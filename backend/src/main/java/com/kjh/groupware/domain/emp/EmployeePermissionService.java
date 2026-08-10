package com.kjh.groupware.domain.emp;

import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EmployeePermissionService {

    public static final String LEAVE_ADMIN = "LEAVE_ADMIN";
    public static final String EMPLOYEE_ADMIN = "EMPLOYEE_ADMIN";
    public static final String NOTICE_WRITE = "NOTICE_WRITE";
    private static final Set<String> SUPPORTED = Set.of(LEAVE_ADMIN, EMPLOYEE_ADMIN);
    private static final Set<String> DEFAULT_HR_LOGIN_IDS = Set.of("e0015", "e7016");
    private static final String ACCOUNT_MANAGER_LOGIN_ID = "e0015";

    private final EmpPermissionRepository permissionRepository;
    private final EmpRepository empRepository;
    private final CurrentEmpProvider currentEmpProvider;

    @Transactional(readOnly = true)
    public boolean hasPermission(Emp emp, String permissionCode) {
        if (emp == null || !SUPPORTED.contains(permissionCode)) {
            return false;
        }
        return "ADMIN".equals(emp.getRoleCode())
            || DEFAULT_HR_LOGIN_IDS.contains(emp.getLoginId())
            || permissionRepository.existsByEmpEmpIdAndPermissionCodeAndActiveYn(emp.getEmpId(), permissionCode, "Y");
    }

    @Transactional(readOnly = true)
    public boolean canAccessSensitiveLeave(Emp emp) {
        return hasPermission(emp, LEAVE_ADMIN) && isHrDepartment(emp);
    }

    @Transactional(readOnly = true)
    public boolean canWriteNotice(Emp emp) {
        if (emp == null) {
            return false;
        }
        if ("ADMIN".equals(emp.getRoleCode())) {
            return true;
        }
        com.kjh.groupware.domain.dept.Dept dept = emp.getDept();
        if (dept != null && "대표이사".equals(dept.getDeptName())) {
            return true;
        }
        while (dept != null) {
            if ("HR_ADMIN".equals(dept.getDeptCode())
                || "인사총무".equals(dept.getDeptName())) {
                return true;
            }
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
            if ("HR_ADMIN".equals(dept.getDeptCode()) || "인사총무".equals(dept.getDeptName())) {
                return true;
            }
            dept = dept.getParentDept();
        }
        return false;
    }

    @Transactional(readOnly = true)
    public List<String> permissionsFor(Emp emp) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        if ("ADMIN".equals(emp.getRoleCode())) {
            result.addAll(List.of("ADMIN", "NOTICE_WRITE", "BOARD_WRITE", "NOTIFICATION_CREATE", "AUDIT_READ"));
        } else {
            result.addAll(List.of("NOTICE_READ", "BOARD_READ", "BOARD_WRITE", "ORGANIZATION_READ", "NOTIFICATION_READ"));
        }
        if (canWriteNotice(emp)) result.add(NOTICE_WRITE);
        if (hasPermission(emp, LEAVE_ADMIN)) result.add(LEAVE_ADMIN);
        if (hasPermission(emp, EMPLOYEE_ADMIN)) result.add(EMPLOYEE_ADMIN);
        if (canManageAccounts(emp)) result.add("ACCOUNT_ADMIN");
        return List.copyOf(result);
    }

    @Transactional(readOnly = true)
    public boolean canManageAccounts(Emp emp) {
        return emp != null && ("ADMIN".equals(emp.getRoleCode()) || ACCOUNT_MANAGER_LOGIN_ID.equals(emp.getLoginId()));
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
        boolean protectedTarget = "ADMIN".equals(target.getRoleCode()) || ACCOUNT_MANAGER_LOGIN_ID.equals(target.getLoginId());
        if (protectedTarget && !canManageAccounts(actor)) {
            throw BusinessException.forbidden("PROTECTED_EMPLOYEE", "보호된 관리자 계정은 수정할 수 없습니다.");
        }
    }

    @Transactional
    public List<String> update(Long empId, String permissionCode, boolean active, String reason) {
        Emp actor = currentEmpProvider.getCurrentEmp();
        if (!canManageAccounts(actor)) {
            throw BusinessException.forbidden("PERMISSION_GRANT_FORBIDDEN", "시스템 관리자 또는 지정된 인사총무 책임자만 권한을 변경할 수 있습니다.");
        }
        if (!SUPPORTED.contains(permissionCode)) {
            throw BusinessException.badRequest("PERMISSION_CODE_INVALID", "지원하지 않는 권한입니다.");
        }
        Emp target = empRepository.findById(empId)
            .orElseThrow(() -> BusinessException.notFound("EMP_NOT_FOUND", "직원을 찾을 수 없습니다."));
        EmpPermission permission = permissionRepository.findByEmpEmpIdAndPermissionCode(empId, permissionCode)
            .orElseGet(() -> new EmpPermission(target, permissionCode, actor, reason));
        if (active) permission.grant(actor, reason); else permission.revoke(actor, reason);
        permissionRepository.save(permission);
        return permissionsFor(target);
    }
}
