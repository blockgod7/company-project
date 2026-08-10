param([string]$TaskName = "Groupware Daily Backup")

$ErrorActionPreference = "Stop"
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Host "[SKIP] scheduled task does not exist: $TaskName"
    exit 0
}
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "[OK] scheduled task removed: $TaskName"
