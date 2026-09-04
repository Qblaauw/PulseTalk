[CmdletBinding()]
param(
    [string]$Apk = "",
    [string]$AndroidSdk = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if ([string]::IsNullOrWhiteSpace($Apk)) {
    $Apk = Join-Path $repoRoot "android\app\build\outputs\apk\debug\app-debug.apk"
}
$Apk = (Resolve-Path -LiteralPath $Apk).Path
if ([string]::IsNullOrWhiteSpace($AndroidSdk)) {
    $AndroidSdk = $env:ANDROID_SDK_ROOT
}
if ([string]::IsNullOrWhiteSpace($AndroidSdk)) {
    $AndroidSdk = $env:ANDROID_HOME
}
if ([string]::IsNullOrWhiteSpace($AndroidSdk)) {
    $AndroidSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
}
$adb = Join-Path (Resolve-Path -LiteralPath $AndroidSdk).Path "platform-tools\adb.exe"
if (-not (Test-Path -LiteralPath $adb)) {
    throw "ADB was not found at $adb"
}
$devices = @(& $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\sdevice$' })
if ($devices.Count -ne 1) {
    throw "Connect exactly one authorized Android device. Found $($devices.Count)."
}

& $adb install -r $Apk
if ($LASTEXITCODE -ne 0) {
    throw "ADB install failed with exit code $LASTEXITCODE"
}
& $adb shell am start -n "com.pulsetalq.android.debug/com.pulsetalq.android.setup.MainActivity"
if ($LASTEXITCODE -ne 0) {
    throw "PulseTalq installed, but the setup activity did not open."
}
Write-Output "PulseTalq debug installed and setup opened."
