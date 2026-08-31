param(
    [Parameter(Mandatory = $true)][string]$BackupFile,
    [string]$PostgresBinDirectory = "C:\Program Files\PostgreSQL\17\bin",
    [string]$JavaHome = $env:JAVA_HOME
)
# Uses a new cluster and QA-only accounts. Never connects to the source database.
$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$backup = (Resolve-Path -LiteralPath $BackupFile).Path
$runRoot = Join-Path $root ("tmp\leave-work-qa-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
$dbName = "groupware_leave_work_qa"
$backendPort = 8081
$frontendPort = 5175
$maven = Join-Path $root ".tools\apache-maven-3.9.9\bin\mvn.cmd"
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$shell = (Get-Process -Id $PID).Path
$envNames = @("PGPASSWORD", "QA_APP_PASSWORD", "E2E_PASSWORD", "E2E_ISOLATED", "E2E_API_BASE", "E2E_BASE_URL", "E2E_SKIP_WEB_SERVER")
$previousEnv = @{}
foreach ($name in $envNames) { $previousEnv[$name] = [Environment]::GetEnvironmentVariable($name, "Process") }
foreach ($port in @($backendPort, $frontendPort)) {
    $probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
    try { $probe.Start() } finally { $probe.Stop() }
}
$probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
try { $probe.Start(); $dbPort = $probe.LocalEndpoint.Port } finally { $probe.Stop() }
foreach ($tool in @("initdb", "pg_ctl", "createdb", "pg_restore", "psql")) {
    if (-not (Test-Path -LiteralPath (Join-Path $PostgresBinDirectory "$tool.exe"))) { throw "Missing PostgreSQL tool: $tool" }
}
foreach ($file in @($maven, (Join-Path $JavaHome "bin\java.exe"), (Join-Path $root "frontend\node_modules\@playwright\test\package.json"))) {
    if (-not (Test-Path -LiteralPath $file)) { throw "Missing dependency: $file" }
}
function Write-Utf8([string]$Path, [string]$Content) {
    [IO.File]::WriteAllText($Path, $Content, [Text.UTF8Encoding]::new($false))
}
function Wait-Healthy([string]$Url, [Diagnostics.Process]$Launcher) {
    $deadline = (Get-Date).AddSeconds(100)
    do {
        if ($Launcher.HasExited) { throw "QA launcher exited; see logs in $runRoot" }
        try { if ((Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2).StatusCode -eq 200) { return } } catch {}
        Start-Sleep -Milliseconds 800
    } while ((Get-Date) -lt $deadline)
    throw "QA server did not become healthy: $Url"
}
function Stop-QaLauncher([Diagnostics.Process]$Launcher) {
    if (-not $Launcher) { return }
    $processes = @(Get-CimInstance Win32_Process)
    $owner = $processes | Where-Object { $_.ProcessId -eq $Launcher.Id }
    if (-not $owner) { return }
    if (-not $owner.CommandLine.Contains($runRoot)) { throw "Refusing to stop an unrelated process." }
    $ids = [Collections.Generic.List[int]]::new()
    $ids.Add($Launcher.Id)
    for ($index = 0; $index -lt $ids.Count; $index++) {
        foreach ($child in ($processes | Where-Object { $_.ParentProcessId -eq $ids[$index] })) { $ids.Add([int]$child.ProcessId) }
    }
    for ($index = $ids.Count - 1; $index -ge 0; $index--) { Stop-Process -Id $ids[$index] -Force -ErrorAction SilentlyContinue }
}
New-Item -ItemType Directory -Path $runRoot | Out-Null
$dataDirectory = Join-Path $runRoot "pgdata"
$passwordFile = Join-Path $runRoot "init-password.tmp"
$serverStarted = $false
$backend = $null
$frontend = $null
try {
    $dbPassword = [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")
    $appPassword = [Guid]::NewGuid().ToString("N") + "!aA1"
    Write-Utf8 $passwordFile $dbPassword
    @{
        Root = $root; DbPort = $dbPort; DbName = $dbName; JavaHome = $JavaHome; Npm = $npm
        DbPassword = ConvertTo-SecureString $dbPassword -AsPlainText -Force
        AppPassword = ConvertTo-SecureString $appPassword -AsPlainText -Force
    } | Export-Clixml -LiteralPath (Join-Path $runRoot "settings.xml")
    $env:PGPASSWORD = $dbPassword
    $env:QA_APP_PASSWORD = $appPassword
    & (Join-Path $PostgresBinDirectory "initdb.exe") -D $dataDirectory -U groupware --auth=scram-sha-256 --encoding=UTF8 --no-locale --pwfile=$passwordFile *> (Join-Path $runRoot "initdb.log")
    if ($LASTEXITCODE -ne 0) { throw "QA initdb failed." }
    Remove-Item -LiteralPath $passwordFile -Force
    & (Join-Path $PostgresBinDirectory "pg_ctl.exe") -D $dataDirectory -l (Join-Path $runRoot "postgres.log") -o "-h 127.0.0.1 -p $dbPort" start -w
    if ($LASTEXITCODE -ne 0) { throw "QA PostgreSQL failed to start." }
    $serverStarted = $true
    & (Join-Path $PostgresBinDirectory "createdb.exe") -h 127.0.0.1 -p $dbPort -U groupware $dbName
    if ($LASTEXITCODE -ne 0) { throw "QA database creation failed." }
    & (Join-Path $PostgresBinDirectory "pg_restore.exe") -h 127.0.0.1 -p $dbPort -U groupware -d $dbName --no-owner --no-privileges --exit-on-error $backup *> (Join-Path $runRoot "restore.log")
    if ($LASTEXITCODE -ne 0) { throw "QA restore failed." }
    foreach ($sql in @("backend\src\main\resources\db\schema\work_request_type_20260831_patch.sql", "backend\src\test\resources\leave-work-acceptance.sql")) {
        & (Join-Path $PostgresBinDirectory "psql.exe") -X -w -h 127.0.0.1 -p $dbPort -U groupware -d $dbName -v ON_ERROR_STOP=1 -f (Join-Path $root $sql) | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "QA schema/fixture preparation failed." }
    }
    $backendScript = Join-Path $runRoot "backend.ps1"
    Write-Utf8 $backendScript @'
$ErrorActionPreference = "Stop"
$settings = Import-Clixml -LiteralPath (Join-Path $PSScriptRoot "settings.xml")
$env:DB_PASSWORD = [Net.NetworkCredential]::new("", $settings.DbPassword).Password
$env:DB_URL = "jdbc:postgresql://127.0.0.1:$($settings.DbPort)/$($settings.DbName)"
$env:DB_USERNAME = "groupware"
$env:SERVER_PORT = "8081"
$env:SERVER_ADDRESS = "127.0.0.1"
$env:CORS_ALLOWED_ORIGINS = "http://127.0.0.1:5175"
$env:JWT_SECRET = $env:DB_PASSWORD + $env:DB_PASSWORD
$env:FILE_STORAGE_PATH = Join-Path $PSScriptRoot "uploads"
$env:LOGGING_LEVEL_ORG_HIBERNATE_SQL = "WARN"
$env:JAVA_HOME = $settings.JavaHome
Set-Location (Join-Path $settings.Root "backend")
& (Join-Path $settings.Root ".tools\apache-maven-3.9.9\bin\mvn.cmd") "-Dmaven.repo.local=$($settings.Root)\.m2repo" spring-boot:run *> (Join-Path $PSScriptRoot "backend.log")
exit $LASTEXITCODE
'@
    $frontendScript = Join-Path $runRoot "frontend.ps1"
    Write-Utf8 $frontendScript @'
$ErrorActionPreference = "Stop"
$settings = Import-Clixml -LiteralPath (Join-Path $PSScriptRoot "settings.xml")
$env:VITE_API_BASE_URL = "http://127.0.0.1:8081/api/v1"
Set-Location (Join-Path $settings.Root "frontend")
& $settings.Npm run dev -- --host 127.0.0.1 --port 5175 --strictPort *> (Join-Path $PSScriptRoot "frontend.log")
exit $LASTEXITCODE
'@
    $backend = Start-Process -FilePath $shell -ArgumentList @("-NoProfile", "-File", ('"' + $backendScript + '"')) -WindowStyle Hidden -PassThru
    $frontend = Start-Process -FilePath $shell -ArgumentList @("-NoProfile", "-File", ('"' + $frontendScript + '"')) -WindowStyle Hidden -PassThru
    Write-Host "[INFO] Waiting for isolated API and UI..."
    Wait-Healthy "http://127.0.0.1:8081/api/v1/health" $backend
    Wait-Healthy "http://127.0.0.1:5175" $frontend
    $env:E2E_PASSWORD = $appPassword
    $env:E2E_ISOLATED = "true"
    $env:E2E_API_BASE = "http://127.0.0.1:8081"
    $env:E2E_BASE_URL = "http://127.0.0.1:5175"
    $env:E2E_SKIP_WEB_SERVER = "true"
    Push-Location (Join-Path $root "frontend")
    try {
        & $npm run test:e2e -- tests/e2e/leave-work-readiness.spec.ts --workers=1 --retries=0 2>&1 | Tee-Object -FilePath (Join-Path $runRoot "acceptance.log")
        if ($LASTEXITCODE -ne 0) { throw "Leave/work acceptance failed; see $runRoot" }
    } finally { Pop-Location }
    & (Join-Path $PostgresBinDirectory "psql.exe") -X -w -h 127.0.0.1 -p $dbPort -U groupware -d $dbName -v ON_ERROR_STOP=1 -f (Join-Path $root "backend\src\main\resources\db\verify\work_request_integrity.sql") *> (Join-Path $runRoot "integrity.log")
    if ($LASTEXITCODE -ne 0) { throw "Post-test work/comp-time integrity check failed." }
    Write-Host "[OK] Isolated leave/work acceptance and database integrity passed."
} finally {
    try { Stop-QaLauncher $frontend } finally {
        try { Stop-QaLauncher $backend } finally {
            if ($serverStarted) { & (Join-Path $PostgresBinDirectory "pg_ctl.exe") -D $dataDirectory stop -m fast -w }
            if (Test-Path -LiteralPath $passwordFile) { Remove-Item -LiteralPath $passwordFile -Force }
            foreach ($name in $envNames) { [Environment]::SetEnvironmentVariable($name, $previousEnv[$name], "Process") }
        }
    }
    Write-Host "[INFO] QA evidence retained locally: $runRoot"
}
