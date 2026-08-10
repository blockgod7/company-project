param(
    [Parameter(Mandatory = $true)]
    [string]$MmsDbPath,
    [string]$ReportPath
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

function Read-CsvFile {
    param(
        [string]$CsvDirectory,
        [string]$FileName
    )
    $path = Join-Path $CsvDirectory $FileName
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required CSV file was not found: $path"
    }
    return @(Import-Csv -LiteralPath $path -Encoding UTF8)
}

function New-StringSet {
    return ,([System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::OrdinalIgnoreCase
    ))
}

function Test-LegacyDate {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $true
    }
    [string[]]$formats = @("yyyy", "yyyyMMdd", "yyyy-MM-dd", "yyyy-MM", "yyyyMMddHHmmss")
    $parsed = [DateTime]::MinValue
    return [DateTime]::TryParseExact(
        $Value.Trim(),
        $formats,
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::None,
        [ref]$parsed
    )
}

function Get-FileSha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

$csvDirectory = Resolve-CsvDirectory -RootPath $MmsDbPath
$equipmentFile = Join-Path $csvDirectory "T2EQUIPMENT.csv"
$workOrderFile = Join-Path $csvDirectory "T2WORK_ORDER.csv"
$directoryFile = Join-Path $csvDirectory "T4DIR_DTL.csv"
$userFile = Join-Path $csvDirectory "T4USERS.csv"
$deptFile = Join-Path $csvDirectory "T4DEPT.csv"

$equipmentRows = Read-CsvFile -CsvDirectory $csvDirectory -FileName "T2EQUIPMENT.csv"
$workOrderRows = Read-CsvFile -CsvDirectory $csvDirectory -FileName "T2WORK_ORDER.csv"
$directoryRows = Read-CsvFile -CsvDirectory $csvDirectory -FileName "T4DIR_DTL.csv"
$userRows = Read-CsvFile -CsvDirectory $csvDirectory -FileName "T4USERS.csv"
$deptRows = Read-CsvFile -CsvDirectory $csvDirectory -FileName "T4DEPT.csv"

$issues = [System.Collections.Generic.List[object]]::new()
function Add-Issue {
    param(
        [string]$Severity,
        [string]$EntityType,
        [string]$SourceRecordId,
        [int]$SourceRowNo,
        [string]$Code,
        [string]$Message,
        [string]$SourceValue
    )
    $issues.Add([pscustomobject]@{
        severity = $Severity
        entityType = $EntityType
        sourceRecordId = $SourceRecordId
        sourceRowNo = $SourceRowNo
        code = $Code
        message = $Message
        sourceValue = $SourceValue
    })
}

