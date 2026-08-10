package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.LeaveUsageSelectionResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.dto.EmployeeLeaveImpactResponse;
import com.kjh.groupware.domain.notification.NotificationService;
import java.time.LocalDate;
import java.util.List;
import java.util.function.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EmployeeLeaveLifecycleService {
    private final ApprovalDocumentRepository documentRepository;
    private final ApprovalLeaveUsageService leaveUsageService;
    private final ApprovalLeaveLifecycleCancellationRepository cancellationRepository;
    private final NotificationService notificationService;
    private final CompTimeLedgerService compTimeLedgerService;

    @Transactional(readOnly = true)
    public EmployeeLeaveImpactResponse retirementImpact(Emp emp, LocalDate retireDate) {
        return impact(emp, date -> date.isAfter(retireDate));
    }

    @Transactional(readOnly = true)
    public EmployeeLeaveImpactResponse leaveImpact(Emp emp, LocalDate startDate, LocalDate endDate) {
        return impact(emp, date -> !date.isBefore(startDate) && !date.isAfter(endDate));
    }

    @Transactional
    public int cancelForRetirement(Emp emp, LocalDate retireDate) {
        return cancel(emp, date -> date.isAfter(retireDate), "RETIREMENT", "퇴직에 따른 자동 취소");
    }

    @Transactional
    public int cancelForEmployeeLeave(Emp emp, LocalDate startDate, LocalDate endDate) {
        return cancel(emp, date -> !date.isBefore(startDate) && !date.isAfter(endDate), "EMPLOYEE_LEAVE", "휴직에 따른 자동 취소");
    }

    private EmployeeLeaveImpactResponse impact(Emp emp, Predicate<LocalDate> target) {
        List<EmployeeLeaveImpactResponse.Item> items = documents(emp).stream().flatMap(document ->
            leaveUsageService.selectionsFor(document).stream()
                .filter(selection -> target.test(leaveUsageService.parseDate(selection.date())))
                .map(selection -> new EmployeeLeaveImpactResponse.Item(document.getApprovalId(), document.getDocumentNo(), document.getStatus(), selection.date(), selection.type()))
        ).toList();
        return new EmployeeLeaveImpactResponse(items.size(), items);
    }

    private int cancel(Emp emp, Predicate<LocalDate> target, String type, String reason) {
        int count = 0;
        for (ApprovalDocument document : documents(emp)) {
            for (LeaveUsageSelectionResponse selection : leaveUsageService.selectionsFor(document)) {
                LocalDate date = leaveUsageService.parseDate(selection.date());
                if (!target.test(date) || cancellationRepository.existsByDocumentAndLeaveDateAndLeaveTypeAndCancellationType(document, date, selection.type(), type)) continue;
                cancellationRepository.save(new ApprovalLeaveLifecycleCancellation(document, date, selection.type(), type, reason));
                if (CompTimeLedgerService.LEAVE_TYPE.equals(selection.type())) {
                    compTimeLedgerService.restoreApprovedLeaveDate(document, date, reason);
                }
                count++;
            }
        }
        if (count > 0) notificationService.notifyEmp(emp.getEmpId(), "휴가 일정 자동 취소", reason + " 처리로 겹치는 휴가 " + count + "일이 취소되었습니다.", "EMPLOYEE", emp.getEmpId());
        return count;
    }

    private List<ApprovalDocument> documents(Emp emp) {
        return documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatusIn(
            emp, "N", ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE,
            List.of(ApprovalDocument.STATUS_IN_PROGRESS, ApprovalDocument.STATUS_APPROVED)
        );
    }
}
