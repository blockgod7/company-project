param(
    [string]$DbName = $env:DB_NAME,
    [string]$DbUser = $env:DB_USERNAME,
    [string]$DbPassword = $env:DB_PASSWORD,
    [string]$PsqlPath = $env:PSQL_PATH,
    [string]$BackendUrl = "http://localhost:8080/api/v1/health",
    [switch]$SkipBackendHealth
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DbName)) { $DbName = "groupware" }
if ([string]::IsNullOrWhiteSpace($DbUser)) { $DbUser = "groupware" }
if ([string]::IsNullOrWhiteSpace($DbPassword)) { $DbPassword = "groupware" }

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

function Invoke-Scalar {
    param([string]$Sql)
    $oldPassword = $env:PGPASSWORD
    try {
        $env:PGPASSWORD = $DbPassword
        $result = & $script:Psql -v ON_ERROR_STOP=1 -h localhost -U $DbUser -d $DbName -t -A -c $Sql
        if ($LASTEXITCODE -ne 0) {
            throw "psql query failed with exit code $LASTEXITCODE"
        }
        return (($result | Out-String).Trim())
    } finally {
        $env:PGPASSWORD = $oldPassword
    }
}

function Assert-Equals {
    param(
        [string]$Name,
        [string]$Actual,
        [string]$Expected
    )
    if ($Actual -ne $Expected) {
        throw "$Name failed. Expected '$Expected', got '$Actual'."
    }
    Write-Host "[OK] $Name"
}

$script:Psql = Resolve-Psql -RequestedPath $PsqlPath
Write-Host "Using psql: $script:Psql"
Write-Host "Target database: $DbName"

$service = Get-Service -Name postgresql* -ErrorAction SilentlyContinue | Select-Object -First 1
if ($service) {
    Write-Host "[OK] PostgreSQL service detected: $($service.Name) ($($service.Status))"
} else {
    Write-Host "[WARN] PostgreSQL Windows service was not detected by name. Continuing with psql checks."
}

Assert-Equals "database connectivity" (Invoke-Scalar "SELECT 'ok';") "ok"

$requiredTables = @(
    "emp",
    "auth_refresh_token",
    "approval_document",
    "approval_delegation",
    "board",
    "pdm_folder",
    "pdm_drawing"
)

foreach ($table in $requiredTables) {
    Assert-Equals "table $table exists" (Invoke-Scalar "SELECT CASE WHEN to_regclass('public.$table') IS NULL THEN 'missing' ELSE 'ok' END;") "ok"
}

$requiredColumns = @(
    @{ Table = "approval_delegation"; Column = "start_at" },
    @{ Table = "approval_delegation"; Column = "end_at" },
    @{ Table = "approval_delegation"; Column = "delegation_type" },
    @{ Table = "approval_delegation"; Column = "source_approval_id" },
    @{ Table = "pdm_folder"; Column = "sort_order" }
)

foreach ($item in $requiredColumns) {
    $sql = "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$($item.Table)' AND column_name = '$($item.Column)') THEN 'ok' ELSE 'missing' END;"
    Assert-Equals "column $($item.Table).$($item.Column) exists" (Invoke-Scalar $sql) "ok"
}

$seedCount = Invoke-Scalar "SELECT count(*)::text FROM emp WHERE login_id IN ('admin', 'kim.manager', 'lee.sales', 'hong.gildong');"
if ([int]$seedCount -lt 4) {
    throw "seed login check failed. Expected at least 4 known accounts, got $seedCount."
}
Write-Host "[OK] seed login accounts present: $seedCount"

$generalBoard = Invoke-Scalar "SELECT count(*)::text FROM board WHERE board_code = 'GENERAL' AND use_yn = 'Y';"
if ([int]$generalBoard -lt 1) {
    throw "GENERAL board check failed. Expected an active GENERAL board."
}
Write-Host "[OK] active GENERAL board present"

if (-not $SkipBackendHealth) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing $BackendUrl -TimeoutSec 5
        if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
            throw "unexpected status $($response.StatusCode)"
        }
        Write-Host "[OK] backend health: $BackendUrl"
    } catch {
        Write-Host "[WARN] backend health check failed: $($_.Exception.Message)"
        Write-Host "       Start the backend with .\start-web.ps1 or backend spring-boot:run, then rerun this check."
    }
}

Write-Host "Local PostgreSQL verification completed."
