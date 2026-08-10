package com.kjh.groupware.domain.equipment;

import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface EquipmentMigrationIssueRepository extends Repository<EquipmentMigrationRun, Long> {
    @Query(value = """
        SELECT severity AS severity, issue_code AS issueCode, COUNT(*) AS issueCount
        FROM equipment_migration_issue
        WHERE migration_run_id = :runId
          AND resolved_yn = 'N'
        GROUP BY severity, issue_code
        ORDER BY CASE severity WHEN 'ERROR' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END, issue_code
        """, nativeQuery = true)
    List<EquipmentMigrationIssueSummaryView> summarizeByRunId(@Param("runId") Long runId);
}
