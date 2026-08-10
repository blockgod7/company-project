param(
    [string]$TaskName = "Groupware Daily Backup",
    [datetime]$At = "02:00",
    [string]$CredentialFile = (Join-Path $PSScriptRoot "backups\.groupware-db-credential.xml"),
    [int]$RetentionDays = 30,
    [int]$MinimumBackups = 7
)

$ErrorActionPreference = "Stop"
$credentialPath = (Resolve-Path -LiteralPath $CredentialFile).Path
$runner = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "run-scheduled-backup.ps1")).Path
$arguments = @(
    "-NoProfile",
    "-ExecutionPolicy Bypass",
    "-File `"$runner`"",
    "-CredentialFile `"$credentialPath`"",
    "-RetentionDays $RetentionDays",
    "-MinimumBackups $MinimumBackups"
) -join " "
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Description "Groupware PostgreSQL and uploads backup with retention" -Force | Out-Null
Write-Host "[OK] scheduled task installed: $TaskName at $($At.ToString('HH:mm'))"
Write-Host "Run once for verification: Start-ScheduledTask -TaskName '$TaskName'"
