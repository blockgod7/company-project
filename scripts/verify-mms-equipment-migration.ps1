param(
    [long]$RunId = 0,
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

function Invoke-Scalar {
    param([string]$Sql)
    $result = & $script:Psql -v ON_ERROR_STOP=1 -h localhost -U $DbUser -d $DbName -t -A -c $Sql
    if ($LASTEXITCODE -ne 0) {
        throw "psql query failed with exit code $LASTEXITCODE."
    }
    return (($result | Out-String).Trim())
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
    Write-Host "[OK] $Name`: $Actual"
}

$script:Psql = Resolve-Psql -RequestedPath $PsqlPath
$oldPassword = $env:PGPASSWORD
try {
    $env:PGPASSWORD = $DbPassword
    if ($RunId -le 0) {
        $RunId = [long](Invoke-Scalar "SELECT COALESCE(MAX(migration_run_id), 0)::text FROM equipment_migration_run WHERE source_system = 'MMS';")
    }
    if ($RunId -le 0) {
        throw "No MMS equipment migration run was found."
    }

    Write-Host "Verifying migration run: $RunId"
    Assert-Equals "source equipment total" (Invoke-Scalar "SELECT equipment_total::text FROM equipment_migration_run WHERE migration_run_id = $RunId;") "1757"
    Assert-Equals "source work-order total" (Invoke-Scalar "SELECT work_order_total::text FROM equipment_migration_run WHERE migration_run_id = $RunId;") "9966"
    Assert-Equals "imported equipment" (Invoke-Scalar "SELECT count(*)::text FROM equipment WHERE migration_run_id = $RunId;") "1757"
    Assert-Equals "imported work orders" (Invoke-Scalar "SELECT count(*)::text FROM equipment_report WHERE migration_run_id = $RunId;") "9965"
    Assert-Equals "excluded source work orders" (Invoke-Scalar "SELECT count(*)::text FROM equipment_migration_issue WHERE migration_run_id = $RunId AND severity = 'ERROR';") "1"
    Assert-Equals "duplicate equipment source keys" (Invoke-Scalar "SELECT count(*)::text FROM (SELECT source_system, source_record_id FROM equipment WHERE source_system = 'MMS' GROUP BY source_system, source_record_id HAVING count(*) > 1) duplicate;") "0"
    Assert-Equals "duplicate work-order source keys" (Invoke-Scalar "SELECT count(*)::text FROM (SELECT source_system, source_record_id FROM equipment_report WHERE source_system = 'MMS' GROUP BY source_system, source_record_id HAVING count(*) > 1) duplicate;") "0"
    Assert-Equals "orphan imported work orders" (Invoke-Scalar "SELECT count(*)::text FROM equipment_report report LEFT JOIN equipment target ON target.equipment_id = report.equipment_id WHERE report.migration_run_id = $RunId AND target.equipment_id IS NULL;") "0"
    Assert-Equals "completed work orders" (Invoke-Scalar "SELECT count(*)::text FROM equipment_report WHERE migration_run_id = $RunId AND state = 'COMPLETED';") "8762"
    Assert-Equals "cancelled work orders" (Invoke-Scalar "SELECT count(*)::text FROM equipment_report WHERE migration_run_id = $RunId AND state = 'CANCELLED';") "856"
    Assert-Equals "active work orders" (Invoke-Scalar "SELECT count(*)::text FROM equipment_report WHERE migration_run_id = $RunId AND state NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED');") "347"
    Assert-Equals "request-stage cancellations" (Invoke-Scalar "SELECT count(*)::text FROM equipment_report WHERE migration_run_id = $RunId AND cancel_stage = 'REQUEST';") "441"
    Assert-Equals "assignment-stage cancellations" (Invoke-Scalar "SELECT count(*)::text FROM equipment_report WHERE migration_run_id = $RunId AND cancel_stage = 'ASSIGNMENT';") "357"
    Assert-Equals "work-stage cancellations" (Invoke-Scalar "SELECT count(*)::text FROM equipment_report WHERE migration_run_id = $RunId AND cancel_stage = 'WORK';") "58"
    Assert-Equals "in-use equipment" (Invoke-Scalar "SELECT count(*)::text FROM equipment WHERE migration_run_id = $RunId AND status = 'IN_USE';") "1520"
    Assert-Equals "under-maintenance equipment" (Invoke-Scalar "SELECT count(*)::text FROM equipment WHERE migration_run_id = $RunId AND status = 'UNDER_MAINTENANCE';") "21"
    Assert-Equals "disposed equipment" (Invoke-Scalar "SELECT count(*)::text FROM equipment WHERE migration_run_id = $RunId AND status = 'DISPOSED';") "216"
    Assert-Equals "utility equipment" (Invoke-Scalar "SELECT count(*)::text FROM equipment WHERE migration_run_id = $RunId AND equipment_type = 'UTILITY';") "20"
    Assert-Equals "missing source payloads" (Invoke-Scalar "SELECT ((SELECT count(*) FROM equipment WHERE migration_run_id = $RunId AND source_payload IS NULL) + (SELECT count(*) FROM equipment_report WHERE migration_run_id = $RunId AND source_payload IS NULL))::text;") "0"

    Write-Host "MMS equipment migration verification completed."
} finally {
    $env:PGPASSWORD = $oldPassword
}
