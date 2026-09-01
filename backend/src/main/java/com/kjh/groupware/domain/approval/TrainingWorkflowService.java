package com.kjh.groupware.domain.approval;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.kjh.groupware.domain.approval.dto.ApprovalRequest;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Personal schedules are projections of approved documents; original documents are never rewritten. */
@Service
@RequiredArgsConstructor
public class TrainingWorkflowService {
    public static final String REQUEST = "TRAINING_REQUEST", CHANGE = "TRAINING_CHANGE", REPORT = "TRAINING_REPORT";
    private static final String VERSION = "educationWorkflowVersion", SOURCE = "sourceTrainingApprovalId";
    private static final Set<String> ACTIVE = Set.of("DRAFT", "IN_PROGRESS", "APPROVED");
    private final ApprovalDocumentRepository documents;
    private final EmpRepository employees;
    private final CurrentEmpProvider currentEmpProvider;
    private final ObjectMapper mapper;

    public static boolean isTraining(String code) { return Set.of(REQUEST, CHANGE, REPORT).contains(code == null ? "" : code); }
    public boolean managed(ApprovalDocument d) { return isTraining(d.getTemplateCode()) && "1".equals(fields(d.getFormDataJson()).path(VERSION).asText()); }
    public ApprovalTemplate templateFor(ApprovalDocument existing, ApprovalTemplate fallback) {
        if (existing == null || !isTraining(existing.getTemplateCode()) || managed(existing)
            || !existing.getTemplateCode().equals(fallback.getTemplateCode())
            || existing.getTemplateSnapshotJson() == null || existing.getTemplateSnapshotJson().isBlank()) return fallback;
        JsonNode snapshot = root(existing.getTemplateSnapshotJson());
        return ApprovalTemplate.builder().templateCode(existing.getTemplateCode()).templateName(snapshot.path("templateName").asText(fallback.getTemplateName()))
            .version(existing.getTemplateVersion()).description(snapshot.path("description").asText(""))
            .fieldsJson(snapshot.path("fieldsJson").asText("[]")).printLayoutJson(snapshot.path("printLayoutJson").asText(""))
            .activeYn("Y").build();
    }
    public boolean receiptTerminates(ApprovalDocument d) { return REPORT.equals(d.getTemplateCode()) && managed(d); }

    @Transactional
    public ApprovalRequest normalize(Emp owner, ApprovalDocument existing, ApprovalRequest request, boolean submitting) {
        if (existing != null && managed(existing) && !existing.getTemplateCode().equals(request.templateCode())) throw bad("TRAINING_TEMPLATE_LOCKED", "교육 문서의 양식은 변경할 수 없습니다.");
        if (!isTraining(request.templateCode())) return request;
        // Existing legacy documents keep their original workflow and do not create schedules retroactively.
        if (existing != null && !managed(existing) && existing.getTemplateCode().equals(request.templateCode())) {
            ObjectNode legacy = root(request.formDataJson()); values(legacy).remove(VERSION);
            return withJson(request, legacy.toString());
        }
        lockOwner(owner);
        ObjectNode root = root(request.formDataJson()), values = values(root);
        values.put(VERSION, "1");
        if (submitting && (request.receiverEmpIds() == null || request.receiverEmpIds().size() != 1)) throw bad("TRAINING_RECEIVER_REQUIRED", "주관부서 수신자를 한 명 지정해 주세요.");
        if (REQUEST.equals(request.templateCode())) {
            values.put("requestType", "수강");
            values.remove(List.of(SOURCE, "sourceTrainingRevisionId", "changeAction"));
            if (submitting) { validateCourse(values); required(values, "reason", "신청 사유"); }
        } else {
            long sourceId = positiveId(values, SOURCE);
            if (existing != null && fields(existing.getFormDataJson()).path(SOURCE).asLong() != sourceId) throw bad("TRAINING_SOURCE_LOCKED", "저장한 문서의 원 교육은 변경할 수 없습니다. 별도 문서를 작성해 주세요.");
            List<ApprovalDocument> history = history(owner);
            ApprovalDocument source = source(history, sourceId);
            TrainingScheduleResponse state = project(source, history, existing == null ? null : existing.getApprovalId(), today());
            assertAction(state, REPORT.equals(request.templateCode()));
            long revision = values.path("sourceTrainingRevisionId").asLong(0);
            if (revision != 0 && revision != state.currentApprovalId()) throw bad("TRAINING_SOURCE_CHANGED", "교육 내용이 변경되었습니다. 교육을 다시 선택해 주세요.");
            values.put(SOURCE, Long.toString(sourceId));
            values.put("sourceTrainingRevisionId", Long.toString(state.currentApprovalId()));
            values.put("sourceTrainingDocumentNo", Objects.toString(source.getDocumentNo(), ""));
            values.put("previousTrainingName", state.trainingName()); values.put("previousInstitution", state.institution());
            values.put("previousStartDate", state.startDate().toString()); values.put("previousEndDate", state.endDate().toString());
            if (REPORT.equals(request.templateCode())) {
                copyCourse(values, state);
                values.put("trainingPeriod", state.startDate() + " ~ " + state.endDate());
                if (submitting) required(values, "mainContent", "주요 교육 내용");
            } else {
                String action = required(values, "changeAction", "변경·취소 구분");
                if (!Set.of("CHANGE", "CANCEL").contains(action)) throw bad("TRAINING_CHANGE_ACTION_INVALID", "변경 또는 취소를 선택해 주세요.");
                values.put("requestType", "CANCEL".equals(action) ? "취소" : "변경");
                values.put("reason", "원 신청서: " + Objects.toString(source.getDocumentNo(), Long.toString(sourceId))
                    + "\n변경 전: " + state.trainingName() + " / " + state.institution() + " / " + state.startDate() + " ~ " + state.endDate()
                    + "\n사유: " + values.path("changeReason").asText());
                if ("CANCEL".equals(action)) copyCourse(values, state);
                if (submitting) { required(values, "changeReason", "변경·취소 사유"); validateCourse(values); }
            }
        }
        return withJson(request, root.toString());
    }

