package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.LeaveUsageSelectionResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.domain.work.WorkRequestEntry;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

class CompTimeLedgerServiceTest {
    private final CompTimeCreditRepository creditRepository = mock(CompTimeCreditRepository.class);
    private final CompTimeAllocationRepository allocationRepository = mock(CompTimeAllocationRepository.class);
    private final EmpRepository empRepository = mock(EmpRepository.class);
    private final CurrentEmpProvider currentEmpProvider = mock(CurrentEmpProvider.class);
    private final EmployeePermissionService permissionService = mock(EmployeePermissionService.class);
    private final NotificationService notificationService = mock(NotificationService.class);
    private final ApprovalLeaveUsageService leaveUsageService = mock(ApprovalLeaveUsageService.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final Emp manager = emp(1L, "관리자");
    private final Emp employee = emp(2L, "직원");
    private CompTimeLedgerService service;

    @BeforeEach
    void setUp() {
        service = new CompTimeLedgerService(
            creditRepository, allocationRepository, empRepository, currentEmpProvider, permissionService,
            notificationService, leaveUsageService, auditLogService, new ObjectMapper(), mock(ScheduledJobStatusService.class)
        );
        when(currentEmpProvider.getCurrentEmp()).thenReturn(manager);
        when(permissionService.hasPermission(manager, EmployeePermissionService.LEAVE_ADMIN)).thenReturn(true);
    }

    @Test
    void completedWorkSkipsShortDurationAndGrantsOneDayFromExactlyFourHours() {
        ApprovalDocument approval = document(90L, "WORK_REQUEST");
        LocalDate workDate = LocalDate.of(2026, 8, 22);
        WorkRequestEntry shortEntry = new WorkRequestEntry(approval, employee, manager, "SPECIAL", workDate,
            LocalTime.of(8, 0), LocalTime.of(11, 59), 239, "단시간 특근", true);
        ReflectionTestUtils.setField(shortEntry, "workEntryId", 901L);
        shortEntry.approve(workDate.plusDays(1).atStartOfDay());

        service.grantFromCompletedWork(shortEntry);

        verify(creditRepository, never()).save(any());

        WorkRequestEntry exactEntry = new WorkRequestEntry(approval, employee, manager, "SPECIAL", workDate,
            LocalTime.of(8, 0), LocalTime.of(12, 0), 240, "4시간 특근", true);
        ReflectionTestUtils.setField(exactEntry, "workEntryId", 902L);
        exactEntry.approve(workDate.plusDays(1).atStartOfDay());
        when(empRepository.findByIdForUpdate(employee.getEmpId())).thenReturn(Optional.of(employee));
        when(creditRepository.save(any())).thenAnswer(invocation -> {
            CompTimeCredit credit = invocation.getArgument(0);
            ReflectionTestUtils.setField(credit, "creditId", 10L);
            return credit;
        });

        service.grantFromCompletedWork(exactEntry);

        ArgumentCaptor<CompTimeCredit> captor = ArgumentCaptor.forClass(CompTimeCredit.class);
        verify(creditRepository).save(captor.capture());
        assertThat(captor.getValue().getGrantedDays()).isEqualByComparingTo("1.0");
        assertThat(captor.getValue().getExpiresOn()).isEqualTo(LocalDate.of(2026, 12, 31));
        verify(notificationService).notifyEmp(eq(employee.getEmpId()), eq("대체휴무 적립"), anyString(), eq("COMP_TIME"), eq(10L));
    }

    @Test
    void submissionReservesNearestExpiryCreditsFirst() {
        LocalDate leaveDate = LocalDate.now().plusDays(10);
        CompTimeCredit first = credit("0.5", leaveDate.plusDays(1));
        CompTimeCredit second = credit("0.5", leaveDate.plusDays(20));
        ApprovalDocument leave = document(100L, ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE);
        List<CompTimeAllocation> saved = new ArrayList<>();

        when(leaveUsageService.selectionsFor(leave)).thenReturn(List.of(selection(leaveDate)));
        when(leaveUsageService.parseDate(leaveDate.toString())).thenReturn(leaveDate);
        when(creditRepository.findUsableForUpdate(employee.getEmpId(), leaveDate)).thenReturn(List.of(first, second));
        when(allocationRepository.save(any())).thenAnswer(invocation -> {
            CompTimeAllocation allocation = invocation.getArgument(0);
            saved.add(allocation);
            return allocation;
        });

        service.reserveForSubmission(leave);

        assertThat(saved).extracting(item -> item.getCredit().getExpiresOn())
            .containsExactly(first.getExpiresOn(), second.getExpiresOn());
        assertThat(first.getReservedDays()).isEqualByComparingTo("0.5");
        assertThat(second.getReservedDays()).isEqualByComparingTo("0.5");
    }

    @Test
    void approvedCancellationRestoresOriginalCreditAllocation() {
        LocalDate leaveDate = LocalDate.now().plusDays(5);
        CompTimeCredit credit = credit("1.0", leaveDate.plusDays(20));
        ApprovalDocument leave = document(100L, ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE);
        ApprovalDocument cancel = document(101L, ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE);
        CompTimeAllocation allocation = new CompTimeAllocation(credit, leave, leaveDate, BigDecimal.ONE);
        credit.reserve(BigDecimal.ONE);

        when(allocationRepository.findByApprovalAndStatusInOrderByLeaveDateAscAllocationIdAsc(
            leave, List.of(CompTimeAllocation.RESERVED)
        )).thenReturn(List.of(allocation));
        service.consumeOnFinalApproval(leave);
        assertThat(credit.getUsedDays()).isEqualByComparingTo("1.0");

        when(leaveUsageService.selectionsFor(cancel)).thenReturn(List.of(selection(leaveDate)));
        when(leaveUsageService.parseDate(leaveDate.toString())).thenReturn(leaveDate);
        when(allocationRepository.findByApprovalRequesterEmpIdAndLeaveDateAndStatusOrderByAllocationIdAsc(
            employee.getEmpId(), leaveDate, CompTimeAllocation.USED
        )).thenReturn(List.of(allocation));

        service.consumeOnFinalApproval(cancel);

        assertThat(allocation.getStatus()).isEqualTo(CompTimeAllocation.RESTORED);
        assertThat(allocation.getRestoredByApproval()).isSameAs(cancel);
        assertThat(credit.availableDays()).isEqualByComparingTo("1.0");
    }

    @Test
    void plannedWorkCannotGenerateCreditAndExistingSourceIsIdempotent() {
        LocalDate date = LocalDate.now().minusDays(2);
        WorkRequestEntry entry = new WorkRequestEntry(document(90L, "WORK_REQUEST"), employee, manager,
            "SPECIAL", date, LocalTime.of(8, 0), LocalTime.of(12, 0), 240, "검증", true);
        ReflectionTestUtils.setField(entry, "workEntryId", 902L);
        service.grantFromCompletedWork(entry);
        verify(creditRepository, never()).save(any());
        entry.approve(date.atTime(12, 0));
        when(empRepository.findByIdForUpdate(employee.getEmpId())).thenReturn(Optional.of(employee));
        when(creditRepository.existsBySourceWorkEntryWorkEntryId(902L)).thenReturn(true);
        service.grantFromCompletedWork(entry);
        verify(creditRepository, never()).save(any());
    }

    @Test
    void cancellationRestoresOnlyItsSelectedSourceDocument() {
        LocalDate date = LocalDate.now().plusDays(3);
        ApprovalDocument firstLeave = document(201L, ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE);
        ApprovalDocument secondLeave = document(202L, ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE);
        ApprovalDocument cancel = document(203L, ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE);
        CompTimeCredit firstCredit = credit("1", date.plusDays(10));
        CompTimeCredit secondCredit = credit("1", date.plusDays(10));
        firstCredit.reserve(BigDecimal.ONE);
        secondCredit.reserve(BigDecimal.ONE);
        CompTimeAllocation first = new CompTimeAllocation(firstCredit, firstLeave, date, BigDecimal.ONE);
        CompTimeAllocation second = new CompTimeAllocation(secondCredit, secondLeave, date, BigDecimal.ONE);
        first.use();
        second.use();
        when(leaveUsageService.selectionsFor(cancel)).thenReturn(List.of(
            new LeaveUsageSelectionResponse(date.toString(), CompTimeLedgerService.LEAVE_TYPE, "1", 201L, null)));
        when(leaveUsageService.parseDate(date.toString())).thenReturn(date);
        when(allocationRepository.findByApprovalRequesterEmpIdAndLeaveDateAndStatusOrderByAllocationIdAsc(
            employee.getEmpId(), date, CompTimeAllocation.USED)).thenReturn(List.of(first, second));
        service.consumeOnFinalApproval(cancel);
        assertThat(first.getStatus()).isEqualTo(CompTimeAllocation.RESTORED);
        assertThat(second.getStatus()).isEqualTo(CompTimeAllocation.USED);
        assertThat(firstCredit.getUsedDays()).isEqualByComparingTo("0");
        assertThat(secondCredit.getUsedDays()).isEqualByComparingTo("1");
    }

    private CompTimeCredit credit(String days, LocalDate expiresOn) {
        return new CompTimeCredit(
            employee, LocalDate.now().minusDays(5), new BigDecimal(days), "휴일 근무", manager, expiresOn
        );
    }

    private ApprovalDocument document(Long id, String templateCode) {
        ApprovalDocument document = ApprovalDocument.builder()
            .title("휴가").content("").templateCode(templateCode).templateVersion(1).formDataJson("{}")
            .requester(employee).build();
        ReflectionTestUtils.setField(document, "approvalId", id);
        return document;
    }

    private LeaveUsageSelectionResponse selection(LocalDate date) {
        return new LeaveUsageSelectionResponse(date.toString(), CompTimeLedgerService.LEAVE_TYPE, "0", null, null);
    }

    private static Emp emp(Long id, String name) {
        try {
            java.lang.reflect.Constructor<Emp> constructor = Emp.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            Emp emp = constructor.newInstance();
            ReflectionTestUtils.setField(emp, "empId", id);
            ReflectionTestUtils.setField(emp, "empNo", "E" + id);
            ReflectionTestUtils.setField(emp, "loginId", "e" + id);
            ReflectionTestUtils.setField(emp, "passwordHash", "x");
            ReflectionTestUtils.setField(emp, "empName", name);
            ReflectionTestUtils.setField(emp, "roleCode", "USER");
            return emp;
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
