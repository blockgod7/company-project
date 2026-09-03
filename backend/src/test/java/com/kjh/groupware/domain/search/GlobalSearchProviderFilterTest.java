package com.kjh.groupware.domain.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.kjh.groupware.domain.approval.ApprovalDelegationService;
import com.kjh.groupware.domain.approval.ApprovalDocument;
import com.kjh.groupware.domain.approval.ApprovalDocumentRepository;
import com.kjh.groupware.domain.approval.ApprovalLineRepository;
import com.kjh.groupware.domain.approval.ApprovalPermissionService;
import com.kjh.groupware.domain.approval.dto.ApprovalPermissionResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.menu.MenuService;
import com.kjh.groupware.domain.menu.dto.EffectiveMenuResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Answers;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

class GlobalSearchProviderFilterTest {
    @Test
    void plannedMenusBeyondTheFirstTenMatchesRemainSearchable() {
        Emp employee = mock(Emp.class);
        MenuService menus = mock(MenuService.class);
        List<EffectiveMenuResponse> catalog = new ArrayList<>();
        for (long id = 1; id <= 12; id++) catalog.add(menu(id, "IMPLEMENTED", false));
        catalog.add(menu(13L, "PLANNED", true));
        catalog.add(menu(14L, "PLANNED", false));
        when(menus.findEffectiveFor(employee, "EMPLOYEE")).thenReturn(catalog);
        when(menus.findEffectiveFor(employee, "ADMIN")).thenReturn(List.of());

        GlobalSearchGroupResponse result = new MenuGlobalSearchProvider(menus).search("검색", 10, employee, "PLANNED");

        assertThat(result.items()).extracting(GlobalSearchItemResponse::targetId).containsExactly(14L);
        assertThat(result.totalCount()).isEqualTo(1);
    }

    @Test
    void activeIncludesImplementedMenusButExcludesPlannedMenus() {
        Emp employee = mock(Emp.class);
        MenuService menus = mock(MenuService.class);
        when(menus.findEffectiveFor(employee, "EMPLOYEE")).thenReturn(List.of(menu(1L, "PLANNED", false), menu(2L, "IMPLEMENTED", false)));
        when(menus.findEffectiveFor(employee, "ADMIN")).thenReturn(List.of());

        GlobalSearchGroupResponse result = new MenuGlobalSearchProvider(menus).search("검색", 1, employee, "ACTIVE");

        assertThat(result.items()).extracting(GlobalSearchItemResponse::targetId).containsExactly(2L);
    }

    @ParameterizedTest
    @ValueSource(strings = { "IN_PROGRESS", "APPROVED", "REJECTED", "ALL" })
    void approvalStatusReachesThePagedQueryWhileDocumentAuthorizationIsPreserved(String status) {
        Emp employee = mock(Emp.class);
        when(employee.getEmpId()).thenReturn(7L);
        ApprovalDocument denied = document(1L, employee, status);
        ApprovalDocument visible = document(2L, employee, status);
        AtomicInteger queries = new AtomicInteger();
        ApprovalDocumentRepository documents = mock(ApprovalDocumentRepository.class, invocation -> {
            if (!invocation.getMethod().getName().equals("searchVisible")) return Answers.RETURNS_DEFAULTS.answer(invocation);
            queries.incrementAndGet();
            assertThat((Boolean) invocation.getArgument(4)).isEqualTo(!"ALL".equals(status));
            assertThat((String) invocation.getArgument(5)).isEqualTo("ALL".equals(status) ? "" : status);
            assertThat((Emp) invocation.getArgument(8)).isSameAs(employee);
            assertThat((Boolean) invocation.getArgument(10)).isFalse();
            assertThat((Boolean) invocation.getArgument(11)).isFalse();
            Pageable pageable = invocation.getArgument(24);
            return new PageImpl<>(List.of(denied, visible), pageable, 2);
        });
        ApprovalPermissionService permissions = mock(ApprovalPermissionService.class);
        ApprovalPermissionResponse deniedPermissions = mock(ApprovalPermissionResponse.class);
        ApprovalPermissionResponse allowedPermissions = mock(ApprovalPermissionResponse.class);
        when(allowedPermissions.canView()).thenReturn(true);
        when(permissions.permissions(eq(employee), eq(denied), anyList())).thenReturn(deniedPermissions);
        when(permissions.permissions(eq(employee), eq(visible), anyList())).thenReturn(allowedPermissions);
        ApprovalGlobalSearchProvider provider = new ApprovalGlobalSearchProvider(documents, mock(ApprovalLineRepository.class), permissions, mock(ApprovalDelegationService.class));

        GlobalSearchGroupResponse result = provider.search("검색", 1, employee, status);

        assertThat(queries.get()).isEqualTo(1);
        assertThat(result.items()).extracting(GlobalSearchItemResponse::targetId).containsExactly(2L);
    }

    private ApprovalDocument document(Long id, Emp requester, String status) {
        ApprovalDocument document = mock(ApprovalDocument.class);
        when(document.getApprovalId()).thenReturn(id);
        when(document.getRequester()).thenReturn(requester);
        when(document.getStatus()).thenReturn(status);
        return document;
    }

    private EffectiveMenuResponse menu(Long id, String status, boolean hidden) {
        return new EffectiveMenuResponse(id, "MENU_" + id, "검색 메뉴 " + id, "/portal/employee/home", null, "EMPLOYEE", null, status, null, 0, 0, false, hidden, true);
    }
}
