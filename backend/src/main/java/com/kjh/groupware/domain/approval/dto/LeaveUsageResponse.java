package com.kjh.groupware.domain.approval.dto;

import java.util.List;

public record LeaveUsageResponse(
    String usedAnnualDays,
    String reservedAnnualDays,
    String totalAnnualDays,
    String remainingAnnualDays,
    List<LeaveUsageSelectionResponse> selections,
    List<LeaveUsageSelectionResponse> occupiedSelections,
    List<LeaveExclusionResponse> exclusions,
    int balanceYear,
    List<LeaveUsageSelectionResponse> pendingCancelSelections
) {
}
