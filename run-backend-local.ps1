$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$javaHome = @(
    (Join-Path $root ".tools\jdk-21"),
    "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot",
    "C:\Program Files\Amazon Corretto\jdk21.0.6_7"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($javaHome -and (Test-Path $javaHome)) {
    $env:JAVA_HOME = $javaHome
    $env:PATH = "$javaHome\bin;$env:PATH"
}

$repo = Join-Path $root ".m2repo"
$backend = Join-Path $root "backend"

$jars = Get-ChildItem $repo -Recurse -Filter "*.jar" |
    Where-Object {
        $_.FullName -notmatch "\\org\\apache\\maven\\" -and
        $_.FullName -notmatch "\\maven-" -and
        $_.FullName -notmatch "\\org\\codehaus\\plexus\\" -and
        $_.FullName -notmatch "\\org\\eclipse\\aether\\" -and
        $_.FullName -notmatch "\\org\\slf4j\\slf4j-api\\1\." -and
        $_.FullName -notmatch "\\junit\\" -and
        $_.FullName -notmatch "\\mockito\\" -and
        $_.FullName -notmatch "\\assertj\\" -and
        $_.FullName -notmatch "\\surefire\\" -and
        $_.FullName -notmatch "\\byte-buddy-agent"
    } |
    ForEach-Object { $_.FullName }

$classpath = @("$backend\target\classes") + $jars -join ";"

Set-Location $backend
java -cp $classpath com.kjh.groupware.GroupwareApplication
