package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayOfficialImpactResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayOfficialSyncRequest;
import com.kjh.groupware.domain.approval.dto.LeaveUsageSelectionResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

class ApprovalHolidayServiceTest {

    @Test
    void rejectsMismatchedLegalAndCompanyHolidayTypes() {
        ApprovalHolidayRepository holidayRepository = mock(ApprovalHolidayRepository.class);
        CurrentEmpProvider currentEmpProvider = mock(CurrentEmpProvider.class);
        EmployeePermissionService employeePermissionService = mock(EmployeePermissionService.class);
        Emp editor = mock(Emp.class);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(editor);
        when(employeePermissionService.hasPermission(editor, EmployeePermissionService.LEAVE_ADMIN)).thenReturn(true);
        ApprovalHolidayService service = service(
            holidayRepository,
            mock(ApprovalLeaveExclusionRepository.class),
            mock(ApprovalDocumentRepository.class),
            currentEmpProvider,
            mock(AuditLogService.class),
            employeePermissionService
        );

        assertThatThrownBy(() -> service.create(
            new ApprovalHolidayRequest(
                LocalDate.of(2026, 8, 20), "잘못된 법정공휴일", "COMPANY_HOLIDAY", false,
                "LEGAL", "YEAR_ONLY", null, null
            ),
            "127.0.0.1",
            "test"
        )).isInstanceOfSatisfying(BusinessException.class, exception ->
            assertThat(exception.getCode()).isEqualTo("LEGAL_HOLIDAY_TYPE_INVALID")
        );
    }

    @Test
    void officialHolidayRequiresReasonForExceptionChange() {
        ApprovalHolidayRepository holidayRepository = mock(ApprovalHolidayRepository.class);
        ApprovalLeaveExclusionRepository exclusionRepository = mock(ApprovalLeaveExclusionRepository.class);
        CurrentEmpProvider currentEmpProvider = mock(CurrentEmpProvider.class);
        EmployeePermissionService employeePermissionService = mock(EmployeePermissionService.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        Emp editor = mock(Emp.class);
        when(editor.getEmpId()).thenReturn(1L);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(editor);
        when(employeePermissionService.hasPermission(editor, EmployeePermissionService.LEAVE_ADMIN)).thenReturn(true);
        ApprovalHoliday official = new ApprovalHoliday(
            LocalDate.of(2026, 1, 1), "신정", "PUBLIC_HOLIDAY", "LEGAL", "YEAR_ONLY",
            "KASA-2026-AMENDED-2026-04-30", "https://example.test/2026", true, editor
        );
        ReflectionTestUtils.setField(official, "holidayId", 11L);
        when(holidayRepository.findById(11L)).thenReturn(Optional.of(official));
        when(exclusionRepository.findByHolidayAndActiveYn(official, "Y")).thenReturn(List.of());
        ApprovalHolidayService service = service(
            holidayRepository,
            exclusionRepository,
            mock(ApprovalDocumentRepository.class),
            currentEmpProvider,
            auditLogService,
            employeePermissionService
        );

        assertThatThrownBy(() -> service.delete(11L, "127.0.0.1", "test"))
            .isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getCode()).isEqualTo("OFFICIAL_HOLIDAY_OVERRIDE_REASON_REQUIRED")
            );

