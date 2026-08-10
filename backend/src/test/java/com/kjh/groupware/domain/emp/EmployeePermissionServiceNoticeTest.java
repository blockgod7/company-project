package com.kjh.groupware.domain.emp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.kjh.groupware.domain.dept.Dept;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import org.junit.jupiter.api.Test;

class EmployeePermissionServiceNoticeTest {

    private final EmployeePermissionService service = new EmployeePermissionService(
        mock(EmpPermissionRepository.class),
        mock(EmpRepository.class),
        mock(CurrentEmpProvider.class)
    );

    @Test
    void noticeWritingIsLimitedToAdminHrAndChiefExecutiveOffice() {
        Emp admin = emp("ADMIN", null);
        Emp hr = emp("USER", dept("HR_ADMIN", "인사총무"));
        Emp chiefExecutiveOffice = emp("USER", dept("CEO", "대표이사"));
        Emp regular = emp("USER", dept("PROD_TECH", "생산기술", dept("CEO", "대표이사")));

        assertThat(service.canWriteNotice(admin)).isTrue();
        assertThat(service.canWriteNotice(hr)).isTrue();
        assertThat(service.canWriteNotice(chiefExecutiveOffice)).isTrue();
        assertThat(service.canWriteNotice(regular)).isFalse();
        assertThat(service.permissionsFor(hr)).contains(EmployeePermissionService.NOTICE_WRITE);
        assertThat(service.permissionsFor(chiefExecutiveOffice)).contains(EmployeePermissionService.NOTICE_WRITE);
        assertThat(service.permissionsFor(regular)).doesNotContain(EmployeePermissionService.NOTICE_WRITE);
    }

    private Emp emp(String roleCode, Dept dept) {
        Emp emp = mock(Emp.class);
        String deptCode = dept == null ? "none" : dept.getDeptCode();
        when(emp.getRoleCode()).thenReturn(roleCode);
        when(emp.getLoginId()).thenReturn("test-" + roleCode + "-" + deptCode);
        when(emp.getDept()).thenReturn(dept);
        return emp;
    }

    private Dept dept(String code, String name) {
        return dept(code, name, null);
    }

    private Dept dept(String code, String name, Dept parent) {
        Dept dept = mock(Dept.class);
        when(dept.getDeptCode()).thenReturn(code);
        when(dept.getDeptName()).thenReturn(name);
        when(dept.getParentDept()).thenReturn(parent);
        return dept;
    }
}
