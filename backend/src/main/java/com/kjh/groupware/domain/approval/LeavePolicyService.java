package com.kjh.groupware.domain.approval;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.LeavePolicyRequest;
import com.kjh.groupware.domain.approval.dto.LeavePolicyResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LeavePolicyService {

    private static final Set<String> PAY_TYPES = Set.of("PAID", "UNPAID", "SEPARATE");
    private static final Set<String> UNIT_TYPES = Set.of("FULL_DAY", "HALF_DAY", "BOTH");
    private static final Set<String> GENDER_TYPES = Set.of("ALL", "MALE", "FEMALE");
    private static final Set<String> REMOVED_LEAVE_TYPES = Set.of("자녀돌봄휴가", "특별유급휴가", "가족돌봄휴가");
    private static final LocalDate DEFAULT_FROM = LocalDate.of(2000, 1, 1);
    private static final List<String> SELECTABLE_ORDER = List.of(
        "연차", "오전반차", "오후반차", "하계휴가", "공가", "공가(오전)", "공가(오후)",
        "경조", "대체휴무", "병가", "산재요양", "무급휴가", "배우자 출산휴가",
        "출산전후휴가", "여성휴가", "유산·사산휴가", "난임치료휴가", "육아휴직"
    );

    private final LeavePolicyRepository repository;
    private final CurrentEmpProvider currentEmpProvider;
    private final EmployeePermissionService employeePermissionService;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<LeavePolicyResponse> manageList() {
        requireManager();
        return repository.findAllByOrderByLeaveTypeAscEffectiveFromDesc().stream().map(LeavePolicyResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<LeavePolicyResponse> activeList(LocalDate date) {
        Map<String, LeavePolicy> latest = new LinkedHashMap<>();
        repository.findAllEffective(date == null ? LocalDate.now() : date)
            .forEach(policy -> latest.putIfAbsent(policy.getLeaveType(), policy));
        return latest.values().stream()
            .filter(LeavePolicy::isActive)
            .filter(policy -> !REMOVED_LEAVE_TYPES.contains(policy.getLeaveType()))
            .sorted(Comparator.comparingInt(this::selectableOrder).thenComparing(LeavePolicy::getLeaveType))
            .map(LeavePolicyResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public LeavePolicy resolve(String leaveType, LocalDate date) {
        LocalDate effectiveDate = date == null ? LocalDate.now() : date;
        return repository.findEffective(leaveType, effectiveDate).stream()
            .findFirst()
            .orElseGet(() -> builtIn(leaveType));
    }

    @Transactional
    public LeavePolicyResponse create(LeavePolicyRequest request, String ipAddress, String userAgent) {
        Emp editor = requireManager();
        validate(request, -1L);
        LeavePolicy policy = repository.saveAndFlush(toEntity(request, editor));
        audit(editor, AuditActionType.CREATE, policy, null, ipAddress, userAgent);
        return LeavePolicyResponse.from(policy);
    }

    @Transactional
    public LeavePolicyResponse update(Long policyId, LeavePolicyRequest request, String ipAddress, String userAgent) {
        Emp editor = requireManager();
        LeavePolicy policy = repository.findById(policyId)
            .orElseThrow(() -> BusinessException.notFound("LEAVE_POLICY_NOT_FOUND", "휴가 정책을 찾을 수 없습니다."));
        validate(request, policyId);
        Map<String, Object> before = snapshot(policy);
        apply(policy, request, editor);
        audit(editor, AuditActionType.UPDATE, policy, before, ipAddress, userAgent);
        return LeavePolicyResponse.from(policy);
    }

    private void validate(LeavePolicyRequest request, Long excludeId) {
        if (request.active() && REMOVED_LEAVE_TYPES.contains(request.leaveType().trim())) {
            throw BusinessException.badRequest("LEAVE_TYPE_REMOVED", "운영에서 제외된 휴가 종류는 활성화할 수 없습니다.");
        }
        String payType = upper(request.payType());
        String unitType = upper(request.unitType());
        String gender = upper(request.genderRestriction());
        if (!PAY_TYPES.contains(payType)) {
            throw BusinessException.badRequest("LEAVE_POLICY_PAY_TYPE_INVALID", "유급/무급 구분을 확인해 주세요.");
        }
        if (!UNIT_TYPES.contains(unitType)) {
            throw BusinessException.badRequest("LEAVE_POLICY_UNIT_INVALID", "종일/반일 구분을 확인해 주세요.");
        }
        if (!GENDER_TYPES.contains(gender)) {
            throw BusinessException.badRequest("LEAVE_POLICY_GENDER_INVALID", "성별 제한을 확인해 주세요.");
        }
        if (request.effectiveTo() != null && request.effectiveTo().isBefore(request.effectiveFrom())) {
            throw BusinessException.badRequest("LEAVE_POLICY_PERIOD_INVALID", "정책 종료일은 시행일보다 빠를 수 없습니다.");
        }
        LocalDate overlapEnd = request.effectiveTo() == null ? LocalDate.of(9999, 12, 31) : request.effectiveTo();
        if (!repository.findOverlaps(request.leaveType().trim(), excludeId, request.effectiveFrom(), overlapEnd).isEmpty()) {
            throw BusinessException.badRequest("LEAVE_POLICY_PERIOD_OVERLAP", "같은 휴가 종류의 정책 시행기간이 겹칩니다.");
        }
    }

    private LeavePolicy toEntity(LeavePolicyRequest request, Emp editor) {
        return new LeavePolicy(
            request.leaveType().trim(), request.displayName().trim(), request.active(), upper(request.payType()),
            request.annualDeductionDays(), upper(request.unitType()), request.maxDays(), request.periodBeforeDays(),
            request.periodAfterDays(), upper(request.genderRestriction()), request.evidenceRequired(),
            request.maxSegments(), request.adminOverrideAllowed(), request.effectiveFrom(), request.effectiveTo(),
            request.changeReason().trim(), editor
        );
    }

    private void apply(LeavePolicy policy, LeavePolicyRequest request, Emp editor) {
        policy.update(
            request.leaveType().trim(), request.displayName().trim(), request.active(), upper(request.payType()),
            request.annualDeductionDays(), upper(request.unitType()), request.maxDays(), request.periodBeforeDays(),
            request.periodAfterDays(), upper(request.genderRestriction()), request.evidenceRequired(),
            request.maxSegments(), request.adminOverrideAllowed(), request.effectiveFrom(), request.effectiveTo(),
            request.changeReason().trim(), editor
        );
    }

    private LeavePolicy builtIn(String leaveType) {
        String type = leaveType == null ? "" : leaveType.trim();
        BigDecimal deduction = Set.of("연차", "하계휴가").contains(type)
            ? BigDecimal.ONE
            : Set.of("오전반차", "오후반차").contains(type) ? new BigDecimal("0.5") : BigDecimal.ZERO;
        String unit = Set.of("오전반차", "오후반차", "공가(오전)", "공가(오후)").contains(type)
            ? "HALF_DAY" : "FULL_DAY";
        String payType = Set.of("병가", "무급휴가").contains(type) ? "UNPAID"
            : "산재요양".equals(type) ? "SEPARATE" : "PAID";
        String gender = Set.of("여성휴가", "출산전후휴가", "유산·사산휴가").contains(type) ? "FEMALE" : "ALL";
        boolean known = Set.of(
            "연차", "하계휴가", "오전반차", "오후반차", "공가", "공가(오전)", "공가(오후)",
            "경조", "대체휴무", "병가", "산재요양", "무급휴가", "배우자 출산휴가",
            "출산전후휴가", "여성휴가", "유산·사산휴가", "난임치료휴가", "육아휴직"
        ).contains(type);
        return new LeavePolicy(
            type, type, known, payType, deduction, unit,
            "배우자 출산휴가".equals(type) ? new BigDecimal("20") : null,
            null, "배우자 출산휴가".equals(type) ? 120 : null,
            gender, false, "배우자 출산휴가".equals(type) ? 4 : null,
            true, DEFAULT_FROM, null, "시스템 기본 정책", null
        );
    }

    private Emp requireManager() {
        Emp editor = currentEmpProvider.getCurrentEmp();
        if (!employeePermissionService.hasPermission(editor, EmployeePermissionService.LEAVE_ADMIN)) {
            throw BusinessException.forbidden("LEAVE_POLICY_MANAGE_FORBIDDEN", "휴가 정책 관리 권한이 없습니다.");
        }
        return editor;
    }

    private int selectableOrder(LeavePolicy policy) {
        int index = SELECTABLE_ORDER.indexOf(policy.getLeaveType());
        return index >= 0 ? index : Integer.MAX_VALUE;
    }

    private String upper(String value) {
        return value.trim().toUpperCase();
    }

    private Map<String, Object> snapshot(LeavePolicy policy) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("leaveType", policy.getLeaveType());
        values.put("displayName", policy.getDisplayName());
        values.put("active", policy.isActive());
        values.put("payType", policy.getPayType());
        values.put("annualDeductionDays", policy.getAnnualDeductionDays());
        values.put("unitType", policy.getUnitType());
        values.put("maxDays", policy.getMaxDays());
        values.put("periodBeforeDays", policy.getPeriodBeforeDays());
        values.put("periodAfterDays", policy.getPeriodAfterDays());
        values.put("genderRestriction", policy.getGenderRestriction());
        values.put("evidenceRequired", policy.isEvidenceRequired());
        values.put("maxSegments", policy.getMaxSegments());
        values.put("adminOverrideAllowed", policy.isAdminOverrideAllowed());
        values.put("effectiveFrom", policy.getEffectiveFrom());
        values.put("effectiveTo", policy.getEffectiveTo());
        return values;
    }

    private void audit(
        Emp editor,
        AuditActionType action,
        LeavePolicy policy,
        Map<String, Object> before,
        String ipAddress,
        String userAgent
    ) {
        auditLogService.record(
            editor.getEmpId(), action, "leave_policy", policy.getLeavePolicyId(),
            before == null ? null : objectMapper.valueToTree(before), objectMapper.valueToTree(snapshot(policy)),
            ipAddress, userAgent, policy.getChangeReason(), true
        );
    }
}