$equipmentNumbers = New-StringSet
$duplicateEquipmentNumbers = New-StringSet
for ($index = 0; $index -lt $equipmentRows.Count; $index++) {
    $row = $equipmentRows[$index]
    $rowNo = $index + 2
    $equipmentNo = [string]$row.EQUIP_NO
    if ([string]::IsNullOrWhiteSpace($equipmentNo)) {
        Add-Issue -Severity "ERROR" -EntityType "EQUIPMENT" -SourceRecordId "" -SourceRowNo $rowNo `
            -Code "EQUIPMENT_NO_REQUIRED" -Message "Equipment number is blank." -SourceValue ""
        continue
    }
    if (-not $equipmentNumbers.Add($equipmentNo.Trim())) {
        [void]$duplicateEquipmentNumbers.Add($equipmentNo.Trim())
        Add-Issue -Severity "ERROR" -EntityType "EQUIPMENT" -SourceRecordId $equipmentNo -SourceRowNo $rowNo `
            -Code "EQUIPMENT_NO_DUPLICATED" -Message "Equipment number is duplicated in the source file." -SourceValue $equipmentNo
    }
    foreach ($field in @("BUY_DATE", "MAKE_DATE", "CHOICE_DATE")) {
        $value = [string]$row.$field
        if (-not (Test-LegacyDate -Value $value)) {
            Add-Issue -Severity "WARNING" -EntityType "EQUIPMENT" -SourceRecordId $equipmentNo -SourceRowNo $rowNo `
                -Code "EQUIPMENT_DATE_INVALID" -Message "$field has an invalid date format." -SourceValue $value
        }
    }
}

$workOrderNumbers = New-StringSet
$duplicateWorkOrderNumbers = New-StringSet
$knownUsers = New-StringSet
$knownDepts = New-StringSet
$knownStatuses = @{}

foreach ($row in $userRows) {
    if (-not [string]::IsNullOrWhiteSpace([string]$row.USER_ID)) {
        [void]$knownUsers.Add(([string]$row.USER_ID).Trim())
    }
}
foreach ($row in $deptRows) {
    if (-not [string]::IsNullOrWhiteSpace([string]$row.DEPT_NO)) {
        [void]$knownDepts.Add(([string]$row.DEPT_NO).Trim())
    }
}
foreach ($row in $directoryRows) {
    if ("WO_STATUS" -eq ([string]$row.DIR_TYPE).Trim()) {
        $knownStatuses[([string]$row.CODE).Trim()] = ([string]$row.DESCRIPTION).Trim()
    }
}

$statusCounts = @{}
$workTypeStatusCounts = @{}
$equipmentStatusCounts = @{}
$equipmentTypeCounts = @{}
$requestDeptCounts = @{}
$assignmentDeptCounts = @{}
$assetNumberCounts = @{}

foreach ($row in $equipmentRows) {
    $status = ([string]$row.EQ_STATUS).Trim()
    $type = ([string]$row.EQ_TYPE).Trim()
    $assetNo = ([string]$row.ASSET_NO).Trim()
    if ([string]::IsNullOrWhiteSpace($status)) { $status = "(blank)" }
    if ([string]::IsNullOrWhiteSpace($type)) { $type = "(blank)" }
    if (-not $equipmentStatusCounts.ContainsKey($status)) { $equipmentStatusCounts[$status] = 0 }
    if (-not $equipmentTypeCounts.ContainsKey($type)) { $equipmentTypeCounts[$type] = 0 }
    $equipmentStatusCounts[$status]++
    $equipmentTypeCounts[$type]++
    if (-not [string]::IsNullOrWhiteSpace($assetNo)) {
        if (-not $assetNumberCounts.ContainsKey($assetNo)) { $assetNumberCounts[$assetNo] = 0 }
        $assetNumberCounts[$assetNo]++
    }
}

$duplicateAssetNumbers = @($assetNumberCounts.GetEnumerator() | Where-Object Value -gt 1)
foreach ($duplicate in $duplicateAssetNumbers) {
    Add-Issue -Severity "WARNING" -EntityType "EQUIPMENT" -SourceRecordId "" -SourceRowNo 0 `
        -Code "ASSET_NO_DUPLICATED" -Message "Asset number is shared by multiple source equipment records and will not be used as a target unique asset number." -SourceValue ([string]$duplicate.Key)
}

for ($index = 0; $index -lt $workOrderRows.Count; $index++) {
    $row = $workOrderRows[$index]
    $rowNo = $index + 2
    $workOrderNo = ([string]$row.WO_NO).Trim()
    $status = ([string]$row.WO_STATUS).Trim()
    $equipmentNo = ([string]$row.EQUIP_NO).Trim()

    if ([string]::IsNullOrWhiteSpace($workOrderNo)) {
        Add-Issue -Severity "ERROR" -EntityType "WORK_ORDER" -SourceRecordId "" -SourceRowNo $rowNo `
            -Code "WORK_ORDER_NO_REQUIRED" -Message "Work order number is blank." -SourceValue ""
    } elseif (-not $workOrderNumbers.Add($workOrderNo)) {
        [void]$duplicateWorkOrderNumbers.Add($workOrderNo)
        Add-Issue -Severity "ERROR" -EntityType "WORK_ORDER" -SourceRecordId $workOrderNo -SourceRowNo $rowNo `
            -Code "WORK_ORDER_NO_DUPLICATED" -Message "Work order number is duplicated in the source file." -SourceValue $workOrderNo
    }

    if ([string]::IsNullOrWhiteSpace($equipmentNo)) {
        Add-Issue -Severity "ERROR" -EntityType "WORK_ORDER" -SourceRecordId $workOrderNo -SourceRowNo $rowNo `
            -Code "WORK_ORDER_EQUIPMENT_REQUIRED" -Message "Work order equipment number is blank." -SourceValue ""
    } elseif (-not $equipmentNumbers.Contains($equipmentNo)) {
        Add-Issue -Severity "ERROR" -EntityType "WORK_ORDER" -SourceRecordId $workOrderNo -SourceRowNo $rowNo `
            -Code "WORK_ORDER_EQUIPMENT_NOT_FOUND" -Message "Referenced equipment does not exist in the source equipment file." -SourceValue $equipmentNo
    }

    if ([string]::IsNullOrWhiteSpace($status) -or -not $knownStatuses.ContainsKey($status)) {
        Add-Issue -Severity "ERROR" -EntityType "WORK_ORDER" -SourceRecordId $workOrderNo -SourceRowNo $rowNo `
            -Code "WORK_ORDER_STATUS_UNKNOWN" -Message "Work order status is not defined in the source directory codes." -SourceValue $status
    }
    if (-not $statusCounts.ContainsKey($status)) { $statusCounts[$status] = 0 }
    $statusCounts[$status]++
    $workType = ([string]$row.WO_TYPE).Trim()
    $workTypeStatusKey = if ([string]::IsNullOrWhiteSpace($workType)) { "(blank)/$status" } else { "$workType/$status" }
    if (-not $workTypeStatusCounts.ContainsKey($workTypeStatusKey)) { $workTypeStatusCounts[$workTypeStatusKey] = 0 }
    $workTypeStatusCounts[$workTypeStatusKey]++

    foreach ($mapping in @(
        @{ Field = "REQ_USER"; Required = $true; Code = "REQUEST_USER_NOT_FOUND" },
        @{ Field = "WORK_USER"; Required = $false; Code = "WORK_USER_NOT_FOUND" },
        @{ Field = "CANCEL_USER"; Required = $false; Code = "CANCEL_USER_NOT_FOUND" }
    )) {
        $value = ([string]$row.($mapping.Field)).Trim()
        if (-not [string]::IsNullOrWhiteSpace($value) -and -not $knownUsers.Contains($value)) {
            Add-Issue -Severity "WARNING" -EntityType "WORK_ORDER" -SourceRecordId $workOrderNo -SourceRowNo $rowNo `
                -Code $mapping.Code -Message "$($mapping.Field) is not present in the source user file." -SourceValue $value
        } elseif ($mapping.Required -and [string]::IsNullOrWhiteSpace($value)) {
            Add-Issue -Severity "WARNING" -EntityType "WORK_ORDER" -SourceRecordId $workOrderNo -SourceRowNo $rowNo `
                -Code "REQUEST_USER_REQUIRED" -Message "Request user is blank." -SourceValue ""
        }
    }

    foreach ($mapping in @(
        @{ Field = "REQ_DEPT_NO"; Code = "REQUEST_DEPT_NOT_FOUND" },
        @{ Field = "DEPT_NO"; Code = "ASSIGNMENT_DEPT_NOT_FOUND" }
    )) {
        $value = ([string]$row.($mapping.Field)).Trim()
        if ([string]::IsNullOrWhiteSpace($value)) {
            Add-Issue -Severity "WARNING" -EntityType "WORK_ORDER" -SourceRecordId $workOrderNo -SourceRowNo $rowNo `
                -Code "WORK_ORDER_DEPT_REQUIRED" -Message "$($mapping.Field) is blank." -SourceValue ""
        } elseif (-not $knownDepts.Contains($value)) {
            Add-Issue -Severity "WARNING" -EntityType "WORK_ORDER" -SourceRecordId $workOrderNo -SourceRowNo $rowNo `
                -Code $mapping.Code -Message "$($mapping.Field) is not present in the source department file." -SourceValue $value
        }
    }

    $requestDept = ([string]$row.REQ_DEPT_NO).Trim()
    $assignmentDept = ([string]$row.DEPT_NO).Trim()
    if ([string]::IsNullOrWhiteSpace($requestDept)) { $requestDept = "(blank)" }
    if ([string]::IsNullOrWhiteSpace($assignmentDept)) { $assignmentDept = "(blank)" }
    if (-not $requestDeptCounts.ContainsKey($requestDept)) { $requestDeptCounts[$requestDept] = 0 }
    if (-not $assignmentDeptCounts.ContainsKey($assignmentDept)) { $assignmentDeptCounts[$assignmentDept] = 0 }
    $requestDeptCounts[$requestDept]++
    $assignmentDeptCounts[$assignmentDept]++

    foreach ($field in @("REQ_DATE", "REQ_START_DATE", "REQ_END_DATE", "PLAN_START_DATE", "PLAN_END_DATE", "START_DATE", "END_DATE", "CANCEL_DATE")) {
        $value = [string]$row.$field
        if (-not (Test-LegacyDate -Value $value)) {
            Add-Issue -Severity "WARNING" -EntityType "WORK_ORDER" -SourceRecordId $workOrderNo -SourceRowNo $rowNo `
                -Code "WORK_ORDER_DATE_INVALID" -Message "$field has an invalid date format." -SourceValue $value
        }
    }

    if ($status -in @("BX", "CX") -and [string]::IsNullOrWhiteSpace(([string]$row.CANCEL_USER))) {
        Add-Issue -Severity "ERROR" -EntityType "WORK_ORDER" -SourceRecordId $workOrderNo -SourceRowNo $rowNo `
            -Code "CANCEL_USER_REQUIRED" -Message "$status cancellation user is blank." -SourceValue ""
    }
    if ($status -eq "AX" -and [string]::IsNullOrWhiteSpace(([string]$row.CANCEL_USER))) {
        Add-Issue -Severity "WARNING" -EntityType "WORK_ORDER" -SourceRecordId $workOrderNo -SourceRowNo $rowNo `
            -Code "REQUEST_CANCEL_USER_MISSING" -Message "Request cancellation user is unavailable; only request department and requester can be preserved." -SourceValue ""
    }
}

if ($equipmentRows.Count -ne 1757) {
    Add-Issue -Severity "WARNING" -EntityType "FILE" -SourceRecordId "T2EQUIPMENT" -SourceRowNo 0 `
        -Code "EQUIPMENT_COUNT_CHANGED" -Message "Equipment count differs from the previously verified count of 1,757." -SourceValue ([string]$equipmentRows.Count)
}
if ($workOrderRows.Count -ne 9966) {
    Add-Issue -Severity "WARNING" -EntityType "FILE" -SourceRecordId "T2WORK_ORDER" -SourceRowNo 0 `
        -Code "WORK_ORDER_COUNT_CHANGED" -Message "Work order count differs from the previously verified count of 9,966." -SourceValue ([string]$workOrderRows.Count)
}

$severityCounts = @{
    error = @($issues | Where-Object severity -eq "ERROR").Count
    warning = @($issues | Where-Object severity -eq "WARNING").Count
}

$report = [ordered]@{
    generatedAt = (Get-Date).ToString("o")
    sourcePath = (Resolve-Path -LiteralPath $MmsDbPath).Path
    csvDirectory = $csvDirectory
    dryRun = $true
    files = [ordered]@{
        equipment = @{ path = $equipmentFile; sha256 = Get-FileSha256 $equipmentFile }
        workOrder = @{ path = $workOrderFile; sha256 = Get-FileSha256 $workOrderFile }
        directory = @{ path = $directoryFile; sha256 = Get-FileSha256 $directoryFile }
        users = @{ path = $userFile; sha256 = Get-FileSha256 $userFile }
        departments = @{ path = $deptFile; sha256 = Get-FileSha256 $deptFile }
    }
    summary = [ordered]@{
        equipmentRows = $equipmentRows.Count
        workOrderRows = $workOrderRows.Count
        duplicateEquipmentNumbers = $duplicateEquipmentNumbers.Count
        duplicateWorkOrderNumbers = $duplicateWorkOrderNumbers.Count
        duplicateAssetNumbers = $duplicateAssetNumbers.Count
        errors = $severityCounts.error
        warnings = $severityCounts.warning
    }
    mappings = [ordered]@{
        workOrderStatuses = $statusCounts
        workOrderTypeStatuses = $workTypeStatusCounts
        workOrderStatusDescriptions = $knownStatuses
        equipmentStatuses = $equipmentStatusCounts
        equipmentTypes = $equipmentTypeCounts
        requestDepartments = $requestDeptCounts
        assignmentDepartments = $assignmentDeptCounts
    }
    issues = $issues
}

$json = $report | ConvertTo-Json -Depth 10
if (-not [string]::IsNullOrWhiteSpace($ReportPath)) {
    $target = [IO.Path]::GetFullPath($ReportPath)
    $parent = Split-Path -Parent $target
    if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    Set-Content -LiteralPath $target -Value $json -Encoding UTF8
    Write-Host "Dry-run report written: $target"
}

[pscustomobject]$report.summary | Format-List
