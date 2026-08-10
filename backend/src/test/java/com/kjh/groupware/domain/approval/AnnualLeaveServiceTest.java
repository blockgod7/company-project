package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

class AnnualLeaveServiceTest {

    private final EmpAnnualLeaveRepository leaveRepository = mock(EmpAnnualLeaveRepository.class);
    private final EmpRepository empRepository = mock(EmpRepository.class);
    private final AnnualLeaveService service = new AnnualLeaveService(
        leaveRepository,
        mock(AnnualLeaveLedgerRepository.class),
        empRepository,
        mock(com.kjh.groupware.global.security.CurrentEmpProvider.class),
        mock(com.kjh.groupware.domain.emp.EmployeePermissionService.class),
        mock(com.kjh.groupware.domain.notification.NotificationService.class),
        mock(ScheduledJobStatusService.class)
    );

    @BeforeEach
    void setUp() {
        org.mockito.Mockito.reset(leaveRepository, empRepository);
    }

    @Test
    void newHireYearUsesOnlyFullMonthsAfterHireMonth() {
        assertDays(LocalDate.of(2026, 7, 15), 2026, "5");
        assertDays(LocalDate.of(2026, 5, 2), 2026, "7");
    }

    @Test
    void nextYearBelowEightyPercentUsesProrationPlusPreAnniversaryMonths() {
        assertDays(LocalDate.of(2026, 5, 2), 2027, "14");
    }

    @Test
    void rehireDateBecomesCurrentEmploymentStartDateForCalculation() {
        assertDays(LocalDate.of(2026, 10, 13), 2026, "2");
    }

    @Test
    void submissionLockSerializesBalanceCreationThenLocksEmployeeYearRow() {
        Emp emp = mock(Emp.class);
        EmpAnnualLeave leave = mock(EmpAnnualLeave.class);
        when(emp.getEmpId()).thenReturn(10L);
        when(empRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(emp));
        when(leaveRepository.findByEmpEmpIdAndLeaveYear(10L, 2026)).thenReturn(Optional.of(leave));
        when(leaveRepository.findByEmpEmpIdAndLeaveYearForUpdate(10L, 2026)).thenReturn(Optional.of(leave));

        service.lockForSubmission(emp, 2026);

        InOrder order = inOrder(empRepository, leaveRepository);
        order.verify(empRepository).findByIdForUpdate(10L);
        order.verify(leaveRepository).findByEmpEmpIdAndLeaveYear(10L, 2026);
        order.verify(leaveRepository).flush();
        order.verify(leaveRepository).findByEmpEmpIdAndLeaveYearForUpdate(10L, 2026);
        verify(leaveRepository).findByEmpEmpIdAndLeaveYearForUpdate(10L, 2026);
    }

    private void assertDays(LocalDate employmentStartDate, int year, String expected) {
        Emp emp = mock(Emp.class);
        when(emp.currentEmploymentStartDate()).thenReturn(employmentStartDate);
        when(emp.isContractEmployee()).thenReturn(false);
        when(emp.getStatus()).thenReturn("ACTIVE");
        AnnualLeaveService.Calculation calculation = service.calculate(emp, year);
        assertThat(calculation.days()).isEqualByComparingTo(new BigDecimal(expected));
    }
}
