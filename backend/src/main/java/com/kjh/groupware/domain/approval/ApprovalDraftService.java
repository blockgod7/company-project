package com.kjh.groupware.domain.approval;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.ApprovalRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.Year;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalDraftService {

    private final ApprovalDocumentRepository documentRepository;
    private final ApprovalLineRepository lineRepository;
    private final ApprovalTemplateRepository templateRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;
    private final ApprovalPermissionService permissionService;
    private final ApprovalLinePolicyService linePolicyService;
    private final ApprovalEquipmentProposalService equipmentProposalService;
    private final ApprovalLeaveUsageService leaveUsageService;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public ApprovalResponse create(ApprovalRequest request, String ipAddress, String userAgent) {
        Emp requester = currentEmpProvider.getCurrentEmp();
        ApprovalTemplate template = activeTemplate(request.templateCode());
        boolean draft = Boolean.TRUE.equals(request.draft());
        linePolicyService.validateLineSelection(requester, request, !draft);
        validateRequiredFields(template, request, !draft);
        if (!draft && ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE.equals(template.getTemplateCode())) {
            leaveUsageService.assertNoCompletedLeaveOverlap(requester, null, request.formDataJson());
        }
        if (!draft && ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE.equals(template.getTemplateCode())) {
            leaveUsageService.assertLeaveCancelTargetsApproved(requester, null, request.formDataJson());
        }

        String title = hasText(request.title()) ? request.title() : template.getTemplateName();
        String content = request.content() == null ? summarizeFormData(request.formDataJson()) : request.content();
        String documentNo = draft ? null : generateDocumentNo(template.getTemplateCode());
        ApprovalDocument document = documentRepository.save(ApprovalDocument.builder()
            .documentNo(documentNo)
            .title(title)
            .content(content)
            .templateCode(template.getTemplateCode())
            .templateVersion(template.getVersion())
            .templateSnapshotJson(templateSnapshot(template))
            .formDataJson(request.formDataJson())
            .searchText(buildSearchText(documentNo, title, requester, template, request.formDataJson()))
            .priority(request.priority())
            .requester(requester)
            .build());

        if (draft) {
            document.saveAsDraft();
            linePolicyService.createLines(document, request, false);
        } else {
            linePolicyService.createLines(document, request, true);
            document.submit(documentNo, buildSearchText(documentNo, title, requester, template, request.formDataJson()), linePolicyService.hasAgreement(request));
            notifyInitialPendingLines(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
        }

        equipmentProposalService.syncFromApprovalRequest(document, request);
        auditApproval(requester, draft ? AuditActionType.CREATE : AuditActionType.SUBMIT, document, draft ? "임시저장" : "상신", true, ipAddress, userAgent);
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), requester);
    }

    @Transactional
    public ApprovalResponse createDraft(ApprovalRequest request, String ipAddress, String userAgent) {
        ApprovalRequest draftRequest = new ApprovalRequest(
            request.title(),
            request.content(),
            request.templateCode(),
            request.formDataJson(),
            request.priority(),
            request.agreementEmpIds(),
            request.approverEmpIds(),
            request.receiverEmpIds(),
            request.referenceEmpIds(),
            request.readerEmpIds(),
            true
        );
        return create(draftRequest, ipAddress, userAgent);
    }

    @Transactional
    public ApprovalResponse updateDraft(Long approvalId, ApprovalRequest request, String ipAddress, String userAgent) {
        Emp requester = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getActiveDocumentForUpdate(approvalId);
        assertRequester(requester, document);
        if (!document.isEditableDraft()) {
            throw BusinessException.badRequest("APPROVAL_NOT_EDITABLE", "수정할 수 없는 문서입니다.");
        }
        linePolicyService.validateLineSelection(requester, request, false);

        ApprovalTemplate template = activeTemplate(request.templateCode());
        validateRequiredFields(template, request, false);
        String title = hasText(request.title()) ? request.title() : template.getTemplateName();
        String content = request.content() == null ? summarizeFormData(request.formDataJson()) : request.content();
        document.updateDraft(
            title,
            content,
            template.getTemplateCode(),
            template.getVersion(),
            templateSnapshot(template),
            request.formDataJson(),
            buildSearchText(document.getDocumentNo(), title, requester, template, request.formDataJson()),
            request.priority()
        );
        document.saveAsDraft();
        lineRepository.deleteByDocument(document);
        lineRepository.flush();
        linePolicyService.createLines(document, request, false);
        equipmentProposalService.syncFromApprovalRequest(document, request);
        auditApproval(requester, AuditActionType.UPDATE, document, "결재선 변경", true, ipAddress, userAgent);
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), requester);
    }

    @Transactional
    public ApprovalResponse submit(Long approvalId, ApprovalRequest request, String ipAddress, String userAgent) {
        Emp requester = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getActiveDocumentForUpdate(approvalId);
        assertRequester(requester, document);
        if (!document.isEditableDraft()) {
            throw BusinessException.badRequest("APPROVAL_ALREADY_SUBMITTED", "이미 처리된 문서입니다.");
        }
        linePolicyService.validateLineSelection(requester, request, true);

        ApprovalTemplate template = activeTemplate(request.templateCode());
        validateRequiredFields(template, request, true);
        if (ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE.equals(template.getTemplateCode())) {
            leaveUsageService.assertNoCompletedLeaveOverlap(requester, document.getApprovalId(), request.formDataJson());
        }
        if (ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE.equals(template.getTemplateCode())) {
            leaveUsageService.assertLeaveCancelTargetsApproved(requester, document.getApprovalId(), request.formDataJson());
        }
        String title = hasText(request.title()) ? request.title() : template.getTemplateName();
        String content = request.content() == null ? summarizeFormData(request.formDataJson()) : request.content();
        String documentNo = hasText(document.getDocumentNo()) ? document.getDocumentNo() : generateDocumentNo(template.getTemplateCode());
        document.updateDraft(
            title,
            content,
            template.getTemplateCode(),
            template.getVersion(),
            templateSnapshot(template),
            request.formDataJson(),
            buildSearchText(documentNo, title, requester, template, request.formDataJson()),
            request.priority()
        );
        lineRepository.deleteByDocument(document);
        lineRepository.flush();
        linePolicyService.createLines(document, request, true);
        document.submit(documentNo, buildSearchText(documentNo, title, requester, template, request.formDataJson()), linePolicyService.hasAgreement(request));
        equipmentProposalService.syncFromApprovalRequest(document, request);
        notifyInitialPendingLines(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
        auditApproval(requester, AuditActionType.SUBMIT, document, "상신", true, ipAddress, userAgent);
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), requester);
    }

    private ApprovalTemplate activeTemplate(String templateCode) {
        return templateRepository.findTopByTemplateCodeAndActiveYnOrderByVersionDesc(templateCode, "Y")
            .orElseGet(() -> {
                if (ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE.equals(templateCode)) {
                    return ApprovalTemplate.builder()
                        .templateCode(ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE)
                        .templateName("휴가 취소계")
                        .version(1)
                        .description("승인 완료된 휴가 취소 신청")
                        .fieldsJson("[]")
                        .activeYn("Y")
                        .sortOrder(0)
                        .build();
                }
                throw BusinessException.badRequest("APPROVAL_TEMPLATE_NOT_FOUND", "Active approval template was not found");
            });
    }

    private ApprovalDocument getActiveDocumentForUpdate(Long approvalId) {
        ApprovalDocument document = documentRepository.findByIdForUpdate(approvalId)
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_NOT_FOUND", "Approval document was not found"));
        if ("Y".equals(document.getDeletedYn())) {
            throw BusinessException.notFound("APPROVAL_NOT_FOUND", "Approval document was not found");
        }
        return document;
    }

    private void assertRequester(Emp currentEmp, ApprovalDocument document) {
        if (!document.getRequester().getEmpId().equals(currentEmp.getEmpId())) {
            throw BusinessException.forbidden("APPROVAL_FORBIDDEN", "Only the requester can change this approval document");
        }
    }

    private void validateRequiredFields(ApprovalTemplate template, ApprovalRequest request, boolean enforceRequired) {
        if (!enforceRequired || !hasText(template.getFieldsJson())) {
            return;
        }
        JsonNode fields = readJson(template.getFieldsJson(), "APPROVAL_TEMPLATE_INVALID_FIELDS", "Approval template fields JSON is invalid");
        if (!fields.isArray()) {
            return;
        }
        JsonNode formData = hasText(request.formDataJson())
            ? readJson(request.formDataJson(), "APPROVAL_FORM_INVALID_JSON", "Approval form data JSON is invalid")
            : objectMapper.createObjectNode();
        JsonNode nestedFields = formData.path("fields");
        for (JsonNode field : fields) {
            if (!isRequiredField(field)) {
                continue;
            }
            String name = field.path("name").asText("");
            if (!hasText(name)) {
                continue;
            }
            JsonNode value = nestedFields.has(name) ? nestedFields.get(name) : formData.get(name);
            if (isBlankFieldValue(value)) {
                String label = field.path("label").asText(name);
                throw BusinessException.badRequest("APPROVAL_REQUIRED_FIELD_MISSING", label + " 필수값을 입력해 주세요.");
            }
        }
    }

    private JsonNode readJson(String json, String code, String message) {
        try {
            return objectMapper.readTree(json);
        } catch (JsonProcessingException ex) {
            throw BusinessException.badRequest(code, message);
        }
    }

    private boolean isRequiredField(JsonNode field) {
        JsonNode required = field.get("required");
        if (required == null) {
            return false;
        }
        if (required.isBoolean()) {
            return required.asBoolean();
        }
        return "Y".equalsIgnoreCase(required.asText()) || "true".equalsIgnoreCase(required.asText());
    }

    private boolean isBlankFieldValue(JsonNode value) {
        if (value == null || value.isNull() || value.isMissingNode()) {
            return true;
        }
        if (value.isTextual()) {
            return !hasText(value.asText());
        }
        if (value.isArray() || value.isObject()) {
            return value.isEmpty();
        }
        return false;
    }

    private synchronized String generateDocumentNo(String templateCode) {
        String prefix = switch (templateCode) {
            case "LEAVE" -> "LEV";
            case "LEAVE_CANCEL" -> "LVC";
            case "PURCHASE" -> "PUR";
            case "TRAINING_REQUEST", "TRAINING_REPORT" -> "EDU";
            case ApprovalEquipmentProposal.TEMPLATE_CODE -> "EQP";
            case ApprovalEquipmentProposal.MOLD_FIXTURE_TEMPLATE_CODE -> "MFP";
            default -> "APP";
        };
        String prefixYear = prefix + "-" + Year.now().getValue() + "-";
        jdbcTemplate.query("select pg_advisory_xact_lock(hashtext(?))", ps -> ps.setString(1, prefixYear), rs -> null);
        return prefixYear + String.format("%06d", documentRepository.findMaxDocumentSequence(prefixYear) + 1);
    }

    private String templateSnapshot(ApprovalTemplate template) {
        try {
            return objectMapper.writeValueAsString(Map.of(
                "templateCode", template.getTemplateCode(),
                "templateName", template.getTemplateName(),
                "version", template.getVersion(),
                "description", template.getDescription() == null ? "" : template.getDescription(),
                "fieldsJson", template.getFieldsJson(),
                "printLayoutJson", template.getPrintLayoutJson() == null ? "" : template.getPrintLayoutJson()
            ));
        } catch (JsonProcessingException ex) {
            throw BusinessException.badRequest("TEMPLATE_SNAPSHOT_FAILED", "Failed to snapshot approval template");
        }
    }

    private String buildSearchText(String documentNo, String title, Emp requester, ApprovalTemplate template, String formDataJson) {
        return String.join(" ", safe(documentNo), safe(title), safe(requester.getEmpName()), safe(template.getTemplateName()), summarizeFormData(formDataJson)).trim();
    }

    private String summarizeFormData(String formDataJson) {
        if (!hasText(formDataJson)) {
            return "";
        }
        try {
            Object parsed = objectMapper.readValue(formDataJson, Object.class);
            if (parsed instanceof Map<?, ?> map && map.containsKey("content")) {
                Object content = map.get("content");
                return content == null ? "" : String.valueOf(content);
            }
            return String.valueOf(parsed);
        } catch (JsonProcessingException ex) {
            return formDataJson;
        }
    }

    private ApprovalResponse response(ApprovalDocument document, List<ApprovalLine> lines, Emp currentEmp) {
        return ApprovalResponse.from(document, lines, permissionService.permissions(currentEmp, document, lines));
    }

    private void notifyInitialPendingLines(ApprovalDocument document, List<ApprovalLine> lines) {
        lines.stream()
            .filter(line -> ApprovalLine.STATUS_PENDING.equals(line.getStatus()))
            .forEach(line -> notificationService.notifyEmp(
                line.getAssignedEmp().getEmpId(),
                line.isAgreement() ? "전자결재 합의 요청" : "전자결재 요청",
                line.isAgreement() ? "합의 요청 문서가 도착했습니다." : "결재 요청 문서가 도착했습니다.",
                "APPROVAL",
                document.getApprovalId()
            ));
    }

    private void auditApproval(
        Emp emp,
        AuditActionType actionType,
        ApprovalDocument document,
        String reason,
        boolean success,
        String ipAddress,
        String userAgent
    ) {
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("approvalId", document.getApprovalId());
        payload.put("documentNo", document.getDocumentNo());
        payload.put("userId", emp == null ? null : emp.getEmpId());
        payload.put("userName", emp == null ? null : emp.getEmpName());
        payload.put("status", document.getStatus());
        payload.put("currentStage", document.getCurrentStage());
        auditLogService.record(
            emp == null ? null : emp.getEmpId(),
            actionType,
            "approval_document",
            document.getApprovalId(),
            null,
            objectMapper.valueToTree(payload),
            ipAddress,
            userAgent,
            reason,
            success
        );
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
