package com.kjh.groupware.domain.approval;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.LeavePolicyOverrideRequest;
import com.kjh.groupware.domain.approval.dto.LeavePolicyOverrideResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LeavePolicyOverrideService {
    public static final String SPOUSE_BIRTH_LEAVE = "배우자 출산휴가";
    private final LeavePolicyOverrideRepository repository;
    private final LeavePolicyService leavePolicyService;
    private final EmpRepository empRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final EmployeePermissionService permissionService;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public Optional<LeavePolicyOverride> activeSpouseBirth(Long empId, LocalDate referenceDate) {
        return repository.findFirstByEmpEmpIdAndLeaveTypeAndReferenceDateAndActiveYnOrderByPolicyOverrideIdDesc(
            empId, SPOUSE_BIRTH_LEAVE, referenceDate, "Y"
        );
    }

    @Transactional(readOnly = true)
    public List<LeavePolicyOverrideResponse> list(Long empId) {
        requireManager();
        return repository.findByEmpEmpIdAndLeaveTypeOrderByPolicyOverrideIdDesc(empId, SPOUSE_BIRTH_LEAVE).stream()
            .map(LeavePolicyOverrideResponse::from).toList();
    }

    @Transactional
    public LeavePolicyOverrideResponse grant(LeavePolicyOverrideRequest request, String ip, String agent) {
        Emp actor = requireManager();
        Emp target = empRepository.findByIdForUpdate(request.empId())
            .orElseThrow(() -> BusinessException.notFound("EMP_NOT_FOUND", "직원을 찾을 수 없습니다."));
        LeavePolicy policy = leavePolicyService.resolve(SPOUSE_BIRTH_LEAVE, request.referenceDate());
        if (policy == null || !policy.isAdminOverrideAllowed()) {
            throw BusinessException.badRequest("LEAVE_POLICY_OVERRIDE_NOT_ALLOWED", "현재 정책은 관리자 예외 조정을 허용하지 않습니다.");
        }
        BigDecimal baseDays = policy.getMaxDays() == null ? new BigDecimal("20") : policy.getMaxDays();
        int baseSegments = policy.getMaxSegments() == null ? 4 : policy.getMaxSegments();
        Optional<LeavePolicyOverride> existing = activeSpouseBirth(target.getEmpId(), request.referenceDate());
        Map<String, Object> before = existing.map(this::snapshot).orElse(null);
        existing.ifPresent(value -> value.revoke(actor, "새 예외 조정으로 대체: " + request.reason().trim()));
        if (existing.isPresent()) {
            repository.flush();
        }
        LeavePolicyOverride created = repository.saveAndFlush(new LeavePolicyOverride(
            target, SPOUSE_BIRTH_LEAVE, request.referenceDate(), baseDays, request.maxDays(), baseSegments,
            request.maxSegments(), request.reason().trim(), actor
        ));
        Map<String, Object> after = snapshot(created);
        auditLogService.record(actor.getEmpId(), AuditActionType.UPDATE, "leave_policy_override", created.getPolicyOverrideId(),
            before == null ? null : objectMapper.valueToTree(before), objectMapper.valueToTree(after),
            ip, agent, request.reason().trim(), true);
        return LeavePolicyOverrideResponse.from(created);
    }

    @Transactional
    public LeavePolicyOverrideResponse revoke(Long overrideId, String reason, String ip, String agent) {
        Emp actor = requireManager();
        if (reason == null || reason.isBlank()) {
            throw BusinessException.badRequest("LEAVE_POLICY_OVERRIDE_REASON_REQUIRED", "예외 조정 해제 사유를 입력해 주세요.");
        }
        LeavePolicyOverride value = repository.findById(overrideId)
            .orElseThrow(() -> BusinessException.notFound("LEAVE_POLICY_OVERRIDE_NOT_FOUND", "예외 조정 이력을 찾을 수 없습니다."));
        if (!value.isActive()) {
            throw BusinessException.badRequest("LEAVE_POLICY_OVERRIDE_ALREADY_REVOKED", "이미 해제된 예외 조정입니다.");
        }
        Map<String, Object> before = snapshot(value);
        value.revoke(actor, reason.trim());
        auditLogService.record(actor.getEmpId(), AuditActionType.UPDATE, "leave_policy_override", value.getPolicyOverrideId(),
            objectMapper.valueToTree(before), objectMapper.valueToTree(snapshot(value)), ip, agent, reason.trim(), true);
        return LeavePolicyOverrideResponse.from(value);
    }

    private Emp requireManager() {
        Emp actor = currentEmpProvider.getCurrentEmp();
        if (!permissionService.hasPermission(actor, EmployeePermissionService.LEAVE_ADMIN)) {
            throw BusinessException.forbidden("LEAVE_ADMIN_REQUIRED", "휴가관리자 권한이 필요합니다.");
        }
        return actor;
    }

    private Map<String, Object> snapshot(LeavePolicyOverride value) {
        return Map.of(
            "empId", value.getEmp().getEmpId(), "referenceDate", value.getReferenceDate().toString(),
            "baseMaxDays", value.getBaseMaxDays(), "overrideMaxDays", value.getOverrideMaxDays(),
            "baseMaxSegments", value.getBaseMaxSegments(), "overrideMaxSegments", value.getOverrideMaxSegments(),
            "active", value.isActive(), "reason", value.getReason()
        );
    }
}
