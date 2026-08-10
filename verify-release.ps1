param(
    [switch]$SkipDatabase,
    [switch]$RunE2E
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
& git -C $root diff --check
if ($LASTEXITCODE -ne 0) { throw "git diff --check failed" }

Push-Location (Join-Path $root "frontend")
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "frontend build failed" }
    if ($RunE2E) { & npm.cmd run test:e2e } else { & npm.cmd run test:e2e:list }
    if ($LASTEXITCODE -ne 0) { throw "frontend E2E verification failed" }
} finally { Pop-Location }

$verify = Join-Path $root ".tmp\backend-release-verify"
if (Test-Path -LiteralPath $verify) {
    $resolved = (Resolve-Path -LiteralPath $verify).Path
    if ($resolved -ne [System.IO.Path]::GetFullPath($verify)) { throw "Unexpected backend verification path" }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
New-Item -ItemType Directory -Path $verify -Force | Out-Null
& robocopy (Join-Path $root "backend") $verify /E /XD target | Out-Null
& (Join-Path $root ".tools\apache-maven-3.9.9\bin\mvn.cmd") -f (Join-Path $verify "pom.xml") "-Dmaven.repo.local=$(Join-Path $root '.m2repo')" test
if ($LASTEXITCODE -ne 0) { throw "backend tests failed" }

if (-not $SkipDatabase) {
    $databaseVerifyArgs = @{
        SkipBackendHealth = $true
        SkipSeedCheck = $true
    }
    $localCredentialPath = Join-Path $root "backups\.groupware-db-credential.xml"
    $plainPassword = $null
    if ([string]::IsNullOrWhiteSpace($env:DB_PASSWORD) -and (Test-Path -LiteralPath $localCredentialPath)) {
        $localCredential = Import-Clixml -LiteralPath $localCredentialPath
        $databaseVerifyArgs.DbUser = $localCredential.UserName
        $plainPassword = $localCredential.GetNetworkCredential().Password
        $databaseVerifyArgs.DbPassword = $plainPassword
    }
    try {
        & (Join-Path $root "verify-local-db.ps1") @databaseVerifyArgs
    } finally {
        $plainPassword = $null
        $localCredential = $null
    }
    if ($LASTEXITCODE -ne 0) { throw "database verification failed" }
}
Write-Host "[OK] release verification completed"
