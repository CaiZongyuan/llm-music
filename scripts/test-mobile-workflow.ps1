<#
.SYNOPSIS
Run the formal mobile journey against an explicitly isolated direct LAN Fake API.
.DESCRIPTION
Start the isolated Fake API and the intended Metro/build yourself. The flow enters
ApiUrl in the selected installed app and connects without PINs or device credentials.
API readiness, direct access mode and identity are checked before UI writes.
The original paired journey passed on Android; this revised direct connection flow
needs its own source/binary device evidence. Root owns that execution.
The bootstrap entrypoint scripts/test-mobile.ps1 remains separate.
.EXAMPLE
./scripts/test-mobile-workflow.ps1 -Device emulator-5562 -AppId host.exp.exponent `
  -ExpoUrl exp://127.0.0.1:18084 -FakeApiUrl http://127.0.0.1:18700 `
  -ApiUrl http://192.168.1.8:18701 -ExpectedServerId '<isolated-server-UUID>' -Isolated
.EXAMPLE
./scripts/test-mobile-workflow.ps1 -AppMode Apk -Device '<serial>' -AppId '<installed-package>' `
  -FakeApiUrl http://127.0.0.1:18700 -ApiUrl http://192.168.1.8:18701 `
  -ExpectedServerId '<isolated-server-UUID>' -Isolated -CheckBackground
.NOTES
Creates a new Project/Job/Version in the selected Fake namespace; it does not delete
data or stop shared services. UI play/pause/button seek is separate from audio bytes,
decoder, slider drag, GPU and APK configuration evidence. Artifacts are retained under
.scratch/mobile-workflow/. This runner reuses the existing SDK ADB / Metro / Maestro
checks and JUnit arguments, without running the bootstrap flow.
#>
param(
    [ValidateSet('Go', 'Apk')][string]$AppMode = 'Go',
    [ValidatePattern('^[A-Za-z0-9_.:-]+$')][string]$Device,
    [string]$AppId,
    [string]$ExpoUrl,
    [string]$FakeApiUrl,
    [Alias('PairedApiUrl')][string]$ApiUrl,
    [string]$ExpectedServerId,
    [switch]$Isolated,
    [switch]$CheckBackground,
    [string]$MaestroPath
)

$ErrorActionPreference = 'Stop'
foreach ($mobileRequired in @('Device', 'AppId', 'FakeApiUrl', 'ApiUrl', 'ExpectedServerId')) {
    if (-not (Get-Variable -Name $mobileRequired -ValueOnly)) { throw "Specify -$mobileRequired explicitly; no target is inferred." }
}
if (-not $Isolated) { throw 'Start an isolated Fake namespace first, then supply -Isolated.' }
if ($AppId -notmatch '^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$') { throw 'AppId must be the installed Android package.' }
$mobileServerId = [guid]::Empty
if (-not [guid]::TryParse($ExpectedServerId, [ref]$mobileServerId) -or $mobileServerId -eq [guid]::Empty) { throw 'ExpectedServerId must be the isolated namespace UUID.' }

function MobileBaseUri([string]$Value) {
    $mobileParsed = $null
    if (-not [uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$mobileParsed) -or $mobileParsed.Scheme -ne 'http' -or
        $mobileParsed.UserInfo -or $mobileParsed.Query -or $mobileParsed.Fragment -or $mobileParsed.AbsolutePath -ne '/' -or $mobileParsed.Port -eq 8188) {
        throw 'API URLs must be explicit HTTP base addresses, without credentials, query, path or Runtime8188.'
    }
    return $mobileParsed
}
$mobileFake = MobileBaseUri $FakeApiUrl
$mobileLan = MobileBaseUri $ApiUrl
if ($mobileFake.Host -notin @('127.0.0.1', 'localhost', '[::1]')) { throw 'FakeApiUrl must be the isolated API owner loopback listener.' }
$mobileLanIp = $null
if (-not [Net.IPAddress]::TryParse($mobileLan.Host, [ref]$mobileLanIp) -or $mobileLanIp.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or
    [Net.IPAddress]::IsLoopback($mobileLanIp) -or $mobileLanIp.Equals([Net.IPAddress]::Any)) { throw 'ApiUrl must be the explicitly selected LAN IPv4 address.' }
$mobileLanAddress = $ApiUrl.TrimEnd('/')
$mobileLanPattern = [regex]::Escape($mobileLanAddress)

