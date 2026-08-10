package com.kjh.groupware.domain.approval.dto;

public record ApprovalHolidayOfficialSyncResponse(
    int year,
    int createdCount,
    int updatedCount,
    int adjustedLeaveCount,
    int totalCount,
    String policyVersion,
    String basisSource
) {
}
