package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.LeavePolicyRequest;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class LeavePolicyServiceTest {
    private final LeavePolicyRepository repository = mock(LeavePolicyRepository.class);
    private final CurrentEmpProvider current = mock(CurrentEmpProvider.class);
    private final EmployeePermissionService permissions = mock(EmployeePermissionService.class);
    private final LeavePolicyService service = new LeavePolicyService(
        repository,
        current,
        permissions,
        mock(AuditLogService.class),
        new ObjectMapper()
    );

    @Test
    void activeListPrioritizesAnnualAndHalfDaysAndExcludesRemovedTypes() {
        LocalDate date = LocalDate.of(2026, 8, 11);
        when(repository.findAllEffective(date)).thenReturn(List.of(
            policy("병가", true),
            policy("오후반차", true),
            policy("특별유급휴가", true),
            policy("연차", true),
            policy("가족돌봄휴가", true),
            policy("오전반차", true),
            policy("자녀돌봄휴가", true),
            policy("하계휴가", true)
        ));

        assertThat(service.activeList(date))
            .extracting(response -> response.leaveType())
            .containsExactly("연차", "오전반차", "오후반차", "하계휴가", "병가");
    }

    @Test
    void removedLeaveTypeCannotBeReactivated() {
        Emp manager = mock(Emp.class);
        when(current.getCurrentEmp()).thenReturn(manager);
        when(permissions.hasPermission(manager, EmployeePermissionService.LEAVE_POLICY_ADMIN)).thenReturn(true);
        LeavePolicyRequest request = new LeavePolicyRequest(
            "특별유급휴가", "특별유급휴가", true, "PAID", BigDecimal.ZERO, "FULL_DAY",
            null, null, null, "ALL", false, null, true,
            LocalDate.of(2026, 1, 1), null, "재활성화"
        );

        assertThatThrownBy(() -> service.create(request, "127.0.0.1", "test"))
            .isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getCode()).isEqualTo("LEAVE_TYPE_REMOVED")
            );
    }

    private LeavePolicy policy(String type, boolean active) {
        return new LeavePolicy(
            type, type, active, "PAID", BigDecimal.ZERO, "FULL_DAY",
            null, null, null, "ALL", false, null, true,
            LocalDate.of(2026, 1, 1), null, "테스트 정책", null
        );
    }
}
