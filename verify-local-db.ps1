param(
    [string]$DbName = $env:DB_NAME,
    [string]$DbUser = $env:DB_USERNAME,
    [string]$DbPassword = $env:DB_PASSWORD,
    [string]$DbHost = $env:DB_HOST,
    [int]$DbPort = $(if ($env:DB_PORT) { [int]$env:DB_PORT } else { 5432 }),
    [string]$PsqlPath = $env:PSQL_PATH,
    [string]$BackendUrl = "http://localhost:8080/api/v1/health",
    [switch]$ApplyLeavePatch,
    [switch]$SkipSeedCheck,
    [switch]$SkipBackendHealth
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DbName)) { $DbName = "groupware" }
if ([string]::IsNullOrWhiteSpace($DbUser)) { $DbUser = "groupware" }
if ([string]::IsNullOrWhiteSpace($DbHost)) { $DbHost = "localhost" }
if ($DbPort -lt 1 -or $DbPort -gt 65535) { throw "DbPort must be between 1 and 65535." }

function Resolve-Psql {
    param([string]$RequestedPath)
    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
        $candidates += $RequestedPath
    }
    $command = Get-Command psql -ErrorAction SilentlyContinue
    if ($command) {
        $candidates += $command.Source
    }
    $candidates += @(
        "C:\Program Files\PostgreSQL\17\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe",
        "C:\Program Files\PostgreSQL\17\pgAdmin 4\runtime\psql.exe"
    )
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return (Resolve-Path $candidate).Path
        }
    }
    throw "psql.exe was not found. Install PostgreSQL client tools or set PSQL_PATH."
}

function Invoke-Scalar {
    param([string]$Sql)
    $oldPassword = $env:PGPASSWORD
    try {
        if (-not [string]::IsNullOrWhiteSpace($DbPassword)) { $env:PGPASSWORD = $DbPassword }
        $result = & $script:Psql -v ON_ERROR_STOP=1 -h $DbHost -p $DbPort -U $DbUser -d $DbName -t -A -c $Sql
        if ($LASTEXITCODE -ne 0) {
            throw "psql query failed with exit code $LASTEXITCODE"
        }
        return (($result | Out-String).Trim())
    } finally {
        $env:PGPASSWORD = $oldPassword
    }
}

function Invoke-SqlFile {
    param([string]$Path)
    $oldPassword = $env:PGPASSWORD
    try {
        if (-not [string]::IsNullOrWhiteSpace($DbPassword)) { $env:PGPASSWORD = $DbPassword }
        & $script:Psql -q -v ON_ERROR_STOP=1 -h $DbHost -p $DbPort -U $DbUser -d $DbName -f $Path
        if ($LASTEXITCODE -ne 0) {
            throw "psql script failed with exit code $LASTEXITCODE"
        }
    } finally {
        $env:PGPASSWORD = $oldPassword
    }
}

function Assert-Equals {
    param(
        [string]$Name,
        [string]$Actual,
        [string]$Expected
    )
    if ($Actual -ne $Expected) {
        throw "$Name failed. Expected '$Expected', got '$Actual'."
    }
    Write-Host "[OK] $Name"
}

$script:Psql = Resolve-Psql -RequestedPath $PsqlPath
Write-Host "Using psql: $script:Psql"
Write-Host "Target database: $DbName"

$service = Get-Service -Name postgresql* -ErrorAction SilentlyContinue | Select-Object -First 1
if ($service) {
    Write-Host "[OK] PostgreSQL service detected: $($service.Name) ($($service.Status))"
} else {
    Write-Host "[WARN] PostgreSQL Windows service was not detected by name. Continuing with psql checks."
}

Assert-Equals "database connectivity" (Invoke-Scalar "SELECT 'ok';") "ok"

if ($ApplyLeavePatch) {
    $leavePatch = Join-Path $PSScriptRoot "backend\src\main\resources\db\schema\leave_management_expansion_patch.sql"
    if (-not (Test-Path -LiteralPath $leavePatch)) {
        throw "Leave management patch was not found: $leavePatch"
    }
    Invoke-SqlFile -Path $leavePatch
    Write-Host "[OK] leave management expansion patch applied"
}

