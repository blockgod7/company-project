package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.notification.NotificationService;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalReminderService {

    private final ApprovalLineRepository lineRepository;
    private final ApprovalDelegationService delegationService;
    private final NotificationService notificationService;
    private final ApprovalOperationSettingService operationSettingService;
    private LocalDateTime lastReminderScanAt;

    public LocalDateTime decisionDueAt() {
        return LocalDateTime.now().plusHours(operationSettingService.decisionDueHours());
    }

    @Scheduled(fixedDelayString = "${app.approval.reminder-scheduler-tick-ms:60000}")
    @Transactional
    public synchronized void sendDueRemindersOnSchedule() {
        LocalDateTime now = LocalDateTime.now();
        if (lastReminderScanAt != null
            && now.isBefore(lastReminderScanAt.plusNanos(operationSettingService.reminderFixedDelayMs() * 1_000_000))) {
            return;
        }
        sendDueReminders(now);
        lastReminderScanAt = now;
    }

    @Transactional
    public int sendDueReminders(LocalDateTime now) {
        LocalDateTime targetTime = now == null ? LocalDateTime.now() : now;
        int sentLines = 0;
        List<ApprovalLine> dueLines = lineRepository.findDueForReminder(ApprovalLine.STATUS_PENDING, targetTime);
        for (ApprovalLine line : dueLines) {
            if (!line.isOverdueForReminder(targetTime)) {
                continue;
            }
            Map<Long, Emp> recipients = reminderRecipients(line);
            if (recipients.isEmpty()) {
                continue;
            }
            recipients.values().forEach(emp -> notificationService.notifyEmp(
                emp.getEmpId(),
                line.isAgreement() ? "전자결재 합의 지연" : "전자결재 결재 지연",
                reminderMessage(line),
                "APPROVAL",
                line.getDocument().getApprovalId()
            ));
            line.markReminded();
            sentLines++;
        }
        return sentLines;
    }

    private Map<Long, Emp> reminderRecipients(ApprovalLine line) {
        Map<Long, Emp> recipients = new LinkedHashMap<>();
        Emp assigned = line.getAssignedEmp();
        if (assigned != null && assigned.isActiveUser()) {
            recipients.put(assigned.getEmpId(), assigned);
        }
        List<Emp> delegates = delegationService.activeDelegatesFor(assigned);
        if (delegates != null) {
            delegates.forEach(delegate -> recipients.putIfAbsent(delegate.getEmpId(), delegate));
        }
        return recipients;
    }

    private String reminderMessage(ApprovalLine line) {
        String title = line.getDocument() == null ? "결재 문서" : line.getDocument().getTitle();
        String dueAt = line.getDueAt() == null ? "지정된 기한" : line.getDueAt().toString();
        return title + " 문서의 처리 기한이 지났습니다. 기한: " + dueAt;
    }
}
