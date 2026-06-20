package com.kjh.groupware.domain.approval.dto;

public record ApprovalPermissionResponse(
    boolean canView,
    boolean canEditDraft,
    boolean canSubmit,
    boolean canApprove,
    boolean canReject,
    boolean canWithdraw,
    boolean canRedraft,
    boolean canCancel,
    boolean canReceive,
    boolean canCompleteReceipt,
    boolean canDownloadAttachment,
    boolean canPrintPdf,
    boolean canExport
) {
}
