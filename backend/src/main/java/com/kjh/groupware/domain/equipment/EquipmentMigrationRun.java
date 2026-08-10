package com.kjh.groupware.domain.equipment;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "equipment_migration_run")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EquipmentMigrationRun {
    @Id
    @Column(name = "migration_run_id")
    private Long migrationRunId;
    @Column(name = "source_system", nullable = false, length = 30)
    private String sourceSystem;
    @Column(name = "status", nullable = false, length = 30)
    private String status;
    @Column(name = "equipment_total", nullable = false)
    private Integer equipmentTotal;
    @Column(name = "equipment_imported", nullable = false)
    private Integer equipmentImported;
    @Column(name = "work_order_total", nullable = false)
    private Integer workOrderTotal;
    @Column(name = "work_order_imported", nullable = false)
    private Integer workOrderImported;
    @Column(name = "duplicate_count", nullable = false)
    private Integer duplicateCount;
    @Column(name = "warning_count", nullable = false)
    private Integer warningCount;
    @Column(name = "error_count", nullable = false)
    private Integer errorCount;
    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;
    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
