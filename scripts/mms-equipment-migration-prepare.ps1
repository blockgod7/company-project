param(
    [Parameter(Mandatory = $true)]
    [string]$MmsDbPath,
    [string]$OutputDirectory = ".\tmp\mms-equipment-prepared",
    [string]$MappingPath = ".\scripts\mms-equipment-mapping.json"
)

$ErrorActionPreference = "Stop"

function Resolve-CsvDirectory {
    param([string]$RootPath)
    $resolved = (Resolve-Path -LiteralPath $RootPath).Path
    $csvCandidate = Join-Path $resolved "csv"
    if (Test-Path -LiteralPath $csvCandidate -PathType Container) {
        return $csvCandidate
    }
    return $resolved
}

function Get-TextSha256 {
    param([string]$Value)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
}

function Get-FileSha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Convert-LegacyDate {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }
    [string[]]$formats = @("yyyyMMdd", "yyyy-MM-dd", "yyyy-MM", "yyyy")
    $parsed = [DateTime]::MinValue
    if ([DateTime]::TryParseExact(
        $Value.Trim(),
        $formats,
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::None,
        [ref]$parsed
    )) {
        return $parsed.ToString("yyyy-MM-dd")
    }
    return $null
}

function Convert-DecimalText {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }
    $normalized = $Value.Trim().Replace(",", "")
    $parsed = [decimal]0
    if ([decimal]::TryParse(
        $normalized,
        [Globalization.NumberStyles]::Number,
        [Globalization.CultureInfo]::InvariantCulture,
        [ref]$parsed
    ) -and $parsed -ge 0) {
        return $parsed.ToString([Globalization.CultureInfo]::InvariantCulture)
    }
    return $null
}

function Limit-Text {
    param(
        [string]$Value,
        [int]$Length
    )
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }
    $trimmed = $Value.Trim()
    if ($trimmed.Length -le $Length) {
        return $trimmed
    }
    return $trimmed.Substring(0, $Length)
}

function First-Text {
    param([object[]]$Values)
    foreach ($value in $Values) {
        $text = [string]$value
        if (-not [string]::IsNullOrWhiteSpace($text)) {
            return $text.Trim()
        }
    }
    return $null
}

function Get-MappedValue {
    param(
        [object]$Map,
        [string]$Key,
        [string]$DefaultValue
    )
    if ($null -ne $Map -and -not [string]::IsNullOrWhiteSpace($Key)) {
        $property = $Map.PSObject.Properties[$Key.Trim()]
        if ($null -ne $property -and -not [string]::IsNullOrWhiteSpace([string]$property.Value)) {
            return ([string]$property.Value).Trim()
        }
    }
    return $DefaultValue
}

$csvDirectory = Resolve-CsvDirectory -RootPath $MmsDbPath
$mappingFile = (Resolve-Path -LiteralPath $MappingPath).Path
$mapping = Get-Content -Raw -LiteralPath $mappingFile -Encoding UTF8 | ConvertFrom-Json
$targetDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null

$equipmentSource = Join-Path $csvDirectory "T2EQUIPMENT.csv"
$workOrderSource = Join-Path $csvDirectory "T2WORK_ORDER.csv"
$equipmentRows = @(Import-Csv -LiteralPath $equipmentSource -Encoding UTF8)
$workOrderRows = @(Import-Csv -LiteralPath $workOrderSource -Encoding UTF8)

$assetCounts = @{}
foreach ($row in $equipmentRows) {
    $assetNo = ([string]$row.ASSET_NO).Trim()
    if (-not [string]::IsNullOrWhiteSpace($assetNo)) {
        if (-not $assetCounts.ContainsKey($assetNo)) { $assetCounts[$assetNo] = 0 }
        $assetCounts[$assetNo]++
    }
}

$utilityTypes = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($typeCode in @($mapping.utilityEquipmentTypeCodes)) {
    [void]$utilityTypes.Add(([string]$typeCode).Trim())
}

