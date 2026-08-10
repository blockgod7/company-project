param(
    [string]$DbName = $env:DB_NAME,
    [string]$DbUser = $env:DB_USERNAME,
    [string]$DbPassword = $env:DB_PASSWORD,
    [string]$DbHost = $env:DB_HOST,
    [int]$DbPort = $(if ($env:DB_PORT) { [int]$env:DB_PORT } else { 5432 }),
    [string]$PgDumpPath = $env:PG_DUMP_PATH,
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "backups"),
    [switch]$IncludeUploads,
    [switch]$PruneExpired,
    [int]$RetentionDays = 30,
    [int]$MinimumBackups = 7
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($DbName)) { $DbName = "groupware" }
if ([string]::IsNullOrWhiteSpace($DbUser)) { $DbUser = "groupware" }
if ([string]::IsNullOrWhiteSpace($DbHost)) { $DbHost = "localhost" }
if ($DbPort -lt 1 -or $DbPort -gt 65535) { throw "DbPort must be between 1 and 65535." }
if ($RetentionDays -lt 1) { throw "RetentionDays must be at least 1." }
if ($MinimumBackups -lt 1) { throw "MinimumBackups must be at least 1." }

function Resolve-PostgresTool([string]$RequestedPath, [string]$ToolName) {
    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) { $candidates += $RequestedPath }
    $command = Get-Command "$ToolName.exe" -ErrorAction SilentlyContinue
    if ($command) { $candidates += $command.Source }
    foreach ($version in 17, 16, 15, 14) { $candidates += "C:\Program Files\PostgreSQL\$version\bin\$ToolName.exe" }
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) { return (Resolve-Path -LiteralPath $candidate).Path }
    }
    throw "$ToolName.exe was not found. Set PG_DUMP_PATH or install PostgreSQL client tools."
}

$pgDump = Resolve-PostgresTool $PgDumpPath "pg_dump"
$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$databaseBackup = Join-Path $outputRoot "$DbName-$timestamp.dump"
$oldPassword = $env:PGPASSWORD
try {
    if (-not [string]::IsNullOrWhiteSpace($DbPassword)) { $env:PGPASSWORD = $DbPassword }
    & $pgDump -h $DbHost -p $DbPort -U $DbUser -d $DbName -Fc --no-owner --no-privileges -f $databaseBackup
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }
} finally {
    $env:PGPASSWORD = $oldPassword
}

$uploadsArchive = $null
if ($IncludeUploads) {
    $uploadsPath = Join-Path $PSScriptRoot "uploads"
    if (Test-Path -LiteralPath $uploadsPath) {
        $uploadsArchive = Join-Path $outputRoot "uploads-$timestamp.zip"
        Compress-Archive -LiteralPath $uploadsPath -DestinationPath $uploadsArchive -CompressionLevel Optimal
    } else {
        Write-Host "[WARN] uploads directory was not found; database backup only."
    }
}

$metadata = [ordered]@{
    createdAt = (Get-Date).ToString("o")
    database = $DbName
    databaseFile = (Split-Path -Leaf $databaseBackup)
    databaseSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $databaseBackup).Hash
    uploadsFile = if ($uploadsArchive) { Split-Path -Leaf $uploadsArchive } else { $null }
    uploadsSha256 = if ($uploadsArchive) { (Get-FileHash -Algorithm SHA256 -LiteralPath $uploadsArchive).Hash } else { $null }
}
$metadataPath = Join-Path $outputRoot "$DbName-$timestamp.json"
$metadata | ConvertTo-Json | Set-Content -LiteralPath $metadataPath -Encoding UTF8
Write-Host "[OK] database backup: $databaseBackup"
if ($uploadsArchive) { Write-Host "[OK] uploads backup: $uploadsArchive" }
Write-Host "[OK] checksum metadata: $metadataPath"

if ($PruneExpired) {
    if ([System.IO.Path]::GetPathRoot($outputRoot).TrimEnd('\') -eq $outputRoot.TrimEnd('\')) {
        throw "Refusing to prune backups from a filesystem root."
    }
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    $allDatabaseBackups = @(Get-ChildItem -LiteralPath $outputRoot -Filter "$DbName-*.dump" -File |
        Sort-Object LastWriteTime -Descending)
    $expired = @($allDatabaseBackups | Select-Object -Skip $MinimumBackups |
        Where-Object { $_.LastWriteTime -lt $cutoff })
    foreach ($expiredBackup in $expired) {
        $expiredMetadata = [System.IO.Path]::ChangeExtension($expiredBackup.FullName, ".json")
        if (Test-Path -LiteralPath $expiredMetadata) {
            $metadataRecord = Get-Content -LiteralPath $expiredMetadata -Raw | ConvertFrom-Json
            if ($metadataRecord.uploadsFile) {
                $uploadsCandidate = [System.IO.Path]::GetFullPath((Join-Path $outputRoot $metadataRecord.uploadsFile))
                if ((Split-Path -Parent $uploadsCandidate) -eq $outputRoot -and (Test-Path -LiteralPath $uploadsCandidate)) {
                    Remove-Item -LiteralPath $uploadsCandidate -Force
                    Write-Host "[PRUNE] uploads backup: $uploadsCandidate"
                }
            }
            Remove-Item -LiteralPath $expiredMetadata -Force
        }
        Remove-Item -LiteralPath $expiredBackup.FullName -Force
        Write-Host "[PRUNE] database backup: $($expiredBackup.FullName)"
    }
    Write-Host "[OK] retention applied: $RetentionDays days, minimum $MinimumBackups database backups retained"
}
