param(
    [string]$Device = 'emulator-5562',
    [string]$ExpoUrl = 'exp://127.0.0.1:18081',
    [string]$MaestroPath
)

$ErrorActionPreference = 'Stop'
$mobileRepo = Split-Path -Parent $PSScriptRoot
$mobileSdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$mobileAdb = Join-Path $mobileSdk 'platform-tools\adb.exe'
if (-not (Test-Path -LiteralPath $mobileAdb)) { throw 'Android SDK adb.exe was not found. Set ANDROID_HOME to your SDK.' }
if (-not $MaestroPath) { $MaestroPath = Join-Path $env:USERPROFILE '.maestro\bin\maestro.bat' }
if (-not (Test-Path -LiteralPath $MaestroPath)) { throw 'Maestro was not found. Install it or supply -MaestroPath.' }

$mobileUri = [uri]$ExpoUrl
if ($mobileUri.Scheme -ne 'exp' -or $mobileUri.Port -lt 1) { throw 'ExpoUrl must be the Expo Go development URL with its port.' }
$mobileHealth = "http://127.0.0.1:$($mobileUri.Port)/status"
$mobileClient = New-Object System.Net.WebClient
try {
    if ($mobileClient.DownloadString($mobileHealth) -ne 'packager-status:running') { throw 'The target Metro server is not ready.' }
} finally {
    $mobileClient.Dispose()
}

$mobileState = & $mobileAdb -s $Device get-state
if ($LASTEXITCODE -ne 0 -or $mobileState.Trim() -ne 'device') { throw "Android device $Device is not ready." }
if ($mobileUri.Host -in @('127.0.0.1', 'localhost')) {
    & $mobileAdb -s $Device reverse "tcp:$($mobileUri.Port)" "tcp:$($mobileUri.Port)"
    if ($LASTEXITCODE -ne 0) { throw 'Could not forward Metro to the selected Android device.' }
}

$mobileRun = Join-Path $mobileRepo ('.scratch\mobile-bootstrap\maestro-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Path $mobileRun -Force | Out-Null
$env:MAESTRO_CLI_NO_ANALYTICS = '1'
$env:MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED = 'true'
& $MaestroPath --device $Device test (Join-Path $mobileRepo 'apps\mobile\.maestro\bootstrap.yaml') `
    --env "EXPO_URL=$ExpoUrl" --test-output-dir $mobileRun --format JUNIT `
    --output (Join-Path $mobileRun 'junit.xml') --no-ansi
exit $LASTEXITCODE
