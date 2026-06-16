$ErrorActionPreference = "Stop"

$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

$repo = "C:\Project\Groupware\.m2repo"
$backend = "C:\Project\Groupware\backend"

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