$preparedEquipment = [Collections.Generic.List[object]]::new()
for ($index = 0; $index -lt $equipmentRows.Count; $index++) {
    $row = $equipmentRows[$index]
    $sourceRecordId = ([string]$row.EQUIP_NO).Trim()
    if ([string]::IsNullOrWhiteSpace($sourceRecordId)) {
        continue
    }
    $sourcePayload = $row | ConvertTo-Json -Compress
    $assetNo = ([string]$row.ASSET_NO).Trim()
    if (-not [string]::IsNullOrWhiteSpace($assetNo) -and $assetCounts[$assetNo] -gt 1) {
        $assetNo = $null
    }
    $buyDate = Convert-LegacyDate ([string]$row.BUY_DATE)
    $makeDate = Convert-LegacyDate ([string]$row.MAKE_DATE)
    $introducedDate = First-Text @($buyDate, $makeDate)
    $introducedYear = if ($introducedDate) { $introducedDate.Substring(0, 4) } else { $null }
    $equipmentName = First-Text @($row.DESCRIPTION, $row.TAG_NO, $sourceRecordId)
    $sourceType = ([string]$row.EQ_TYPE).Trim()
    $sourceStatus = ([string]$row.EQ_STATUS).Trim()

    $preparedEquipment.Add([pscustomobject][ordered]@{
        source_record_id = $sourceRecordId
        source_row_no = $index + 2
        equipment_no = $sourceRecordId
        equipment_name = Limit-Text $equipmentName 200
        equipment_type = if ($utilityTypes.Contains($sourceType)) { "UTILITY" } else { "GENERAL" }
        asset_no = Limit-Text $assetNo 100
        model_name = Limit-Text ([string]$row.MODEL_NO) 200
        introduced_year = $introducedYear
        introduced_price = Convert-DecimalText ([string]$row.BUY_COST)
        manufacturer = Limit-Text ([string]$row.VENDOR_NAME) 200
        status = Get-MappedValue $mapping.equipmentStatus $sourceStatus "IN_USE"
        source_status = $sourceStatus
        source_payload_hash = Get-TextSha256 $sourcePayload
        source_payload = $sourcePayload
        created_at = First-Text @(
            (Convert-LegacyDate ([string]$row.ENTER_DATE)),
            (Convert-LegacyDate ([string]$row.UPDATE_DATE))
        )
    })
}

