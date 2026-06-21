$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$maven = Join-Path $root ".tools\apache-maven-3.9.9\bin\mvn.cmd"
$m2repo = Join-Path $root ".m2repo"
$logDir = Join-Path $root "tmp\logs"
$npm = "C:\Program Files\nodejs\npm.cmd"
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

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$backendLog = Join-Path $logDir "backend.log"
$frontendLog = Join-Path $logDir "frontend.log"
$backendErr = Join-Path $logDir "backend.err.log"
$frontendErr = Join-Path $logDir "frontend.err.log"

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
& '$npm' run dev -- --host localhost *> '$frontendLog'
"@

Write-Host "Starting Groupware backend on http://localhost:8080"
Start-Process -FilePath $powershell -WindowStyle Hidden -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $backendCommand

Start-Sleep -Seconds 2

Write-Host "Starting Groupware frontend on http://localhost:5173"
Start-Process -FilePath $powershell -WindowStyle Hidden -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $frontendCommand

function Wait-Http($Url, $Name, $Seconds) {
    for ($i = 0; $i -lt $Seconds; $i++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
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

$frontendReady = Wait-Http "http://localhost:5173/" "Frontend" 30
$backendReady = Wait-Http "http://localhost:8080/api/v1/health" "Backend" 45

if ($frontendReady) {
    Start-Process "http://localhost:5173/"
} else {
    Write-Host "Frontend log: $frontendLog"
}

if (-not $backendReady) {
    Write-Host "Backend log: $backendLog"
    Write-Host "If the frontend opens but login/API fails, check PostgreSQL and apply backend\src\main\resources\db\schema\groupware_schema.sql."
}

Write-Host "Groupware launch requested."
Write-Host "Login: admin / admin1234"
Write-Host "Backend requires PostgreSQL DB_URL/DB_USERNAME/DB_PASSWORD or the default local groupware database."
