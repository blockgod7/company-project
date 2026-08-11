package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.file.AttachFileRepository;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.test.util.ReflectionTestUtils;

class ApprovalLeaveUsageServiceTest {

    private final ApprovalDocumentRepository documentRepository = mock(ApprovalDocumentRepository.class);
    private final CurrentEmpProvider currentEmpProvider = mock(CurrentEmpProvider.class);
    private final AnnualLeaveService annualLeaveService = mock(AnnualLeaveService.class);
    private final ApprovalHolidayRepository holidayRepository = mock(ApprovalHolidayRepository.class);
    private final ApprovalLeaveExclusionRepository exclusionRepository = mock(ApprovalLeaveExclusionRepository.class);
    private final ApprovalLeaveLifecycleCancellationRepository lifecycleCancellationRepository = mock(ApprovalLeaveLifecycleCancellationRepository.class);
    private final LeavePolicyService leavePolicyService = mock(LeavePolicyService.class);
    private final LeavePolicyOverrideService leavePolicyOverrideService = mock(LeavePolicyOverrideService.class);
    private final BereavementPolicyRepository bereavementPolicyRepository = mock(BereavementPolicyRepository.class);
    private final AttachFileRepository attachFileRepository = mock(AttachFileRepository.class);

    private ApprovalLeaveUsageService service;
    private Emp requester;

