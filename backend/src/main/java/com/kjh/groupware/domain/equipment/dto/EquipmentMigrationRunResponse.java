package com.kjh.groupware.domain.equipment.dto;

import com.kjh.groupware.domain.equipment.EquipmentMigrationRun;
import java.time.LocalDateTime;

public record EquipmentMigrationRunResponse(
    Long migrationRunId,
    String sourceSystem,
    String status,
    Integer equipmentTotal,
    Integer equipmentImported,
    Integer workOrderTotal,
    Integer workOrderImported,
    Integer duplicateCount,
    Integer warningCount,
    Integer errorCount,
    LocalDateTime startedAt,
    LocalDateTime completedAt
) {
    public static EquipmentMigrationRunResponse from(EquipmentMigrationRun value) {
        return new EquipmentMigrationRunResponse(
            value.getMigrationRunId(),
            value.getSourceSystem(),
            value.getStatus(),
            value.getEquipmentTotal(),
            value.getEquipmentImported(),
            value.getWorkOrderTotal(),
            value.getWorkOrderImported(),
            value.getDuplicateCount(),
            value.getWarningCount(),
            value.getErrorCount(),
            value.getStartedAt(),
            value.getCompletedAt()
        );
    }
}
