param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$maven = Join-Path $root ".tools\apache-maven-3.9.9\bin\mvn.cmd"
$m2repo = Join-Path $root ".m2repo"
$logDir = Join-Path $root "tmp\logs"
$runDir = Join-Path $root "tmp\run"
$npm = "C:\Program Files\nodejs\npm.cmd"
$frontendHost = "127.0.0.1"
$frontendPort = 5174
$backendPort = 8080
$frontendUrl = "http://${frontendHost}:${frontendPort}/"
$backendUrl = "http://127.0.0.1:${backendPort}/api/v1/health"
$javaHome = @(
    (Join-Path $root ".tools\jdk-21"),
    "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot",
    "C:\Program Files\Amazon Corretto\jdk21.0.6_7"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
$powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

if ($javaHome -and (Test-Path $javaHome)) {
    $env:JAVA_HOME = $javaHome
    $env:PATH = "$javaHome\bin;$env:PATH"
}

if (-not (Test-Path $maven)) {
    throw "Maven executable was not found: $maven"
}
if (-not (Test-Path $npm)) {
    throw "Node npm executable was not found: $npm"
}

New-Item -ItemType Directory -Force -Path $logDir, $runDir | Out-Null
$backendLog = Join-Path $logDir "backend.log"
$frontendLog = Join-Path $logDir "frontend.log"
$backendErr = Join-Path $logDir "backend.err.log"
$frontendErr = Join-Path $logDir "frontend.err.log"
$backendPidFile = Join-Path $runDir "backend-launcher.pid"
$frontendPidFile = Join-Path $runDir "frontend-launcher.pid"

function Test-HttpContent {
    param(
        [string]$Url,
        [string]$ExpectedText
    )
    try {
        $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 2
        return $response.StatusCode -eq 200 -and $response.Content.Contains($ExpectedText)
    } catch {
        return $false
    }
}

function Get-PortOwnerPid {
    param([int]$Port)
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($listener) { return $listener.OwningProcess }
    return $null
}

function Assert-ServicePort {
    param(
        [string]$Name,
        [int]$Port,
        [bool]$Ready
    )
    if ($Ready) { return }
    $ownerPid = Get-PortOwnerPid -Port $Port
    if ($ownerPid) {
        throw "$Name cannot start because port $Port is already used by PID $ownerPid. Stop that process or run .\stop-web.ps1 if it belongs to this project."
    }
}

$backendCommand = @"
if ('$javaHome') {
    `$env:JAVA_HOME = '$javaHome'
    `$env:PATH = '$javaHome\bin;' + `$env:PATH
}
Set-Location '$backend'
& '$maven' '-Dmaven.repo.local=$m2repo' spring-boot:run *> '$backendLog'
"@

$frontendCommand = @"
Set-Location '$frontend'
& '$npm' run dev -- --host $frontendHost --port $frontendPort --strictPort *> '$frontendLog'
"@

$backendReady = Test-HttpContent -Url $backendUrl -ExpectedText '"status":"OK"'
$frontendReady = Test-HttpContent -Url $frontendUrl -ExpectedText '<title>SCHUNK Groupware</title>'
Assert-ServicePort -Name "Backend" -Port $backendPort -Ready $backendReady
Assert-ServicePort -Name "Frontend" -Port $frontendPort -Ready $frontendReady

if ($backendReady) {
    Write-Host "Backend is already running: $backendUrl"
} else {
    Write-Host "Starting Groupware backend: $backendUrl"
    $backendProcess = Start-Process -FilePath $powershell -WindowStyle Hidden -PassThru -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $backendCommand
    Set-Content -LiteralPath $backendPidFile -Value $backendProcess.Id -Encoding ascii
}

Start-Sleep -Seconds 2

if ($frontendReady) {
    Write-Host "Frontend is already running: $frontendUrl"
} else {
    Write-Host "Starting Groupware frontend: $frontendUrl"
    $frontendProcess = Start-Process -FilePath $powershell -WindowStyle Hidden -PassThru -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $frontendCommand
    Set-Content -LiteralPath $frontendPidFile -Value $frontendProcess.Id -Encoding ascii
}

function Wait-Http($Url, $Name, $Seconds) {
    for ($i = 0; $i -lt $Seconds; $i++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                Write-Host "$Name is ready: $Url"
                return $true
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    Write-Host "$Name is not ready yet: $Url"
    return $false
}

$frontendReady = Wait-Http $frontendUrl "Frontend" 30
$backendReady = Wait-Http $backendUrl "Backend" 45

if (-not $frontendReady) {
    Write-Host "Frontend log: $frontendLog"
} elseif (-not $NoBrowser) {
    Start-Process $frontendUrl
}

if (-not $backendReady) {
    Write-Host "Backend log: $backendLog"
    Write-Host "If the frontend opens but login/API fails, check PostgreSQL and apply backend\src\main\resources\db\schema\groupware_schema.sql."
}

Write-Host "Groupware launch requested."
Write-Host "Frontend: $frontendUrl"
Write-Host "Backend: $backendUrl"
Write-Host "Backend requires PostgreSQL DB_URL/DB_USERNAME/DB_PASSWORD or the default local groupware database."
