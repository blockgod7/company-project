package com.kjh.groupware.domain.emp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EmployeePermissionService {

    public static final String LEAVE_ADMIN = "LEAVE_ADMIN";
    public static final String LEAVE_POLICY_ADMIN = "LEAVE_POLICY_ADMIN";
    public static final String EMPLOYEE_ADMIN = "EMPLOYEE_ADMIN";
    public static final String WORK_CATEGORY_ADMIN = "WORK_CATEGORY_ADMIN";
    public static final String ACCOUNT_ADMIN = "ACCOUNT_ADMIN";
    public static final String WORK_REQUEST_ADMIN = "WORK_REQUEST_ADMIN";
    public static final String WORK_REQUEST_DELEGATE = "WORK_REQUEST_DELEGATE";
    public static final String FULL_ADMIN = "FULL_ADMIN";
    public static final String NOTICE_WRITE = "NOTICE_WRITE";

    private static final Set<String> SUPPORTED = Set.of(
        FULL_ADMIN, LEAVE_ADMIN, LEAVE_POLICY_ADMIN, EMPLOYEE_ADMIN, WORK_CATEGORY_ADMIN, ACCOUNT_ADMIN,
        WORK_REQUEST_ADMIN, WORK_REQUEST_DELEGATE
    );
    private static final List<String> MANAGED_PERMISSIONS = List.of(
        FULL_ADMIN, LEAVE_ADMIN, LEAVE_POLICY_ADMIN, EMPLOYEE_ADMIN, WORK_CATEGORY_ADMIN, ACCOUNT_ADMIN,
        WORK_REQUEST_ADMIN, WORK_REQUEST_DELEGATE
    );

    private final EmpPermissionRepository permissionRepository;
    private final EmpRepository empRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public boolean hasPermission(Emp emp, String permissionCode) {
        if (emp == null || !SUPPORTED.contains(permissionCode) || !isEligibleAccount(emp)) {
            return false;
        }
        if ("ADMIN".equals(emp.getRoleCode())) {
            return true;
        }
        if (permissionRepository.existsByEmpEmpIdAndPermissionCodeAndActiveYn(emp.getEmpId(), FULL_ADMIN, "Y")) {
            return true;
        }
        if (WORK_REQUEST_DELEGATE.equals(permissionCode)
            && permissionRepository.existsByEmpEmpIdAndPermissionCodeAndActiveYn(emp.getEmpId(), WORK_REQUEST_ADMIN, "Y")) {
            return true;
        }
        return permissionRepository.existsByEmpEmpIdAndPermissionCodeAndActiveYn(emp.getEmpId(), permissionCode, "Y");
    }

    @Transactional(readOnly = true)
    public boolean canAccessSensitiveLeave(Emp emp) {
        return hasPermission(emp, LEAVE_ADMIN);
    }

    @Transactional(readOnly = true)
    public boolean canWriteNotice(Emp emp) {
        if (emp == null) return false;
        if ("ADMIN".equals(emp.getRoleCode()) || hasPermission(emp, FULL_ADMIN)) return true;
        com.kjh.groupware.domain.dept.Dept dept = emp.getDept();
        if (dept != null && "대표이사".equals(dept.getDeptName())) return true;
        while (dept != null) {
            if ("HR_ADMIN".equals(dept.getDeptCode()) || "인사총무".equals(dept.getDeptName())) return true;
            dept = dept.getParentDept();
        }
        return false;
    }

    public void requireNoticeWrite(Emp emp) {
        if (!canWriteNotice(emp)) {
            throw BusinessException.forbidden("NOTICE_WRITE_REQUIRED", "공지사항은 시스템 관리자, 인사총무, 대표이사만 작성할 수 있습니다.");
        }
    }

    private boolean isHrDepartment(Emp emp) {
        com.kjh.groupware.domain.dept.Dept dept = emp == null ? null : emp.getDept();
        while (dept != null) {
            if ("HR_ADMIN".equals(dept.getDeptCode()) || "인사총무".equals(dept.getDeptName())) return true;
            dept = dept.getParentDept();
        }
        return false;
    }

    @Transactional(readOnly = true)
    public List<String> permissionsFor(Emp emp) {
        if (emp == null || !isEligibleAccount(emp)) return List.of();
        LinkedHashSet<String> result = new LinkedHashSet<>();
        if ("ADMIN".equals(emp.getRoleCode())) {
            result.addAll(List.of("ADMIN", "NOTICE_WRITE", "BOARD_WRITE", "NOTIFICATION_CREATE", "AUDIT_READ"));
        } else {
            result.addAll(List.of("NOTICE_READ", "BOARD_READ", "BOARD_WRITE", "ORGANIZATION_READ", "NOTIFICATION_READ"));
        }
        if (canWriteNotice(emp)) result.add(NOTICE_WRITE);
        MANAGED_PERMISSIONS.stream().filter(permission -> hasPermission(emp, permission)).forEach(result::add);
        return List.copyOf(result);
    }

    @Transactional(readOnly = true)
    public boolean canManageAccounts(Emp emp) {
        return hasPermission(emp, ACCOUNT_ADMIN);
    }

    @Transactional(readOnly = true)
    public void requireLeaveAdmin() {
        if (!hasPermission(currentEmpProvider.getCurrentEmp(), LEAVE_ADMIN)) {
            throw BusinessException.forbidden("LEAVE_ADMIN_REQUIRED", "휴가관리자 권한이 필요합니다.");
        }
    }

    @Transactional(readOnly = true)
    public void requireEmployeeAdmin() {
        if (!hasPermission(currentEmpProvider.getCurrentEmp(), EMPLOYEE_ADMIN)) {
            throw BusinessException.forbidden("EMPLOYEE_ADMIN_REQUIRED", "직원관리 권한이 필요합니다.");
        }
    }

    @Transactional(readOnly = true)
    public void requireEmployeeOrWorkCategoryAdmin() {
        Emp actor = currentEmpProvider.getCurrentEmp();
        if (!hasPermission(actor, EMPLOYEE_ADMIN) && !hasPermission(actor, WORK_CATEGORY_ADMIN)
            && !hasPermission(actor, WORK_REQUEST_ADMIN)) {
            throw BusinessException.forbidden("EMPLOYEE_READ_ADMIN_REQUIRED", "직원관리 또는 직군관리 권한이 필요합니다.");
        }
    }

    @Transactional(readOnly = true)
    public void requireWorkRequestAdmin() {
        if (!hasPermission(currentEmpProvider.getCurrentEmp(), WORK_REQUEST_ADMIN)) {
            throw BusinessException.forbidden("WORK_REQUEST_ADMIN_REQUIRED", "근무신청 권한관리 권한이 필요합니다.");
        }
    }

    @Transactional(readOnly = true)
    public void requireWorkCategoryAdmin() {
        if (!hasPermission(currentEmpProvider.getCurrentEmp(), WORK_CATEGORY_ADMIN)) {
            throw BusinessException.forbidden("WORK_CATEGORY_ADMIN_REQUIRED", "직군관리 권한이 필요합니다.");
        }
    }

    @Transactional(readOnly = true)
    public void requireAccountAdmin() {
        if (!canManageAccounts(currentEmpProvider.getCurrentEmp())) {
            throw BusinessException.forbidden("ACCOUNT_ADMIN_REQUIRED", "계정관리 권한이 필요합니다.");
        }
    }

    @Transactional(readOnly = true)
    public void assertCanEditTarget(Emp actor, Emp target) {
        if (!hasPermission(actor, EMPLOYEE_ADMIN)) {
            throw BusinessException.forbidden("EMPLOYEE_ADMIN_REQUIRED", "직원관리 권한이 필요합니다.");
        }
        if ("ADMIN".equals(target.getRoleCode()) && !"ADMIN".equals(actor.getRoleCode())) {
            throw BusinessException.forbidden("SYSTEM_ADMIN_PROTECTED", "시스템관리자 계정은 최상위 권한자만 수정할 수 있습니다.");
        }
        if (hasPermission(target, FULL_ADMIN)
            && !"ADMIN".equals(actor.getRoleCode())
            && !hasPermission(actor, FULL_ADMIN)) {
            throw BusinessException.forbidden("FULL_ADMIN_PROTECTED", "전권 관리자는 시스템관리자 또는 다른 전권 관리자만 인사 처리할 수 있습니다.");
        }
    }

    @Transactional
    public List<String> update(
        Long empId,
        String permissionCode,
        boolean active,
        String reason,
        String ipAddress,
        String userAgent
    ) {
        Emp actor = currentEmpProvider.getCurrentEmp();
        boolean fullAdministrator = "ADMIN".equals(actor.getRoleCode()) || hasPermission(actor, FULL_ADMIN);
        boolean workAuthorityAdministrator = WORK_REQUEST_DELEGATE.equals(permissionCode)
            && hasPermission(actor, WORK_REQUEST_ADMIN);
        if (!fullAdministrator && !workAuthorityAdministrator) {
            throw BusinessException.forbidden("PERMISSION_GRANT_FORBIDDEN", "시스템관리자 또는 전권 관리자만 권한을 변경할 수 있습니다.");
        }
        if (!SUPPORTED.contains(permissionCode)) {
            throw BusinessException.badRequest("PERMISSION_CODE_INVALID", "지원하지 않는 권한입니다.");
        }
        Emp target = empRepository.findById(empId)
            .orElseThrow(() -> BusinessException.notFound("EMP_NOT_FOUND", "직원을 찾을 수 없습니다."));
        if ("ADMIN".equals(target.getRoleCode())) {
            throw BusinessException.forbidden("SYSTEM_ADMIN_PERMISSION_IMMUTABLE", "시스템관리자의 최상위 권한은 변경할 수 없습니다.");
        }
        boolean beforeActive = permissionRepository.existsByEmpEmpIdAndPermissionCodeAndActiveYn(empId, permissionCode, "Y");
        EmpPermission permission = permissionRepository.findByEmpEmpIdAndPermissionCode(empId, permissionCode)
            .orElseGet(() -> new EmpPermission(target, permissionCode, actor, reason));
        if (active) permission.grant(actor, reason); else permission.revoke(actor, reason);
        permissionRepository.saveAndFlush(permission);
        auditLogService.record(
            actor.getEmpId(), AuditActionType.UPDATE, "emp_permission", permission.getEmpPermissionId(),
            objectMapper.valueToTree(Map.of("permissionCode", permissionCode, "active", beforeActive)),
            objectMapper.valueToTree(Map.of("permissionCode", permissionCode, "active", active)),
            ipAddress, userAgent, reason, true
        );
        return permissionsFor(target);
    }

    @Transactional
    public void revokeAllForRetirement(Emp target, Emp actor) {
        for (EmpPermission permission : permissionRepository.findByEmpEmpIdAndActiveYnOrderByPermissionCode(target.getEmpId(), "Y")) {
            permission.revoke(actor, "퇴직으로 모든 관리 권한 자동 회수");
            permissionRepository.save(permission);
            auditLogService.record(
                actor.getEmpId(), AuditActionType.UPDATE, "emp_permission", permission.getEmpPermissionId(),
                objectMapper.valueToTree(Map.of("permissionCode", permission.getPermissionCode(), "active", true)),
                objectMapper.valueToTree(Map.of("permissionCode", permission.getPermissionCode(), "active", false)),
                null, null, "퇴직으로 모든 관리 권한 자동 회수", true
            );
        }
    }

    private boolean isEligibleAccount(Emp emp) {
        if (emp.getStatus() == null && emp.getAccountStatus() == null && emp.getUseYn() == null) return true;
        return emp.isActiveUser();
    }
}
