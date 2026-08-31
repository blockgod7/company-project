package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
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
    private final AnnualLeaveLedgerRepository ledgerRepository = mock(AnnualLeaveLedgerRepository.class);
    private final EmpRepository empRepository = mock(EmpRepository.class);
    private final ApprovedAnnualLeaveUsageReader approvedUsageReader = mock(ApprovedAnnualLeaveUsageReader.class);
    private final AnnualLeaveService service = new AnnualLeaveService(
        leaveRepository,
        ledgerRepository,
        empRepository,
        mock(com.kjh.groupware.global.security.CurrentEmpProvider.class),
        mock(com.kjh.groupware.domain.emp.EmployeePermissionService.class),
        mock(com.kjh.groupware.domain.notification.NotificationService.class),
        mock(ScheduledJobStatusService.class),
        approvedUsageReader
    );

    @BeforeEach
    void setUp() {
        org.mockito.Mockito.reset(leaveRepository, ledgerRepository, empRepository, approvedUsageReader);
    }

    @Test
    void newHireYearUsesOnlyFullMonthsAfterHireMonth() {
        assertDays(LocalDate.of(2026, 7, 15), 2026, "5");
        assertDays(LocalDate.of(2026, 5, 2), 2026, "7");
    }

    @Test
    void firstDayHireIncludesHireMonth() {
        assertDays(LocalDate.of(2026, 4, 1), 2026, "9");
        assertDays(LocalDate.of(2026, 4, 2), 2026, "8");
    }

    @Test
    void nextYearUsesCeilingHalfPlusElevenMinusApprovedPriorUsage() {
        assertNextYearDays(LocalDate.of(2025, 7, 21), "3", "15");
        assertNextYearDays(LocalDate.of(2025, 8, 27), "1.5", "15");
    }

    @Test
    void nextYearAtLeastEightyPercentUsesFifteenPlusElevenMinusApprovedPriorUsage() {
        assertNextYearDays(LocalDate.of(2025, 1, 13), "10", "16");
    }

    @Test
    void nextYearNeverDropsBelowZero() {
        assertNextYearDays(LocalDate.of(2025, 1, 13), "30", "0");
    }

    @Test
    void tenureIncreasesYearlyThroughTwentyFiveThenEveryTwoYearsToThirty() {
        assertDays(LocalDate.of(2024, 1, 15), 2026, "15");
        assertDays(LocalDate.of(2023, 5, 30), 2026, "16");
        assertDays(LocalDate.of(2022, 7, 11), 2026, "17");
        assertDays(LocalDate.of(2014, 4, 28), 2026, "25");
        assertDays(LocalDate.of(2013, 4, 1), 2026, "25");
        assertDays(LocalDate.of(2012, 4, 9), 2026, "26");
        assertDays(LocalDate.of(1990, 6, 18), 2026, "30");
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

    @Test
    void employmentChangeDoesNotOverwriteManualBalance() {
        Emp emp = mock(Emp.class);
        Emp actor = mock(Emp.class);
        int year = LocalDate.now().getYear();
        when(emp.getEmpId()).thenReturn(10L);
        EmpAnnualLeave leave = new EmpAnnualLeave(emp, year, new BigDecimal("10"));
        leave.finalizeDays(new BigDecimal("12"), "관리자 확정", actor);
        when(leaveRepository.findByEmpEmpIdAndLeaveYear(10L, year)).thenReturn(Optional.of(leave));

        service.recalculateForEmploymentChange(emp, actor);

        assertThat(leave.getFinalDays()).isEqualByComparingTo("12");
        assertThat(leave.isManual()).isTrue();
        verify(ledgerRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    private void assertDays(LocalDate employmentStartDate, int year, String expected) {
        Emp emp = mock(Emp.class);
        when(emp.currentEmploymentStartDate()).thenReturn(employmentStartDate);
        when(emp.isContractEmployee()).thenReturn(false);
        when(emp.getStatus()).thenReturn("ACTIVE");
        AnnualLeaveService.Calculation calculation = service.calculate(emp, year);
        assertThat(calculation.days()).isEqualByComparingTo(new BigDecimal(expected));
    }

    private void assertNextYearDays(LocalDate employmentStartDate, String approvedUsage, String expected) {
        Emp emp = mock(Emp.class);
        when(emp.currentEmploymentStartDate()).thenReturn(employmentStartDate);
        when(emp.isContractEmployee()).thenReturn(false);
        when(emp.getStatus()).thenReturn("ACTIVE");
        when(approvedUsageReader.approvedAnnualDays(emp, employmentStartDate.getYear()))
            .thenReturn(new BigDecimal(approvedUsage));

        AnnualLeaveService.Calculation calculation = service.calculate(emp, employmentStartDate.getYear() + 1);

        assertThat(calculation.days()).isEqualByComparingTo(new BigDecimal(expected));
    }
}
