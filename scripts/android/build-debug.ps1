[CmdletBinding()]
param(
    [string]$AndroidSdk = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$androidRoot = Join-Path $repoRoot "android"

if ([string]::IsNullOrWhiteSpace($AndroidSdk)) {
    $AndroidSdk = $env:ANDROID_SDK_ROOT
}
if ([string]::IsNullOrWhiteSpace($AndroidSdk)) {
    $AndroidSdk = $env:ANDROID_HOME
}
if ([string]::IsNullOrWhiteSpace($AndroidSdk)) {
    $AndroidSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
}
$AndroidSdk = (Resolve-Path -LiteralPath $AndroidSdk).Path
if (-not (Test-Path -LiteralPath (Join-Path $AndroidSdk "platforms\android-36"))) {
    throw "Android SDK platform 36 is not installed under $AndroidSdk"
}
$env:ANDROID_HOME = $AndroidSdk

Push-Location $androidRoot
try {
    & .\gradlew.bat clean testDebugUnitTest lintDebug assembleDebug assembleDebugAndroidTest --no-daemon
    if ($LASTEXITCODE -ne 0) {
        throw "Android debug build failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

$apk = Join-Path $androidRoot "app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path -LiteralPath $apk)) {
    throw "Expected APK was not produced: $apk"
}
$entries = & jar tf $apk
if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect APK contents with jar"
}
$abis = @(
    $entries |
        Where-Object { $_ -match '^lib/[^/]+/.+\.so$' } |
        ForEach-Object { ($_ -split '/')[1] } |
        Sort-Object -Unique
)
if (($abis.Count -ne 1) -or ($abis[0] -ne "arm64-v8a")) {
    throw "APK ABI check failed. Found: $($abis -join ', ')"
}
$bundledModels = @($entries | Where-Object { $_ -match '(encoder|decoder|joiner)\.int8\.onnx|tokens\.txt' })
if ($bundledModels.Count -ne 0) {
    throw "Model files must not be bundled in the APK: $($bundledModels -join ', ')"
}

$artifact = Get-Item -LiteralPath $apk
$hash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
$commit = (git -C $repoRoot rev-parse HEAD).Trim()
[ordered]@{
    apk = $artifact.FullName
    bytes = $artifact.Length
    sha256 = $hash
    abis = $abis
    modelFilesBundled = $false
    sourceCommit = $commit
} | ConvertTo-Json
