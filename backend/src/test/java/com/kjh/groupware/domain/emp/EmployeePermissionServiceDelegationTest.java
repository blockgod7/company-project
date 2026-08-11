package com.kjh.groupware.domain.emp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class EmployeePermissionServiceDelegationTest {

    private final EmpPermissionRepository permissionRepository = mock(EmpPermissionRepository.class);
    private final EmpRepository empRepository = mock(EmpRepository.class);
    private final CurrentEmpProvider currentEmpProvider = mock(CurrentEmpProvider.class);
    private final EmployeePermissionService service = new EmployeePermissionService(
        permissionRepository,
        empRepository,
        currentEmpProvider,
        mock(AuditLogService.class),
        new ObjectMapper()
    );

    @Test
    void fullAdminReceivesEveryManagedPermission() {
        Emp delegate = emp(10L, "USER");
        when(permissionRepository.existsByEmpEmpIdAndPermissionCodeAndActiveYn(
            10L, EmployeePermissionService.FULL_ADMIN, "Y"
        )).thenReturn(true);

        assertThat(service.permissionsFor(delegate)).contains(
            EmployeePermissionService.FULL_ADMIN,
            EmployeePermissionService.LEAVE_ADMIN,
            EmployeePermissionService.LEAVE_POLICY_ADMIN,
            EmployeePermissionService.EMPLOYEE_ADMIN,
            EmployeePermissionService.WORK_CATEGORY_ADMIN,
            EmployeePermissionService.ACCOUNT_ADMIN
        );
    }

    @Test
    void delegatedFullAdminCannotModifySystemAdministratorAuthority() {
        Emp delegate = emp(10L, "USER");
        Emp systemAdmin = emp(1L, "ADMIN");
        when(currentEmpProvider.getCurrentEmp()).thenReturn(delegate);
        when(permissionRepository.existsByEmpEmpIdAndPermissionCodeAndActiveYn(
            10L, EmployeePermissionService.FULL_ADMIN, "Y"
        )).thenReturn(true);
        when(empRepository.findById(1L)).thenReturn(Optional.of(systemAdmin));

        assertThatThrownBy(() -> service.update(
            1L, EmployeePermissionService.FULL_ADMIN, false, "회수 시도", "127.0.0.1", "test"
        )).isInstanceOfSatisfying(BusinessException.class, exception ->
            assertThat(exception.getCode()).isEqualTo("SYSTEM_ADMIN_PERMISSION_IMMUTABLE")
        );
    }

    private Emp emp(Long empId, String roleCode) {
        Emp emp = mock(Emp.class);
        when(emp.getEmpId()).thenReturn(empId);
        when(emp.getRoleCode()).thenReturn(roleCode);
        return emp;
    }
}
