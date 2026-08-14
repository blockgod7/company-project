package com.kjh.groupware.domain.menu;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.domain.menu.dto.EffectiveMenuResponse;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.List;
import org.junit.jupiter.api.Test;

class MenuServiceTest {

    private final MenuRepository menuRepository = mock(MenuRepository.class);
    private final UserMenuPreferenceRepository preferenceRepository = mock(UserMenuPreferenceRepository.class);
    private final CurrentEmpProvider currentEmpProvider = mock(CurrentEmpProvider.class);
    private final EmployeePermissionService permissionService = mock(EmployeePermissionService.class);
    private final MenuService service = new MenuService(
        menuRepository, preferenceRepository, currentEmpProvider, permissionService
    );

    @Test
    void regularEmployeeCannotSeePlannedMenus() {
        Emp employee = employee(1L, "USER");
        Menu home = menu(1L, "EMPLOYEE_HOME", "EMPLOYEE", "IMPLEMENTED", null, 1);
        Menu planned = menu(2L, "PDM", "EMPLOYEE", "PLANNED", null, 2);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(employee);
        when(preferenceRepository.findByEmpEmpId(1L)).thenReturn(List.of());
        when(menuRepository.findByUseYnOrderByPortalCodeAscSortOrderAscMenuIdAsc("Y"))
            .thenReturn(List.of(home, planned));

        List<EffectiveMenuResponse> result = service.findEffective("employee");

        assertThat(result).extracting(EffectiveMenuResponse::menuCode).containsExactly("EMPLOYEE_HOME");
    }

    @Test
    void regularEmployeeCanSeeAllImplementedCommonEmployeeMenusWithoutGrantedPermissions() {
        Emp employee = employee(5L, "USER");
        List<Menu> commonMenus = List.of(
            menu(1L, "EMPLOYEE_HOME", "EMPLOYEE", "IMPLEMENTED", null, 1),
            menu(2L, "NOTICES", "EMPLOYEE", "IMPLEMENTED", null, 2),
            menu(3L, "BOARDS", "EMPLOYEE", "IMPLEMENTED", null, 3),
            menu(4L, "APPROVALS", "EMPLOYEE", "IMPLEMENTED", null, 4),
            menu(5L, "ORGANIZATION", "EMPLOYEE", "IMPLEMENTED", null, 5),
            menu(6L, "NOTIFICATIONS", "EMPLOYEE", "IMPLEMENTED", null, 6)
        );
        when(currentEmpProvider.getCurrentEmp()).thenReturn(employee);
        when(preferenceRepository.findByEmpEmpId(5L)).thenReturn(List.of());
        when(menuRepository.findByUseYnOrderByPortalCodeAscSortOrderAscMenuIdAsc("Y"))
            .thenReturn(commonMenus);

        assertThat(service.findEffective("EMPLOYEE"))
            .extracting(EffectiveMenuResponse::menuCode)
            .containsExactly(
                "EMPLOYEE_HOME", "NOTICES", "BOARDS", "APPROVALS", "ORGANIZATION", "NOTIFICATIONS"
            );
    }

    @Test
    void systemAdministratorCanSeePlannedMenus() {
        Emp administrator = employee(2L, "ADMIN");
        Menu planned = menu(2L, "PDM", "EMPLOYEE", "PLANNED", null, 2);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(administrator);
        when(preferenceRepository.findByEmpEmpId(2L)).thenReturn(List.of());
        when(menuRepository.findByUseYnOrderByPortalCodeAscSortOrderAscMenuIdAsc("Y"))
            .thenReturn(List.of(planned));

        assertThat(service.findEffective("EMPLOYEE"))
            .extracting(EffectiveMenuResponse::menuCode)
            .containsExactly("PDM");
    }

    @Test
    void fullAdministratorCanSeePlannedMenus() {
        Emp fullAdministrator = employee(6L, "USER");
        Menu planned = menu(2L, "PDM", "EMPLOYEE", "PLANNED", null, 2);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(fullAdministrator);
        when(permissionService.hasPermission(fullAdministrator, EmployeePermissionService.FULL_ADMIN)).thenReturn(true);
        when(preferenceRepository.findByEmpEmpId(6L)).thenReturn(List.of());
        when(menuRepository.findByUseYnOrderByPortalCodeAscSortOrderAscMenuIdAsc("Y"))
            .thenReturn(List.of(planned));

        assertThat(service.findEffective("EMPLOYEE"))
            .extracting(EffectiveMenuResponse::menuCode)
            .containsExactly("PDM");
    }

    @Test
    void approvalAdministratorCannotSeePlannedMenusWithoutFullAdminPermission() {
        Emp approvalAdministrator = employee(7L, "APPROVAL_ADMIN");
        Menu planned = menu(2L, "PDM", "EMPLOYEE", "PLANNED", null, 2);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(approvalAdministrator);
        when(preferenceRepository.findByEmpEmpId(7L)).thenReturn(List.of());
        when(menuRepository.findByUseYnOrderByPortalCodeAscSortOrderAscMenuIdAsc("Y"))
            .thenReturn(List.of(planned));

        assertThat(service.findEffective("EMPLOYEE")).isEmpty();
    }

