param(
    [Parameter(Mandatory = $true)][string]$BackupFile,
    [Parameter(Mandatory = $true)][string]$TargetDbName,
    [string]$DbUser = $env:DB_USERNAME,
    [string]$DbPassword = $env:DB_PASSWORD,
    [string]$DbHost = $env:DB_HOST,
    [int]$DbPort = $(if ($env:DB_PORT) { [int]$env:DB_PORT } else { 5432 }),
    [string]$PgRestorePath = $env:PG_RESTORE_PATH,
    [switch]$ConfirmRestore
)

$ErrorActionPreference = "Stop"
if ($TargetDbName -in @("postgres", "template0", "template1") -or $TargetDbName -notmatch '^[A-Za-z0-9_-]+$') {
    throw "TargetDbName must be an explicit non-system database name."
}
if ([string]::IsNullOrWhiteSpace($DbUser)) { $DbUser = "groupware" }
if ([string]::IsNullOrWhiteSpace($DbHost)) { $DbHost = "localhost" }
if ($DbPort -lt 1 -or $DbPort -gt 65535) { throw "DbPort must be between 1 and 65535." }
$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path

function Resolve-PgRestore([string]$RequestedPath) {
    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) { $candidates += $RequestedPath }
    $command = Get-Command pg_restore.exe -ErrorAction SilentlyContinue
    if ($command) { $candidates += $command.Source }
    foreach ($version in 17, 16, 15, 14) { $candidates += "C:\Program Files\PostgreSQL\$version\bin\pg_restore.exe" }
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) { return (Resolve-Path -LiteralPath $candidate).Path }
    }
    throw "pg_restore.exe was not found. Set PG_RESTORE_PATH or install PostgreSQL client tools."
}

$pgRestore = Resolve-PgRestore $PgRestorePath
& $pgRestore --list $resolvedBackup | Out-Null
if ($LASTEXITCODE -ne 0) { throw "The backup archive is invalid or unreadable." }
Write-Host "[OK] backup archive validated: $resolvedBackup"
if (-not $ConfirmRestore) {
    Write-Host "Validation only. Re-run with -ConfirmRestore to replace objects in '$TargetDbName'."
    exit 0
}

$oldPassword = $env:PGPASSWORD
try {
    if (-not [string]::IsNullOrWhiteSpace($DbPassword)) { $env:PGPASSWORD = $DbPassword }
    & $pgRestore -h $DbHost -p $DbPort -U $DbUser -d $TargetDbName --clean --if-exists --no-owner --no-privileges --exit-on-error $resolvedBackup
    if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE" }
} finally {
    $env:PGPASSWORD = $oldPassword
}
Write-Host "[OK] restored backup into explicit target database: $TargetDbName"
