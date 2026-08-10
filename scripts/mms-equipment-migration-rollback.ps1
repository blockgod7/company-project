[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [long]$RunId,
    [string]$DbName = $env:DB_NAME,
    [string]$DbUser = $env:DB_USERNAME,
    [string]$DbPassword = $env:DB_PASSWORD,
    [string]$PsqlPath = $env:PSQL_PATH,
    [string]$BackupDirectory = ".\backups",
    [switch]$Apply
)

$ErrorActionPreference = "Stop"

if ($RunId -le 0) { throw "RunId must be greater than zero." }
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
    if ($LASTEXITCODE -ne 0) { throw "psql query failed with exit code $LASTEXITCODE." }
    return (($result | Out-String).Trim())
}

$script:Psql = Resolve-Psql -RequestedPath $PsqlPath
$pgDump = Join-Path (Split-Path -Parent $script:Psql) "pg_dump.exe"
$oldPassword = $env:PGPASSWORD
try {
    $env:PGPASSWORD = $DbPassword
    $runInfo = Invoke-Scalar "SELECT source_system || '|' || status || '|' || equipment_imported::text || '|' || work_order_imported::text FROM equipment_migration_run WHERE migration_run_id = $RunId;"
    if ([string]::IsNullOrWhiteSpace($runInfo)) { throw "Migration run was not found: $RunId" }
    $parts = $runInfo -split "\|"
    Write-Host "Run $RunId`: source=$($parts[0]), status=$($parts[1]), equipment=$($parts[2]), workOrders=$($parts[3])"

    $externalReferences = Invoke-Scalar "SELECT count(*)::text FROM equipment target WHERE target.migration_run_id = $RunId AND EXISTS (SELECT 1 FROM equipment_report report WHERE report.equipment_id = target.equipment_id AND COALESCE(report.migration_run_id, -1) <> $RunId);"
    if ([int]$externalReferences -gt 0) {
        throw "Rollback is blocked because $externalReferences imported equipment records are referenced by later work orders."
    }
    if (-not $Apply) {
        Write-Host "Rollback readiness check passed. No database changes were made. Re-run with -Apply to execute."
        exit 0
    }
    if (-not (Test-Path -LiteralPath $pgDump -PathType Leaf)) {
        throw "pg_dump.exe was not found next to psql.exe: $pgDump"
    }

    $backupRoot = [IO.Path]::GetFullPath($BackupDirectory)
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    $backupPath = Join-Path $backupRoot "$DbName-before-equipment-rollback-$(Get-Date -Format 'yyyyMMdd-HHmmss').dump"
    Write-Host "Creating database backup: $backupPath"
    & $pgDump -h localhost -U $DbUser -d $DbName -Fc -f $backupPath
    if ($LASTEXITCODE -ne 0) { throw "Database backup failed with exit code $LASTEXITCODE." }

    $sql = @"
BEGIN;
DELETE FROM equipment_history_event history
USING equipment_report report
WHERE history.report_id = report.report_id
  AND report.migration_run_id = $RunId;
DELETE FROM equipment_report WHERE migration_run_id = $RunId;
DELETE FROM equipment WHERE migration_run_id = $RunId;
DELETE FROM equipment_migration_run WHERE migration_run_id = $RunId;
COMMIT;
"@
    & $script:Psql -v ON_ERROR_STOP=1 -h localhost -U $DbUser -d $DbName -c $sql
    if ($LASTEXITCODE -ne 0) {
        throw "Rollback failed with exit code $LASTEXITCODE. The rollback transaction was reverted."
    }
    Write-Host "Migration run $RunId was rolled back. Backup: $backupPath"
} finally {
    $env:PGPASSWORD = $oldPassword
}