    @Test
    void employeeWithoutDelegatedPermissionCannotSeeAdminPortalMenu() {
        Emp employee = employee(3L, "USER");
        Menu adminHome = menu(3L, "ADMIN_HOME", "ADMIN", "IMPLEMENTED", "ADMIN_PORTAL", 1);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(employee);
        when(preferenceRepository.findByEmpEmpId(3L)).thenReturn(List.of());
        when(menuRepository.findByUseYnOrderByPortalCodeAscSortOrderAscMenuIdAsc("Y"))
            .thenReturn(List.of(adminHome));

        assertThat(service.findEffective("ADMIN")).isEmpty();
    }

    @Test
    void employeeWithDelegatedManagementPermissionCanSeeAdminPortalHome() {
        Emp delegatedAdministrator = employee(8L, "USER");
        Menu adminHome = menu(3L, "ADMIN_HOME", "ADMIN", "IMPLEMENTED", "ADMIN_PORTAL", 1);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(delegatedAdministrator);
        when(permissionService.hasPermission(delegatedAdministrator, EmployeePermissionService.EMPLOYEE_ADMIN))
            .thenReturn(true);
        when(preferenceRepository.findByEmpEmpId(8L)).thenReturn(List.of());
        when(menuRepository.findByUseYnOrderByPortalCodeAscSortOrderAscMenuIdAsc("Y"))
            .thenReturn(List.of(adminHome));

        assertThat(service.findEffective("ADMIN"))
            .extracting(EffectiveMenuResponse::menuCode)
            .containsExactly("ADMIN_HOME");
    }

    @Test
    void approvalAdministratorSeesApprovalManagementOnlyInAdminPortal() {
        Emp approvalAdministrator = employee(9L, "APPROVAL_ADMIN");
        Menu employeeApproval = menu(4L, "APPROVALS", "EMPLOYEE", "IMPLEMENTED", null, 4);
        Menu approvalManagement = menu(5L, "APPROVAL_ADMIN", "ADMIN", "IMPLEMENTED", "APPROVAL_MANAGE", 2);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(approvalAdministrator);
        when(preferenceRepository.findByEmpEmpId(9L)).thenReturn(List.of());
        when(menuRepository.findByUseYnOrderByPortalCodeAscSortOrderAscMenuIdAsc("Y"))
            .thenReturn(List.of(employeeApproval, approvalManagement));

        assertThat(service.findEffective("EMPLOYEE"))
            .extracting(EffectiveMenuResponse::menuCode)
            .containsExactly("APPROVALS");
        assertThat(service.findEffective("ADMIN"))
            .extracting(EffectiveMenuResponse::menuCode)
            .containsExactly("APPROVAL_ADMIN");
    }

    @Test
    void employeeAdministratorCannotSeeApprovalManagementWithoutApprovalPermission() {
        Emp employeeAdministrator = employee(10L, "USER");
        Menu approvalManagement = menu(5L, "APPROVAL_ADMIN", "ADMIN", "IMPLEMENTED", "APPROVAL_MANAGE", 2);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(employeeAdministrator);
        when(permissionService.hasPermission(employeeAdministrator, EmployeePermissionService.EMPLOYEE_ADMIN))
            .thenReturn(true);
        when(preferenceRepository.findByEmpEmpId(10L)).thenReturn(List.of());
        when(menuRepository.findByUseYnOrderByPortalCodeAscSortOrderAscMenuIdAsc("Y"))
            .thenReturn(List.of(approvalManagement));

        assertThat(service.findEffective("ADMIN")).isEmpty();
    }

    @Test
    void rejectsUnknownPortalCode() {
        Emp employee = employee(4L, "USER");
        when(currentEmpProvider.getCurrentEmp()).thenReturn(employee);

        assertThatThrownBy(() -> service.findEffective("UNKNOWN"))
            .isInstanceOf(BusinessException.class)
            .hasMessage("지원하지 않는 포털 구분입니다.");
    }

    private Emp employee(Long empId, String roleCode) {
        Emp emp = mock(Emp.class);
        when(emp.getEmpId()).thenReturn(empId);
        when(emp.getRoleCode()).thenReturn(roleCode);
        return emp;
    }

    private Menu menu(
        Long menuId,
        String menuCode,
        String portalCode,
        String status,
        String requiredPermission,
        int sortOrder
    ) {
        Menu menu = mock(Menu.class);
        when(menu.getMenuId()).thenReturn(menuId);
        when(menu.getMenuCode()).thenReturn(menuCode);
        when(menu.getMenuName()).thenReturn(menuCode);
        when(menu.getMenuPath()).thenReturn("/" + menuCode.toLowerCase());
        when(menu.getPortalCode()).thenReturn(portalCode);
        when(menu.getImplementationStatus()).thenReturn(status);
        when(menu.getRequiredPermissionCode()).thenReturn(requiredPermission);
        when(menu.getSortOrder()).thenReturn(sortOrder);
        when(menu.getSearchableYn()).thenReturn("Y");
        return menu;
    }
}