$preparedWorkOrders = [Collections.Generic.List[object]]::new()
$rejectedWorkOrders = [Collections.Generic.List[object]]::new()
for ($index = 0; $index -lt $workOrderRows.Count; $index++) {
    $row = $workOrderRows[$index]
    $sourceRecordId = ([string]$row.WO_NO).Trim()
    $equipmentNo = ([string]$row.EQUIP_NO).Trim()
    if ([string]::IsNullOrWhiteSpace($sourceRecordId) -or [string]::IsNullOrWhiteSpace($equipmentNo)) {
        $rejectedWorkOrders.Add([pscustomobject][ordered]@{
            source_record_id = $sourceRecordId
            source_row_no = $index + 2
            issue_code = if ([string]::IsNullOrWhiteSpace($sourceRecordId)) { "WORK_ORDER_NO_REQUIRED" } else { "WORK_ORDER_EQUIPMENT_REQUIRED" }
            source_value = $equipmentNo
        })
        continue
    }
    $sourcePayload = $row | ConvertTo-Json -Compress
    $sourceStatus = ([string]$row.WO_STATUS).Trim()
    $title = First-Text @($row.DESCRIPTION, $row.REQ_DESC, "과거 설비 업무")
    $symptom = First-Text @($row.SYMP_DESC, $row.REQ_DESC, "기록 없음")
    $requestContent = First-Text @($row.REQ_DESC, $row.DESCRIPTION, "기록 없음")
    $completedOn = if ($sourceStatus -eq "YZ") {
        First-Text @(
            (Convert-LegacyDate ([string]$row.END_DATE)),
            (Convert-LegacyDate ([string]$row.UPDATE_DATE))
        )
    } else { $null }

    $preparedWorkOrders.Add([pscustomobject][ordered]@{
        source_record_id = $sourceRecordId
        source_row_no = $index + 2
        equipment_no = $equipmentNo
        title = Limit-Text $title 200
        symptom = $symptom
        request_content = $requestContent
        priority = Get-MappedValue $mapping.priority ([string]$row.PRIORITY) "NORMAL"
        occurred_on = Convert-LegacyDate ([string]$row.REQ_DATE)
        state = Get-MappedValue $mapping.workOrderState $sourceStatus "DRAFT"
        reporter_source_user_id = Limit-Text ([string]$row.REQ_USER) 50
        assignee_source_user_id = Limit-Text ([string]$row.WORK_USER) 50
        assigned_by_source_user_id = Limit-Text ([string]$row.UPDATE_BY) 50
        planned_start_on = Convert-LegacyDate ([string]$row.PLAN_START_DATE)
        planned_end_on = Convert-LegacyDate ([string]$row.PLAN_END_DATE)
        assignment_instruction = First-Text @($row.WORK_DESC, $row.REQ_DESC)
        work_result = First-Text @($row.WORK_DESC, $row.REPAIR_DESC)
        cause_analysis = Limit-Text ([string]$row.FAIL_DESC) 1000000
        action_taken = Limit-Text ([string]$row.REPAIR_DESC) 1000000
        completed_on = $completedOn
        work_duration_hours = Convert-DecimalText ([string]$row.REPAIR_HRS)
        cancel_stage = Get-MappedValue $mapping.cancelStage $sourceStatus $null
        cancel_source_user_id = Limit-Text ([string]$row.CANCEL_USER) 50
        cancelled_on = Convert-LegacyDate ([string]$row.CANCEL_DATE)
        source_status = $sourceStatus
        source_request_dept_code = Limit-Text ([string]$row.REQ_DEPT_NO) 50
        source_assignment_dept_code = Limit-Text ([string]$row.DEPT_NO) 50
        source_payload_hash = Get-TextSha256 $sourcePayload
        source_payload = $sourcePayload
        created_at = First-Text @(
            (Convert-LegacyDate ([string]$row.REQ_DATE)),
            (Convert-LegacyDate ([string]$row.ENTER_DATE))
        )
    })
}

$equipmentTarget = Join-Path $targetDirectory "equipment.csv"
$workOrderTarget = Join-Path $targetDirectory "work_orders.csv"
$rejectTarget = Join-Path $targetDirectory "work_order_rejects.csv"
$preparedEquipment | Export-Csv -LiteralPath $equipmentTarget -NoTypeInformation -Encoding UTF8
$preparedWorkOrders | Export-Csv -LiteralPath $workOrderTarget -NoTypeInformation -Encoding UTF8
$rejectedWorkOrders | Export-Csv -LiteralPath $rejectTarget -NoTypeInformation -Encoding UTF8

$equipmentSourceHash = Get-FileSha256 $equipmentSource
$workOrderSourceHash = Get-FileSha256 $workOrderSource
$manifest = [ordered]@{
    generatedAt = (Get-Date).ToString("o")
    sourcePath = (Resolve-Path -LiteralPath $MmsDbPath).Path
    sourceSystem = [string]$mapping.sourceSystem
    sourceHash = Get-TextSha256 "$equipmentSourceHash`:$workOrderSourceHash"
    mappingPath = $mappingFile
    mappingHash = Get-FileSha256 $mappingFile
    counts = [ordered]@{
        equipmentSource = $equipmentRows.Count
        equipmentPrepared = $preparedEquipment.Count
        workOrderSource = $workOrderRows.Count
        workOrderPrepared = $preparedWorkOrders.Count
        workOrderRejected = $rejectedWorkOrders.Count
    }
    files = [ordered]@{
        equipment = @{ path = $equipmentTarget; sha256 = Get-FileSha256 $equipmentTarget }
        workOrders = @{ path = $workOrderTarget; sha256 = Get-FileSha256 $workOrderTarget }
        rejects = @{ path = $rejectTarget; sha256 = Get-FileSha256 $rejectTarget }
    }
}

$manifestPath = Join-Path $targetDirectory "manifest.json"
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Host "Prepared migration files: $targetDirectory"
[pscustomobject]$manifest.counts | Format-List
