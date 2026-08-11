package com.kjh.groupware.domain.approval;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.LeaveExclusionResponse;
import com.kjh.groupware.domain.approval.dto.LeaveUsageResponse;
import com.kjh.groupware.domain.approval.dto.LeaveUsageSelectionResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalLeaveUsageService {

    static final String LEAVE_TEMPLATE_CODE = "LEAVE";
    static final String LEAVE_CANCEL_TEMPLATE_CODE = "LEAVE_CANCEL";
    private final ApprovalDocumentRepository documentRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final ObjectMapper objectMapper;
    private final AnnualLeaveService annualLeaveService;
    private final ApprovalHolidayRepository holidayRepository;
    private final ApprovalLeaveExclusionRepository exclusionRepository;
    private final ApprovalLeaveLifecycleCancellationRepository lifecycleCancellationRepository;
    private final LeavePolicyService leavePolicyService;
    private final LeavePolicyOverrideService leavePolicyOverrideService;
    private final BereavementPolicyRepository bereavementPolicyRepository;

    private static final Set<String> LEAVE_TYPES = Set.of(
        "연차", "하계휴가", "오전반차", "오후반차", "공가", "공가(오전)", "공가(오후)",
        "경조", "대체휴무", "병가", "산재요양", "무급휴가", "배우자 출산휴가",
        "출산전후휴가", "여성휴가", "유산·사산휴가", "난임치료휴가", "육아휴직"
    );
    private static final Set<String> CROSS_YEAR_TYPES = Set.of();
    private static final Set<String> REASON_REQUIRED_TYPES = Set.of("공가", "공가(오전)", "공가(오후)", "무급휴가");

    @Transactional(readOnly = true)
    public LeaveUsageResponse myUsage() {
        return myUsage(null);
    }

    @Transactional(readOnly = true)
    public LeaveUsageResponse myUsage(Integer requestedYear) {
        int balanceYear = requestedYear == null ? LocalDate.now().getYear() : requestedYear;
        if (balanceYear < 1900 || balanceYear > 2100) {
            throw BusinessException.badRequest("LEAVE_YEAR_INVALID", "Leave balance year is invalid");
        }
        return usageFor(currentEmpProvider.getCurrentEmp(), null, balanceYear);
    }

    @Transactional(readOnly = true)
    public void assertNoCompletedLeaveOverlap(ApprovalDocument document) {
        if (!LEAVE_TEMPLATE_CODE.equals(document.getTemplateCode())) {
            return;
        }
        assertNoCompletedLeaveOverlap(document.getRequester(), document.getApprovalId(), document.getFormDataJson());
    }

    @Transactional(readOnly = true)
    public void assertSelectableLeaveDates(ApprovalDocument document) {
        if (LEAVE_TEMPLATE_CODE.equals(document.getTemplateCode())) {
            assertSelectableLeaveDates(document.getFormDataJson(), document.getRequester());
        }
    }

    @Transactional(readOnly = true)
    public void assertSelectableLeaveDates(String formDataJson) {
        assertSelectableLeaveDates(formDataJson, null);
    }

    void assertSelectableLeaveDates(String formDataJson, Emp requester) {
        List<LeaveUsageSelectionResponse> selections = selectionsFrom(formDataJson, null, null);
        JsonNode fields = formFields(formDataJson);
        boolean structuredSelections = fields.hasNonNull("leaveSelectionsJson")
            && !fields.path("leaveSelectionsJson").asText("").isBlank();
        if (selections.isEmpty()) {
            throw BusinessException.badRequest("LEAVE_DATE_REQUIRED", "휴가 날짜를 한 개 이상 선택해 주세요.");
        }
        Set<LocalDate> selectedDates = new HashSet<>();
        Set<Integer> restrictedYears = new HashSet<>();
        Set<String> selectedTypes = new HashSet<>();
        Set<YearMonth> womenLeaveMonths = new HashSet<>();
        Map<String, BigDecimal> requestedPolicyDays = new LinkedHashMap<>();
        for (LeaveUsageSelectionResponse selection : selections) {
            LocalDate date = parseDate(selection.date());
            selectedTypes.add(selection.type());
            LeavePolicy policy = leavePolicyService.resolve(selection.type(), date);
            if (structuredSelections && policy != null && !policy.isActive()) {
                throw BusinessException.badRequest("LEAVE_TYPE_INACTIVE", selection.type() + "은 현재 사용할 수 없는 휴가 종류입니다.");
            }
            if (structuredSelections && policy == null && !LEAVE_TYPES.contains(selection.type())) {
                throw BusinessException.badRequest("LEAVE_TYPE_INVALID", selection.type() + "은 사용할 수 없는 휴가 종류입니다.");
            }
            if (requester != null && policy != null && !"ALL".equals(policy.getGenderRestriction())
                && !policy.getGenderRestriction().equals(requester.getGenderCode())) {
                throw BusinessException.badRequest("LEAVE_POLICY_GENDER_RESTRICTED", selection.type() + "은 성별 제한으로 신청할 수 없습니다.");
            }
            BigDecimal usageDays = policy != null && "HALF_DAY".equals(policy.getUnitType())
                ? new BigDecimal("0.5") : BigDecimal.ONE;
            requestedPolicyDays.merge(selection.type(), usageDays, BigDecimal::add);
            if ("여성휴가".equals(selection.type()) && !womenLeaveMonths.add(YearMonth.from(date))) {
                throw BusinessException.badRequest(
                    "WOMEN_LEAVE_MONTHLY_LIMIT",
                    "여성휴가는 같은 달에 한 번만 신청할 수 있습니다."
                );
            }
            if (!selectedDates.add(date)) {
                throw BusinessException.badRequest("LEAVE_DATE_DUPLICATED", date + " 날짜가 중복 선택되었습니다.");
            }
            if (!CROSS_YEAR_TYPES.contains(selection.type())) {
                restrictedYears.add(date.getYear());
            }
            if (date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY) {
                throw BusinessException.badRequest("LEAVE_WEEKEND_NOT_ALLOWED", date + "은 주말이라 선택할 수 없습니다.");
            }
            holidayRepository.findByHolidayDateAndActiveYn(date, "Y")
                .or(() -> holidayRepository.findFirstByActiveYnAndSourceTypeAndRepeatTypeAndRepeatMonthAndRepeatDay(
                    "Y", "COMPANY", "ANNUAL", date.getMonthValue(), date.getDayOfMonth()
                ))
                .ifPresent(holiday -> {
                throw BusinessException.badRequest(
                    "LEAVE_HOLIDAY_NOT_ALLOWED",
                    date + "은 " + holiday.getHolidayName() + "이라 선택할 수 없습니다."
                );
            });
        }
        for (Map.Entry<String, BigDecimal> entry : requestedPolicyDays.entrySet()) {
            LocalDate firstDate = selections.stream().filter(item -> entry.getKey().equals(item.type()))
                .map(item -> parseDate(item.date())).findFirst().orElse(LocalDate.now());
            LeavePolicy policy = leavePolicyService.resolve(entry.getKey(), firstDate);
            if (policy != null && policy.getMaxDays() != null && entry.getValue().compareTo(policy.getMaxDays()) > 0) {
                throw BusinessException.badRequest(
                    "LEAVE_POLICY_MAX_DAYS_EXCEEDED",
                    entry.getKey() + "은 한 신청에서 최대 " + formatDay(policy.getMaxDays()) + "일까지 사용할 수 있습니다."
                );
            }
        }
        if (restrictedYears.size() > 1) {
            throw BusinessException.badRequest("LEAVE_YEAR_MIXED", "한 휴가계에는 같은 연도의 날짜만 선택할 수 있습니다.");
        }
        if (requester != null && selectedTypes.contains("여성휴가") && !"FEMALE".equals(requester.getGenderCode())) {
            throw BusinessException.badRequest("WOMEN_LEAVE_NOT_ELIGIBLE", "여성휴가는 직원 정보의 성별이 여성인 경우에만 신청할 수 있습니다.");
        }
        if (selectedTypes.stream().anyMatch(REASON_REQUIRED_TYPES::contains)
            && fields.path("leaveReason").asText("").isBlank()) {
            throw BusinessException.badRequest("LEAVE_REASON_REQUIRED", "선택한 휴가의 구체적인 신청 사유를 입력해 주세요.");
        }
        if ((selectedTypes.contains("배우자 출산휴가") || selectedTypes.contains("출산전후휴가"))
            && fields.path("expectedBirthDate").asText("").isBlank()
            && fields.path("actualBirthDate").asText("").isBlank()) {
            throw BusinessException.badRequest("BIRTH_DATE_REQUIRED", "출산 예정일 또는 실제 출산일을 입력해 주세요.");
        }
        if (selectedTypes.contains("경조")) {
            String eventTypeRaw = fields.path("familyEventType").asText("").trim();
            String relationRaw = fields.path("familyRelation").asText("").trim();
            String eventType = eventTypeRaw.isBlank() ? "" : BereavementCatalog.normalizeEvent(eventTypeRaw);
            String relation = relationRaw.isBlank() ? "" : BereavementCatalog.normalizeRelation(relationRaw);
            if (eventType.isBlank() || relation.isBlank()) {
                throw BusinessException.badRequest("BEREAVEMENT_DETAIL_REQUIRED", "경조 유형과 대상 관계를 입력해 주세요.");
            }
            List<LocalDate> dates = selections.stream().filter(item -> "경조".equals(item.type()))
                .map(item -> parseDate(item.date())).sorted().toList();
            BereavementPolicy bereavement = bereavementPolicyRepository.findEffective(eventType, relation, dates.getFirst()).stream()
                .findFirst().orElseThrow(() -> BusinessException.badRequest(
                    "BEREAVEMENT_POLICY_NOT_CONFIGURED", "해당 경조 유형·관계에 적용되는 관리자 기준표가 없습니다."
                ));
            if (BigDecimal.valueOf(dates.size()).compareTo(bereavement.getAllowedDays()) > 0) {
                throw BusinessException.badRequest("BEREAVEMENT_DAYS_EXCEEDED", "경조휴가는 기준표상 최대 " + formatDay(bereavement.getAllowedDays()) + "일입니다.");
            }
        }
    }

    @Transactional
    public void assertSufficientAnnualLeave(Emp requester, Long excludeApprovalId, String formDataJson) {
        List<LeaveUsageSelectionResponse> requestedSelections = selectionsFrom(formDataJson, null, null);
        BigDecimal requestedDays = requestedSelections.stream()
            .map(selection -> daysFor(selection.type(), parseDate(selection.date())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        int leaveYear = requestedSelections.stream()
            .filter(selection -> daysFor(selection.type(), parseDate(selection.date())).compareTo(BigDecimal.ZERO) > 0)
            .map(selection -> parseDate(selection.date()).getYear())
            .findFirst()
            .orElse(LocalDate.now().getYear());
        annualLeaveService.lockForSubmission(requester, leaveYear);
        LeaveUsageResponse usage = usageFor(requester, excludeApprovalId, leaveYear);
        BigDecimal remainingDays = new BigDecimal(usage.remainingAnnualDays());
        BigDecimal reservedDays = new BigDecimal(usage.reservedAnnualDays());
        if (requestedDays.add(reservedDays).compareTo(remainingDays) > 0) {
            throw BusinessException.badRequest(
                "ANNUAL_LEAVE_INSUFFICIENT",
                "결재 중 휴가를 포함하면 잔여 연차가 부족합니다. 결재 중 " + formatDay(reservedDays)
                    + "일 / 이번 신청 " + formatDay(requestedDays) + "일 / 잔여 " + formatDay(remainingDays) + "일"
            );
        }
    }

    @Transactional
    public void assertSufficientAnnualLeave(ApprovalDocument document) {
        if (LEAVE_TEMPLATE_CODE.equals(document.getTemplateCode())) {
            assertSufficientAnnualLeave(document.getRequester(), document.getApprovalId(), document.getFormDataJson());
        }
    }

    @Transactional
    public void assertLeaveCancelTargetsApproved(ApprovalDocument document) {
        if (!LEAVE_CANCEL_TEMPLATE_CODE.equals(document.getTemplateCode())) {
            return;
        }
        assertLeaveCancelTargetsApproved(document.getRequester(), document.getApprovalId(), document.getFormDataJson());
    }

    @Transactional
    public void assertLeaveCancelTargetsApproved(Emp requester, Long excludeApprovalId, String formDataJson) {
        List<LeaveUsageSelectionResponse> cancelSelections = selectionsFrom(formDataJson, null, null, true);
        if (cancelSelections.isEmpty()) {
            throw BusinessException.badRequest("LEAVE_CANCEL_DATE_REQUIRED", "Leave cancel date is required");
        }
        lockReferencedLeaveDocuments(requester, cancelSelections);
        LeaveUsageResponse usage = usageFor(requester, excludeApprovalId, LocalDate.now().getYear());
        Set<String> approvedTargets = usage.selections().stream()
            .map(this::targetSelectionKey)
            .collect(java.util.stream.Collectors.toSet());
        Set<String> approvedLegacyTargets = usage.selections().stream()
            .map(this::selectionKey)
            .collect(java.util.stream.Collectors.toSet());
        Set<String> pendingTargets = usage.pendingCancelSelections().stream()
            .map(this::targetSelectionKey)
            .collect(java.util.stream.Collectors.toSet());
        Set<String> pendingLegacyTargets = usage.pendingCancelSelections().stream()
            .map(this::selectionKey)
            .collect(java.util.stream.Collectors.toSet());
        for (LeaveUsageSelectionResponse selection : cancelSelections) {
            boolean referenced = selection.approvalId() != null;
            boolean alreadyPending = referenced
                ? pendingTargets.contains(targetSelectionKey(selection))
                    || pendingLegacyTargets.contains(selectionKey(selection))
                : pendingLegacyTargets.contains(selectionKey(selection));
            if (alreadyPending) {
                throw BusinessException.badRequest(
                    "LEAVE_CANCEL_ALREADY_PENDING",
                    selection.date() + " already has a leave cancellation in progress"
                );
            }
            boolean approved = referenced
                ? approvedTargets.contains(targetSelectionKey(selection))
                : approvedLegacyTargets.contains(selectionKey(selection));
            if (!approved) {
                throw BusinessException.badRequest(
                    "LEAVE_CANCEL_DATE_NOT_APPROVED",
                    selection.date() + " is not an approved leave date"
                );
            }
        }
    }

    private void lockReferencedLeaveDocuments(Emp requester, List<LeaveUsageSelectionResponse> selections) {
        selections.stream()
            .map(LeaveUsageSelectionResponse::approvalId)
            .filter(java.util.Objects::nonNull)
            .distinct()
            .sorted()
            .forEach(approvalId -> {
                ApprovalDocument source = documentRepository.findByIdForUpdate(approvalId)
                    .orElseThrow(() -> BusinessException.badRequest(
                        "LEAVE_CANCEL_SOURCE_NOT_FOUND", "The original leave document was not found"
                    ));
                if (!source.getRequester().getEmpId().equals(requester.getEmpId())
                    || !LEAVE_TEMPLATE_CODE.equals(source.getTemplateCode())
                    || !ApprovalDocument.STATUS_APPROVED.equals(source.getStatus())
                    || "Y".equals(source.getDeletedYn())) {
                    throw BusinessException.badRequest(
                        "LEAVE_CANCEL_SOURCE_INVALID", "The original leave document cannot be canceled"
                    );
                }
                Set<String> sourceSelections = selectionsFor(source).stream()
                    .map(this::selectionKey)
                    .collect(java.util.stream.Collectors.toSet());
                boolean matches = selections.stream()
                    .filter(selection -> approvalId.equals(selection.approvalId()))
                    .allMatch(selection -> sourceSelections.contains(selectionKey(selection)));
                if (!matches) {
                    throw BusinessException.badRequest(
                        "LEAVE_CANCEL_SOURCE_MISMATCH", "The selected leave date does not match the original document"
                    );
                }
            });
    }

    @Transactional(readOnly = true)
    public void assertNoCompletedLeaveOverlap(Emp requester, Long excludeApprovalId, String formDataJson) {
        LeaveUsageResponse usage = usageFor(requester, excludeApprovalId, LocalDate.now().getYear());
        for (LeaveUsageSelectionResponse selection : selectionsFrom(formDataJson, null, null)) {
            if ("여성휴가".equals(selection.type())) {
                YearMonth requestedMonth = YearMonth.from(parseDate(selection.date()));
                boolean alreadyUsedThisMonth = usage.occupiedSelections().stream()
                    .filter(existing -> "여성휴가".equals(existing.type()))
                    .anyMatch(existing -> YearMonth.from(parseDate(existing.date())).equals(requestedMonth));
                if (alreadyUsedThisMonth) {
                    throw BusinessException.badRequest(
                        "WOMEN_LEAVE_MONTHLY_LIMIT",
                        "여성휴가는 같은 달에 한 번만 신청할 수 있습니다."
                    );
                }
            }
            List<LeaveUsageSelectionResponse> occupied = usage.occupiedSelections().stream()
                .filter(existing -> existing.date().equals(selection.date()))
                .toList();
            if (occupied.stream().anyMatch(existing -> overlaps(existing.type(), selection.type()))) {
                throw BusinessException.badRequest(
                    "LEAVE_DATE_ALREADY_OCCUPIED",
                    selection.date() + "은 결재 중이거나 승인된 휴가와 시간이 겹칩니다."
                );
            }
            if ("여성휴가".equals(selection.type()) && occupied.stream().anyMatch(existing ->
                "여성휴가".equals(existing.type())
                    && parseDate(existing.date()).getYear() == parseDate(selection.date()).getYear()
                    && parseDate(existing.date()).getMonth() == parseDate(selection.date()).getMonth())) {
                throw BusinessException.badRequest("WOMEN_LEAVE_MONTHLY_LIMIT", "여성휴가는 같은 달에 한 번만 신청할 수 있습니다.");
            }
        }
        assertSpouseBirthLeavePolicy(requester, usage, formDataJson);
    }

    private void assertSpouseBirthLeavePolicy(Emp requester, LeaveUsageResponse usage, String formDataJson) {
        List<LeaveUsageSelectionResponse> requested = selectionsFrom(formDataJson, null, null).stream()
            .filter(selection -> "배우자 출산휴가".equals(selection.type()))
            .toList();
        if (requested.isEmpty()) {
            return;
        }
        JsonNode fields = formFields(formDataJson);
        String expectedText = fields.path("expectedBirthDate").asText("");
        String actualText = fields.path("actualBirthDate").asText("");
        LocalDate expected = expectedText.isBlank() ? null : parseDate(expectedText);
        LocalDate actual = actualText.isBlank() ? null : parseDate(actualText);
        LocalDate reference = actual != null ? actual : expected;
        if (reference == null) {
            throw BusinessException.badRequest(
                "BIRTH_DATE_REQUIRED",
                "배우자 출산휴가에는 출산 예정일 또는 실제 출산일이 필요합니다."
            );
        }
        LocalDate firstRequestedDate = requested.stream().map(item -> parseDate(item.date())).min(LocalDate::compareTo).orElse(reference);
        LeavePolicy policy = leavePolicyService.resolve("배우자 출산휴가", firstRequestedDate);
        LeavePolicyOverride policyOverride = leavePolicyOverrideService.activeSpouseBirth(
            requester.getEmpId(), reference
        ).orElse(null);
        int beforeDays = policy != null && policy.getPeriodBeforeDays() != null ? policy.getPeriodBeforeDays() : 50;
        int afterDays = policy != null && policy.getPeriodAfterDays() != null ? policy.getPeriodAfterDays() : 120;
        LocalDate latest = reference.plusDays(afterDays);
        LocalDate eventEarliest = expected == null ? reference : expected.minusDays(beforeDays);
        for (LeaveUsageSelectionResponse selection : requested) {
            LocalDate date = parseDate(selection.date());
            LocalDate earliest = date.isBefore(LocalDate.of(2026, 8, 20)) || expected == null
                ? reference
                : eventEarliest;
            if (date.isBefore(earliest) || date.isAfter(latest)) {
                throw BusinessException.badRequest(
                    "SPOUSE_BIRTH_LEAVE_PERIOD_INVALID",
                    "배우자 출산휴가는 법정 사용기간(2026-08-20부터 예정일 50일 전~출산일 후 120일) 안에서 사용해야 합니다."
                );
            }
        }
        List<LocalDate> occupiedDates = usage.occupiedSelections().stream()
            .filter(selection -> "배우자 출산휴가".equals(selection.type()))
            .map(selection -> parseDate(selection.date()))
            .filter(date -> !date.isBefore(eventEarliest) && !date.isAfter(latest))
            .toList();
        BigDecimal maxDays = policyOverride != null ? policyOverride.getOverrideMaxDays()
            : policy != null && policy.getMaxDays() != null ? policy.getMaxDays() : new BigDecimal("20");
        if (BigDecimal.valueOf(occupiedDates.size() + requested.size()).compareTo(maxDays) > 0) {
            throw BusinessException.badRequest(
                "SPOUSE_BIRTH_LEAVE_LIMIT_EXCEEDED",
                "배우자 출산휴가는 기존 사용·결재 중 일수를 포함해 최대 " + formatDay(maxDays) + "일입니다."
            );
        }
        List<LocalDate> allDates = new ArrayList<>(occupiedDates);
        requested.stream().map(item -> parseDate(item.date())).forEach(allDates::add);
        int maxSegments = policyOverride != null ? policyOverride.getOverrideMaxSegments()
            : policy != null && policy.getMaxSegments() != null ? policy.getMaxSegments() : 4;
        if (workingDaySegments(allDates) > maxSegments) {
            throw BusinessException.badRequest(
                "SPOUSE_BIRTH_LEAVE_SPLIT_LIMIT_EXCEEDED",
                "배우자 출산휴가는 연속 사용 구간 기준 최대 " + maxSegments + "번까지 사용할 수 있습니다."
            );
        }
    }

    private int workingDaySegments(List<LocalDate> rawDates) {
        List<LocalDate> dates = rawDates.stream().distinct().sorted().toList();
        if (dates.isEmpty()) {
            return 0;
        }
        int segments = 1;
        LocalDate previous = dates.get(0);
        for (int index = 1; index < dates.size(); index++) {
            LocalDate current = dates.get(index);
            if (!current.equals(nextWorkingDay(previous))) {
                segments++;
            }
            previous = current;
        }
        return segments;
    }

    private LocalDate nextWorkingDay(LocalDate date) {
        LocalDate candidate = date.plusDays(1);
        while (isNonWorkingDay(candidate)) {
            candidate = candidate.plusDays(1);
        }
        return candidate;
    }

    private boolean isNonWorkingDay(LocalDate date) {
        if (date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY) {
            return true;
        }
        return holidayRepository.findByHolidayDateAndActiveYn(date, "Y").isPresent()
            || holidayRepository.findFirstByActiveYnAndSourceTypeAndRepeatTypeAndRepeatMonthAndRepeatDay(
                "Y", "COMPANY", "ANNUAL", date.getMonthValue(), date.getDayOfMonth()
            ).isPresent();
    }

    private LeaveUsageResponse usageFor(Emp requester, Long excludeApprovalId, int balanceYear) {
        List<ApprovalDocument> leaveDocuments = documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
            requester,
            "N",
            LEAVE_TEMPLATE_CODE,
            ApprovalDocument.STATUS_APPROVED
        );
        List<ApprovalDocument> pendingDocuments = documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatusIn(
            requester,
            "N",
            LEAVE_TEMPLATE_CODE,
            List.of(ApprovalDocument.STATUS_IN_PROGRESS)
        );
        List<ApprovalDocument> cancelDocuments = documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
            requester,
            "N",
            LEAVE_CANCEL_TEMPLATE_CODE,
            ApprovalDocument.STATUS_APPROVED
        );
        List<ApprovalDocument> pendingCancelDocuments = documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatusIn(
            requester,
            "N",
            LEAVE_CANCEL_TEMPLATE_CODE,
            List.of(ApprovalDocument.STATUS_IN_PROGRESS)
        );
        Set<String> canceledTargetSelections = new HashSet<>();
        Set<String> legacyCanceledSelections = new HashSet<>();
        for (ApprovalDocument document : cancelDocuments) {
            if (excludeApprovalId != null && excludeApprovalId.equals(document.getApprovalId())) {
                continue;
            }
            for (LeaveUsageSelectionResponse selection : selectionsFor(document)) {
                if (selection.approvalId() == null) {
                    legacyCanceledSelections.add(selectionKey(selection));
                } else {
                    canceledTargetSelections.add(targetSelectionKey(selection));
                }
            }
        }
        List<LeaveUsageSelectionResponse> pendingCancelSelections = new ArrayList<>();
        for (ApprovalDocument document : pendingCancelDocuments) {
            if (excludeApprovalId != null && excludeApprovalId.equals(document.getApprovalId())) {
                continue;
            }
            pendingCancelSelections.addAll(selectionsFor(document));
        }
        List<LeaveExclusionResponse> exclusions = exclusionRepository.findByDocumentRequesterOrderByLeaveDateAsc(requester)
            .stream()
            .filter(ApprovalLeaveExclusion::isActive)
            .map(LeaveExclusionResponse::from)
            .toList();
        Set<String> excludedDates = exclusions.stream()
            .map(exclusion -> exclusion.approvalId() + "|" + exclusion.date())
            .collect(java.util.stream.Collectors.toSet());
        Set<String> lifecycleCanceledSelections = lifecycleCancellationRepository.findByEmpAndActiveYn(requester, "Y").stream()
            .map(item -> item.getDocument().getApprovalId() + "|" + item.getLeaveDate() + "|" + item.getLeaveType())
            .collect(java.util.stream.Collectors.toSet());
        List<LeaveUsageSelectionResponse> selections = new ArrayList<>();
        List<LeaveUsageSelectionResponse> pendingSelections = new ArrayList<>();
        BigDecimal annualDays = BigDecimal.ZERO;
        for (ApprovalDocument document : leaveDocuments) {
            if (excludeApprovalId != null && excludeApprovalId.equals(document.getApprovalId())) {
                continue;
            }
            for (LeaveUsageSelectionResponse selection : selectionsFor(document)) {
                if (lifecycleCanceledSelections.contains(document.getApprovalId() + "|" + selection.date() + "|" + selection.type())) {
                    continue;
                }
                if (excludedDates.contains(document.getApprovalId() + "|" + selection.date())) {
                    continue;
                }
                if (canceledTargetSelections.contains(targetSelectionKey(document.getApprovalId(), selection))
                    || legacyCanceledSelections.contains(selectionKey(selection))) {
                    continue;
                }
                selections.add(selection);
                if (parseDate(selection.date()).getYear() == balanceYear) {
                    annualDays = annualDays.add(daysFor(selection.type(), parseDate(selection.date())));
                }
            }
        }
        BigDecimal reservedAnnualDays = BigDecimal.ZERO;
        for (ApprovalDocument document : pendingDocuments) {
            if (excludeApprovalId != null && excludeApprovalId.equals(document.getApprovalId())) {
                continue;
            }
            for (LeaveUsageSelectionResponse selection : selectionsFor(document)) {
                if (lifecycleCanceledSelections.contains(document.getApprovalId() + "|" + selection.date() + "|" + selection.type())) {
                    continue;
                }
                pendingSelections.add(selection);
                if (parseDate(selection.date()).getYear() == balanceYear) {
                    reservedAnnualDays = reservedAnnualDays.add(daysFor(selection.type(), parseDate(selection.date())));
                }
            }
        }
        BigDecimal totalAnnualDays = annualLeaveService.totalDays(requester, balanceYear);
        BigDecimal remainingAnnualDays = totalAnnualDays.subtract(annualDays);
        selections.sort(java.util.Comparator.comparing(LeaveUsageSelectionResponse::date));
        pendingSelections.sort(java.util.Comparator.comparing(LeaveUsageSelectionResponse::date));
        List<LeaveUsageSelectionResponse> occupiedSelections = new ArrayList<>(selections);
        occupiedSelections.addAll(pendingSelections);
        return new LeaveUsageResponse(
            formatDay(annualDays),
            formatDay(reservedAnnualDays),
            formatDay(totalAnnualDays),
            formatDay(remainingAnnualDays),
            selections,
            occupiedSelections,
            exclusions,
            balanceYear,
            pendingCancelSelections
        );
    }

    List<LeaveUsageSelectionResponse> selectionsFor(ApprovalDocument document) {
        return selectionsFrom(
            document.getFormDataJson(),
            document.getApprovalId(),
            document.getDocumentNo(),
            LEAVE_CANCEL_TEMPLATE_CODE.equals(document.getTemplateCode())
        );
    }

    private List<LeaveUsageSelectionResponse> selectionsFrom(String formDataJson, Long approvalId, String documentNo) {
        return selectionsFrom(formDataJson, approvalId, documentNo, false);
    }

    private List<LeaveUsageSelectionResponse> selectionsFrom(
        String formDataJson,
        Long approvalId,
        String documentNo,
        boolean sourceReferences
    ) {
        JsonNode fields = formFields(formDataJson);
        JsonNode rawSelections = fields.path("leaveSelectionsJson");
        if (rawSelections.isMissingNode() || rawSelections.asText("").isBlank()) {
            return fallbackSelection(sourceReferences ? null : approvalId, sourceReferences ? null : documentNo, fields);
        }
        try {
            JsonNode parsed = objectMapper.readTree(rawSelections.asText());
            if (!parsed.isArray()) {
                return List.of();
            }
            List<LeaveUsageSelectionResponse> selections = new ArrayList<>();
            for (JsonNode node : parsed) {
                String date = node.path("date").asText("");
                if (date.isBlank()) {
                    continue;
                }
                String type = normalizedType(node.path("type").asText("연차"));
                Long resolvedApprovalId = sourceReferences ? positiveLong(node.path("sourceApprovalId")) : approvalId;
                String sourceDocumentNo = node.path("sourceDocumentNo").asText("").trim();
                String resolvedDocumentNo = sourceReferences
                    ? (sourceDocumentNo.isBlank() ? null : sourceDocumentNo)
                    : documentNo;
                selections.add(new LeaveUsageSelectionResponse(
                    date,
                    type,
                    formatDay(daysFor(type, parseDate(date))),
                    resolvedApprovalId,
                    resolvedDocumentNo
                ));
            }
            return selections;
        } catch (Exception ex) {
            return List.of();
        }
    }

    private Long positiveLong(JsonNode node) {
        if (node == null || !node.canConvertToLong()) {
            return null;
        }
        long value = node.asLong();
        return value > 0 ? value : null;
    }

    private List<LeaveUsageSelectionResponse> fallbackSelection(Long approvalId, String documentNo, JsonNode fields) {
        String startDate = fields.path("startDate").asText("");
        if (startDate.isBlank()) {
            return List.of();
        }
        String type = normalizedType(fields.path("leaveType").asText("연차"));
        return List.of(new LeaveUsageSelectionResponse(
            startDate,
            type,
            formatDay(daysFor(type, parseDate(startDate))),
            approvalId,
            documentNo
        ));
    }

    private JsonNode formFields(String formDataJson) {
        if (formDataJson == null || formDataJson.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            JsonNode root = objectMapper.readTree(formDataJson);
            return root.path("fields");
        } catch (Exception ex) {
            return objectMapper.createObjectNode();
        }
    }

    private String normalizedType(String value) {
        return value == null || value.isBlank() ? "연차" : value.trim();
    }

    BigDecimal daysFor(String type) {
        return daysFor(type, LocalDate.now());
    }

    BigDecimal daysFor(String type, LocalDate date) {
        LeavePolicy policy = leavePolicyService.resolve(type, date);
        if (policy != null) {
            return policy.getAnnualDeductionDays();
        }
        if ("연차".equals(type) || "하계휴가".equals(type)) {
            return BigDecimal.ONE;
        }
        if ("오전반차".equals(type) || "오후반차".equals(type)) {
            return new BigDecimal("0.5");
        }
        return BigDecimal.ZERO;
    }

    private boolean overlaps(String existingType, String requestedType) {
        String existingSlot = slotFor(existingType);
        String requestedSlot = slotFor(requestedType);
        return "FULL".equals(existingSlot) || "FULL".equals(requestedSlot) || existingSlot.equals(requestedSlot);
    }

    private String selectionKey(LeaveUsageSelectionResponse selection) {
        return selection.date() + "|" + selection.type();
    }

    private String targetSelectionKey(LeaveUsageSelectionResponse selection) {
        return targetSelectionKey(selection.approvalId(), selection);
    }

    private String targetSelectionKey(Long approvalId, LeaveUsageSelectionResponse selection) {
        return (approvalId == null ? "legacy" : approvalId) + "|" + selectionKey(selection);
    }

    private String slotFor(String type) {
        if ("오전반차".equals(type) || "공가(오전)".equals(type)) return "AM";
        if ("오후반차".equals(type) || "공가(오후)".equals(type)) return "PM";
        return "FULL";
    }

    LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException ex) {
            throw BusinessException.badRequest("LEAVE_DATE_INVALID", "휴가 날짜 형식을 확인해 주세요: " + value);
        }
    }

    private String formatDay(BigDecimal value) {
        return value.setScale(1, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

}
