param(
    [string]$CredentialFile = (Join-Path $PSScriptRoot "backups\.groupware-db-credential.xml"),
    [int]$RetentionDays = 30,
    [int]$MinimumBackups = 7
)

$ErrorActionPreference = "Stop"
$credentialPath = (Resolve-Path -LiteralPath $CredentialFile).Path
$credential = Import-Clixml -LiteralPath $credentialPath
$plainPassword = $credential.GetNetworkCredential().Password
$logDirectory = Join-Path $PSScriptRoot "backups\logs"
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$logPath = Join-Path $logDirectory ("backup-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")
$oldUser = $env:DB_USERNAME
$oldPassword = $env:DB_PASSWORD
try {
    Start-Transcript -LiteralPath $logPath -Force | Out-Null
    $env:DB_USERNAME = $credential.UserName
    $env:DB_PASSWORD = $plainPassword
    & (Join-Path $PSScriptRoot "backup-groupware.ps1") `
        -IncludeUploads `
        -PruneExpired `
        -RetentionDays $RetentionDays `
        -MinimumBackups $MinimumBackups
    if ($LASTEXITCODE -ne 0) { throw "Scheduled backup failed with exit code $LASTEXITCODE" }
} finally {
    $plainPassword = $null
    $env:DB_USERNAME = $oldUser
    $env:DB_PASSWORD = $oldPassword
    try { Stop-Transcript | Out-Null } catch { }
}
Write-Host "[OK] scheduled backup completed; log: $logPath"
