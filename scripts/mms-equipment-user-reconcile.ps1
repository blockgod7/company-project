param(
    [long]$RunId = 0,
    [string]$MappingPath = (Join-Path $PSScriptRoot "mms-equipment-user-mapping.json"),
    [switch]$Apply,
    [string]$DbName = $env:DB_NAME,
    [string]$DbUser = $env:DB_USERNAME,
    [string]$DbPassword = $env:DB_PASSWORD,
    [string]$PsqlPath = $env:PSQL_PATH
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DbName)) { $DbName = "groupware" }
if ([string]::IsNullOrWhiteSpace($DbUser)) { $DbUser = "groupware" }
if ([string]::IsNullOrWhiteSpace($DbPassword)) { $DbPassword = "groupware" }

function Resolve-Psql {
    param([string]$RequestedPath)
    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) { $candidates += $RequestedPath }
    $command = Get-Command psql -ErrorAction SilentlyContinue
    if ($command) { $candidates += $command.Source }
    $candidates += @(
        "C:\Program Files\PostgreSQL\17\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe"
    )
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    throw "psql.exe was not found. Install PostgreSQL client tools or set PSQL_PATH."
}

function Convert-ToSqlLiteral {
    param([AllowNull()][string]$Value)
    if ($null -eq $Value) { return "NULL" }
    return "'" + $Value.Replace("'", "''") + "'"
}

if (-not (Test-Path -LiteralPath $MappingPath -PathType Leaf)) {
    throw "User mapping file was not found: $MappingPath"
}

$mappingDocument = Get-Content -LiteralPath $MappingPath -Raw -Encoding UTF8 | ConvertFrom-Json
$mappings = @($mappingDocument.mappings)
if ($mappings.Count -eq 0) { throw "The user mapping file does not contain mappings." }

$duplicateSourceIds = @($mappings | Group-Object { ([string]$_.sourceUserId).Trim().ToUpperInvariant() } | Where-Object Count -gt 1)
if ($duplicateSourceIds.Count -gt 0) {
    throw "The user mapping file contains duplicate source user IDs: $($duplicateSourceIds.Name -join ', ')"
}

$valueRows = foreach ($mapping in $mappings) {
    $sourceUserId = ([string]$mapping.sourceUserId).Trim()
    $currentEmpNo = ([string]$mapping.currentEmpNo).Trim()
    if ([string]::IsNullOrWhiteSpace($sourceUserId) -or [string]::IsNullOrWhiteSpace($currentEmpNo)) {
        throw "Every mapping requires sourceUserId and currentEmpNo."
    }
    "(" + ((Convert-ToSqlLiteral $sourceUserId), (Convert-ToSqlLiteral ([string]$mapping.sourceUserName)), (Convert-ToSqlLiteral $currentEmpNo), (Convert-ToSqlLiteral ([string]$mapping.matchMethod)) -join ", ") + ")"
}

$psql = Resolve-Psql -RequestedPath $PsqlPath
$oldPassword = $env:PGPASSWORD
try {
    $env:PGPASSWORD = $DbPassword
    if ($RunId -le 0) {
        $runResult = & $psql -v ON_ERROR_STOP=1 -h localhost -U $DbUser -d $DbName -t -A -c "SELECT COALESCE(MAX(migration_run_id), 0) FROM equipment_migration_run WHERE source_system = 'MMS';"
        if ($LASTEXITCODE -ne 0) { throw "Failed to resolve the latest MMS migration run." }
        $RunId = [long](($runResult | Out-String).Trim())
    }
    if ($RunId -le 0) { throw "No MMS equipment migration run was found." }

    $applySql = ""
    if ($Apply) {
        $applySql = @"
DO `$`$
BEGIN
    IF to_regclass('public.equipment_migration_user_map') IS NULL THEN
        RAISE EXCEPTION 'equipment_migration_user_map is missing. Apply equipment_legacy_migration_patch.sql first.';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM equipment_migration_user_map existing
        JOIN legacy_user_map incoming ON upper(incoming.source_user_id) = upper(existing.source_user_id)
        JOIN emp incoming_emp ON upper(incoming_emp.emp_no) = upper(incoming.current_emp_no)
        WHERE existing.migration_run_id = $RunId
          AND existing.emp_id <> incoming_emp.emp_id
    ) THEN
        RAISE EXCEPTION 'An existing source-user mapping points to a different employee.';
    END IF;
END `$`$;

INSERT INTO equipment_migration_user_map (
    migration_run_id, source_user_id, source_user_name, emp_id, match_method
)
SELECT $RunId, mapping.source_user_id, mapping.source_user_name, employee.emp_id, mapping.match_method
FROM legacy_user_map mapping
JOIN emp employee ON upper(employee.emp_no) = upper(mapping.current_emp_no)
ON CONFLICT (migration_run_id, source_user_id) DO NOTHING;

UPDATE equipment_report report
SET reporter_emp_id = employee.emp_id
FROM legacy_user_map mapping
JOIN emp employee ON upper(employee.emp_no) = upper(mapping.current_emp_no)
WHERE report.migration_run_id = $RunId
  AND upper(report.source_request_user_id) = upper(mapping.source_user_id)
  AND EXISTS (
      SELECT 1 FROM emp current_reporter
      WHERE current_reporter.emp_id = report.reporter_emp_id
        AND current_reporter.emp_no = 'LEGACY_IMPORT'
  );

UPDATE equipment_report report
SET assignee_emp_id = employee.emp_id
FROM legacy_user_map mapping
JOIN emp employee ON upper(employee.emp_no) = upper(mapping.current_emp_no)
WHERE report.migration_run_id = $RunId
  AND report.assignee_emp_id IS NULL
  AND report.source_status IN ('CA', 'CS', 'CX', 'YZ')
  AND upper(report.source_work_user_id) = upper(mapping.source_user_id);

UPDATE equipment_report report
SET cancelled_by_emp_id = employee.emp_id
FROM legacy_user_map mapping
JOIN emp employee ON upper(employee.emp_no) = upper(mapping.current_emp_no)
WHERE report.migration_run_id = $RunId
  AND report.cancelled_by_emp_id IS NULL
  AND report.source_status IN ('AX', 'BX', 'CX')
  AND upper(report.source_cancel_user_id) = upper(mapping.source_user_id);

UPDATE equipment_migration_issue issue
SET resolved_yn = 'Y',
    resolved_at = NOW(),
    resolution_note = 'CURRENT_EMPLOYEE_RECONCILED'
FROM equipment_report report
WHERE issue.migration_run_id = $RunId
  AND report.migration_run_id = $RunId
  AND issue.source_record_id = report.source_record_id
  AND issue.resolved_yn = 'N'
  AND (
      (issue.issue_code = 'REQUEST_USER_NOT_MAPPED' AND EXISTS (
          SELECT 1 FROM emp reporter
          WHERE reporter.emp_id = report.reporter_emp_id
            AND reporter.emp_no <> 'LEGACY_IMPORT'
      ))
      OR (issue.issue_code = 'WORK_USER_NOT_MAPPED' AND report.assignee_emp_id IS NOT NULL)
      OR (issue.issue_code = 'CANCEL_USER_NOT_MAPPED' AND report.cancelled_by_emp_id IS NOT NULL)
      OR (issue.issue_code = 'ACTIVE_ASSIGNEE_REVIEW_REQUIRED' AND report.assignee_emp_id IS NOT NULL)
  );
"@
    }

    $sql = @"
