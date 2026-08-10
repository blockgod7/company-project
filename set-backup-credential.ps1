param(
    [string]$CredentialFile = (Join-Path $PSScriptRoot "backups\.groupware-db-credential.xml")
)

$ErrorActionPreference = "Stop"
$credentialPath = [System.IO.Path]::GetFullPath($CredentialFile)
$credentialDirectory = Split-Path -Parent $credentialPath
New-Item -ItemType Directory -Path $credentialDirectory -Force | Out-Null
$credential = Get-Credential -Message "Groupware backup database credential"
if (-not $credential) { throw "Credential entry was cancelled." }
$credential | Export-Clixml -LiteralPath $credentialPath
Write-Host "[OK] encrypted backup credential saved for the current Windows user: $credentialPath"
