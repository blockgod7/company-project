param(
    [string]$Path = (Join-Path $PSScriptRoot "backend\docs\templates\bereavement-policy-input.csv")
)

$ErrorActionPreference = "Stop"
$resolvedPath = (Resolve-Path -LiteralPath $Path).Path
$rows = @(Import-Csv -LiteralPath $resolvedPath -Encoding UTF8)
if (-not $rows.Count) { throw "The bereavement policy input file is empty." }

$requiredColumns = @(
    "event_type", "family_relation", "allowed_days", "pay_type", "evidence_required",
    "effective_from", "effective_to", "change_reason", "confirmed_by", "confirmed_at"
)
$headers = @($rows[0].PSObject.Properties.Name)
$missingColumns = @($requiredColumns | Where-Object { $_ -notin $headers })
if ($missingColumns.Count) { throw "Missing columns: $($missingColumns -join ', ')" }

$allowedEvents = @("MARRIAGE", "BIRTH", "DEATH")
$allowedRelations = @("SELF", "SPOUSE", "CHILD", "PARENT", "SPOUSE_PARENT", "GRANDPARENT", "SIBLING")
$allowedPayTypes = @("PAID", "UNPAID")
$allowedEvidenceValues = @("Y", "N", "TRUE", "FALSE")
$errors = [System.Collections.Generic.List[string]]::new()
$keys = @{}

for ($index = 0; $index -lt $rows.Count; $index++) {
    $line = $index + 2
    $row = $rows[$index]
    if ($row.event_type -notin $allowedEvents) { $errors.Add("line ${line}: invalid event_type") }
    if ($row.family_relation -notin $allowedRelations) { $errors.Add("line ${line}: invalid family_relation") }

    $isPolicyEntered = -not [string]::IsNullOrWhiteSpace($row.allowed_days) `
        -or -not [string]::IsNullOrWhiteSpace($row.pay_type) `
        -or -not [string]::IsNullOrWhiteSpace($row.effective_from)
    if (-not $isPolicyEntered) { continue }

    $days = [decimal]0
    if (-not [decimal]::TryParse($row.allowed_days, [ref]$days) -or $days -lt [decimal]0.5) {
        $errors.Add("line ${line}: allowed_days must be at least 0.5")
    }
    if ($row.pay_type -notin $allowedPayTypes) { $errors.Add("line ${line}: pay_type must be PAID or UNPAID") }
    if (([string]$row.evidence_required).ToUpperInvariant() -notin $allowedEvidenceValues) {
        $errors.Add("line ${line}: evidence_required must be Y/N or TRUE/FALSE")
    }
    $effectiveFrom = [datetime]::MinValue
    if (-not [datetime]::TryParseExact($row.effective_from, "yyyy-MM-dd", $null, [Globalization.DateTimeStyles]::None, [ref]$effectiveFrom)) {
        $errors.Add("line ${line}: effective_from must use yyyy-MM-dd")
    }
    if (-not [string]::IsNullOrWhiteSpace($row.effective_to)) {
        $effectiveTo = [datetime]::MinValue
        if (-not [datetime]::TryParseExact($row.effective_to, "yyyy-MM-dd", $null, [Globalization.DateTimeStyles]::None, [ref]$effectiveTo)) {
            $errors.Add("line ${line}: effective_to must use yyyy-MM-dd")
        } elseif ($effectiveFrom -ne [datetime]::MinValue -and $effectiveTo -lt $effectiveFrom) {
            $errors.Add("line ${line}: effective_to cannot be earlier than effective_from")
        }
    }
    foreach ($field in "change_reason", "confirmed_by", "confirmed_at") {
        if ([string]::IsNullOrWhiteSpace($row.$field)) { $errors.Add("line ${line}: $field is required for a confirmed policy") }
    }
    $key = "$($row.event_type)|$($row.family_relation)|$($row.effective_from)"
    if ($keys.ContainsKey($key)) { $errors.Add("line ${line}: duplicate event/relation/effective_from") } else { $keys[$key] = $true }
}

if ($errors.Count) {
    $errors | ForEach-Object { Write-Host "[FAIL] $_" }
    throw "Bereavement policy input validation failed with $($errors.Count) issue(s)."
}
$completed = @($rows | Where-Object { -not [string]::IsNullOrWhiteSpace($_.allowed_days) }).Count
Write-Host "[OK] bereavement policy worksheet structure is valid; completed policies: $completed / $($rows.Count)"
