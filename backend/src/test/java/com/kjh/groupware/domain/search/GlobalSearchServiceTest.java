package com.kjh.groupware.domain.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class GlobalSearchServiceTest {

    @Test
    void defaultSearchDoesNotInvokeProvidersOutsideTheApprovedScope() {
        GlobalSearchProvider employeeProvider = provider("employees", 20);
        GlobalSearchProvider auditProvider = provider("audit", 90);
        CurrentEmpProvider current = currentEmployee();
        when(employeeProvider.search(anyString(), anyInt(), any())).thenReturn(group("employees", "ACTIVE"));
        GlobalSearchService service = new GlobalSearchService(List.of(auditProvider, employeeProvider), current);

        GlobalSearchResponse response = service.search("김철", 5, null, null);

        assertThat(response.groups()).extracting(GlobalSearchGroupResponse::code).containsExactly("employees");
        verify(auditProvider, never()).search(anyString(), anyInt(), any());
    }

    @Test
    void reportsOneProviderFailureWithoutDiscardingOtherResults() {
        GlobalSearchProvider menuProvider = provider("menus", 5);
        GlobalSearchProvider employeeProvider = provider("employees", 20);
        when(menuProvider.search(anyString(), anyInt(), any())).thenThrow(new IllegalStateException("temporary failure"));
        when(employeeProvider.search(anyString(), anyInt(), any())).thenReturn(group("employees", "ACTIVE"));
        GlobalSearchService service = new GlobalSearchService(List.of(menuProvider, employeeProvider), currentEmployee());

        GlobalSearchResponse response = service.search("김철", 5, List.of("menus", "employees"), null);

        assertThat(response.groups()).extracting(GlobalSearchGroupResponse::code).containsExactly("employees");
        assertThat(response.failedProviders()).containsExactly("menus");
    }

    @Test
    void appliesStatusFilterWithinTheAuthorizedProvider() {
        GlobalSearchProvider approvalProvider = provider("approvals", 10);
        when(approvalProvider.search(anyString(), anyInt(), any())).thenReturn(group("approvals", "APPROVED"));
        GlobalSearchService service = new GlobalSearchService(List.of(approvalProvider), currentEmployee());

        GlobalSearchResponse response = service.search("휴가", 5, List.of("approvals"), "REJECTED");

        assertThat(response.groups()).isEmpty();
    }

    @Test
    void activeEmployeesKeepTheFullCountWhenTheProviderReturnsOnlyOnePage() {
        GlobalSearchProvider employeeProvider = provider("employees", 20);
        GlobalSearchGroupResponse page = group("employees", "ACTIVE");
        when(employeeProvider.search(anyString(), anyInt(), any()))
            .thenReturn(new GlobalSearchGroupResponse("employees", "조직/직원", 37, page.items()));
        GlobalSearchService service = new GlobalSearchService(List.of(employeeProvider), currentEmployee());

        GlobalSearchResponse response = service.search("김철", 5, List.of("employees"), "active");

        assertThat(response.groups().getFirst().totalCount()).isEqualTo(37);
    }

    private GlobalSearchProvider provider(String code, int order) {
        GlobalSearchProvider provider = mock(GlobalSearchProvider.class);
        doCallRealMethod().when(provider).search(anyString(), anyInt(), any(), nullable(String.class));
        when(provider.code()).thenReturn(code);
        when(provider.order()).thenReturn(order);
        return provider;
    }

    private CurrentEmpProvider currentEmployee() {
        CurrentEmpProvider current = mock(CurrentEmpProvider.class);
        Emp employee = mock(Emp.class);
        when(current.getCurrentEmp()).thenReturn(employee);
        return current;
    }

    private GlobalSearchGroupResponse group(String code, String badge) {
        GlobalSearchItemResponse item = new GlobalSearchItemResponse(
            "EMPLOYEE", 1L, null, "organization", "김철수", null, null,
            List.of(badge), LocalDateTime.now()
        );
        return new GlobalSearchGroupResponse(code, code, 1, List.of(item));
    }
}
