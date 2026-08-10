param(
    [int]$Year = ((Get-Date).Year + 2),
    [string]$ServiceKey = $env:HOLIDAY_OPEN_API_SERVICE_KEY,
    [string]$BaseUrl = $(if ($env:HOLIDAY_OPEN_API_BASE_URL) { $env:HOLIDAY_OPEN_API_BASE_URL } else { "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo" })
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($ServiceKey)) {
    throw "HOLIDAY_OPEN_API_SERVICE_KEY is required. Use the decoded service key."
}
if ($Year -lt 2000 -or $Year -gt 2100) { throw "Year must be between 2000 and 2100." }
$encodedKey = [Uri]::EscapeDataString($ServiceKey.Trim())
$uri = "$BaseUrl`?serviceKey=$encodedKey&pageNo=1&numOfRows=100&solYear=$Year"
$response = Invoke-RestMethod -Method Get -Uri $uri -TimeoutSec 20
$resultCode = [string]$response.response.header.resultCode
if ($resultCode -ne "00") {
    throw "Holiday OpenAPI returned result code $resultCode."
}
$items = @($response.response.body.items.item | Where-Object { $_.isHoliday -eq "Y" })
if (-not $items.Count) { throw "Holiday OpenAPI returned no official holidays for $Year." }
Write-Host "[OK] Holiday OpenAPI live check succeeded for $Year; official holidays: $($items.Count)"