    @Transactional
    public void assertResolutionAllowed(ApprovalDocument d) {
        if (!managed(d)) return;
        lockOwner(d.getRequester());
        JsonNode values = fields(d.getFormDataJson());
        if (REQUEST.equals(d.getTemplateCode())) { validateCourse(values); return; }
        List<ApprovalDocument> history = history(d.getRequester());
        TrainingScheduleResponse state = project(source(history, positiveId(values, SOURCE)), history, d.getApprovalId(), today());
        assertAction(state, REPORT.equals(d.getTemplateCode()));
        if (values.path("sourceTrainingRevisionId").asLong() != state.currentApprovalId()) throw bad("TRAINING_SOURCE_CHANGED", "원 교육의 변경 이력을 확인해 주세요.");
    }

    @Transactional(readOnly = true)
    public List<TrainingScheduleResponse> mine(LocalDate from, LocalDate to, Long editingApprovalId) {
        if ((from == null) != (to == null) || (from != null && (to.isBefore(from) || to.isAfter(from.plusYears(1))))) throw bad("TRAINING_RANGE_INVALID", "조회 기간은 시작일 이후 최대 1년으로 지정해 주세요.");
        List<ApprovalDocument> history = history(currentEmpProvider.getCurrentEmp());
        if (editingApprovalId != null && history.stream().noneMatch(d -> d.getApprovalId().equals(editingApprovalId) && d.isEditableDraft())) throw bad("TRAINING_EDIT_TARGET_INVALID", "수정할 수 있는 본인의 교육 문서만 지정할 수 있습니다.");
        return history.stream().filter(d -> REQUEST.equals(d.getTemplateCode()) && approved(d) && managed(d) && !"Y".equals(d.getDeletedYn()))
            .map(d -> project(d, history, editingApprovalId, today()))
            .filter(s -> from == null || (!"CANCELED".equals(s.status()) && !s.endDate().isBefore(from) && !s.startDate().isAfter(to)))
            .sorted(Comparator.comparing(TrainingScheduleResponse::startDate).reversed()).toList();
    }

    TrainingScheduleResponse project(ApprovalDocument source, List<ApprovalDocument> history, Long excluded, LocalDate now) {
        List<ApprovalDocument> linked = history.stream().filter(d -> managed(d) && fields(d.getFormDataJson()).path(SOURCE).asLong() == source.getApprovalId()).toList();
        ApprovalDocument current = linked.stream().filter(d -> CHANGE.equals(d.getTemplateCode()) && approved(d))
            .max(Comparator.comparing(ApprovalDocument::getCompletedAt, Comparator.nullsFirst(Comparator.naturalOrder())).thenComparing(ApprovalDocument::getApprovalId)).orElse(source);
        JsonNode values = fields(current.getFormDataJson());
        LocalDate start = date(values, "trainingStartDate"), end = date(values, "trainingEndDate");
        boolean canceled = "CANCEL".equals(values.path("changeAction").asText());
        List<ApprovalDocument> others = linked.stream().filter(d -> !Objects.equals(d.getApprovalId(), excluded)).toList();
        ApprovalDocument pending = others.stream().filter(d -> CHANGE.equals(d.getTemplateCode()) && !"Y".equals(d.getDeletedYn()) && (d.isDraft() || d.isPending())).findFirst().orElse(null);
        ApprovalDocument report = others.stream().filter(d -> REPORT.equals(d.getTemplateCode()) && ACTIVE.contains(d.getStatus()) && !"Y".equals(d.getDeletedYn())).findFirst().orElse(null);
        boolean reportEverWritten = linked.stream().anyMatch(d -> REPORT.equals(d.getTemplateCode()));
        boolean ended = end.isBefore(now);
        String status = canceled ? "CANCELED" : report != null && approved(report) ? "COMPLETED" : ended ? "ENDED" : start.isAfter(now) ? "PLANNED" : "IN_PROGRESS";
        String reason = canceled ? "취소된 교육입니다." : pending != null ? "변경·취소 문서가 작성 또는 결재 중입니다." : report != null ? "교육 보고서가 이미 작성되었습니다." : !ended ? "교육기간이 끝난 후 보고서를 작성할 수 있습니다." : "";
        boolean changeable = !canceled && pending == null && !reportEverWritten;
        boolean reportable = !canceled && pending == null && report == null && ended;
        if (!changeable && reason.isEmpty() && reportEverWritten) reason = "보고서 작성 이력이 있어 교육을 변경·취소할 수 없습니다.";
        return new TrainingScheduleResponse(source.getApprovalId(), source.getDocumentNo(), current.getApprovalId(), values.path("trainingName").asText(), values.path("institution").asText(), start, end, status, changeable, reportable,
            pending == null ? null : pending.getApprovalId(), report == null ? null : report.getApprovalId(), reason);
    }

