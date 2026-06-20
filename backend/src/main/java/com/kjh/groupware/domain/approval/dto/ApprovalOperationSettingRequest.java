package com.kjh.groupware.domain.approval.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record ApprovalOperationSettingRequest(
    @NotNull @Min(1) @Max(720)
    Long decisionDueHours,

    @NotNull @Min(60000) @Max(86400000)
    Long reminderFixedDelayMs,

    @NotNull @Min(30) @Max(3650)
    Long deletedDocumentRetentionDays,

    @NotNull
    Boolean permanentDeleteEnabled
) {
}
