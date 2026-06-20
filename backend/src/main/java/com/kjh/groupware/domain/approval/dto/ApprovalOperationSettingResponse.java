package com.kjh.groupware.domain.approval.dto;

public record ApprovalOperationSettingResponse(
    long decisionDueHours,
    long reminderFixedDelayMs,
    long deletedDocumentRetentionDays,
    boolean permanentDeleteEnabled,
    long fallbackDecisionDueHours,
    long fallbackReminderFixedDelayMs,
    long fallbackDeletedDocumentRetentionDays,
    boolean fallbackPermanentDeleteEnabled
) {
}