$requiredTables = @(
    "emp",
    "auth_refresh_token",
    "approval_document",
    "approval_delegation",
    "approval_holiday",
    "approval_leave_exclusion",
    "approval_leave_lifecycle_cancellation",
    "annual_leave_ledger",
    "emp_annual_leave",
    "emp_permission",
    "emp_employment_history",
    "emp_leave_period",
    "leave_policy",
    "comp_time_credit",
    "comp_time_allocation",
    "leave_policy_override",
    "approval_leave_admin_case",
    "bereavement_policy",
    "scheduled_job_run",
    "board",
    "menu",
    "user_menu_preference",
    "equipment",
    "equipment_report",
    "equipment_migration_run",
    "equipment_migration_issue",
    "equipment_migration_user_map",
    "pdm_folder",
    "pdm_drawing"
)

foreach ($table in $requiredTables) {
    Assert-Equals "table $table exists" (Invoke-Scalar "SELECT CASE WHEN to_regclass('public.$table') IS NULL THEN 'missing' ELSE 'ok' END;") "ok"
}

$requiredColumns = @(
    @{ Table = "approval_delegation"; Column = "start_at" },
    @{ Table = "approval_delegation"; Column = "end_at" },
    @{ Table = "approval_delegation"; Column = "delegation_type" },
    @{ Table = "approval_delegation"; Column = "source_approval_id" },
    @{ Table = "emp"; Column = "gender_code" },
    @{ Table = "emp"; Column = "employment_type" },
    @{ Table = "emp"; Column = "work_category" },
    @{ Table = "emp"; Column = "account_status" },
    @{ Table = "emp"; Column = "extension_number" },
    @{ Table = "menu"; Column = "menu_code" },
    @{ Table = "menu"; Column = "portal_code" },
    @{ Table = "menu"; Column = "icon_key" },
    @{ Table = "menu"; Column = "implementation_status" },
    @{ Table = "menu"; Column = "required_permission_code" },
    @{ Table = "menu"; Column = "searchable_yn" },
    @{ Table = "user_menu_preference"; Column = "pinned_yn" },
    @{ Table = "user_menu_preference"; Column = "hidden_yn" },
    @{ Table = "emp_annual_leave"; Column = "auto_calculated_days" },
    @{ Table = "emp_annual_leave"; Column = "final_days" },
    @{ Table = "approval_holiday"; Column = "source_type" },
    @{ Table = "approval_holiday"; Column = "repeat_type" },
    @{ Table = "approval_holiday"; Column = "apply_year" },
    @{ Table = "approval_holiday"; Column = "repeat_month" },
    @{ Table = "approval_holiday"; Column = "repeat_day" },
    @{ Table = "approval_holiday"; Column = "policy_version" },
    @{ Table = "approval_holiday"; Column = "basis_source" },
    @{ Table = "approval_leave_lifecycle_cancellation"; Column = "updated_at" },
    @{ Table = "approval_leave_lifecycle_cancellation"; Column = "updated_by" },
    @{ Table = "comp_time_credit"; Column = "expiration_notified_at" },
    @{ Table = "comp_time_allocation"; Column = "restored_by_approval_id" },
    @{ Table = "leave_policy_override"; Column = "override_max_segments" },
    @{ Table = "approval_leave_admin_case"; Column = "workers_comp_status" },
    @{ Table = "bereavement_policy"; Column = "evidence_required_yn" },
    @{ Table = "scheduled_job_run"; Column = "last_succeeded_at" },
    @{ Table = "notification"; Column = "event_key" },
    @{ Table = "equipment"; Column = "source_system" },
    @{ Table = "equipment"; Column = "migration_run_id" },
    @{ Table = "equipment_report"; Column = "cancel_stage" },
    @{ Table = "equipment_report"; Column = "cancelled_by_emp_id" },
    @{ Table = "equipment_report"; Column = "source_system" },
    @{ Table = "equipment_report"; Column = "source_status" },
    @{ Table = "equipment_report"; Column = "migration_run_id" },
    @{ Table = "equipment_migration_issue"; Column = "resolved_yn" },
    @{ Table = "equipment_migration_issue"; Column = "resolved_at" },
    @{ Table = "pdm_folder"; Column = "sort_order" }
)

foreach ($item in $requiredColumns) {
    $sql = "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$($item.Table)' AND column_name = '$($item.Column)') THEN 'ok' ELSE 'missing' END;"
    Assert-Equals "column $($item.Table).$($item.Column) exists" (Invoke-Scalar $sql) "ok"
}