    @BeforeEach
    void setUp() {
        requester = mock(Emp.class);
        when(requester.getEmpId()).thenReturn(10L);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(requester);
        when(annualLeaveService.totalDays(requester, LocalDate.now().getYear())).thenReturn(BigDecimal.TEN);
        when(documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
            requester, "N", ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE, ApprovalDocument.STATUS_APPROVED
        )).thenReturn(List.of());
        when(documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
            requester, "N", ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE, ApprovalDocument.STATUS_APPROVED
        )).thenReturn(List.of());
        when(documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatusIn(
            requester, "N", ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE, List.of(ApprovalDocument.STATUS_IN_PROGRESS)
        )).thenReturn(List.of());
        when(documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatusIn(
            requester, "N", ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE, List.of(ApprovalDocument.STATUS_IN_PROGRESS)
        )).thenReturn(List.of());
        when(exclusionRepository.findByDocumentRequesterOrderByLeaveDateAsc(requester)).thenReturn(List.of());
        when(lifecycleCancellationRepository.findByEmpAndActiveYn(requester, "Y")).thenReturn(List.of());
        service = new ApprovalLeaveUsageService(
            documentRepository,
            currentEmpProvider,
            new ObjectMapper(),
            annualLeaveService,
            holidayRepository,
            exclusionRepository,
            lifecycleCancellationRepository,
            leavePolicyService,
            leavePolicyOverrideService,
            bereavementPolicyRepository,
            attachFileRepository
        );
    }

    @Test
    void summerLeaveUsesOneAnnualDay() {
        assertThat(service.daysFor("하계휴가")).isEqualByComparingTo("1");
    }

    @Test
    void inactivePolicyBlocksLeaveSelection() {
        LocalDate date = LocalDate.of(2026, 8, 3);
        LeavePolicy inactive = new LeavePolicy(
            "특별유급휴가", "특별유급휴가", false, "PAID", BigDecimal.ZERO, "FULL_DAY",
            null, null, null, "ALL", false, null, true,
            LocalDate.of(2026, 1, 1), null, "운영 중지", requester
        );
        when(leavePolicyService.resolve("특별유급휴가", date)).thenReturn(inactive);

        assertThatThrownBy(() -> service.assertSelectableLeaveDates(formData(date.toString(), "특별유급휴가")))
            .isInstanceOfSatisfying(BusinessException.class, ex ->
                assertThat(ex.getCode()).isEqualTo("LEAVE_TYPE_INACTIVE")
            );
    }

    @Test
    void annualDeductionComesFromEffectivePolicy() {
        LocalDate date = LocalDate.of(2026, 8, 3);
        LeavePolicy policy = new LeavePolicy(
            "특별차감휴가", "특별차감휴가", true, "PAID", new BigDecimal("0.5"), "HALF_DAY",
            null, null, null, "ALL", false, null, true,
            LocalDate.of(2026, 1, 1), null, "테스트", requester
        );
        when(leavePolicyService.resolve("특별차감휴가", date)).thenReturn(policy);

        assertThat(service.daysFor("특별차감휴가", date)).isEqualByComparingTo("0.5");
    }

    @Test
    void weekendCannotBeSelected() {
        assertThatThrownBy(() -> service.assertSelectableLeaveDates(formData("2026-08-01", "연차")))
            .isInstanceOfSatisfying(BusinessException.class, ex -> assertThat(ex.getCode()).isEqualTo("LEAVE_WEEKEND_NOT_ALLOWED"));
    }

    @Test
    void sickLeaveRequiresAtLeastFourteenCalendarDays() {
        assertThatThrownBy(() -> service.assertSelectableLeaveDates(formData("2026-08-03", "병가")))
            .isInstanceOfSatisfying(BusinessException.class, ex ->
                assertThat(ex.getCode()).isEqualTo("SICK_LEAVE_MINIMUM_PERIOD"));
    }

    @Test
    void unpaidLeaveIsBlockedWhenEffectiveAnnualBalanceIsTenOrMore() {
        assertThatThrownBy(() -> service.assertSelectableLeaveDates(formData("2026-08-03", "무급휴가"), requester))
            .isInstanceOfSatisfying(BusinessException.class, ex ->
                assertThat(ex.getCode()).isEqualTo("LEAVE_REASON_REQUIRED"));

        String withReason = "{\"fields\":{\"leaveReason\":\"개인 사정\",\"leaveSelectionsJson\":"
            + new ObjectMapper().valueToTree("[{\"date\":\"2026-08-03\",\"type\":\"무급휴가\",\"days\":0}]") + "}}";
        assertThatThrownBy(() -> service.assertSelectableLeaveDates(withReason, requester))
            .isInstanceOfSatisfying(BusinessException.class, ex ->
                assertThat(ex.getCode()).isEqualTo("UNPAID_LEAVE_ANNUAL_BALANCE_NOT_ELIGIBLE"));
    }

    @Test
    void requiredLeaveEvidenceChecksAttachmentPresenceOnly() {
        ApprovalDocument draft = document(301L, ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE,
            ApprovalDocument.STATUS_DRAFT, formData("2026-08-03", "병가"));

        assertThatThrownBy(() -> service.assertRequiredEvidence(draft, draft.getFormDataJson()))
            .isInstanceOfSatisfying(BusinessException.class, ex ->
                assertThat(ex.getCode()).isEqualTo("LEAVE_EVIDENCE_ATTACHMENT_REQUIRED"));
    }

    @Test
    void workersCompLeaveCannotMixCalendarYearsInOneDocument() {
        String selections = "[{\"date\":\"2026-12-31\",\"type\":\"산재요양\"},{\"date\":\"2027-01-04\",\"type\":\"산재요양\"}]";
        String formData = "{\"fields\":{\"leaveSelectionsJson\":" + new ObjectMapper().valueToTree(selections) + "}}";
        assertThatThrownBy(() -> service.assertSelectableLeaveDates(formData))
            .isInstanceOfSatisfying(BusinessException.class, ex -> assertThat(ex.getCode()).isEqualTo("LEAVE_YEAR_MIXED"));
    }

    @Test
    void managedHolidayCannotBeSelected() {
        LocalDate date = LocalDate.of(2026, 8, 3);
        when(holidayRepository.findByHolidayDateAndActiveYn(date, "Y"))
            .thenReturn(Optional.of(new ApprovalHoliday(date, "회사 지정휴일", "COMPANY_HOLIDAY", true, requester)));

        assertThatThrownBy(() -> service.assertSelectableLeaveDates(formData(date.toString(), "연차")))
            .isInstanceOfSatisfying(BusinessException.class, ex -> assertThat(ex.getCode()).isEqualTo("LEAVE_HOLIDAY_NOT_ALLOWED"));
    }

    @Test
    void annualCompanyHolidayCannotBeBypassedInALaterYear() {
        LocalDate date = LocalDate.of(2027, 8, 20);
        ApprovalHoliday annual = new ApprovalHoliday(
            LocalDate.of(2026, 8, 20), "창립기념일", "COMPANY_HOLIDAY",
            "COMPANY", "ANNUAL", null, null, true, requester
        );
        when(holidayRepository.findByHolidayDateAndActiveYn(date, "Y")).thenReturn(Optional.empty());
        when(holidayRepository.findFirstByActiveYnAndSourceTypeAndRepeatTypeAndRepeatMonthAndRepeatDay(
            "Y", "COMPANY", "ANNUAL", 8, 20
        )).thenReturn(Optional.of(annual));

        assertThatThrownBy(() -> service.assertSelectableLeaveDates(formData(date.toString(), "연차")))
            .isInstanceOfSatisfying(BusinessException.class, ex -> assertThat(ex.getCode()).isEqualTo("LEAVE_HOLIDAY_NOT_ALLOWED"));
    }

    @Test
    void spouseBirthLeaveOutsideTheLegalWindowIsRejected() {
        String formData = "{\"fields\":{\"actualBirthDate\":\"2026-08-20\","
            + "\"leaveSelectionsJson\":\"[{\\\"date\\\":\\\"2026-12-21\\\","
            + "\\\"type\\\":\\\"배우자 출산휴가\\\",\\\"days\\\":0}]\"}}";

        assertThatThrownBy(() -> service.assertNoCompletedLeaveOverlap(requester, null, formData))
            .isInstanceOfSatisfying(BusinessException.class, ex ->
                assertThat(ex.getCode()).isEqualTo("SPOUSE_BIRTH_LEAVE_PERIOD_INVALID"));
    }

    @Test
    void spouseBirthLeaveCountsContinuousWorkingDaySegmentsInsteadOfDocuments() {
        String selections = "["
            + "{\"date\":\"2026-08-24\",\"type\":\"배우자 출산휴가\"},"
            + "{\"date\":\"2026-08-26\",\"type\":\"배우자 출산휴가\"},"
            + "{\"date\":\"2026-08-28\",\"type\":\"배우자 출산휴가\"},"
            + "{\"date\":\"2026-09-01\",\"type\":\"배우자 출산휴가\"},"
            + "{\"date\":\"2026-09-03\",\"type\":\"배우자 출산휴가\"}]";
        String formData = "{\"fields\":{\"actualBirthDate\":\"2026-08-20\",\"leaveSelectionsJson\":"
            + new ObjectMapper().valueToTree(selections) + "}}";

        assertThatThrownBy(() -> service.assertNoCompletedLeaveOverlap(requester, null, formData))
            .isInstanceOfSatisfying(BusinessException.class, ex ->
                assertThat(ex.getCode()).isEqualTo("SPOUSE_BIRTH_LEAVE_SPLIT_LIMIT_EXCEEDED"));
    }

    @Test
    void insufficientAnnualLeaveIsRejected() {
        when(annualLeaveService.totalDays(requester, LocalDate.now().getYear())).thenReturn(new BigDecimal("0.5"));

        assertThatThrownBy(() -> service.assertSufficientAnnualLeave(requester, null, formData("2026-08-03", "하계휴가")))
            .isInstanceOfSatisfying(BusinessException.class, ex -> assertThat(ex.getCode()).isEqualTo("ANNUAL_LEAVE_INSUFFICIENT"));

        InOrder order = inOrder(annualLeaveService);
        order.verify(annualLeaveService).lockForSubmission(requester, 2026);
        order.verify(annualLeaveService).totalDays(requester, 2026);
    }

    @Test
    void cancellationRemovesOnlyTheReferencedOriginalDocument() {
        ApprovalDocument first = document(101L, ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE,
            ApprovalDocument.STATUS_APPROVED, formData("2026-08-03", "\uC5F0\uCC28"));
        ApprovalDocument second = document(102L, ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE,
            ApprovalDocument.STATUS_APPROVED, formData("2026-08-03", "\uC5F0\uCC28"));
        ApprovalDocument cancellation = document(201L, ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE,
            ApprovalDocument.STATUS_APPROVED, cancelFormData("2026-08-03", "\uC5F0\uCC28", 101L));
        when(documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
            requester, "N", ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE, ApprovalDocument.STATUS_APPROVED
        )).thenReturn(List.of(first, second));
        when(documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
            requester, "N", ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE, ApprovalDocument.STATUS_APPROVED
        )).thenReturn(List.of(cancellation));

        var usage = service.myUsage(2026);

        assertThat(usage.selections()).singleElement().satisfies(selection ->
            assertThat(selection.approvalId()).isEqualTo(102L)
        );
        assertThat(usage.usedAnnualDays()).isEqualTo("1");
    }

    @Test
    void sameDateHalfDayCancellationsRemainIndividuallyAddressable() {
        String sameDateHalves = "{\"fields\":{\"leaveSelectionsJson\":\"["
            + "{\\\"date\\\":\\\"2026-08-03\\\",\\\"type\\\":\\\"\\uC624\\uC804\\uBC18\\uCC28\\\",\\\"days\\\":0.5},"
            + "{\\\"date\\\":\\\"2026-08-03\\\",\\\"type\\\":\\\"\\uC624\\uD6C4\\uBC18\\uCC28\\\",\\\"days\\\":0.5}]\"}}";
        ApprovalDocument source = document(101L, ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE,
            ApprovalDocument.STATUS_APPROVED, sameDateHalves);
        ApprovalDocument cancellation = document(201L, ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE,
            ApprovalDocument.STATUS_APPROVED, cancelFormData("2026-08-03", "\uC624\uC804\uBC18\uCC28", 101L));
        when(documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
            requester, "N", ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE, ApprovalDocument.STATUS_APPROVED
        )).thenReturn(List.of(source));
        when(documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
            requester, "N", ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE, ApprovalDocument.STATUS_APPROVED
        )).thenReturn(List.of(cancellation));

        var usage = service.myUsage(2026);

        assertThat(usage.selections()).singleElement().satisfies(selection -> {
            assertThat(selection.type()).isEqualTo("\uC624\uD6C4\uBC18\uCC28");
            assertThat(selection.days()).isEqualTo("0.5");
        });
        assertThat(usage.usedAnnualDays()).isEqualTo("0.5");
    }

    @Test
    void duplicatePendingCancellationIsRejected() {
        ApprovalDocument source = document(101L, ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE,
            ApprovalDocument.STATUS_APPROVED, formData("2026-08-03", "\uC5F0\uCC28"));
        ApprovalDocument pending = document(201L, ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE,
            ApprovalDocument.STATUS_IN_PROGRESS, cancelFormData("2026-08-03", "\uC5F0\uCC28", 101L));
        when(documentRepository.findByIdForUpdate(101L)).thenReturn(Optional.of(source));
        when(documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
            requester, "N", ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE, ApprovalDocument.STATUS_APPROVED
        )).thenReturn(List.of(source));
        when(documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatusIn(
            requester, "N", ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE, List.of(ApprovalDocument.STATUS_IN_PROGRESS)
        )).thenReturn(List.of(pending));

        assertThatThrownBy(() -> service.assertLeaveCancelTargetsApproved(
            requester, null, cancelFormData("2026-08-03", "\uC5F0\uCC28", 101L)
        )).isInstanceOfSatisfying(BusinessException.class, ex ->
            assertThat(ex.getCode()).isEqualTo("LEAVE_CANCEL_ALREADY_PENDING")
        );
    }

    @Test
    void legacyPendingCancellationAlsoBlocksReferencedDuplicate() {
        ApprovalDocument source = document(101L, ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE,
            ApprovalDocument.STATUS_APPROVED, formData("2026-08-03", "\uC5F0\uCC28"));
        ApprovalDocument legacyPending = document(201L, ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE,
            ApprovalDocument.STATUS_IN_PROGRESS, formData("2026-08-03", "\uC5F0\uCC28"));
        when(documentRepository.findByIdForUpdate(101L)).thenReturn(Optional.of(source));
        when(documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
            requester, "N", ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE, ApprovalDocument.STATUS_APPROVED
        )).thenReturn(List.of(source));
        when(documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatusIn(
            requester, "N", ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE, List.of(ApprovalDocument.STATUS_IN_PROGRESS)
        )).thenReturn(List.of(legacyPending));

        assertThatThrownBy(() -> service.assertLeaveCancelTargetsApproved(
            requester, null, cancelFormData("2026-08-03", "\uC5F0\uCC28", 101L)
        )).isInstanceOfSatisfying(BusinessException.class, ex ->
            assertThat(ex.getCode()).isEqualTo("LEAVE_CANCEL_ALREADY_PENDING")
        );
    }

    @Test
    void usageCanBeLoadedForRequestedBalanceYear() {
        ApprovalDocument source = document(101L, ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE,
            ApprovalDocument.STATUS_APPROVED, formData("2025-08-04", "\uC5F0\uCC28"));
        when(documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
            requester, "N", ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE, ApprovalDocument.STATUS_APPROVED
        )).thenReturn(List.of(source));
        when(annualLeaveService.totalDays(requester, 2025)).thenReturn(new BigDecimal("12"));

        var usage = service.myUsage(2025);

        assertThat(usage.balanceYear()).isEqualTo(2025);
        assertThat(usage.usedAnnualDays()).isEqualTo("1");
        assertThat(usage.totalAnnualDays()).isEqualTo("12");
    }

    private String formData(String date, String type) {
        return "{\"fields\":{\"leaveSelectionsJson\":\"[{\\\"date\\\":\\\"" + date
            + "\\\",\\\"type\\\":\\\"" + type + "\\\",\\\"days\\\":1}]\"}}";
    }

    private String cancelFormData(String date, String type, long sourceApprovalId) {
        return "{\"fields\":{\"leaveSelectionsJson\":\"[{\\\"date\\\":\\\"" + date
            + "\\\",\\\"type\\\":\\\"" + type + "\\\",\\\"days\\\":1,\\\"sourceApprovalId\\\":"
            + sourceApprovalId + ",\\\"sourceDocumentNo\\\":\\\"LEV-2026-0001\\\"}]\"}}";
    }

    private ApprovalDocument document(Long approvalId, String templateCode, String status, String formDataJson) {
        ApprovalDocument document = ApprovalDocument.builder()
            .title("Leave")
            .content("content")
            .documentNo(templateCode + "-" + approvalId)
            .templateCode(templateCode)
            .formDataJson(formDataJson)
            .requester(requester)
            .build();
        ReflectionTestUtils.setField(document, "approvalId", approvalId);
        ReflectionTestUtils.setField(document, "status", status);
        return document;
    }
}
