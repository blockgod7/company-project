package com.kjh.groupware.domain.approval;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.LeaveAdminCaseResponse;
import com.kjh.groupware.domain.approval.dto.LeaveAdminReasonRequest;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.global.audit.*;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class ApprovalLeaveAdminCaseService {
    private static final Set<String> COMP_STATUSES = Set.of("BEFORE_SUBMISSION", "SUBMITTED", "APPROVED", "REJECTED");
    private final ApprovalLeaveAdminCaseRepository repository;
    private final ApprovalDocumentRepository documentRepository;
    private final ApprovalLeaveUsageService leaveUsageService;
    private final CurrentEmpProvider currentEmpProvider;
    private final EmployeePermissionService permissionService;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public LeaveAdminCaseResponse get(Long approvalId) {
        requireManager();
        ApprovalDocument document = document(approvalId);
        return repository.findByApproval(document).map(LeaveAdminCaseResponse::from)
            .orElse(new LeaveAdminCaseResponse(approvalId, "UNPAID", null, "BEFORE_SUBMISSION", null));
    }

    @Transactional
    public LeaveAdminCaseResponse sickPay(Long approvalId, LeaveAdminReasonRequest request, String ip, String agent) {
        Emp actor = requireManager(); ApprovalDocument document = document(approvalId); requireType(document, "병가");
        if (request.paid() == null) throw BusinessException.badRequest("SICK_PAY_VALUE_REQUIRED", "병가 유급 여부를 선택해 주세요.");
        ApprovalLeaveAdminCase value = caseFor(document); Map<String,Object> before = snapshot(value);
        value.updateSickPay(request.paid(), request.reason().trim(), actor);
        audit(actor, value, before, request.reason(), ip, agent);
        notificationService.notifyEmp(document.getRequester().getEmpId(), "병가 급여 구분 변경", "병가가 " + (request.paid() ? "유급" : "무급") + "으로 처리되었습니다. 사유: " + request.reason().trim(), "APPROVAL", approvalId);
        return LeaveAdminCaseResponse.from(value);
    }

    @Transactional
    public LeaveAdminCaseResponse workersComp(Long approvalId, LeaveAdminReasonRequest request, String ip, String agent) {
        Emp actor = requireManager(); ApprovalDocument document = document(approvalId); requireType(document, "산재요양");
        String status = request.status() == null ? "" : request.status().trim().toUpperCase();
        if (!COMP_STATUSES.contains(status)) throw BusinessException.badRequest("WORKERS_COMP_STATUS_INVALID", "산재 접수 상태를 확인해 주세요.");
        ApprovalLeaveAdminCase value = caseFor(document); Map<String,Object> before = snapshot(value);
        value.updateWorkersComp(status, request.reason().trim(), actor);
        audit(actor, value, before, request.reason(), ip, agent);
        notificationService.notifyEmp(document.getRequester().getEmpId(), "산재 접수 상태 변경", "산재 접수 상태가 " + status + "로 변경되었습니다. 사유: " + request.reason().trim(), "APPROVAL", approvalId);
        return LeaveAdminCaseResponse.from(value);
    }

    private void requireType(ApprovalDocument doc, String type) {
        if (leaveUsageService.selectionsFor(doc).stream().noneMatch(item -> type.equals(item.type())))
            throw BusinessException.badRequest("LEAVE_ADMIN_CASE_TYPE_INVALID", type + "가 포함된 휴가계만 처리할 수 있습니다.");
    }
    private ApprovalLeaveAdminCase caseFor(ApprovalDocument doc) { return repository.findByApproval(doc).orElseGet(() -> repository.saveAndFlush(new ApprovalLeaveAdminCase(doc))); }
    private ApprovalDocument document(Long id) { return documentRepository.findById(id).orElseThrow(() -> BusinessException.notFound("APPROVAL_NOT_FOUND", "전자결재 문서를 찾을 수 없습니다.")); }
    private Emp requireManager() { Emp actor=currentEmpProvider.getCurrentEmp(); if(!permissionService.hasPermission(actor, EmployeePermissionService.LEAVE_ADMIN)) throw BusinessException.forbidden("LEAVE_ADMIN_REQUIRED","휴가관리자 권한이 필요합니다."); return actor; }
    private Map<String,Object> snapshot(ApprovalLeaveAdminCase v) { Map<String,Object> m=new LinkedHashMap<>(); m.put("sickPayType",v.getSickPayType()); m.put("sickPayReason",v.getSickPayReason()); m.put("workersCompStatus",v.getWorkersCompStatus()); m.put("workersCompReason",v.getWorkersCompReason()); return m; }
    private void audit(Emp actor, ApprovalLeaveAdminCase v, Map<String,Object> before, String reason, String ip, String agent) { auditLogService.record(actor.getEmpId(), AuditActionType.UPDATE, "approval_leave_admin_case", v.getLeaveAdminCaseId(), objectMapper.valueToTree(before), objectMapper.valueToTree(snapshot(v)), ip, agent, reason.trim(), true); }
}
