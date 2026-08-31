package com.kjh.groupware.domain.approval.dto;

public record ApprovalOperationSettingResponse(
    long decisionDueHours,
    long reminderFixedDelayMs,
    long deletedDocumentRetentionDays,
    boolean permanentDeleteEnabled,
    Long leaveDefaultReceiverEmpId,
    String leaveDefaultReceiverName,
    long fallbackDecisionDueHours,
    long fallbackReminderFixedDelayMs,
    long fallbackDeletedDocumentRetentionDays,
    boolean fallbackPermanentDeleteEnabled,
    Long fallbackLeaveDefaultReceiverEmpId,
    String fallbackLeaveDefaultReceiverName
) {
}
