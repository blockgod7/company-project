package com.kjh.groupware.domain.approval.dto;

import jakarta.validation.constraints.Size;

public record ApprovalHolidayOverrideRequest(
    @Size(max = 500) String reason
) {
}
