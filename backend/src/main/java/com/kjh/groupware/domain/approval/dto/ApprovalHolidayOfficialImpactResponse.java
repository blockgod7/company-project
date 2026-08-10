package com.kjh.groupware.domain.approval.dto;

import java.util.List;

public record ApprovalHolidayOfficialImpactResponse(
    int year,
    int createdCount,
    int updatedCount,
    int unchangedCount,
    int conflictCount,
    int affectedLeaveCount,
    int totalCount,
    String policyVersion,
    String basisSource,
    String previewToken,
    List<Item> items
) {
    public record Item(
        String holidayDate,
        String holidayName,
        String holidayType,
        String changeType,
        int affectedCount,
        List<ApprovalHolidayImpactResponse.Item> affectedLeaves
    ) {
    }
}
