package com.kjh.groupware.domain.equipment.dto;

import com.kjh.groupware.domain.equipment.EquipmentMigrationIssueSummaryView;

public record EquipmentMigrationIssueSummaryResponse(String severity, String issueCode, Long issueCount) {
    public static EquipmentMigrationIssueSummaryResponse from(EquipmentMigrationIssueSummaryView value) {
        return new EquipmentMigrationIssueSummaryResponse(value.getSeverity(), value.getIssueCode(), value.getIssueCount());
    }
}