$mobileMetro = $null
if ($AppMode -eq 'Go') {
    if ($AppId -ne 'host.exp.exponent' -or -not [uri]::TryCreate($ExpoUrl, [UriKind]::Absolute, [ref]$mobileMetro) -or
        $mobileMetro.Scheme -ne 'exp' -or $mobileMetro.Port -lt 1 -or $mobileMetro.UserInfo -or $mobileMetro.Query -or
        $mobileMetro.Fragment -or $mobileMetro.AbsolutePath -ne '/') { throw 'Go requires host.exp.exponent and an explicit root ExpoUrl with its Metro port.' }
    $mobileConnectUrl = $ExpoUrl.TrimEnd('/') + '/--/connect'
    $mobileWorkbenchUrl = $ExpoUrl.TrimEnd('/') + '/--/workbench'
} else {
    if ($AppId -eq 'host.exp.exponent' -or $ExpoUrl) { throw 'Apk requires its own installed AppId and no ExpoUrl.' }
    $mobileConnectUrl = 'unused-for-apk'
    $mobileWorkbenchUrl = 'unused-for-apk'
}

$mobileRepo = Split-Path -Parent $PSScriptRoot
$mobileFlow = Join-Path $mobileRepo 'apps\mobile\.maestro\workflow.yaml'
$mobileRunId = (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$mobileRun = Join-Path $mobileRepo ('.scratch\mobile-workflow\maestro-' + $mobileRunId)
New-Item -ItemType Directory -Path $mobileRun -Force | Out-Null
$mobileReceipt = [ordered]@{ startedAt = [DateTimeOffset]::UtcNow.ToString('o'); status = 'preflight'; appMode = $AppMode; appId = $AppId;
    device = $Device; fakeApiUrl = $mobileFake.AbsoluteUri; apiUrl = $mobileLanAddress; serverId = $mobileServerId.ToString();
    runnerCheckout = (& git -C $mobileRepo rev-parse HEAD); flowSha256 = (Get-FileHash -LiteralPath $mobileFlow -Algorithm SHA256).Hash.ToLowerInvariant();
    runnerSha256 = (Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant();
    projectName = "手机验证 $mobileRunId"; versionName = "雨后 · 手机验证 $mobileRunId"; checkBackground = [bool]$CheckBackground;
    maestroStarted = $false; terminalExit = $false; exitCode = $null; coverage = 'UI journey only; native audio/binary/drag/GPU evidence remain separate' }
$mobileEnvironment = @{}
foreach ($mobileKey in @('JAVA_OPTS', 'MAESTRO_CLI_NO_ANALYTICS', 'MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED')) {
    $mobileEnvironment[$mobileKey] = [Environment]::GetEnvironmentVariable($mobileKey, 'Process')
}
$mobileConsoleEncoding = [Console]::OutputEncoding
$mobileOutputEncoding = $OutputEncoding
$mobileExit = 1
try {
    $mobileHealth = Invoke-RestMethod -Uri ($mobileFake.AbsoluteUri + 'health') -TimeoutSec 10 -MaximumRedirection 0
    if ($mobileHealth.runtime.mode -ne 'fake' -or $mobileHealth.backend.status -ne 'ready' -or $mobileHealth.runtime.ready -ne $true -or
        $mobileHealth.runtime.observation.freshness -ne 'fresh') { throw 'The selected API is not a ready CPU Fake Runtime; no device action was started.' }
    $mobileCapabilities = Invoke-RestMethod -Uri ($mobileFake.AbsoluteUri + 'runtime/capabilities') -TimeoutSec 10 -MaximumRedirection 0
    if ($mobileCapabilities.mode -ne 'fake' -or -not @($mobileCapabilities.capabilities | Where-Object { $_.operation -eq 'Generate' -and $_.ready -eq $true -and $_.observation.freshness -eq 'fresh' }).Count) {
        throw 'The isolated Fake Generate capability is not ready; no device action was started.'
    }
    foreach ($mobileTarget in @($mobileFake, $mobileLan)) {
        $mobileConnection = Invoke-RestMethod -Uri ($mobileTarget.AbsoluteUri + 'connection') -TimeoutSec 10 -MaximumRedirection 0
        if ($mobileConnection.server_id -ne $mobileServerId.ToString() -or $mobileConnection.protocol_version -ne 1) { throw 'The requested API listeners do not match the explicit isolated server identity.' }
        if ($mobileConnection.access_method -ne 'direct' -or $mobileConnection.pairing_available -ne $false) { throw 'The selected API does not advertise direct LAN access.' }
    }
    $mobileSdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
    $mobileAdb = Join-Path $mobileSdk 'platform-tools\adb.exe'
    if (-not (Test-Path -LiteralPath $mobileAdb -PathType Leaf)) { throw 'Android SDK adb.exe was not found. Set ANDROID_HOME to your SDK.' }
    if (-not $MaestroPath) { $MaestroPath = Join-Path $env:USERPROFILE '.maestro\bin\maestro.bat' }
    if (-not (Test-Path -LiteralPath $MaestroPath -PathType Leaf) -or [IO.Path]::GetExtension($MaestroPath).ToLowerInvariant() -notin @('.bat', '.cmd', '.exe')) {
        throw 'Maestro was not found. Supply its Windows CLI .bat/.cmd/.exe launcher.'
    }
    $mobileState = & $mobileAdb -s $Device get-state
    if ($LASTEXITCODE -ne 0 -or $mobileState.Trim() -ne 'device') { throw "Android device $Device is not ready." }
    $mobilePackage = & $mobileAdb -s $Device shell pm path $AppId
    if ($LASTEXITCODE -ne 0 -or -not ($mobilePackage -match '^package:')) { throw 'The selected app package is not installed.' }
    $mobileReceipt.binary = @(& $mobileAdb -s $Device shell dumpsys package $AppId | Select-String 'versionName=|versionCode=') | ForEach-Object { $_.ToString().Trim() }
    if ($LASTEXITCODE -ne 0) { throw 'Could not read the installed app version.' }
    if ($mobileMetro) {
        $mobilePackager = Invoke-WebRequest -UseBasicParsing -Uri "http://$($mobileMetro.Host):$($mobileMetro.Port)/status" -TimeoutSec 10 -MaximumRedirection 0
        $mobilePackagerStatus = if ($mobilePackager.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($mobilePackager.Content) } else { $mobilePackager.Content }
        if ($mobilePackagerStatus -ne 'packager-status:running') { throw 'The target Metro server is not ready.' }
        if ($mobileMetro.Host -in @('127.0.0.1', 'localhost')) {
            & $mobileAdb -s $Device reverse "tcp:$($mobileMetro.Port)" "tcp:$($mobileMetro.Port)"
            if ($LASTEXITCODE -ne 0) { throw 'Could not forward Metro to the selected Android device.' }
        }
    }
    $env:JAVA_OPTS = ($mobileEnvironment.JAVA_OPTS + ' -Dfile.encoding=UTF-8').Trim()
    $env:MAESTRO_CLI_NO_ANALYTICS = '1'
    $env:MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED = 'true'
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding = [Console]::OutputEncoding
    $mobileLogWriter = [IO.StreamWriter]::new((Join-Path $mobileRun 'console.log'), $false, [Text.UTF8Encoding]::new($false))
    try {
        $mobileReceipt.status = 'running'; $mobileReceipt.maestroStarted = $true
        $mobileReceipt | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $mobileRun 'receipt.json') -Encoding UTF8
        $ErrorActionPreference = 'Continue'
        & $MaestroPath --device $Device test $mobileFlow --env "APP_ID=$AppId" --env "APP_MODE=$AppMode" --env "CONNECT_URL=$mobileConnectUrl" `
            --env "WORKBENCH_URL=$mobileWorkbenchUrl" `
            --env "API_URL=$mobileLanAddress" --env "API_PATTERN=$mobileLanPattern" --env "PROJECT_NAME=$($mobileReceipt.projectName)" --env "VERSION_NAME=$($mobileReceipt.versionName)" `
            --env "CHECK_BACKGROUND=$($CheckBackground.IsPresent.ToString().ToLowerInvariant())" --test-output-dir $mobileRun --format JUNIT `
            --output (Join-Path $mobileRun 'junit.xml') --no-ansi 2>&1 | ForEach-Object {
                $mobileLogWriter.WriteLine($_.ToString()); Write-Host ($_.ToString())
            }
        $mobileExit = $LASTEXITCODE
    } finally { $mobileLogWriter.Dispose(); $ErrorActionPreference = 'Stop' }
    $mobileReceipt.terminalExit = $true; $mobileReceipt.exitCode = $mobileExit
    if ($mobileExit -ne 0) { throw "Maestro ended with exit $mobileExit; inspect retained artifacts." }
    [xml]$mobileJunit = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $mobileRun 'junit.xml')
    if (-not $mobileJunit.SelectNodes('//*[local-name()="testcase" and not(*[local-name()="skipped"])]').Count -or $mobileJunit.SelectNodes('//*[local-name()="failure" or local-name()="error"]').Count) { throw 'JUnit did not record a passing executed test.' }
    $mobileReceipt.status = 'passed'
} catch {
    $mobileReceipt.status = 'failed'; $mobileReceipt.error = $_.Exception.Message; $mobileExit = 1
    Write-Error -Message $_.Exception.Message -ErrorAction Continue
} finally {
    $ErrorActionPreference = 'Stop'
    foreach ($mobileKey in $mobileEnvironment.Keys) { [Environment]::SetEnvironmentVariable($mobileKey, $mobileEnvironment[$mobileKey], 'Process') }
    [Console]::OutputEncoding = $mobileConsoleEncoding; $OutputEncoding = $mobileOutputEncoding
    if ($mobileReceipt.status -eq 'running' -and -not $mobileReceipt.terminalExit) { $mobileReceipt.status = 'interrupted' }
    $mobileReceipt.endedAt = [DateTimeOffset]::UtcNow.ToString('o')
    $mobileReceipt | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $mobileRun 'receipt.json') -Encoding UTF8
    Write-Host "Workflow artifacts: $mobileRun"
}
exit $mobileExit
