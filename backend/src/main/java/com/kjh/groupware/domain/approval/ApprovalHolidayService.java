package com.kjh.groupware.domain.approval;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayPermissionResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayImpactResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayOfficialImpactResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayOfficialSyncRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayOfficialSyncResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayProviderStatusResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayResponse;
import com.kjh.groupware.domain.approval.dto.LeaveExclusionResponse;
import com.kjh.groupware.domain.approval.dto.LeaveUsageSelectionResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalHolidayService {

    private static final Set<String> HOLIDAY_TYPES = Set.of(
        "PUBLIC_HOLIDAY",
        "SUBSTITUTE_HOLIDAY",
        "COMPANY_HOLIDAY",
        "OTHER"
    );
    private static final Set<String> SOURCE_TYPES = Set.of("LEGAL", "COMPANY");
    private static final Set<String> REPEAT_TYPES = Set.of("YEAR_ONLY", "ANNUAL");

    private final ApprovalHolidayRepository holidayRepository;
    private final ApprovalLeaveExclusionRepository exclusionRepository;
    private final ApprovalDocumentRepository documentRepository;
    private final ApprovalLineRepository lineRepository;
    private final ApprovalLeaveUsageService leaveUsageService;
    private final ApprovalPermissionService permissionService;
    private final CurrentEmpProvider currentEmpProvider;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;
    private final EmployeePermissionService employeePermissionService;
    private final CompTimeLedgerService compTimeLedgerService;
    private final ApprovalHolidayOfficialProvider officialProvider;

    @Transactional(readOnly = true)
    public List<ApprovalHolidayResponse> active(LocalDate from, LocalDate to) {
        if (from == null && to == null) {
            return holidayRepository.findByActiveYnOrderByHolidayDateAsc("Y").stream()
                .map(ApprovalHolidayResponse::from)
                .toList();
        }
        LocalDate effectiveFrom = from == null ? LocalDate.of(to.getYear(), 1, 1) : from;
        LocalDate effectiveTo = to == null ? LocalDate.of(from.getYear(), 12, 31) : to;
        if (effectiveFrom.isAfter(effectiveTo)) {
            throw BusinessException.badRequest("HOLIDAY_RANGE_INVALID", "휴일 조회 기간을 확인해 주세요.");
        }
        return activeWithAnnualRepeats(effectiveFrom, effectiveTo);
    }

    private List<ApprovalHolidayResponse> activeWithAnnualRepeats(LocalDate from, LocalDate to) {
        Map<LocalDate, ApprovalHolidayResponse> byDate = new LinkedHashMap<>();
        for (ApprovalHoliday holiday : holidayRepository.findByActiveYnOrderByHolidayDateAsc("Y")) {
            ApprovalHolidayResponse response = ApprovalHolidayResponse.from(holiday);
            if (!holiday.getHolidayDate().isBefore(from) && !holiday.getHolidayDate().isAfter(to)) {
                byDate.putIfAbsent(holiday.getHolidayDate(), response);
            }
            if (!holiday.isAnnualRepeat() || !"COMPANY".equals(holiday.getSourceType())
                || holiday.getRepeatMonth() == null || holiday.getRepeatDay() == null) {
                continue;
            }
            int firstYear = Math.max(from.getYear(), holiday.getApplyYear());
            for (int year = firstYear; year <= to.getYear(); year++) {
                LocalDate repeatedDate;
                try {
                    repeatedDate = LocalDate.of(year, holiday.getRepeatMonth(), holiday.getRepeatDay());
                } catch (java.time.DateTimeException ignored) {
                    continue;
                }
                if (!repeatedDate.isBefore(from) && !repeatedDate.isAfter(to)) {
                    byDate.putIfAbsent(repeatedDate, response.withHolidayDate(repeatedDate));
                }
            }
        }
        return byDate.values().stream().sorted(Comparator.comparing(ApprovalHolidayResponse::holidayDate)).toList();
    }

    @Transactional(readOnly = true)
    public List<ApprovalHolidayResponse> manageList() {
        requireManager(currentEmpProvider.getCurrentEmp());
        return holidayRepository.findAllByOrderByHolidayDateAsc().stream().map(ApprovalHolidayResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ApprovalHolidayPermissionResponse permission() {
        return new ApprovalHolidayPermissionResponse(canManage(currentEmpProvider.getCurrentEmp()));
    }

    @Transactional(readOnly = true)
    public ApprovalHolidayProviderStatusResponse officialProviderStatus() {
        requireManager(currentEmpProvider.getCurrentEmp());
        return new ApprovalHolidayProviderStatusResponse(
            ApprovalHolidayOfficialCalendar.supportedYears().stream().sorted().toList(),
            officialProvider.isExternalConfigured(),
            "한국천문연구원 특일 정보 OpenAPI",
            KoreanPublicHolidayClient.BASIS_SOURCE
        );
    }

    @Transactional
    public ApprovalHolidayResponse create(ApprovalHolidayRequest request, String ipAddress, String userAgent) {
        Emp editor = currentEmpProvider.getCurrentEmp();
        requireManager(editor);
        validateRequest(request);
        validatePolicyRequest(request);
        if ("LEGAL".equals(sourceType(request))) {
            throw BusinessException.badRequest(
                "OFFICIAL_HOLIDAY_SYNC_REQUIRED",
                "법정공휴일은 공식 월력요항 반영 기능으로만 등록할 수 있습니다."
            );
        }
        if (holidayRepository.findByHolidayDate(request.holidayDate()).isPresent()) {
            throw BusinessException.badRequest("HOLIDAY_DATE_DUPLICATED", "이미 등록된 휴일 날짜입니다.");
        }
        ApprovalHoliday holiday = holidayRepository.saveAndFlush(new ApprovalHoliday(
            request.holidayDate(),
            request.holidayName().trim(),
            request.holidayType(),
            sourceType(request),
            repeatType(request),
            null,
            clean(request.basisSource()),
            false,
            editor
        ));
        auditHoliday(editor, AuditActionType.CREATE_HOLIDAY, holiday, 0, ipAddress, userAgent);
        return ApprovalHolidayResponse.from(holiday);
    }

    @Transactional
    public ApprovalHolidayResponse update(Long holidayId, ApprovalHolidayRequest request, String ipAddress, String userAgent) {
        Emp editor = currentEmpProvider.getCurrentEmp();
        requireManager(editor);
        validateRequest(request);
        validatePolicyRequest(request);
        ApprovalHoliday holiday = getHoliday(holidayId);
        if (holiday.isOfficial()) {
            requireOfficialOverrideReason(request.overrideReason());
            if (!"LEGAL".equals(sourceType(request)) || !"YEAR_ONLY".equals(repeatType(request))) {
                throw BusinessException.badRequest(
                    "OFFICIAL_HOLIDAY_POLICY_IMMUTABLE",
                    "공식 법정공휴일의 출처와 적용 방식은 변경할 수 없습니다."
                );
            }
        } else if ("LEGAL".equals(sourceType(request))) {
            throw BusinessException.badRequest(
                "OFFICIAL_HOLIDAY_SYNC_REQUIRED",
                "법정공휴일은 공식 월력요항 반영 기능으로만 등록할 수 있습니다."
            );
        }
        Map<String, Object> before = holidaySnapshot(holiday, 0);
        if (!holiday.getHolidayDate().equals(request.holidayDate()) && exclusionRepository.existsByHoliday(holiday)) {
            throw BusinessException.badRequest(
                "HOLIDAY_DATE_HAS_EXCLUSIONS",
                "자동 연차 복원 이력이 있는 휴일의 날짜는 변경할 수 없습니다."
            );
        }
        holidayRepository.findByHolidayDate(request.holidayDate())
            .filter(other -> !other.getHolidayId().equals(holidayId))
            .ifPresent(other -> {
                throw BusinessException.badRequest("HOLIDAY_DATE_DUPLICATED", "이미 등록된 휴일 날짜입니다.");
            });
        holiday.update(
            request.holidayDate(),
            request.holidayName().trim(),
            request.holidayType(),
            sourceType(request),
            repeatType(request),
            holiday.getPolicyVersion(),
            clean(request.basisSource()),
            holiday.isActive(),
            editor
        );
        auditHoliday(
            editor,
            AuditActionType.UPDATE_HOLIDAY,
            holiday,
            before,
            holiday.isOfficial() ? clean(request.overrideReason()) : holiday.getHolidayName(),
            0,
            ipAddress,
            userAgent
        );
        return ApprovalHolidayResponse.from(holiday);
    }

    @Transactional(readOnly = true)
    public ApprovalHolidayOfficialImpactResponse previewOfficial(int year) {
        requireManager(currentEmpProvider.getCurrentEmp());
        OfficialPlan plan = buildOfficialPlan(year);
        List<ApprovalHolidayOfficialImpactResponse.Item> items = plan.items().stream()
            .map(item -> new ApprovalHolidayOfficialImpactResponse.Item(
                item.official().date().toString(),
                item.official().name(),
                item.official().type(),
                item.changeType(),
                item.impacts().size(),
                item.impacts().stream().map(this::toImpactItem).toList()
            ))
            .toList();
        return new ApprovalHolidayOfficialImpactResponse(
            year,
            countChange(plan, "CREATE"),
            countChange(plan, "UPDATE"),
            countChange(plan, "UNCHANGED"),
            countChange(plan, "CONFLICT"),
            items.stream().mapToInt(ApprovalHolidayOfficialImpactResponse.Item::affectedCount).sum(),
            items.size(),
            plan.calendar().policyVersion(),
            plan.calendar().basisSource(),
            plan.previewToken(),
            items
        );
    }

    @Transactional
    public ApprovalHolidayOfficialSyncResponse syncOfficial(
        int year,
        ApprovalHolidayOfficialSyncRequest request,
        String ipAddress,
        String userAgent
    ) {
        Emp editor = currentEmpProvider.getCurrentEmp();
        requireManager(editor);
        OfficialPlan plan = buildOfficialPlan(year);
        if (!MessageDigest.isEqual(
            plan.previewToken().getBytes(StandardCharsets.UTF_8),
            request.previewToken().getBytes(StandardCharsets.UTF_8)
        )) {
            throw BusinessException.badRequest(
                "OFFICIAL_HOLIDAY_PREVIEW_STALE",
                "미리보기 이후 휴일 또는 승인 휴가 정보가 변경되었습니다. 영향을 다시 확인해 주세요."
            );
        }
        if (countChange(plan, "CONFLICT") > 0 && clean(request.overrideReason()) == null) {
            throw BusinessException.badRequest(
                "OFFICIAL_HOLIDAY_CONFLICT_REASON_REQUIRED",
                "회사 휴일과 충돌하는 공식 공휴일을 반영하려면 예외 사유를 입력해 주세요."
            );
        }

        int created = 0;
        int updated = 0;
        int adjusted = 0;
        for (OfficialPlanItem item : plan.items()) {
            ApprovalHoliday holiday = item.existing();
            Map<String, Object> before = holiday == null ? null : holidaySnapshot(holiday, 0);
            AuditActionType action;
            if (holiday == null) {
                holiday = new ApprovalHoliday(
                    item.official().date(), item.official().name(), item.official().type(), "LEGAL", "YEAR_ONLY",
                    plan.calendar().policyVersion(), plan.calendar().basisSource(), true, editor
                );
                holidayRepository.saveAndFlush(holiday);
                created++;
                action = AuditActionType.CREATE_HOLIDAY;
            } else {
                action = AuditActionType.UPDATE_HOLIDAY;
                if (!"UNCHANGED".equals(item.changeType())) {
                    holiday.update(
                        item.official().date(), item.official().name(), item.official().type(), "LEGAL", "YEAR_ONLY",
                        plan.calendar().policyVersion(), plan.calendar().basisSource(), true, editor
                    );
                    updated++;
                }
            }
            int itemAdjusted = reconcileApprovedLeaves(holiday, editor, ipAddress, userAgent);
            adjusted += itemAdjusted;
            if (!"UNCHANGED".equals(item.changeType()) || itemAdjusted > 0) {
                String reason = "CONFLICT".equals(item.changeType())
                    ? clean(request.overrideReason())
                    : year + "년 공식 월력요항 반영";
                auditHoliday(editor, action, holiday, before, reason, itemAdjusted, ipAddress, userAgent);
            }
        }
        return new ApprovalHolidayOfficialSyncResponse(
            year, created, updated, adjusted, plan.items().size(),
            plan.calendar().policyVersion(), plan.calendar().basisSource()
        );
    }

    @Transactional(readOnly = true)
    public ApprovalHolidayImpactResponse impact(Long holidayId) {
        requireManager(currentEmpProvider.getCurrentEmp());
        ApprovalHoliday holiday = getHoliday(holidayId);
        List<ApprovalHolidayImpactResponse.Item> items = impactedSelections(holiday).stream()
            .map(this::toImpactItem)
            .toList();
        return new ApprovalHolidayImpactResponse(
            holiday.getHolidayId(), holiday.getHolidayDate().toString(), holiday.getHolidayName(), items.size(), items
        );
    }

    @Transactional
    public ApprovalHolidayResponse activate(Long holidayId, String ipAddress, String userAgent) {
        return activate(holidayId, null, ipAddress, userAgent);
    }

    @Transactional
    public ApprovalHolidayResponse activate(Long holidayId, String overrideReason, String ipAddress, String userAgent) {
        Emp editor = currentEmpProvider.getCurrentEmp();
        requireManager(editor);
        ApprovalHoliday holiday = getHoliday(holidayId);
        if (holiday.isOfficial()) {
            requireOfficialOverrideReason(overrideReason);
        }
        Map<String, Object> before = holidaySnapshot(holiday, 0);
        holiday.update(holiday.getHolidayDate(), holiday.getHolidayName(), holiday.getHolidayType(), true, editor);
        int adjusted = reconcileApprovedLeaves(holiday, editor, ipAddress, userAgent);
        auditHoliday(
            editor,
            AuditActionType.UPDATE_HOLIDAY,
            holiday,
            before,
            holiday.isOfficial() ? clean(overrideReason) : holiday.getHolidayName(),
            adjusted,
            ipAddress,
            userAgent
        );
        return ApprovalHolidayResponse.from(holiday);
    }

    @Transactional
    public ApprovalHolidayResponse delete(Long holidayId, String ipAddress, String userAgent) {
        return delete(holidayId, null, ipAddress, userAgent);
    }

    @Transactional
    public ApprovalHolidayResponse delete(Long holidayId, String overrideReason, String ipAddress, String userAgent) {
        Emp editor = currentEmpProvider.getCurrentEmp();
        requireManager(editor);
        ApprovalHoliday holiday = getHoliday(holidayId);
        if (holiday.isOfficial()) {
            requireOfficialOverrideReason(overrideReason);
        }
        Map<String, Object> before = holidaySnapshot(holiday, 0);
        for (ApprovalLeaveExclusion exclusion : exclusionRepository.findByHolidayAndActiveYn(holiday, "Y")) {
            if (CompTimeLedgerService.LEAVE_TYPE.equals(exclusion.getLeaveType())) {
                compTimeLedgerService.reverseHolidayRestoration(
                    exclusion.getDocument(), exclusion.getLeaveDate(), holiday.getHolidayId()
                );
            }
            exclusion.reverse(editor, holiday.getHolidayName() + " 비활성화로 자동 복원 취소");
            notificationService.notifyEmp(
                exclusion.getDocument().getRequester().getEmpId(),
                "휴일 비활성화에 따른 연차 재계산",
                exclusion.getLeaveDate() + "의 휴일 지정이 해제되어 원래 휴가 사용량으로 다시 반영되었습니다.",
                "APPROVAL",
                exclusion.getDocument().getApprovalId()
            );
        }
        holiday.deactivate(editor);
        auditHoliday(
            editor,
            AuditActionType.DELETE_HOLIDAY,
            holiday,
            before,
            holiday.isOfficial() ? clean(overrideReason) : holiday.getHolidayName(),
            0,
            ipAddress,
            userAgent
        );
        return ApprovalHolidayResponse.from(holiday);
    }

    @Transactional(readOnly = true)
    public List<LeaveExclusionResponse> exclusions(Long approvalId) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = documentRepository.findById(approvalId)
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_NOT_FOUND", "전자결재 문서를 찾을 수 없습니다."));
        permissionService.assertCanView(currentEmp, document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
        return exclusionRepository.findByDocumentOrderByLeaveDateAsc(document).stream()
            .filter(ApprovalLeaveExclusion::isActive)
            .map(LeaveExclusionResponse::from)
            .toList();
    }

    public boolean canManage(Emp emp) {
        return employeePermissionService.hasPermission(emp, EmployeePermissionService.LEAVE_ADMIN);
    }

    private int reconcileApprovedLeaves(ApprovalHoliday holiday, Emp editor, String ipAddress, String userAgent) {
        int adjusted = 0;
        List<ApprovalDocument> documents = documentRepository.findByDeletedYnAndTemplateCodeAndStatus(
            "N",
            ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE,
            ApprovalDocument.STATUS_APPROVED
        );
        for (ApprovalDocument document : documents) {
            for (LeaveUsageSelectionResponse selection : leaveUsageService.selectionsFor(document)) {
                LocalDate leaveDate = LocalDate.parse(selection.date());
                if (!matchesHolidayDate(holiday, leaveDate)) {
                    continue;
                }
                if (exclusionRepository.existsByDocumentAndLeaveDateAndActiveYn(document, leaveDate, "Y")) {
                    continue;
                }
                BigDecimal restoredDays = leaveUsageService.daysFor(selection.type(), leaveDate);
                String reason = holiday.getHolidayName() + " 지정으로 자동 제외";
                ApprovalLeaveExclusion exclusion = exclusionRepository.findByDocumentAndLeaveDate(document, leaveDate)
                    .map(existing -> { existing.reactivate(editor, reason); return existing; })
                    .orElseGet(() -> new ApprovalLeaveExclusion(
                        document, holiday, leaveDate, selection.type(), restoredDays, reason, editor
                    ));
                exclusionRepository.saveAndFlush(exclusion);
                if (CompTimeLedgerService.LEAVE_TYPE.equals(selection.type())) {
                    compTimeLedgerService.restoreForHoliday(document, leaveDate, holiday.getHolidayId());
                }
                notificationService.notifyEmp(
                    document.getRequester().getEmpId(),
                    "휴가 연차 자동 복원",
                    leaveDate + " 휴가가 " + holiday.getHolidayName() + " 지정으로 제외되어 "
                        + restoredDays.stripTrailingZeros().toPlainString() + "일이 복원되었습니다.",
                    "APPROVAL",
                    document.getApprovalId()
                );
                auditLogService.record(
                    editor.getEmpId(),
                    AuditActionType.AUTO_EXCLUDE_LEAVE,
                    "approval_document",
                    document.getApprovalId(),
                    null,
                    objectMapper.valueToTree(Map.of(
                        "exclusionId", exclusion.getExclusionId(),
                        "leaveDate", leaveDate.toString(),
                        "leaveType", selection.type(),
                        "restoredDays", restoredDays.stripTrailingZeros().toPlainString(),
                        "holidayId", holiday.getHolidayId(),
                        "holidayName", holiday.getHolidayName()
                    )),
                    ipAddress,
                    userAgent,
                    reason,
                    true
                );
                adjusted++;
            }
        }
        return adjusted;
    }

    private List<Impact> impactedSelections(ApprovalHoliday holiday) {
        List<Impact> impacts = new java.util.ArrayList<>();
        for (ApprovalDocument document : documentRepository.findByDeletedYnAndTemplateCodeAndStatus(
            "N", ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE, ApprovalDocument.STATUS_APPROVED)) {
            for (LeaveUsageSelectionResponse selection : leaveUsageService.selectionsFor(document)) {
                LocalDate leaveDate = LocalDate.parse(selection.date());
                if (matchesHolidayDate(holiday, leaveDate)
                    && !exclusionRepository.existsByDocumentAndLeaveDateAndActiveYn(document, leaveDate, "Y")) {
                    impacts.add(new Impact(document, selection));
                }
            }
        }
        return impacts;
    }

    private List<Impact> impactedSelections(LocalDate holidayDate) {
        List<Impact> impacts = new java.util.ArrayList<>();
        for (ApprovalDocument document : documentRepository.findByDeletedYnAndTemplateCodeAndStatus(
            "N", ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE, ApprovalDocument.STATUS_APPROVED)) {
            for (LeaveUsageSelectionResponse selection : leaveUsageService.selectionsFor(document)) {
                if (holidayDate.toString().equals(selection.date())
                    && !exclusionRepository.existsByDocumentAndLeaveDateAndActiveYn(document, holidayDate, "Y")) {
                    impacts.add(new Impact(document, selection));
                }
            }
        }
        return impacts;
    }

    private record Impact(ApprovalDocument document, LeaveUsageSelectionResponse selection) {}

    private boolean matchesHolidayDate(ApprovalHoliday holiday, LocalDate leaveDate) {
        if (!holiday.isAnnualRepeat() || !"COMPANY".equals(holiday.getSourceType())) {
            return holiday.getHolidayDate().equals(leaveDate);
        }
        return leaveDate.getYear() >= holiday.getApplyYear()
            && leaveDate.getMonthValue() == holiday.getRepeatMonth()
            && leaveDate.getDayOfMonth() == holiday.getRepeatDay();
    }

    private ApprovalHolidayImpactResponse.Item toImpactItem(Impact impact) {
        return new ApprovalHolidayImpactResponse.Item(
            impact.document().getApprovalId(), impact.document().getDocumentNo(),
            impact.document().getRequester().getEmpId(), impact.document().getRequester().getEmpName(),
            impact.selection().date(), impact.selection().type(), impact.selection().days()
        );
    }

    private OfficialPlan buildOfficialPlan(int year) {
        ApprovalHolidayOfficialCalendar.OfficialYear calendar = officialProvider.require(year);
        List<OfficialPlanItem> items = new ArrayList<>();
        for (ApprovalHolidayOfficialCalendar.OfficialHoliday official : calendar.holidays()) {
            ApprovalHoliday existing = holidayRepository.findByHolidayDate(official.date()).orElse(null);
            String changeType;
            if (existing == null) {
                changeType = "CREATE";
            } else if (!existing.isOfficial()) {
                changeType = "CONFLICT";
            } else if (matchesOfficial(existing, official, calendar)) {
                changeType = "UNCHANGED";
            } else {
                changeType = "UPDATE";
            }
            List<Impact> impacts = impactedSelections(official.date()).stream()
                .sorted(Comparator
                    .comparing((Impact impact) -> impact.document().getApprovalId())
                    .thenComparing(impact -> impact.selection().type()))
                .toList();
            items.add(new OfficialPlanItem(official, existing, changeType, impacts));
        }
        return new OfficialPlan(calendar, items, officialPreviewToken(year, calendar, items));
    }

    private boolean matchesOfficial(
        ApprovalHoliday holiday,
        ApprovalHolidayOfficialCalendar.OfficialHoliday official,
        ApprovalHolidayOfficialCalendar.OfficialYear calendar
    ) {
        return holiday.getHolidayDate().equals(official.date())
            && holiday.getHolidayName().equals(official.name())
            && holiday.getHolidayType().equals(official.type())
            && "LEGAL".equals(holiday.getSourceType())
            && "YEAR_ONLY".equals(holiday.getRepeatType())
            && Objects.equals(holiday.getPolicyVersion(), calendar.policyVersion())
            && Objects.equals(holiday.getBasisSource(), calendar.basisSource())
            && holiday.isActive();
    }

    private int countChange(OfficialPlan plan, String changeType) {
        return Math.toIntExact(plan.items().stream().filter(item -> changeType.equals(item.changeType())).count());
    }

    private String officialPreviewToken(
        int year,
        ApprovalHolidayOfficialCalendar.OfficialYear calendar,
        List<OfficialPlanItem> items
    ) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            updateDigest(digest, Integer.toString(year));
            updateDigest(digest, calendar.policyVersion());
            updateDigest(digest, calendar.basisSource());
            for (OfficialPlanItem item : items) {
                ApprovalHoliday current = item.existing();
                updateDigest(digest, item.official().date().toString());
                updateDigest(digest, item.official().name());
                updateDigest(digest, item.official().type());
                updateDigest(digest, item.changeType());
                updateDigest(digest, current == null ? null : current.getHolidayId().toString());
                updateDigest(digest, current == null ? null : current.getHolidayName());
                updateDigest(digest, current == null ? null : current.getHolidayType());
                updateDigest(digest, current == null ? null : current.getSourceType());
                updateDigest(digest, current == null ? null : current.getRepeatType());
                updateDigest(digest, current == null ? null : current.getPolicyVersion());
                updateDigest(digest, current == null ? null : current.getBasisSource());
                updateDigest(digest, current == null ? null : Boolean.toString(current.isActive()));
                for (Impact impact : item.impacts()) {
                    updateDigest(digest, impact.document().getApprovalId().toString());
                    updateDigest(digest, impact.selection().type());
                    updateDigest(digest, impact.selection().days());
                }
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 digest is unavailable", exception);
        }
    }

    private void updateDigest(MessageDigest digest, String value) {
        byte[] bytes = (value == null ? "<null>" : value).getBytes(StandardCharsets.UTF_8);
        digest.update(Integer.toString(bytes.length).getBytes(StandardCharsets.US_ASCII));
        digest.update((byte) ':');
        digest.update(bytes);
    }

    private record OfficialPlan(
        ApprovalHolidayOfficialCalendar.OfficialYear calendar,
        List<OfficialPlanItem> items,
        String previewToken
    ) {
    }

    private record OfficialPlanItem(
        ApprovalHolidayOfficialCalendar.OfficialHoliday official,
        ApprovalHoliday existing,
        String changeType,
        List<Impact> impacts
    ) {
    }

    private void validateRequest(ApprovalHolidayRequest request) {
        if (!HOLIDAY_TYPES.contains(request.holidayType())) {
            throw BusinessException.badRequest("HOLIDAY_TYPE_INVALID", "휴일 유형을 확인해 주세요.");
        }
    }

    private void validatePolicyRequest(ApprovalHolidayRequest request) {
        String sourceType = sourceType(request);
        String repeatType = repeatType(request);
        if (!SOURCE_TYPES.contains(sourceType)) {
            throw BusinessException.badRequest("HOLIDAY_SOURCE_INVALID", "휴일 출처를 확인해 주세요.");
        }
        if (!REPEAT_TYPES.contains(repeatType)) {
            throw BusinessException.badRequest("HOLIDAY_REPEAT_INVALID", "휴일 반복 방식을 확인해 주세요.");
        }
        if ("LEGAL".equals(sourceType) && "ANNUAL".equals(repeatType)) {
            throw BusinessException.badRequest(
                "LEGAL_HOLIDAY_REPEAT_NOT_ALLOWED",
                "법정공휴일은 공식 월력요항을 연도별로 반영하며 매년 반복으로 등록할 수 없습니다."
            );
        }
        boolean legalHolidayType = Set.of("PUBLIC_HOLIDAY", "SUBSTITUTE_HOLIDAY").contains(request.holidayType());
        if ("LEGAL".equals(sourceType) && !legalHolidayType) {
            throw BusinessException.badRequest(
                "LEGAL_HOLIDAY_TYPE_INVALID",
                "법정공휴일에는 공휴일 또는 대체공휴일 유형만 사용할 수 있습니다."
            );
        }
        if ("COMPANY".equals(sourceType) && legalHolidayType) {
            throw BusinessException.badRequest(
                "COMPANY_HOLIDAY_TYPE_INVALID",
                "회사 자체 휴일에는 회사 지정휴일 또는 기타 유형만 사용할 수 있습니다."
            );
        }
    }

    private String sourceType(ApprovalHolidayRequest request) {
        if (request.sourceType() != null && !request.sourceType().isBlank()) {
            return request.sourceType().trim().toUpperCase();
        }
        return Set.of("PUBLIC_HOLIDAY", "SUBSTITUTE_HOLIDAY").contains(request.holidayType())
            ? "LEGAL"
            : "COMPANY";
    }

    private String repeatType(ApprovalHolidayRequest request) {
        return request.repeatType() == null || request.repeatType().isBlank()
            ? "YEAR_ONLY"
            : request.repeatType().trim().toUpperCase();
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private ApprovalHoliday getHoliday(Long holidayId) {
        return holidayRepository.findById(holidayId)
            .orElseThrow(() -> BusinessException.notFound("HOLIDAY_NOT_FOUND", "휴일을 찾을 수 없습니다."));
    }

    private void requireManager(Emp emp) {
        if (!canManage(emp)) {
            throw BusinessException.forbidden("HOLIDAY_MANAGE_FORBIDDEN", "휴일 관리 권한이 없습니다.");
        }
    }

    private void requireOfficialOverrideReason(String reason) {
        if (clean(reason) == null) {
            throw BusinessException.badRequest(
                "OFFICIAL_HOLIDAY_OVERRIDE_REASON_REQUIRED",
                "공식 법정공휴일을 예외 변경하려면 사유를 입력해 주세요."
            );
        }
    }

    private Map<String, Object> holidaySnapshot(ApprovalHoliday holiday, int adjusted) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("holidayDate", holiday.getHolidayDate().toString());
        snapshot.put("holidayName", holiday.getHolidayName());
        snapshot.put("holidayType", holiday.getHolidayType());
        snapshot.put("sourceType", holiday.getSourceType());
        snapshot.put("repeatType", holiday.getRepeatType());
        snapshot.put("policyVersion", holiday.getPolicyVersion());
        snapshot.put("basisSource", holiday.getBasisSource());
        snapshot.put("official", holiday.isOfficial());
        snapshot.put("active", holiday.isActive());
        snapshot.put("adjustedLeaveCount", adjusted);
        return snapshot;
    }

    private void auditHoliday(
        Emp editor,
        AuditActionType action,
        ApprovalHoliday holiday,
        int adjusted,
        String ipAddress,
        String userAgent
    ) {
        auditHoliday(
            editor,
            action,
            holiday,
            null,
            holiday.getHolidayName(),
            adjusted,
            ipAddress,
            userAgent
        );
    }

    private void auditHoliday(
        Emp editor,
        AuditActionType action,
        ApprovalHoliday holiday,
        Map<String, Object> before,
        String reason,
        int adjusted,
        String ipAddress,
        String userAgent
    ) {
        auditLogService.record(
            editor.getEmpId(),
            action,
            "approval_holiday",
            holiday.getHolidayId(),
            before == null ? null : objectMapper.valueToTree(before),
            objectMapper.valueToTree(holidaySnapshot(holiday, adjusted)),
            ipAddress,
            userAgent,
            reason,
            true
        );
    }
}
