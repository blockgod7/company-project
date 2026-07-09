param(
    [string]$DbName = $env:DB_NAME,
    [string]$DbUser = $env:DB_USERNAME,
    [string]$DbPassword = $env:DB_PASSWORD,
    [string]$AdminUser = $env:PG_ADMIN_USER,
    [string]$AdminPassword = $env:PG_ADMIN_PASSWORD,
    [string]$AdminDatabase = "postgres",
    [string]$PsqlPath = $env:PSQL_PATH,
    [switch]$Recreate,
    [switch]$ApplyLegacyPatches,
    [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DbName)) { $DbName = "groupware" }
if ([string]::IsNullOrWhiteSpace($DbUser)) { $DbUser = "groupware" }
if ([string]::IsNullOrWhiteSpace($DbPassword)) { $DbPassword = "groupware" }
if ([string]::IsNullOrWhiteSpace($AdminUser)) { $AdminUser = "postgres" }

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$schemaDir = Join-Path $root "backend\src\main\resources\db\schema"
$seedFile = Join-Path $root "backend\src\main\resources\db\seed\local_seed.sql"
$baselineSchema = Join-Path $schemaDir "groupware_schema.sql"

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

function Invoke-PsqlCommand {
    param(
        [string]$Database,
        [string]$User,
        [string]$Password,
        [string]$Command
    )
    $oldPassword = $env:PGPASSWORD
    try {
        if (-not [string]::IsNullOrWhiteSpace($Password)) {
            $env:PGPASSWORD = $Password
        }
        & $script:Psql -v ON_ERROR_STOP=1 -h localhost -U $User -d $Database -c $Command
        if ($LASTEXITCODE -ne 0) {
            throw "psql command failed with exit code $LASTEXITCODE"
        }
    } finally {
        $env:PGPASSWORD = $oldPassword
    }
}

function Invoke-PsqlFile {
    param(
        [string]$Database,
        [string]$User,
        [string]$Password,
        [string]$File
    )
    if (-not (Test-Path $File)) {
        throw "SQL file was not found: $File"
    }
    $oldPassword = $env:PGPASSWORD
    try {
        if (-not [string]::IsNullOrWhiteSpace($Password)) {
            $env:PGPASSWORD = $Password
        }
        Write-Host "Applying $(Split-Path -Leaf $File)"
        & $script:Psql -v ON_ERROR_STOP=1 -h localhost -U $User -d $Database -f $File
        if ($LASTEXITCODE -ne 0) {
            throw "psql file execution failed with exit code $LASTEXITCODE"
        }
    } finally {
        $env:PGPASSWORD = $oldPassword
    }
}

$script:Psql = Resolve-Psql -RequestedPath $PsqlPath
Write-Host "Using psql: $script:Psql"
Write-Host "Target database: $DbName"

$legacyPatchFiles = @(
    "auth_refresh_token_patch.sql",
    "approval_template_v1_patch.sql",
    "approval_phase1_patch.sql",
    "approval_phase3_patch.sql",
    "approval_phase5_default_line_patch.sql",
    "approval_operation_setting_patch.sql",
    "approval_phase7_delegation_patch.sql",
    "approval_equipment_proposal_patch.sql",
    "approval_missing_template_drafts_patch.sql",
    "approval_purchase_request_template_patch.sql",
    "approval_training_request_template_patch.sql",
    "pdm_phase1_patch.sql"
) | ForEach-Object { Join-Path $schemaDir $_ }

$currentPatchFiles = @(
    "approval_delegation_auto_patch.sql",
    "board_single_patch.sql",
    "pdm_folder_order_patch.sql"
) | ForEach-Object { Join-Path $schemaDir $_ }

if ($Recreate) {
    Write-Host "Recreate requested. Existing database '$DbName' will be dropped if it exists."
    $roleSql = @"
DO `$`$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$DbUser') THEN
        CREATE ROLE $DbUser LOGIN PASSWORD '$DbPassword';
    ELSE
        ALTER ROLE $DbUser WITH LOGIN PASSWORD '$DbPassword';
    END IF;
END
`$`$;
"@
    Invoke-PsqlCommand -Database $AdminDatabase -User $AdminUser -Password $AdminPassword -Command $roleSql
    Invoke-PsqlCommand -Database $AdminDatabase -User $AdminUser -Password $AdminPassword -Command "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DbName' AND pid <> pg_backend_pid();"
    Invoke-PsqlCommand -Database $AdminDatabase -User $AdminUser -Password $AdminPassword -Command "DROP DATABASE IF EXISTS $DbName;"
    Invoke-PsqlCommand -Database $AdminDatabase -User $AdminUser -Password $AdminPassword -Command "CREATE DATABASE $DbName OWNER $DbUser;"
    Invoke-PsqlFile -Database $DbName -User $DbUser -Password $DbPassword -File $baselineSchema
} else {
    Write-Host "Non-destructive patch mode. Use -Recreate to rebuild from groupware_schema.sql."
    $patchFiles = $currentPatchFiles
    if ($ApplyLegacyPatches) {
        Write-Host "Legacy patch application requested. This can fail on already-migrated databases with real data."
        $patchFiles = $legacyPatchFiles + $currentPatchFiles
    }
    foreach ($file in $patchFiles) {
        Invoke-PsqlFile -Database $DbName -User $DbUser -Password $DbPassword -File $file
    }
}

if (-not $SkipSeed) {
    Invoke-PsqlFile -Database $DbName -User $DbUser -Password $DbPassword -File $seedFile
}

Write-Host "Local PostgreSQL setup completed."
Write-Host "Run .\verify-local-db.ps1 to confirm schema, seed accounts, and backend health."
