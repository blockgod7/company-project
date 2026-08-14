$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runDir = Join-Path $root "tmp\run"

function Stop-ManagedProcess {
    param(
        [string]$Name,
        [string]$PidFile
    )
    if (-not (Test-Path -LiteralPath $PidFile)) {
        Write-Host "$Name has no managed PID file."
        return
    }

    $rawPid = (Get-Content -Raw -LiteralPath $PidFile).Trim()
    $processId = 0
    if (-not [int]::TryParse($rawPid, [ref]$processId) -or $processId -le 0) {
        throw "$Name PID file is invalid: $PidFile"
    }

    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
        & taskkill.exe /PID $processId /T /F | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to stop $Name process tree for PID $processId."
        }
        Write-Host "$Name stopped (PID $processId)."
    } else {
        Write-Host "$Name process is already stopped (PID $processId)."
    }
    Remove-Item -LiteralPath $PidFile -Force
}

Stop-ManagedProcess -Name "Frontend" -PidFile (Join-Path $runDir "frontend-launcher.pid")
Stop-ManagedProcess -Name "Backend" -PidFile (Join-Path $runDir "backend-launcher.pid")