Assert-Equals "required portal menus are active" (Invoke-Scalar @"
SELECT count(DISTINCT menu_code)
FROM menu
WHERE menu_code IN (
    'EMPLOYEE_HOME', 'NOTICES', 'BOARDS', 'APPROVALS', 'PDM', 'EQUIPMENT',
    'ORGANIZATION', 'NOTIFICATIONS', 'ADMIN_HOME', 'EMPLOYEES', 'AUDIT_LOGS'
)
AND use_yn = 'Y';
"@) "11"

Assert-Equals "portal menu metadata values are valid" (Invoke-Scalar @"
SELECT count(*)
FROM menu
WHERE portal_code NOT IN ('EMPLOYEE', 'ADMIN')
   OR implementation_status NOT IN ('IMPLEMENTED', 'PLANNED', 'DISABLED')
   OR searchable_yn NOT IN ('Y', 'N');
"@) "0"

Assert-Equals "planned menus remain restricted metadata" (Invoke-Scalar @"
SELECT count(*)
FROM menu
WHERE menu_code IN ('PDM', 'EQUIPMENT')
  AND implementation_status = 'PLANNED'
  AND portal_code = 'EMPLOYEE'
  AND use_yn = 'Y';
"@) "2"

Assert-Equals "admin menus retain permission metadata" (Invoke-Scalar @"
SELECT count(*)
FROM menu
WHERE (menu_code = 'ADMIN_HOME' AND required_permission_code = 'ADMIN_PORTAL')
   OR (menu_code = 'EMPLOYEES' AND required_permission_code = 'EMPLOYEE_MANAGE')
   OR (menu_code = 'AUDIT_LOGS' AND required_permission_code = 'SYSTEM_ADMIN');
"@) "3"

Assert-Equals "menu preferences have valid flags" (Invoke-Scalar @"
SELECT count(*)
FROM user_menu_preference
WHERE pinned_yn NOT IN ('Y', 'N') OR hidden_yn NOT IN ('Y', 'N');
"@) "0"

Assert-Equals "confirmed hire dates are applied" (Invoke-Scalar @"
SELECT count(*)
FROM emp
WHERE (emp_no = 'E9024' AND hire_date = DATE '2016-09-01')
   OR (emp_no = 'E9064' AND hire_date = DATE '2024-01-15')
   OR (emp_no = 'C7008' AND hire_date = DATE '1997-09-29');
"@) "3"

Assert-Equals "2026 new-hire AUTO annual leave balances match revised policy" (Invoke-Scalar @"
WITH expected(emp_no, expected_days) AS (
    VALUES
        ('E9086', 11.0::NUMERIC), ('E9087', 11.0::NUMERIC), ('E9088', 9.0::NUMERIC),
        ('E9089', 8.0::NUMERIC), ('E9090', 7.0::NUMERIC), ('E9092', 7.0::NUMERIC),
        ('E9093', 7.0::NUMERIC), ('E9094', 7.0::NUMERIC), ('E9095', 7.0::NUMERIC),
        ('E9096', 7.0::NUMERIC), ('E9097', 7.0::NUMERIC), ('E9098', 6.0::NUMERIC),
        ('E9099', 6.0::NUMERIC)
)
SELECT count(*)
FROM expected
JOIN emp ON emp.emp_no = expected.emp_no
LEFT JOIN emp_annual_leave leave ON leave.emp_id = emp.emp_id AND leave.leave_year = 2026
WHERE leave.annual_leave_id IS NULL
   OR leave.calculation_mode <> 'AUTO'
   OR leave.final_days IS DISTINCT FROM expected.expected_days;
"@) "0"

$contactCoverage = Invoke-Scalar @"
SELECT concat(
    'employees=', count(*),
    ', email=', count(*) FILTER (WHERE nullif(trim(email), '') IS NOT NULL),
    ', phone=', count(*) FILTER (WHERE nullif(trim(phone), '') IS NOT NULL),
    ', extension=', count(*) FILTER (WHERE nullif(trim(extension_number), '') IS NOT NULL)
)
FROM emp
WHERE use_yn = 'Y';
"@
Write-Host "[INFO] active employee contact coverage: $contactCoverage"

Assert-Equals "managed permission codes are valid" (Invoke-Scalar @"
SELECT COUNT(*)
FROM emp_permission
WHERE permission_code NOT IN (
    'FULL_ADMIN', 'LEAVE_ADMIN', 'LEAVE_POLICY_ADMIN',
    'EMPLOYEE_ADMIN', 'WORK_CATEGORY_ADMIN', 'ACCOUNT_ADMIN'
);
"@) "0"

Assert-Equals "removed leave types are inactive" (Invoke-Scalar @"
SELECT COUNT(*) FROM leave_policy
WHERE encode(convert_to(leave_type, 'UTF8'), 'hex') IN (
    'ec9e90eb8580eb8f8cebb484ed9cb4eab080',
    'ed8ab9ebb384ec9ca0eab889ed9cb4eab080',
    'eab080eca1b1eb8f8cebb484ed9cb4eab080'
) AND active_yn = 'Y';
"@) "0"

Assert-Equals "required leave evidence policies are enabled" (Invoke-Scalar @"
SELECT COUNT(*) FROM leave_policy
WHERE encode(convert_to(leave_type, 'UTF8'), 'hex') IN (
    'ebb391eab080', 'eb829cec9e84ecb998eba38ced9cb4eab080'
) AND evidence_required_yn <> 'Y';
"@) "0"

Assert-Equals "new early-leave and occupational-accident policies exist" (Invoke-Scalar @"
SELECT COUNT(DISTINCT leave_type) FROM leave_policy
WHERE encode(convert_to(leave_type, 'UTF8'), 'hex') IN ('eca1b0ed87b4', 'eab3b5ec8381') AND active_yn = 'Y';
"@) "2"

Assert-Equals "compensatory-time credits expire at occurrence-year end" (Invoke-Scalar @"
SELECT COUNT(*) FROM comp_time_credit
WHERE expires_on <> make_date(EXTRACT(YEAR FROM work_date)::int, 12, 31);
"@) "0"

Assert-Equals "bereavement childbirth options are inactive" (Invoke-Scalar @"
SELECT COUNT(*) FROM bereavement_policy WHERE event_type = 'BIRTH' AND active_yn = 'Y';
"@) "0"

Assert-Equals "management positions have management work category" (Invoke-Scalar @"
SELECT COUNT(*) FROM emp
WHERE (
    encode(convert_to(trim(position_name), 'UTF8'), 'hex') IN (
        'eab8b0ec9b90', 'eab8b0ec9ea5', 'eb8c80eba6ac',
        'eab3bcec9ea5', 'ecb0a8ec9ea5', 'ebb680ec9ea5'
    )
    OR right(encode(convert_to(trim(position_name), 'UTF8'), 'hex'), 12) = 'ec9db4ec82ac'
)
AND work_category <> 'MANAGEMENT';
"@) "0"

Assert-Equals "line-leader positions have field work category" (Invoke-Scalar @"
SELECT COUNT(*) FROM emp
WHERE encode(convert_to(trim(position_name), 'UTF8'), 'hex') IN ('eca1b0ec9ea5', 'ebb098ec9ea5')
  AND work_category <> 'FIELD';
"@) "0"

$unlinkedLeaveCancelSql = @"
WITH cancel_selections AS (
    SELECT selection.item
    FROM approval_document cancel
    CROSS JOIN LATERAL jsonb_array_elements(
        NULLIF(cancel.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '')::jsonb
    ) AS selection(item)
    WHERE cancel.template_code = 'LEAVE_CANCEL'
      AND COALESCE(cancel.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '') <> ''
), legacy_fallback AS (
    SELECT cancel.approval_id
    FROM approval_document cancel
    WHERE cancel.template_code = 'LEAVE_CANCEL'
      AND COALESCE(cancel.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '') = ''
      AND COALESCE(cancel.form_data_json::jsonb -> 'fields' ->> 'startDate', '') <> ''
)
SELECT (
    (SELECT count(*) FROM cancel_selections WHERE COALESCE(item ->> 'sourceApprovalId', '') !~ '^[1-9][0-9]*$')
    + (SELECT count(*) FROM legacy_fallback)
)::text;
"@
Assert-Equals "leave cancellation selections have source approval ids" (Invoke-Scalar $unlinkedLeaveCancelSql) "0"

$invalidLeaveCancelSourceSql = @"
WITH source_selections AS (
    SELECT
        source.approval_id,
        selection.item ->> 'date' AS leave_date,
        selection.item ->> 'type' AS leave_type
    FROM approval_document source
    CROSS JOIN LATERAL jsonb_array_elements(
        NULLIF(source.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '')::jsonb
    ) AS selection(item)
    WHERE source.template_code = 'LEAVE'
      AND source.status = 'APPROVED'
      AND source.deleted_yn = 'N'
      AND COALESCE(source.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '') <> ''
    UNION ALL
    SELECT
        source.approval_id,
        source.form_data_json::jsonb -> 'fields' ->> 'startDate',
        source.form_data_json::jsonb -> 'fields' ->> 'leaveType'
    FROM approval_document source
    WHERE source.template_code = 'LEAVE'
      AND source.status = 'APPROVED'
      AND source.deleted_yn = 'N'
      AND COALESCE(source.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '') = ''
), linked_cancel_selections AS (
    SELECT cancel.requester_emp_id, selection.item
    FROM approval_document cancel
    CROSS JOIN LATERAL jsonb_array_elements(
        NULLIF(cancel.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '')::jsonb
    ) AS selection(item)
    WHERE cancel.template_code = 'LEAVE_CANCEL'
      AND COALESCE(selection.item ->> 'sourceApprovalId', '') ~ '^[1-9][0-9]*$'
)
SELECT count(*)::text
FROM linked_cancel_selections linked
LEFT JOIN approval_document source
  ON source.approval_id = (linked.item ->> 'sourceApprovalId')::bigint
WHERE source.approval_id IS NULL
   OR source.requester_emp_id <> linked.requester_emp_id
   OR source.template_code <> 'LEAVE'
   OR source.status <> 'APPROVED'
   OR source.deleted_yn <> 'N'
   OR (
       COALESCE(linked.item ->> 'sourceDocumentNo', '') <> ''
       AND linked.item ->> 'sourceDocumentNo' <> source.document_no
   )
   OR NOT EXISTS (
       SELECT 1
       FROM source_selections source_selection
       WHERE source_selection.approval_id = source.approval_id
         AND source_selection.leave_date = linked.item ->> 'date'
         AND source_selection.leave_type = linked.item ->> 'type'
   );
"@
Assert-Equals "leave cancellation source approval references are valid" (Invoke-Scalar $invalidLeaveCancelSourceSql) "0"

$leaveDefaultReceiverCount = Invoke-Scalar "SELECT count(*)::text FROM approval_operation_setting setting JOIN emp ON emp.emp_id = CASE WHEN setting.setting_value ~ '^[1-9][0-9]*$' THEN setting.setting_value::bigint END WHERE setting.setting_key = 'LEAVE_DEFAULT_RECEIVER_EMP_ID' AND emp.use_yn = 'Y' AND emp.status = 'ACTIVE' AND emp.account_status = 'ACTIVE';"
Assert-Equals "leave default receiver setting resolves to an active employee" $leaveDefaultReceiverCount "1"

$orphanImportedReports = Invoke-Scalar "SELECT count(*)::text FROM equipment_report report LEFT JOIN equipment target ON target.equipment_id = report.equipment_id WHERE report.source_system IS NOT NULL AND target.equipment_id IS NULL;"
Assert-Equals "imported equipment report references" $orphanImportedReports "0"

$officialHolidayCount = Invoke-Scalar "SELECT count(*)::text FROM approval_holiday WHERE source_type = 'LEGAL' AND apply_year IN (2026, 2027) AND active_yn = 'Y';"
if ([int]$officialHolidayCount -lt 46) {
    throw "official holiday check failed. Expected at least 46 active 2026-2027 legal holidays, got $officialHolidayCount."
}
Write-Host "[OK] official 2026-2027 holidays present: $officialHolidayCount"

if ($SkipSeedCheck) {
    Write-Host "[SKIP] local demo seed login check"
} else {
    $seedCount = Invoke-Scalar "SELECT count(*)::text FROM emp WHERE login_id IN ('admin', 'kim.manager', 'lee.sales', 'hong.gildong');"
    if ([int]$seedCount -lt 4) {
        throw "seed login check failed. Expected at least 4 known accounts, got $seedCount. Use -SkipSeedCheck for an existing operational database."
    }
    Write-Host "[OK] seed login accounts present: $seedCount"
}

$generalBoard = Invoke-Scalar "SELECT count(*)::text FROM board WHERE board_code = 'GENERAL' AND use_yn = 'Y';"
if ([int]$generalBoard -lt 1) {
    throw "GENERAL board check failed. Expected an active GENERAL board."
}
Write-Host "[OK] active GENERAL board present"

if (-not $SkipBackendHealth) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing $BackendUrl -TimeoutSec 5
        if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
            throw "unexpected status $($response.StatusCode)"
        }
        Write-Host "[OK] backend health: $BackendUrl"
    } catch {
        Write-Host "[WARN] backend health check failed: $($_.Exception.Message)"
        Write-Host "       Start the backend with .\start-web.ps1 or backend spring-boot:run, then rerun this check."
    }
}

Write-Host "Local PostgreSQL verification completed."
