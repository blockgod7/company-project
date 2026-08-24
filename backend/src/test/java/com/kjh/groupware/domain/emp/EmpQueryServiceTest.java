package com.kjh.groupware.domain.emp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.kjh.groupware.global.security.CurrentEmpProvider;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

class EmpQueryServiceTest {

    private final EmpRepository empRepository = mock(EmpRepository.class);
    private final CurrentEmpProvider currentEmpProvider = mock(CurrentEmpProvider.class);
    private final EmployeePermissionService employeePermissionService = mock(EmployeePermissionService.class);
    private final Emp currentEmp = mock(Emp.class);
    private final EmpQueryService service = new EmpQueryService(empRepository, currentEmpProvider, employeePermissionService);

    @Test
    void directoryWithoutKeywordUsesSystemAdminExcludedQuery() {
        when(empRepository.searchDirectoryWithoutKeyword(eq(3L), eq("ACTIVE"), org.mockito.ArgumentMatchers.any(Pageable.class)))
            .thenReturn(Page.empty());

        var result = service.searchDirectory(" ", 3L, "ACTIVE", 0, 100);

        assertThat(result.content()).isEmpty();
        verify(empRepository).searchDirectoryWithoutKeyword(eq(3L), eq("ACTIVE"), org.mockito.ArgumentMatchers.any(Pageable.class));
    }

    @Test
    void directoryKeywordSearchUsesSystemAdminExcludedQuery() {
        when(empRepository.searchDirectory(eq("홍길동"), eq(null), eq("ACTIVE"), org.mockito.ArgumentMatchers.any(Pageable.class)))
            .thenReturn(Page.empty());

        var result = service.searchDirectory(" 홍길동 ", null, "ACTIVE", 0, 100);

        assertThat(result.content()).isEmpty();
        verify(empRepository).searchDirectory(eq("홍길동"), eq(null), eq("ACTIVE"), org.mockito.ArgumentMatchers.any(Pageable.class));
    }

    @Test
    void directoryAllStatusSearchIncludesEmploymentHistory() {
        when(currentEmpProvider.getCurrentEmp()).thenReturn(currentEmp);
        when(employeePermissionService.hasPermission(currentEmp, EmployeePermissionService.EMPLOYEE_ADMIN)).thenReturn(true);
        when(empRepository.searchDirectoryWithoutKeyword(eq(null), eq(null), org.mockito.ArgumentMatchers.any(Pageable.class)))
            .thenReturn(Page.empty());

        var result = service.searchDirectory(null, null, "ALL", 0, 100);

        assertThat(result.content()).isEmpty();
        verify(empRepository).searchDirectoryWithoutKeyword(eq(null), eq(null), org.mockito.ArgumentMatchers.any(Pageable.class));
    }

    @Test
    void directoryCurrentStatusExcludesRetiredEmployees() {
        when(empRepository.searchCurrentDirectoryWithoutKeyword(eq(3L), org.mockito.ArgumentMatchers.any(Pageable.class)))
            .thenReturn(Page.empty());

        var result = service.searchDirectory(null, 3L, "CURRENT", 0, 100);

        assertThat(result.content()).isEmpty();
        verify(empRepository).searchCurrentDirectoryWithoutKeyword(eq(3L), org.mockito.ArgumentMatchers.any(Pageable.class));
    }

    @Test
    void directoryAllStatusForRegularEmployeeExcludesRetiredEmployees() {
        when(currentEmpProvider.getCurrentEmp()).thenReturn(currentEmp);
        when(employeePermissionService.hasPermission(currentEmp, EmployeePermissionService.EMPLOYEE_ADMIN)).thenReturn(false);
        when(empRepository.searchCurrentDirectoryWithoutKeyword(eq(null), org.mockito.ArgumentMatchers.any(Pageable.class)))
            .thenReturn(Page.empty());

        var result = service.searchDirectory(null, null, "ALL", 0, 100);

        assertThat(result.content()).isEmpty();
        verify(empRepository).searchCurrentDirectoryWithoutKeyword(eq(null), org.mockito.ArgumentMatchers.any(Pageable.class));
    }
    @Test
    void directoryRetiredStatusForRegularEmployeeReturnsNoEmployees() {
        when(currentEmpProvider.getCurrentEmp()).thenReturn(currentEmp);
        when(employeePermissionService.hasPermission(currentEmp, EmployeePermissionService.EMPLOYEE_ADMIN)).thenReturn(false);

        var result = service.searchDirectory(null, null, "RETIRED", 0, 100);

        assertThat(result.content()).isEmpty();
        verifyNoInteractions(empRepository);
    }
}