        ApprovalHolidayResponse result = service.delete(11L, "노사 합의에 따른 예외", "127.0.0.1", "test");
        assertThat(result.active()).isFalse();
        verify(auditLogService).record(
            any(), any(), any(), any(), any(), any(), any(), any(),
            org.mockito.ArgumentMatchers.eq("노사 합의에 따른 예외"),
            org.mockito.ArgumentMatchers.eq(true)
        );
    }

    @Test
    void officialSyncRequiresFreshPreviewAndUsesYearSpecificSource() {
        ApprovalHolidayRepository holidayRepository = mock(ApprovalHolidayRepository.class);
        ApprovalDocumentRepository documentRepository = mock(ApprovalDocumentRepository.class);
        CurrentEmpProvider currentEmpProvider = mock(CurrentEmpProvider.class);
        EmployeePermissionService employeePermissionService = mock(EmployeePermissionService.class);
        Emp editor = mock(Emp.class);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(editor);
        when(employeePermissionService.hasPermission(editor, EmployeePermissionService.LEAVE_ADMIN)).thenReturn(true);
        when(documentRepository.findByDeletedYnAndTemplateCodeAndStatus(
            "N", ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE, ApprovalDocument.STATUS_APPROVED
        )).thenReturn(List.of());
        ApprovalHolidayService service = service(
            holidayRepository,
            mock(ApprovalLeaveExclusionRepository.class),
            documentRepository,
            currentEmpProvider,
            mock(AuditLogService.class),
            employeePermissionService
        );

        ApprovalHolidayOfficialImpactResponse preview2026 = service.previewOfficial(2026);
        ApprovalHolidayOfficialImpactResponse preview2027 = service.previewOfficial(2027);

        assertThat(preview2026.basisSource()).isEqualTo("https://astro.kasi.re.kr/life/post/calendardata");
        assertThat(preview2027.basisSource()).contains("kasa.go.kr");
        assertThat(preview2026.basisSource()).isNotEqualTo(preview2027.basisSource());
        assertThat(preview2026.previewToken()).hasSize(64);
        assertThatThrownBy(() -> service.syncOfficial(
            2026,
            new ApprovalHolidayOfficialSyncRequest("stale-token", null),
            "127.0.0.1",
            "test"
        )).isInstanceOfSatisfying(BusinessException.class, exception ->
            assertThat(exception.getCode()).isEqualTo("OFFICIAL_HOLIDAY_PREVIEW_STALE")
        );
    }

    @Test
    void companyAnnualHolidayIsExposedOnTheSameMonthAndDayInLaterYears() {
        ApprovalHolidayRepository holidayRepository = mock(ApprovalHolidayRepository.class);
        ApprovalHoliday annual = new ApprovalHoliday(
            LocalDate.of(2026, 8, 20),
            "창립기념일",
            "COMPANY_HOLIDAY",
            "COMPANY",
            "ANNUAL",
            null,
            "취업규칙",
            true,
            null
        );
        when(holidayRepository.findByActiveYnOrderByHolidayDateAsc("Y")).thenReturn(List.of(annual));

        ApprovalHolidayService service = new ApprovalHolidayService(
            holidayRepository,
            mock(ApprovalLeaveExclusionRepository.class),
            mock(ApprovalDocumentRepository.class),
            mock(ApprovalLineRepository.class),
            mock(ApprovalLeaveUsageService.class),
            mock(ApprovalPermissionService.class),
            mock(CurrentEmpProvider.class),
            mock(NotificationService.class),
            mock(AuditLogService.class),
            new ObjectMapper(),
            mock(EmployeePermissionService.class),
            mock(CompTimeLedgerService.class),
            officialProvider()
        );

        List<ApprovalHolidayResponse> result = service.active(
            LocalDate.of(2027, 8, 1),
            LocalDate.of(2027, 8, 31)
        );

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().holidayDate()).isEqualTo(LocalDate.of(2027, 8, 20));
        assertThat(result.getFirst().repeatType()).isEqualTo("ANNUAL");
        assertThat(result.getFirst().sourceType()).isEqualTo("COMPANY");
    }

    @Test
    void creatingHolidayExcludesOnlyMatchingDateAndRestoresAnnualDay() {
        ApprovalHolidayRepository holidayRepository = mock(ApprovalHolidayRepository.class);
        ApprovalLeaveExclusionRepository exclusionRepository = mock(ApprovalLeaveExclusionRepository.class);
        ApprovalDocumentRepository documentRepository = mock(ApprovalDocumentRepository.class);
        ApprovalLineRepository lineRepository = mock(ApprovalLineRepository.class);
        ApprovalLeaveUsageService leaveUsageService = mock(ApprovalLeaveUsageService.class);
        ApprovalPermissionService permissionService = mock(ApprovalPermissionService.class);
        CurrentEmpProvider currentEmpProvider = mock(CurrentEmpProvider.class);
        NotificationService notificationService = mock(NotificationService.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        EmployeePermissionService employeePermissionService = mock(EmployeePermissionService.class);

        Emp editor = mock(Emp.class);
        when(editor.getRoleCode()).thenReturn("ADMIN");
        when(editor.getEmpId()).thenReturn(1L);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(editor);
        when(employeePermissionService.hasPermission(editor, EmployeePermissionService.LEAVE_ADMIN)).thenReturn(true);

        Emp requester = mock(Emp.class);
        when(requester.getEmpId()).thenReturn(10L);
        ApprovalDocument document = mock(ApprovalDocument.class);
        when(document.getApprovalId()).thenReturn(100L);
        when(document.getRequester()).thenReturn(requester);

        LocalDate holidayDate = LocalDate.of(2026, 8, 17);
        ApprovalHoliday persistedHoliday = new ApprovalHoliday(holidayDate, "회사 지정휴일", "COMPANY_HOLIDAY", false, editor);
        ReflectionTestUtils.setField(persistedHoliday, "holidayId", 5L);
        when(holidayRepository.findByHolidayDate(holidayDate)).thenReturn(Optional.empty());
        when(holidayRepository.saveAndFlush(any(ApprovalHoliday.class))).thenReturn(persistedHoliday);
        when(holidayRepository.findById(5L)).thenReturn(Optional.of(persistedHoliday));
        when(documentRepository.findByDeletedYnAndTemplateCodeAndStatus(
            "N", ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE, ApprovalDocument.STATUS_APPROVED
        )).thenReturn(List.of(document));
        when(leaveUsageService.selectionsFor(document)).thenReturn(List.of(
            new LeaveUsageSelectionResponse("2026-08-17", "하계휴가", "1", 100L, "LEV-2026-001"),
            new LeaveUsageSelectionResponse("2026-08-18", "연차", "1", 100L, "LEV-2026-001")
        ));
        when(leaveUsageService.daysFor("하계휴가", holidayDate)).thenReturn(java.math.BigDecimal.ONE);
        when(exclusionRepository.existsByDocumentAndLeaveDateAndActiveYn(document, holidayDate, "Y")).thenReturn(false);
        when(exclusionRepository.saveAndFlush(any(ApprovalLeaveExclusion.class))).thenAnswer(invocation -> {
            ApprovalLeaveExclusion exclusion = invocation.getArgument(0);
            ReflectionTestUtils.setField(exclusion, "exclusionId", 7L);
            return exclusion;
        });

        ApprovalHolidayService service = new ApprovalHolidayService(
            holidayRepository,
            exclusionRepository,
            documentRepository,
            lineRepository,
            leaveUsageService,
            permissionService,
            currentEmpProvider,
            notificationService,
            auditLogService,
            new ObjectMapper(),
            employeePermissionService,
            mock(CompTimeLedgerService.class),
            officialProvider()
        );

        ApprovalHolidayResponse holiday = service.create(
            new ApprovalHolidayRequest(holidayDate, "회사 지정휴일", "COMPANY_HOLIDAY", true),
            "127.0.0.1",
            "test"
        );
        service.activate(holiday.holidayId(), "127.0.0.1", "test");

        ArgumentCaptor<ApprovalLeaveExclusion> captor = ArgumentCaptor.forClass(ApprovalLeaveExclusion.class);
        verify(exclusionRepository).saveAndFlush(captor.capture());
        ApprovalLeaveExclusion exclusion = captor.getValue();
        assertThat(exclusion.getLeaveDate()).isEqualTo(holidayDate);
        assertThat(exclusion.getLeaveType()).isEqualTo("하계휴가");
        assertThat(exclusion.getRestoredDays()).isEqualByComparingTo("1");
        verify(notificationService).notifyEmp(
            10L,
            "휴가 연차 자동 복원",
            "2026-08-17 휴가가 회사 지정휴일 지정으로 제외되어 1일이 복원되었습니다.",
            "APPROVAL",
            100L
        );
    }

    @Test
    void annualCompanyHolidayImpactIncludesApprovedLeaveInLaterYear() {
        ApprovalHolidayRepository holidayRepository = mock(ApprovalHolidayRepository.class);
        ApprovalLeaveExclusionRepository exclusionRepository = mock(ApprovalLeaveExclusionRepository.class);
        ApprovalDocumentRepository documentRepository = mock(ApprovalDocumentRepository.class);
        ApprovalLeaveUsageService leaveUsageService = mock(ApprovalLeaveUsageService.class);
        CurrentEmpProvider currentEmpProvider = mock(CurrentEmpProvider.class);
        EmployeePermissionService permissions = mock(EmployeePermissionService.class);
        Emp manager = mock(Emp.class);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(manager);
        when(permissions.hasPermission(manager, EmployeePermissionService.LEAVE_ADMIN)).thenReturn(true);

        ApprovalHoliday annual = new ApprovalHoliday(
            LocalDate.of(2026, 8, 20), "창립기념일", "COMPANY_HOLIDAY",
            "COMPANY", "ANNUAL", null, "취업규칙", false, manager
        );
        ReflectionTestUtils.setField(annual, "holidayId", 20L);
        when(holidayRepository.findById(20L)).thenReturn(Optional.of(annual));
        Emp requester = mock(Emp.class);
        when(requester.getEmpId()).thenReturn(10L);
        when(requester.getEmpName()).thenReturn("신청자");
        ApprovalDocument document = mock(ApprovalDocument.class);
        when(document.getApprovalId()).thenReturn(100L);
        when(document.getRequester()).thenReturn(requester);
        when(documentRepository.findByDeletedYnAndTemplateCodeAndStatus(
            "N", ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE, ApprovalDocument.STATUS_APPROVED
        )).thenReturn(List.of(document));
        LeaveUsageSelectionResponse selection = new LeaveUsageSelectionResponse(
            "2027-08-20", "연차", "1", 100L, "LEV-2027-001"
        );
        when(leaveUsageService.selectionsFor(document)).thenReturn(List.of(selection));
        when(leaveUsageService.parseDate("2027-08-20")).thenReturn(LocalDate.of(2027, 8, 20));

        ApprovalHolidayService service = new ApprovalHolidayService(
            holidayRepository, exclusionRepository, documentRepository, mock(ApprovalLineRepository.class),
            leaveUsageService, mock(ApprovalPermissionService.class), currentEmpProvider, mock(NotificationService.class),
            mock(AuditLogService.class), new ObjectMapper(), permissions, mock(CompTimeLedgerService.class),
            officialProvider()
        );

        com.kjh.groupware.domain.approval.dto.ApprovalHolidayImpactResponse impact = service.impact(20L);

        assertThat(impact.affectedCount()).isEqualTo(1);
        assertThat(impact.items().getFirst().leaveDate()).isEqualTo("2027-08-20");
    }

    private ApprovalHolidayService service(
        ApprovalHolidayRepository holidayRepository,
        ApprovalLeaveExclusionRepository exclusionRepository,
        ApprovalDocumentRepository documentRepository,
        CurrentEmpProvider currentEmpProvider,
        AuditLogService auditLogService,
        EmployeePermissionService employeePermissionService
    ) {
        return new ApprovalHolidayService(
            holidayRepository,
            exclusionRepository,
            documentRepository,
            mock(ApprovalLineRepository.class),
            mock(ApprovalLeaveUsageService.class),
            mock(ApprovalPermissionService.class),
            currentEmpProvider,
            mock(NotificationService.class),
            auditLogService,
            new ObjectMapper(),
            employeePermissionService,
            mock(CompTimeLedgerService.class),
            officialProvider()
        );
    }

    private ApprovalHolidayOfficialProvider officialProvider() {
        return new ApprovalHolidayOfficialProvider(mock(KoreanPublicHolidayClient.class));
    }
}
