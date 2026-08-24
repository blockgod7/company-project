package com.kjh.groupware.domain.work;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.ApprovalDocument;
import com.kjh.groupware.domain.approval.ApprovalHolidayRepository;
import com.kjh.groupware.domain.approval.CompTimeLedgerService;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.domain.emp.dto.EmpResponse;
import com.kjh.groupware.domain.work.dto.WorkScheduleResponse;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkRequestService {
    public static final String TEMPLATE = "WORK_REQUEST";
    public static final String EMERGENCY_TEMPLATE = "EMERGENCY_CALL_REQUEST";
    public static final String CHANGE_TEMPLATE = "WORK_REQUEST_CHANGE";
    private final WorkRequestEntryRepository entryRepository;
    private final WorkRequestChangeRepository changeRepository;
    private final EmpRepository empRepository;
    private final ApprovalHolidayRepository holidayRepository;
    private final EmployeePermissionService permissionService;
    private final CurrentEmpProvider currentEmpProvider;
    private final CompTimeLedgerService compTimeLedgerService;
    private final ObjectMapper objectMapper;

    @Transactional
    public void prepareSubmission(ApprovalDocument document) {
        if (isEntryTemplate(document.getTemplateCode())) prepareEntries(document);
        if (CHANGE_TEMPLATE.equals(document.getTemplateCode())) prepareChanges(document);
    }

    private void prepareEntries(ApprovalDocument document) {
        entryRepository.deleteByApproval(document);
        JsonNode rows = formArray(document.getFormDataJson(), "workEntriesJson");
        if (rows.isEmpty()) throw bad("WORK_ENTRY_REQUIRED", "근무 신청 대상자를 한 명 이상 입력해 주세요.");
        Emp actor = document.getRequester();
        boolean delegate = permissionService.hasPermission(actor, EmployeePermissionService.WORK_REQUEST_DELEGATE);
        Set<String> duplicate = new HashSet<>();
        for (JsonNode row : rows) {
            Emp emp = empRepository.findById(row.path("empId").asLong()).orElseThrow(() -> bad("EMP_NOT_FOUND", "근무 대상자를 찾을 수 없습니다."));
            if (!actor.getEmpId().equals(emp.getEmpId()) && !delegate) throw BusinessException.forbidden("WORK_DELEGATE_REQUIRED", "본인 외 직원은 근무 대리·일괄신청 권한이 필요합니다.");
            if (!actor.getEmpId().equals(emp.getEmpId()) && !sameDepartment(actor, emp)) throw BusinessException.forbidden("WORK_DEPT_SCOPE_REQUIRED", "같은 소속 부서 직원만 근무를 대리·일괄신청할 수 있습니다.");
            String type = required(row, "workType", "근무구분");
            LocalDate date = date(required(row, "workDate", "근무일자"));
            LocalTime start = time(required(row, "startTime", "시작시간"));
            LocalTime end = time(required(row, "endTime", "종료시간"));
            int minutes = duration(start, end);
            String content = required(row, "workContent", "근무내용");
            boolean comp = row.path("compTime").asBoolean(false);
            validateSubmissionType(document.getTemplateCode(), type);
            validateType(emp, type, date, comp);
            String key = emp.getEmpId() + ":" + date + ":" + start + ":" + end;
            if (!duplicate.add(key)) throw bad("WORK_ENTRY_DUPLICATED", "동일한 직원·날짜·시간의 근무가 중복되었습니다.");
            entryRepository.save(new WorkRequestEntry(document, emp, actor, type, date, start, end, minutes, content, comp));
        }
    }

    private void prepareChanges(ApprovalDocument document) {
        changeRepository.deleteByApproval(document);
        JsonNode rows = formArray(document.getFormDataJson(), "workChangesJson");
        if (rows.isEmpty()) throw bad("WORK_CHANGE_REQUIRED", "변경 또는 취소할 근무를 선택해 주세요.");
        Emp actor = document.getRequester();
        boolean delegate = permissionService.hasPermission(actor, EmployeePermissionService.WORK_REQUEST_DELEGATE);
        for (JsonNode row : rows) {
            WorkRequestEntry source = entryRepository.findById(row.path("sourceWorkEntryId").asLong())
                .orElseThrow(() -> bad("WORK_ENTRY_NOT_FOUND", "원 근무 일정을 찾을 수 없습니다."));
            if (!WorkRequestEntry.PLANNED.equals(source.getStatus())) throw bad("WORK_ENTRY_NOT_CHANGEABLE", "근무예정 상태만 변경하거나 취소할 수 있습니다.");
            if (!actor.getEmpId().equals(source.getEmp().getEmpId()) && !delegate) throw BusinessException.forbidden("WORK_DELEGATE_REQUIRED", "다른 직원의 근무 변경·취소에는 대리신청 권한이 필요합니다.");
            if (!actor.getEmpId().equals(source.getEmp().getEmpId()) && !sameDepartment(actor, source.getEmp())) throw BusinessException.forbidden("WORK_DEPT_SCOPE_REQUIRED", "같은 소속 부서 직원의 근무만 변경하거나 취소할 수 있습니다.");
            String action = required(row, "actionType", "처리구분");
            if (!List.of("CANCEL", "CHANGE").contains(action)) throw bad("WORK_CHANGE_ACTION_INVALID", "처리구분이 올바르지 않습니다.");
            String reason = required(row, "reason", "변경·취소 사유");
            LocalDate newDate = null; LocalTime newStart = null; LocalTime newEnd = null; String newContent = null; Boolean newComp = null;
            if ("CHANGE".equals(action)) {
                newDate = date(required(row, "newWorkDate", "변경 근무일자"));
                newStart = time(required(row, "newStartTime", "변경 시작시간"));
                newEnd = time(required(row, "newEndTime", "변경 종료시간")); duration(newStart, newEnd);
                newContent = required(row, "newWorkContent", "변경 근무내용"); newComp = row.path("newCompTime").asBoolean(false);
                validateType(source.getEmp(), source.getWorkType(), newDate, newComp);
            }
            source.markCancelPending();
            changeRepository.save(new WorkRequestChange(document, source, action, newDate, newStart, newEnd, newContent, newComp, reason));
        }
    }

    @Transactional
    public void onFinalApproval(ApprovalDocument document) {
        LocalDate today = LocalDate.now();
        if (isEntryTemplate(document.getTemplateCode())) {
            for (WorkRequestEntry entry : entryRepository.findByApprovalOrderByWorkEntryIdAsc(document)) {
                entry.approve(today); if (WorkRequestEntry.COMPLETED.equals(entry.getStatus())) compTimeLedgerService.grantFromCompletedWork(entry);
            }
        }
        if (CHANGE_TEMPLATE.equals(document.getTemplateCode())) {
            for (WorkRequestChange change : changeRepository.findByApprovalOrderByWorkChangeIdAsc(document)) {
                WorkRequestEntry source = change.getSource(); source.cancel(document); change.approve();
                if ("CHANGE".equals(change.getActionType())) {
                    int minutes = duration(change.getNewStartTime(), change.getNewEndTime());
                    WorkRequestEntry replacement = new WorkRequestEntry(document, source.getEmp(), document.getRequester(), source.getWorkType(),
                        change.getNewWorkDate(), change.getNewStartTime(), change.getNewEndTime(), minutes, change.getNewWorkContent(), "Y".equals(change.getNewCompTimeYn()));
                    replacement.approve(today); entryRepository.save(replacement);
                    if (WorkRequestEntry.COMPLETED.equals(replacement.getStatus())) compTimeLedgerService.grantFromCompletedWork(replacement);
                }
            }
        }
    }

    @Transactional
    public void onRejectedOrWithdrawn(ApprovalDocument document, boolean rejected) {
        if (isEntryTemplate(document.getTemplateCode())) entryRepository.deleteByApproval(document);
        if (CHANGE_TEMPLATE.equals(document.getTemplateCode())) {
            for (WorkRequestChange change : changeRepository.findByApprovalOrderByWorkChangeIdAsc(document)) {
                change.getSource().restoreAfterChange(LocalDate.now());
                if (WorkRequestEntry.COMPLETED.equals(change.getSource().getStatus())) compTimeLedgerService.grantFromCompletedWork(change.getSource());
                change.resolve(rejected);
            }
        }
    }

    @Scheduled(cron = "0 5 0 * * *", zone = "Asia/Seoul")
    @Transactional
    public void completePastSchedules() {
        for (WorkRequestEntry entry : entryRepository.dueForCompletion(LocalDate.now())) {
            entry.complete(); compTimeLedgerService.grantFromCompletedWork(entry);
        }
    }

    @Transactional(readOnly = true)
    public List<WorkScheduleResponse> mine(LocalDate from, LocalDate to) {
        Emp actor = currentEmpProvider.getCurrentEmp();
        return entryRepository.calendar(actor.getEmpId(), from, to).stream().map(WorkScheduleResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<WorkScheduleResponse> changeable(Long empId, boolean all) {
        Emp actor = currentEmpProvider.getCurrentEmp(); Long target = empId == null ? actor.getEmpId() : empId;
        boolean delegate = permissionService.hasPermission(actor, EmployeePermissionService.WORK_REQUEST_DELEGATE);
        if (all) {
            if (!delegate) throw BusinessException.forbidden("WORK_DELEGATE_REQUIRED", "전체 직원 일정을 조회할 권한이 없습니다.");
            return entryRepository.findByStatusOrderByWorkDateAscStartTimeAsc(WorkRequestEntry.PLANNED).stream()
                .filter(entry -> sameDepartment(actor, entry.getEmp()))
                .map(WorkScheduleResponse::from).toList();
        }
        if (!actor.getEmpId().equals(target) && !delegate)
            throw BusinessException.forbidden("WORK_DELEGATE_REQUIRED", "다른 직원의 일정을 조회할 권한이 없습니다.");
        if (!actor.getEmpId().equals(target)) {
            Emp targetEmp = empRepository.findById(target).orElseThrow(() -> bad("EMP_NOT_FOUND", "근무 대상자를 찾을 수 없습니다."));
            if (!sameDepartment(actor, targetEmp)) throw BusinessException.forbidden("WORK_DEPT_SCOPE_REQUIRED", "같은 소속 부서 직원의 일정만 조회할 수 있습니다.");
        }
        return entryRepository.changeable(target).stream().map(WorkScheduleResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<EmpResponse> candidates() {
        Emp actor = currentEmpProvider.getCurrentEmp();
        if (!permissionService.hasPermission(actor, EmployeePermissionService.WORK_REQUEST_DELEGATE)) return List.of(EmpResponse.from(actor));
        Long actorDeptId = actor.getDept() == null ? null : actor.getDept().getDeptId();
        if (actorDeptId == null) return List.of(EmpResponse.from(actor));
        return empRepository.findAllEmployeesForManagement().stream().filter(e -> "ACTIVE".equals(e.getStatus()) && "Y".equals(e.getUseYn()))
            .filter(e -> e.getDept() != null && Objects.equals(e.getDept().getDeptId(), actorDeptId))
            .sorted(Comparator.comparing(Emp::getEmpName))
            .map(EmpResponse::from).toList();
    }

    private void validateSubmissionType(String templateCode, String type) {
        if (TEMPLATE.equals(templateCode) && !List.of("OVERTIME", "SPECIAL").contains(type))
            throw bad("WORK_TYPE_INVALID", "근무신청서는 잔업 또는 특근만 신청할 수 있습니다.");
        if (EMERGENCY_TEMPLATE.equals(templateCode) && !"EMERGENCY_CALL".equals(type))
            throw bad("WORK_TYPE_INVALID", "비상호출 신청서에는 비상호출 근무만 신청할 수 있습니다.");
    }

    private void validateType(Emp emp, String type, LocalDate date, boolean comp) {
        if (!List.of("OVERTIME", "SPECIAL", "EMERGENCY_CALL").contains(type)) throw bad("WORK_TYPE_INVALID", "근무구분이 올바르지 않습니다.");
        if ("MANAGEMENT".equals(emp.getWorkCategory()) && "OVERTIME".equals(type)) throw bad("WORK_TYPE_NOT_ALLOWED", "관리직은 잔업 신청 대상이 아닙니다.");
        boolean weekend = date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY;
        boolean holiday = holidayRepository.findByHolidayDateAndActiveYn(date, "Y").isPresent();
        if ("SPECIAL".equals(type) && !weekend && !holiday) throw bad("SPECIAL_WORK_DATE_INVALID", "특근은 주말 또는 등록된 공휴일에만 신청할 수 있습니다.");
        if (comp && !"SPECIAL".equals(type)) throw bad("COMP_TIME_SPECIAL_ONLY", "대체근무는 주말·공휴일 특근에만 선택할 수 있습니다.");
    }

    private boolean isEntryTemplate(String templateCode) {
        return TEMPLATE.equals(templateCode) || EMERGENCY_TEMPLATE.equals(templateCode);
    }

    private boolean sameDepartment(Emp left, Emp right) {
        Long leftDeptId = left.getDept() == null ? null : left.getDept().getDeptId();
        Long rightDeptId = right.getDept() == null ? null : right.getDept().getDeptId();
        return leftDeptId != null && Objects.equals(leftDeptId, rightDeptId);
    }

    private JsonNode formArray(String json, String name) {
        try {
            JsonNode value = objectMapper.readTree(json).path("fields").path(name);
            if (value.isTextual()) value = objectMapper.readTree(value.asText());
            if (!value.isArray()) throw bad("WORK_FORM_INVALID", "근무신청 내역 형식이 올바르지 않습니다.");
            return value;
        } catch (BusinessException e) { throw e; }
        catch (Exception e) { throw bad("WORK_FORM_INVALID", "근무신청 내역을 읽을 수 없습니다."); }
    }
    private String required(JsonNode row, String field, String label) { String value = row.path(field).asText("").trim(); if (value.isEmpty()) throw bad("WORK_FIELD_REQUIRED", label + "을(를) 입력해 주세요."); return value; }
    private LocalDate date(String value) { try { return LocalDate.parse(value); } catch (Exception e) { throw bad("WORK_DATE_INVALID", "근무일자가 올바르지 않습니다."); } }
    private LocalTime time(String value) { try { return LocalTime.parse(value); } catch (Exception e) { throw bad("WORK_TIME_INVALID", "근무시간이 올바르지 않습니다."); } }
    private int duration(LocalTime start, LocalTime end) { int value = (int) Duration.between(start, end).toMinutes(); if (value <= 0) value += 1440; if (value <= 0 || value > 1440) throw bad("WORK_TIME_RANGE_INVALID", "근무시간 범위가 올바르지 않습니다."); return value; }
    private BusinessException bad(String code, String message) { return BusinessException.badRequest(code, message); }
}