BEGIN;
CREATE TEMP TABLE legacy_user_map (
    source_user_id TEXT PRIMARY KEY,
    source_user_name TEXT,
    current_emp_no TEXT NOT NULL,
    match_method TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO legacy_user_map (source_user_id, source_user_name, current_emp_no, match_method)
VALUES
$($valueRows -join ",`n");

DO `$`$
BEGIN
    IF EXISTS (
        SELECT 1 FROM legacy_user_map mapping
        LEFT JOIN emp employee ON upper(employee.emp_no) = upper(mapping.current_emp_no)
        WHERE employee.emp_id IS NULL
    ) THEN
        RAISE EXCEPTION 'At least one mapped employee number does not exist.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM legacy_user_map mapping
        JOIN emp employee ON upper(employee.emp_no) = upper(mapping.current_emp_no)
        WHERE employee.use_yn <> 'Y'
    ) THEN
        RAISE EXCEPTION 'At least one mapped employee is inactive.';
    END IF;
END `$`$;

SELECT 'mapping_entries' AS metric, count(*)::bigint AS value FROM legacy_user_map
UNION ALL
SELECT 'requester_candidates', count(*) FROM equipment_report report
JOIN legacy_user_map mapping ON upper(mapping.source_user_id) = upper(report.source_request_user_id)
JOIN emp current_reporter ON current_reporter.emp_id = report.reporter_emp_id
WHERE report.migration_run_id = $RunId AND current_reporter.emp_no = 'LEGACY_IMPORT'
UNION ALL
SELECT 'worker_candidates', count(*) FROM equipment_report report
JOIN legacy_user_map mapping ON upper(mapping.source_user_id) = upper(report.source_work_user_id)
WHERE report.migration_run_id = $RunId AND report.assignee_emp_id IS NULL AND report.source_status IN ('CA', 'CS', 'CX', 'YZ')
UNION ALL
SELECT 'canceller_candidates', count(*) FROM equipment_report report
JOIN legacy_user_map mapping ON upper(mapping.source_user_id) = upper(report.source_cancel_user_id)
WHERE report.migration_run_id = $RunId AND report.cancelled_by_emp_id IS NULL AND report.source_status IN ('AX', 'BX', 'CX')
UNION ALL
SELECT 'active_worker_candidates', count(*) FROM equipment_report report
JOIN legacy_user_map mapping ON upper(mapping.source_user_id) = upper(report.source_work_user_id)
WHERE report.migration_run_id = $RunId AND report.assignee_emp_id IS NULL AND report.source_status IN ('CA', 'CS');

$applySql

SELECT 'remaining_active_without_assignee' AS metric, count(*)::bigint AS value
FROM equipment_report
WHERE migration_run_id = $RunId
  AND source_status IN ('CA', 'CS')
  AND assignee_emp_id IS NULL;
COMMIT;
"@

    if ($Apply) {
        Write-Host "Applying MMS user mappings to migration run $RunId"
    }
    else {
        Write-Host "Dry-running MMS user mappings for migration run $RunId"
    }
    $sql | & $psql -v ON_ERROR_STOP=1 -h localhost -U $DbUser -d $DbName -P pager=off
    if ($LASTEXITCODE -ne 0) { throw "User reconciliation failed with exit code $LASTEXITCODE." }
    if (-not $Apply) { Write-Host "Dry run only. Re-run with -Apply after taking a database backup." }
}
finally {
    $env:PGPASSWORD = $oldPassword
}
