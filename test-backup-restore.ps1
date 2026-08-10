param(
    [Parameter(Mandatory = $true)][string]$BackupFile,
    [string]$PostgresBinDirectory = "C:\Program Files\PostgreSQL\17\bin",
    [switch]$KeepWorkingDirectory
)

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$tempRoot = [System.IO.Path]::GetFullPath((Join-Path $root ".tmp"))
$runRoot = [System.IO.Path]::GetFullPath((Join-Path $tempRoot ("restore-drill-" + (Get-Date -Format "yyyyMMdd-HHmmss"))))
if (-not $runRoot.StartsWith($tempRoot + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Unexpected restore drill directory."
}
$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
$dataDirectory = Join-Path $runRoot "data"
$serverLog = Join-Path $runRoot "postgres.log"
$databaseName = "groupware_restore_drill"

function Resolve-PostgresTool([string]$Name) {
    $candidates = @((Join-Path $PostgresBinDirectory "$Name.exe"))
    $command = Get-Command "$Name.exe" -ErrorAction SilentlyContinue
    if ($command) { $candidates += $command.Source }
    foreach ($version in 17, 16, 15, 14) { $candidates += "C:\Program Files\PostgreSQL\$version\bin\$Name.exe" }
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) { return (Resolve-Path -LiteralPath $candidate).Path }
    }
    throw "$Name.exe was not found."
}

function Get-FreeTcpPort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    try {
        $listener.Start()
        return ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
    } finally {
        $listener.Stop()
    }
}

$initdb = Resolve-PostgresTool "initdb"
$pgCtl = Resolve-PostgresTool "pg_ctl"
$createdb = Resolve-PostgresTool "createdb"
$port = Get-FreeTcpPort
$serverStarted = $false

New-Item -ItemType Directory -Path $runRoot -Force | Out-Null
try {
    & $initdb -D $dataDirectory -U postgres --auth=trust --encoding=UTF8 --no-locale | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "initdb failed with exit code $LASTEXITCODE" }

    & $pgCtl -D $dataDirectory -l $serverLog -o "-h 127.0.0.1 -p $port" start -w
    if ($LASTEXITCODE -ne 0) { throw "temporary PostgreSQL start failed with exit code $LASTEXITCODE" }
    $serverStarted = $true

    & $createdb -h 127.0.0.1 -p $port -U postgres $databaseName
    if ($LASTEXITCODE -ne 0) { throw "temporary database creation failed with exit code $LASTEXITCODE" }

    & (Join-Path $root "restore-groupware.ps1") `
        -BackupFile $resolvedBackup `
        -TargetDbName $databaseName `
        -DbUser postgres `
        -DbHost 127.0.0.1 `
        -DbPort $port `
        -ConfirmRestore
    if ($LASTEXITCODE -ne 0) { throw "restore script failed with exit code $LASTEXITCODE" }

    & (Join-Path $root "verify-local-db.ps1") `
        -DbName $databaseName `
        -DbUser postgres `
        -DbHost 127.0.0.1 `
        -DbPort $port `
        -SkipBackendHealth `
        -SkipSeedCheck
    if ($LASTEXITCODE -ne 0) { throw "restored database verification failed with exit code $LASTEXITCODE" }

    Write-Host "[OK] isolated restore drill completed on temporary PostgreSQL port $port"
} finally {
    if ($serverStarted) {
        & $pgCtl -D $dataDirectory stop -m fast -w
    }
    if (-not $KeepWorkingDirectory -and (Test-Path -LiteralPath $runRoot)) {
        $resolvedRunRoot = (Resolve-Path -LiteralPath $runRoot).Path
        if (-not $resolvedRunRoot.StartsWith($tempRoot + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove an unexpected restore drill directory."
        }
        Remove-Item -LiteralPath $resolvedRunRoot -Recurse -Force
    } elseif ($KeepWorkingDirectory) {
        Write-Host "[INFO] restore drill files retained: $runRoot"
    }
}
