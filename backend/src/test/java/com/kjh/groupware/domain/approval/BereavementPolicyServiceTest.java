package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.BereavementPolicyRequest;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class BereavementPolicyServiceTest {
    private final BereavementPolicyRepository repository = mock(BereavementPolicyRepository.class);
    private final CurrentEmpProvider current = mock(CurrentEmpProvider.class);
    private final EmployeePermissionService permissions = mock(EmployeePermissionService.class);
    private final BereavementPolicyService service = new BereavementPolicyService(
        repository, current, permissions, mock(AuditLogService.class), new ObjectMapper()
    );

    @Test
    void canonicalizesKoreanAliasesAndRejectsOverlappingActivePolicy() {
        Emp manager = mock(Emp.class);
        when(current.getCurrentEmp()).thenReturn(manager);
        when(permissions.hasPermission(manager, EmployeePermissionService.LEAVE_ADMIN)).thenReturn(true);
        when(repository.findOverlaps(
            "DEATH", "PARENT", null,
            LocalDate.of(2026, 8, 1), LocalDate.of(9999, 12, 31)
        )).thenReturn(List.of(mock(BereavementPolicy.class)));

        BereavementPolicyRequest request = new BereavementPolicyRequest(
            "사망", "부모님", new BigDecimal("3"), "PAID", true,
            LocalDate.of(2026, 8, 1), null, true, "회사 기준 반영"
        );

        assertThatThrownBy(() -> service.create(request, "127.0.0.1", "test"))
            .isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getCode()).isEqualTo("BEREAVEMENT_POLICY_PERIOD_OVERLAP")
            );
    }

    @Test
    void catalogRejectsUnknownFreeText() {
        assertThatThrownBy(() -> BereavementCatalog.normalizeRelation("친척"))
            .isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getCode()).isEqualTo("BEREAVEMENT_RELATION_INVALID")
            );
        assertThat(BereavementCatalog.eventLabel("MARRIAGE")).isEqualTo("결혼");
    }
}
