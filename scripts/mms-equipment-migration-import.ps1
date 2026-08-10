[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PreparedDirectory,
    [string]$DbName = $env:DB_NAME,
    [string]$DbUser = $env:DB_USERNAME,
    [string]$DbPassword = $env:DB_PASSWORD,
    [string]$PsqlPath = $env:PSQL_PATH,
    [string]$BackupDirectory = ".\backups",
    [switch]$Apply
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DbName)) { $DbName = "groupware" }
if ([string]::IsNullOrWhiteSpace($DbUser)) { $DbUser = "groupware" }
if ([string]::IsNullOrWhiteSpace($DbPassword)) { $DbPassword = "groupware" }

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
        "C:\Program Files\PostgreSQL\14\bin\psql.exe"
    )
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    throw "psql.exe was not found. Install PostgreSQL client tools or set PSQL_PATH."
}

function Assert-FileHash {
    param(
        [string]$Path,
        [string]$Expected
    )
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Prepared file was not found: $Path"
    }
    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $Expected.ToLowerInvariant()) {
        throw "Prepared file hash changed: $Path"
    }
}

function Convert-ToSqlLiteral {
    param([string]$Value)
    if ($null -eq $Value) { return "" }
    return $Value.Replace("'", "''")
}

function Convert-ToCopyPath {
    param([string]$Path)
    return ([IO.Path]::GetFullPath($Path)).Replace("\", "/").Replace("'", "''")
}

$root = Split-Path -Parent $PSScriptRoot
$preparedRoot = (Resolve-Path -LiteralPath $PreparedDirectory).Path
$manifestPath = Join-Path $preparedRoot "manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Migration manifest was not found: $manifestPath"
}
$manifest = Get-Content -Raw -LiteralPath $manifestPath -Encoding UTF8 | ConvertFrom-Json
$mappingPath = (Resolve-Path -LiteralPath ([string]$manifest.mappingPath)).Path
$mapping = Get-Content -Raw -LiteralPath $mappingPath -Encoding UTF8 | ConvertFrom-Json

$equipmentCsv = [string]$manifest.files.equipment.path
$workOrderCsv = [string]$manifest.files.workOrders.path
$rejectCsv = [string]$manifest.files.rejects.path
Assert-FileHash $equipmentCsv ([string]$manifest.files.equipment.sha256)
Assert-FileHash $workOrderCsv ([string]$manifest.files.workOrders.sha256)
Assert-FileHash $rejectCsv ([string]$manifest.files.rejects.sha256)

Write-Host "Prepared migration package verified."
[pscustomobject]$manifest.counts | Format-List
if (-not $Apply) {
    Write-Host "No database changes were made. Re-run with -Apply after reviewing the prepared counts."
    exit 0
}

$psql = Resolve-Psql -RequestedPath $PsqlPath
$pgDump = Join-Path (Split-Path -Parent $psql) "pg_dump.exe"
if (-not (Test-Path -LiteralPath $pgDump -PathType Leaf)) {
    throw "pg_dump.exe was not found next to psql.exe: $pgDump"
}

$backupRoot = [IO.Path]::GetFullPath($BackupDirectory)
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $backupRoot "$DbName-before-equipment-migration-$timestamp.dump"
$schemaPatch = Join-Path $root "backend\src\main\resources\db\schema\equipment_legacy_migration_patch.sql"
$sqlTemplate = Join-Path $PSScriptRoot "sql\mms-equipment-migration-import.sql"

$oldPassword = $env:PGPASSWORD
$tempSql = $null
try {
    $env:PGPASSWORD = $DbPassword
    Write-Host "Creating database backup: $backupPath"
    & $pgDump -h localhost -U $DbUser -d $DbName -Fc -f $backupPath
    if ($LASTEXITCODE -ne 0) {
        throw "Database backup failed with exit code $LASTEXITCODE."
    }

    Write-Host "Applying migration tracking schema."
    & $psql -v ON_ERROR_STOP=1 -h localhost -U $DbUser -d $DbName -f $schemaPatch
    if ($LASTEXITCODE -ne 0) {
        throw "Migration schema patch failed with exit code $LASTEXITCODE."
    }

    $sql = Get-Content -Raw -LiteralPath $sqlTemplate -Encoding UTF8
    $replacements = [ordered]@{
        "__EQUIPMENT_CSV__" = Convert-ToCopyPath $equipmentCsv
        "__WORK_ORDER_CSV__" = Convert-ToCopyPath $workOrderCsv
        "__REJECT_CSV__" = Convert-ToCopyPath $rejectCsv
        "__SOURCE_SYSTEM_SQL__" = Convert-ToSqlLiteral ([string]$manifest.sourceSystem)
        "__SOURCE_PATH_SQL__" = Convert-ToSqlLiteral ([string]$manifest.sourcePath)
        "__SOURCE_HASH_SQL__" = Convert-ToSqlLiteral ([string]$manifest.sourceHash)
        "__MAPPING_HASH_SQL__" = Convert-ToSqlLiteral ([string]$manifest.mappingHash)
        "__DEFAULT_PROCESS_NAME_SQL__" = Convert-ToSqlLiteral ([string]$mapping.defaultProcessName)
        "__DEFAULT_DEPT_CODE_SQL__" = Convert-ToSqlLiteral ([string]$mapping.defaultDeptCode)
        "__DEFAULT_DEPT_NAME_SQL__" = Convert-ToSqlLiteral ([string]$mapping.defaultDeptName)
        "__LEGACY_EMP_NO_SQL__" = Convert-ToSqlLiteral ([string]$mapping.legacyEmpNo)
        "__LEGACY_LOGIN_ID_SQL__" = Convert-ToSqlLiteral ([string]$mapping.legacyLoginId)
        "__LEGACY_EMP_NAME_SQL__" = Convert-ToSqlLiteral ([string]$mapping.legacyEmpName)
    }
    foreach ($entry in $replacements.GetEnumerator()) {
        $sql = $sql.Replace([string]$entry.Key, [string]$entry.Value)
    }
    if ($sql -match "__[A-Z0-9_]+__") {
        throw "Migration SQL contains an unresolved placeholder: $($Matches[0])"
    }

    $tempSql = [IO.Path]::GetTempFileName()
    Set-Content -LiteralPath $tempSql -Value $sql -Encoding UTF8
    Write-Host "Importing equipment and work-order history."
    & $psql -v ON_ERROR_STOP=1 -h localhost -U $DbUser -d $DbName -f $tempSql
    if ($LASTEXITCODE -ne 0) {
        throw "Equipment migration failed with exit code $LASTEXITCODE. The import transaction was rolled back."
    }
    Write-Host "Migration completed. Backup: $backupPath"
} finally {
    $env:PGPASSWORD = $oldPassword
    if ($tempSql -and (Test-Path -LiteralPath $tempSql -PathType Leaf)) {
        $resolvedTemp = (Resolve-Path -LiteralPath $tempSql).Path
        $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
        if ($resolvedTemp.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) {
            Remove-Item -LiteralPath $resolvedTemp -Force
        }
    }
}
