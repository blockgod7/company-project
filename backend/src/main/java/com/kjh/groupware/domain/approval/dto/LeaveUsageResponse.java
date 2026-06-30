package com.kjh.groupware.domain.approval.dto;

import java.util.List;

public record LeaveUsageResponse(
    String usedAnnualDays,
    String totalAnnualDays,
    String remainingAnnualDays,
    List<LeaveUsageSelectionResponse> selections
) {
}
