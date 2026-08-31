package com.kjh.groupware.domain.approval;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.CompTimeCreditResponse;
import com.kjh.groupware.domain.approval.dto.CompTimeExpiryRequest;
import com.kjh.groupware.domain.approval.dto.CompTimeSummaryResponse;
import com.kjh.groupware.domain.approval.dto.LeaveUsageSelectionResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import com.kjh.groupware.domain.work.WorkRequestEntry;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CompTimeLedgerService {
    public static final String LEAVE_TYPE = "대체휴무";
    private static final BigDecimal ONE_DAY = BigDecimal.ONE;
    private static final int COMP_TIME_MINIMUM_MINUTES = 240;

    private final CompTimeCreditRepository creditRepository;
    private final CompTimeAllocationRepository allocationRepository;
    private final EmpRepository empRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final EmployeePermissionService employeePermissionService;
    private final NotificationService notificationService;
    private final ApprovalLeaveUsageService leaveUsageService;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;
    private final ScheduledJobStatusService scheduledJobStatusService;

    @Transactional(readOnly = true)
    public CompTimeSummaryResponse mine() {
        return summary(currentEmpProvider.getCurrentEmp());
    }

    @Transactional(readOnly = true)
    public CompTimeSummaryResponse manage(Long empId) {
        requireManager();
        return summary(requireEmp(empId));
    }

    @Transactional
    public void grantFromCompletedWork(WorkRequestEntry entry) {
        if (!WorkRequestEntry.COMPLETED.equals(entry.getStatus()) || !"Y".equals(entry.getCompTimeYn()) || entry.getWorkMinutes() == null
            || entry.getWorkMinutes() < COMP_TIME_MINIMUM_MINUTES) return;
        // Serialize credits for the same employee before checking the existing daily limit.
        empRepository.findByIdForUpdate(entry.getEmp().getEmpId())
            .orElseThrow(() -> BusinessException.notFound("EMP_NOT_FOUND", "직원을 찾을 수 없습니다."));
        if (creditRepository.existsBySourceWorkEntryWorkEntryId(entry.getWorkEntryId())) return;
        if (creditRepository.existsByEmpEmpIdAndWorkDate(entry.getEmp().getEmpId(), entry.getWorkDate())) return;
        BigDecimal days = ONE_DAY;
        LocalDate expiry = entry.getWorkDate().getMonthValue() == 12 && entry.getWorkDate().getDayOfMonth() >= 15
            ? LocalDate.of(entry.getWorkDate().getYear() + 1, 1, 31)
            : LocalDate.of(entry.getWorkDate().getYear(), 12, 31);
        CompTimeCredit credit = creditRepository.save(new CompTimeCredit(entry.getEmp(), entry.getWorkDate(), days,
            "승인 근무신청 자동 적립", entry.getRequester(), expiry, entry));
        notificationService.notifyEmp(entry.getEmp().getEmpId(), "대체휴무 적립",
            entry.getWorkDate() + " 근무분 " + day(days) + "일이 자동 적립되었습니다. 만료일: " + expiry,
            "COMP_TIME", credit.getCreditId());
    }

    @Transactional
    public CompTimeCreditResponse extend(Long creditId, CompTimeExpiryRequest request, String ipAddress, String userAgent) {
        Emp manager = requireManager();
        CompTimeCredit credit = creditRepository.findByIdForUpdate(creditId)
            .orElseThrow(() -> BusinessException.notFound("COMP_TIME_CREDIT_NOT_FOUND", "대체휴무 적립 내역을 찾을 수 없습니다."));
        if (!request.expiresOn().isAfter(credit.getExpiresOn())) {
            throw BusinessException.badRequest("COMP_TIME_EXPIRY_NOT_EXTENDED", "새 만료일은 기존 만료일보다 늦어야 합니다.");
        }
        LocalDate maximumExpiry = credit.getWorkDate().getMonthValue() == 12 && credit.getWorkDate().getDayOfMonth() >= 15
            ? LocalDate.of(credit.getWorkDate().getYear() + 1, 1, 31)
            : LocalDate.of(credit.getWorkDate().getYear(), 12, 31);
        if (request.expiresOn().isAfter(maximumExpiry)) {
            throw BusinessException.badRequest("COMP_TIME_EXPIRY_LIMIT", "대체휴무 만료일은 적용 가능한 최종 사용기한을 넘길 수 없습니다.");
        }
        LocalDate before = credit.getExpiresOn();
        credit.extendExpiry(request.expiresOn());
        notificationService.notifyEmp(
            credit.getEmp().getEmpId(), "대체휴무 만료일 연장",
            credit.getWorkDate() + " 근무분 만료일이 " + before + "에서 " + request.expiresOn() + "로 연장되었습니다.",
            "COMP_TIME", credit.getCreditId()
        );
        audit(manager, AuditActionType.UPDATE, credit, Map.of("expiresOn", before.toString()), request.reason().trim(), ipAddress, userAgent);
        return CompTimeCreditResponse.from(credit, LocalDate.now());
    }

    @Transactional
    public void reserveForSubmission(ApprovalDocument document) {
        if (!ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE.equals(document.getTemplateCode())) {
            return;
        }
        List<LocalDate> leaveDates = leaveUsageService.selectionsFor(document).stream()
            .filter(selection -> LEAVE_TYPE.equals(selection.type()))
            .map(selection -> leaveUsageService.parseDate(selection.date()))
            .sorted()
            .toList();
        for (LocalDate leaveDate : leaveDates) {
            reserveDay(document, leaveDate);
        }
    }

    @Transactional
    public void consumeOnFinalApproval(ApprovalDocument document) {
        if (ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE.equals(document.getTemplateCode())) {
            List<CompTimeAllocation> allocations = allocationRepository.findByApprovalAndStatusInOrderByLeaveDateAscAllocationIdAsc(
                document, List.of(CompTimeAllocation.RESERVED)
            );
            if (allocations.stream().anyMatch(item -> item.getCredit().getExpiresOn().isBefore(LocalDate.now()))) {
                throw BusinessException.badRequest(
                    "COMP_TIME_RESERVATION_EXPIRED",
                    "결재 대기 중 대체휴무 적립 건이 만료되었습니다. 휴가관리자에게 만료일 연장을 요청해 주세요."
                );
            }
            allocations.forEach(CompTimeAllocation::use);
            if (!allocations.isEmpty()) {
                BigDecimal total = allocations.stream().map(CompTimeAllocation::getAllocatedDays).reduce(BigDecimal.ZERO, BigDecimal::add);
                notificationService.notifyEmp(document.getRequester().getEmpId(), "대체휴무 사용 확정",
                    "전자결재 최종 승인으로 대체휴무 " + day(total) + "일을 사용했습니다.", "APPROVAL", document.getApprovalId());
            }
            return;
        }
        if (ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE.equals(document.getTemplateCode())) {
            restoreCancelSelections(document, "휴가 취소계 최종 승인");
        }
    }

    @Transactional
    public void releasePending(ApprovalDocument document, String reason) {
        allocationRepository.findByApprovalAndStatusInOrderByLeaveDateAscAllocationIdAsc(
            document, List.of(CompTimeAllocation.RESERVED)
        ).forEach(allocation -> allocation.release(reason));
    }

    @Transactional
    public void restoreApprovedLeave(ApprovalDocument document, String reason) {
        List<CompTimeAllocation> allocations = allocationRepository.findByApprovalAndStatusInOrderByLeaveDateAscAllocationIdAsc(
            document, List.of(CompTimeAllocation.USED)
        );
        allocations.forEach(allocation -> allocation.restore(null, reason));
        notifyRestoration(document, allocations);
    }

    @Transactional
    public void restoreApprovedLeaveDate(ApprovalDocument document, LocalDate leaveDate, String reason) {
        List<CompTimeAllocation> allocations = allocationRepository.findByApprovalAndStatusInOrderByLeaveDateAscAllocationIdAsc(
            document, List.of(CompTimeAllocation.RESERVED, CompTimeAllocation.USED)
        ).stream().filter(item -> item.getLeaveDate().equals(leaveDate)).toList();
        List<CompTimeAllocation> restored = new java.util.ArrayList<>();
        for (CompTimeAllocation allocation : allocations) {
            if (CompTimeAllocation.RESERVED.equals(allocation.getStatus())) {
                allocation.release(reason);
            } else {
                allocation.restore(null, reason);
                restored.add(allocation);
            }
        }
        notifyRestoration(document, restored);
    }

    @Transactional
    public void reverseApprovedCancellation(ApprovalDocument cancelDocument, String reason) {
        List<CompTimeAllocation> allocations = allocationRepository.findByRestoredByApprovalAndStatusOrderByAllocationIdAsc(
            cancelDocument, CompTimeAllocation.RESTORED
        );
        allocations.forEach(allocation -> allocation.reuse(reason));
        if (!allocations.isEmpty()) {
            notificationService.notifyEmp(cancelDocument.getRequester().getEmpId(), "대체휴무 취소 복원 철회",
                "휴가 취소계 관리 취소로 원 휴가의 대체휴무 사용 상태가 복구되었습니다.", "APPROVAL", cancelDocument.getApprovalId());
        }
    }

    @Transactional
    public void restoreForHoliday(ApprovalDocument document, LocalDate leaveDate, Long holidayId) {
        String reason = "HOLIDAY:" + holidayId;
        List<CompTimeAllocation> allocations = allocationRepository.findByApprovalAndStatusInOrderByLeaveDateAscAllocationIdAsc(
            document, List.of(CompTimeAllocation.USED)
        ).stream().filter(item -> item.getLeaveDate().equals(leaveDate)).toList();
        allocations.forEach(allocation -> allocation.restore(null, reason));
        notifyRestoration(document, allocations);
    }

    @Transactional
    public void reverseHolidayRestoration(ApprovalDocument document, LocalDate leaveDate, Long holidayId) {
        List<CompTimeAllocation> allocations = allocationRepository
            .findByApprovalAndLeaveDateAndStatusAndStatusReasonOrderByAllocationIdAsc(
                document, leaveDate, CompTimeAllocation.RESTORED, "HOLIDAY:" + holidayId
            );
        allocations.forEach(allocation -> allocation.reuse("휴일 비활성화로 대체휴무 사용 재반영"));
    }

    @Scheduled(cron = "0 10 0 * * *", zone = "Asia/Seoul")
    @Transactional
    public void notifyExpiredCredits() {
        String job = "comp-time-expiration";
        scheduledJobStatusService.start(job);
        try {
            LocalDate today = LocalDate.now();
            List<CompTimeCredit> expired = creditRepository.findUnnotifiedExpired(today);
            for (CompTimeCredit credit : expired) {
                BigDecimal expiredDays = credit.getGrantedDays().subtract(credit.getUsedDays());
                credit.markExpirationNotified();
                notificationService.notifyEmp(credit.getEmp().getEmpId(), "대체휴무 만료",
                    credit.getWorkDate() + " 근무분 대체휴무 " + day(expiredDays) + "일이 " + credit.getExpiresOn() + "자로 만료되었습니다.",
                    "COMP_TIME", credit.getCreditId());
            }
            scheduledJobStatusService.success(job, "만료 알림 " + expired.size() + "건");
        } catch (RuntimeException exception) {
            scheduledJobStatusService.failure(job, exception);
            throw exception;
        }
    }

    private void reserveDay(ApprovalDocument document, LocalDate leaveDate) {
        LocalDate minimumExpiry = leaveDate.isAfter(LocalDate.now()) ? leaveDate : LocalDate.now();
        List<CompTimeCredit> credits = creditRepository.findUsableForUpdate(document.getRequester().getEmpId(), minimumExpiry);
        BigDecimal remaining = ONE_DAY;
        for (CompTimeCredit credit : credits) {
            if (credit.getWorkDate().isAfter(leaveDate) || credit.availableDays().signum() <= 0) {
                continue;
            }
            BigDecimal allocated = credit.availableDays().min(remaining);
            credit.reserve(allocated);
            allocationRepository.save(new CompTimeAllocation(credit, document, leaveDate, allocated));
            remaining = remaining.subtract(allocated);
            if (remaining.signum() == 0) {
                return;
            }
        }
        throw BusinessException.badRequest("COMP_TIME_INSUFFICIENT", leaveDate + "에 사용할 대체휴무 잔여일이 부족합니다.");
    }

    private void restoreCancelSelections(ApprovalDocument cancelDocument, String reason) {
        List<CompTimeAllocation> restored = new java.util.ArrayList<>();
        for (LeaveUsageSelectionResponse selection : leaveUsageService.selectionsFor(cancelDocument)) {
            if (!LEAVE_TYPE.equals(selection.type())) {
                continue;
            }
            LocalDate leaveDate = leaveUsageService.parseDate(selection.date());
            List<CompTimeAllocation> allocations = allocationRepository
                .findByApprovalRequesterEmpIdAndLeaveDateAndStatusOrderByAllocationIdAsc(
                    cancelDocument.getRequester().getEmpId(), leaveDate, CompTimeAllocation.USED
                ).stream().filter(allocation -> selection.approvalId() == null
                    || selection.approvalId().equals(allocation.getApproval().getApprovalId())).toList();
            allocations.forEach(allocation -> allocation.restore(cancelDocument, reason));
            restored.addAll(allocations);
        }
        notifyRestoration(cancelDocument, restored);
    }

    private void notifyRestoration(ApprovalDocument document, List<CompTimeAllocation> allocations) {
        if (allocations.isEmpty()) {
            return;
        }
        BigDecimal total = allocations.stream().map(CompTimeAllocation::getAllocatedDays).reduce(BigDecimal.ZERO, BigDecimal::add);
        notificationService.notifyEmp(document.getRequester().getEmpId(), "대체휴무 사용 취소",
            "취소된 휴가의 대체휴무 " + day(total) + "일을 원 적립 건으로 복원했습니다.", "APPROVAL", document.getApprovalId());
    }

    private CompTimeSummaryResponse summary(Emp emp) {
        LocalDate today = LocalDate.now();
        List<CompTimeCreditResponse> credits = creditRepository.findByEmpEmpIdOrderByExpiresOnAscWorkDateAsc(emp.getEmpId()).stream()
            .map(item -> CompTimeCreditResponse.from(item, today)).toList();
        BigDecimal available = credits.stream().filter(item -> !"EXPIRED".equals(item.status()))
            .map(CompTimeCreditResponse::availableDays).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal reserved = credits.stream().map(CompTimeCreditResponse::reservedDays).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new CompTimeSummaryResponse(emp.getEmpId(), emp.getEmpName(), available, reserved, credits);
    }

    private Emp requireManager() {
        Emp manager = currentEmpProvider.getCurrentEmp();
        if (!employeePermissionService.hasPermission(manager, EmployeePermissionService.LEAVE_ADMIN)) {
            throw BusinessException.forbidden("LEAVE_ADMIN_REQUIRED", "휴가관리자 권한이 필요합니다.");
        }
        return manager;
    }

    private Emp requireEmp(Long empId) {
        return empRepository.findById(empId)
            .orElseThrow(() -> BusinessException.notFound("EMP_NOT_FOUND", "직원을 찾을 수 없습니다."));
    }

    private void audit(Emp actor, AuditActionType action, CompTimeCredit credit, Map<String, ?> before, String reason, String ip, String agent) {
        Map<String, Object> after = Map.of(
            "creditId", credit.getCreditId(), "empId", credit.getEmp().getEmpId(), "workDate", credit.getWorkDate().toString(),
            "grantedDays", credit.getGrantedDays(), "expiresOn", credit.getExpiresOn().toString()
        );
        auditLogService.record(actor.getEmpId(), action, "comp_time_credit", credit.getCreditId(),
            before == null ? null : objectMapper.valueToTree(before), objectMapper.valueToTree(after), ip, agent, reason, true);
    }

    private String day(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }
}