    private ApprovalRequest withJson(ApprovalRequest r, String json) {
        return new ApprovalRequest(r.title(), r.content(), r.templateCode(), json, r.priority(), r.agreementEmpIds(), r.approverEmpIds(), r.receiverEmpIds(), r.referenceEmpIds(), r.readerEmpIds(), r.draft());
    }

    private void assertAction(TrainingScheduleResponse state, boolean report) {
        if (report ? !state.reportable() : !state.changeable()) throw bad("TRAINING_ACTION_BLOCKED", state.blockedReason().isBlank() ? "현재 교육에는 이 작업을 진행할 수 없습니다." : state.blockedReason());
    }
    private ApprovalDocument source(List<ApprovalDocument> history, long id) {
        return history.stream().filter(d -> d.getApprovalId() == id && REQUEST.equals(d.getTemplateCode()) && approved(d) && managed(d) && !"Y".equals(d.getDeletedYn())).findFirst()
            .orElseThrow(() -> bad("TRAINING_SOURCE_INVALID", "본인의 최종 결재가 완료된 교육을 선택해 주세요."));
    }
    private List<ApprovalDocument> history(Emp owner) { return documents.findByRequesterAndTemplateCodeIn(owner, List.of(REQUEST, CHANGE, REPORT)); }
    private void lockOwner(Emp owner) { employees.findByIdForUpdate(owner.getEmpId()).orElseThrow(() -> bad("TRAINING_OWNER_NOT_FOUND", "신청자를 확인할 수 없습니다.")); }
    private boolean approved(ApprovalDocument d) { return ApprovalDocument.STATUS_APPROVED.equals(d.getStatus()); }
    private LocalDate today() { return LocalDate.now(ZoneId.of("Asia/Seoul")); }
    private void copyCourse(ObjectNode v, TrainingScheduleResponse s) { v.put("trainingName", s.trainingName()); v.put("institution", s.institution()); v.put("trainingStartDate", s.startDate().toString()); v.put("trainingEndDate", s.endDate().toString()); }
    private void validateCourse(JsonNode v) { required(v, "trainingName", "교육명"); required(v, "institution", "교육기관"); if (date(v, "trainingEndDate").isBefore(date(v, "trainingStartDate"))) throw bad("TRAINING_PERIOD_INVALID", "교육 종료일은 시작일보다 빠를 수 없습니다."); }
    private long positiveId(JsonNode v, String field) { try { long id = Long.parseLong(v.path(field).asText()); if (id > 0) return id; } catch (NumberFormatException ignored) {} throw bad("TRAINING_SOURCE_REQUIRED", "연결할 교육을 선택해 주세요."); }
    private LocalDate date(JsonNode v, String field) { try { return LocalDate.parse(v.path(field).asText()); } catch (RuntimeException e) { throw bad("TRAINING_DATE_REQUIRED", "교육 시작일과 종료일을 정확히 입력해 주세요."); } }
    private String required(JsonNode v, String field, String label) { String text = v.path(field).asText("").trim(); if (text.isBlank()) throw bad("TRAINING_FIELD_REQUIRED", label + "을(를) 입력해 주세요."); return text; }
    private JsonNode fields(String json) { ObjectNode r = root(json); return r.has("fields") ? r.path("fields") : r; }
    private ObjectNode values(ObjectNode r) { if (!r.has("fields")) { ObjectNode copy = r.deepCopy(); r.removeAll(); r.set("fields", copy); } if (!(r.get("fields") instanceof ObjectNode v)) throw bad("TRAINING_FORM_INVALID", "교육 양식 데이터가 올바르지 않습니다."); return v; }
    private ObjectNode root(String json) { try { JsonNode p = json == null || json.isBlank() ? mapper.createObjectNode() : mapper.readTree(json); if (p instanceof ObjectNode object) return object; } catch (Exception ignored) {} throw bad("TRAINING_FORM_INVALID", "교육 양식 데이터가 올바르지 않습니다."); }
    private BusinessException bad(String code, String message) { return BusinessException.badRequest(code, message); }
}
