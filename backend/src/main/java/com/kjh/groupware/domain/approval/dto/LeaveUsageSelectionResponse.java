package com.kjh.groupware.domain.approval.dto;

public record LeaveUsageSelectionResponse(
    String date,
    String type,
    String days,
    Long approvalId,
    String documentNo
) {
}
