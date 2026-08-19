package com.kjh.groupware.domain.emp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.kjh.groupware.domain.approval.AnnualLeaveService;
import com.kjh.groupware.domain.approval.EmployeeLeaveLifecycleService;
import com.kjh.groupware.domain.auth.AuthRefreshTokenRepository;
import com.kjh.groupware.domain.dept.DeptRepository;
import com.kjh.groupware.domain.emp.dto.EmployeeCreateRequest;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class EmployeeManagementServiceTest {

    private EmployeeManagementService service;

    @BeforeEach
    void setUp() {
        service = new EmployeeManagementService(
            mock(EmpRepository.class),
            mock(DeptRepository.class),
            mock(EmpEmploymentHistoryRepository.class),
            mock(EmpLeavePeriodRepository.class),
            mock(EmployeePermissionService.class),
            mock(CurrentEmpProvider.class),
            mock(PasswordEncoder.class),
            mock(AuthRefreshTokenRepository.class),
            mock(AnnualLeaveService.class),
            mock(EmployeeLeaveLifecycleService.class)
        );
    }

    @Test
    void contractEmployeeRequiresBothContractDates() {
        assertThatThrownBy(() -> service.create(contractRequest(null, LocalDate.of(2027, 6, 30))))
            .isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getCode()).isEqualTo("CONTRACT_PERIOD_INVALID")
            );
    }

    @Test
    void contractEndDateCannotPrecedeStartDate() {
        assertThatThrownBy(() -> service.create(contractRequest(
            LocalDate.of(2027, 6, 30), LocalDate.of(2026, 6, 30)
        ))).isInstanceOfSatisfying(BusinessException.class, exception ->
            assertThat(exception.getCode()).isEqualTo("CONTRACT_PERIOD_INVALID")
        );
    }

    private EmployeeCreateRequest contractRequest(LocalDate contractStartDate, LocalDate contractEndDate) {
        return new EmployeeCreateRequest(
            "TEST-EMP",
            "Test Employee",
            "MALE",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            LocalDate.of(2026, 8, 19),
            "CONTRACT",
            contractStartDate,
            contractEndDate
        );
    }
}
