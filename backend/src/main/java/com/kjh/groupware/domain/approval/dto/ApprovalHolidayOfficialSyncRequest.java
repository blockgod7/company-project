package com.kjh.groupware.domain.approval.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ApprovalHolidayOfficialSyncRequest(
    @NotBlank String previewToken,
    @Size(max = 500) String overrideReason
) {
}
