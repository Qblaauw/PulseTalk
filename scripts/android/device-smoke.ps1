[CmdletBinding()]
param(
    [ValidateSet("install", "status", "kill-voice", "metrics")]
    [string]$Action = "install",
    [string]$Apk = "",
    [string]$ExpectedSha256 = "a600b8099bbcfc58c3809fd6803594221497abe5a5a4852bdffa5e31cde5d8f7",
    [string]$AndroidSdk = "",
    [switch]$PermitEmulatorPreflight
)

$ErrorActionPreference = "Stop"
$packageName = "com.pulsetalq.android.debug"
$imeComponent = "$packageName/com.pulsetalq.android.ime.PulseTalqImeService"
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

$devices = @(& $adb devices -l | Select-Object -Skip 1 | Where-Object { $_ -match '\sdevice\s' })
if ($devices.Count -ne 1) {
    throw "Connect exactly one authorized Android device. Found $($devices.Count)."
}
$serial = (($devices[0] -split '\s+')[0]).Trim()
function Invoke-Adb {
    param(
        [switch]$AllowFailure,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
    )
    $result = & $adb -s $serial @Arguments
    if ($LASTEXITCODE -ne 0 -and -not $AllowFailure) {
        throw "ADB failed: adb -s $serial $($Arguments -join ' ')"
    }
    return $result
}

$sdk = (Invoke-Adb shell getprop ro.build.version.sdk).Trim()
$manufacturer = (Invoke-Adb shell getprop ro.product.manufacturer).Trim()
$model = (Invoke-Adb shell getprop ro.product.model).Trim()
$build = (Invoke-Adb shell getprop ro.build.fingerprint).Trim()
$isEmulator = (Invoke-Adb shell getprop ro.kernel.qemu).Trim() -eq "1"
$memoryKb = ((Invoke-Adb shell cat /proc/meminfo | Select-String '^MemTotal:').ToString() -replace '\D', '')
if ($sdk -ne "36") {
    throw "The connected device runs API $sdk. This smoke test requires Android 16 / API 36."
}
if ($manufacturer -notmatch '(?i)samsung' -and -not ($PermitEmulatorPreflight -and $isEmulator)) {
    throw "The connected device reports manufacturer '$manufacturer'. Use the required Samsung handset."
}
$actualSha = (Get-FileHash -LiteralPath $Apk -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSha -ne $ExpectedSha256.ToLowerInvariant()) {
    throw "APK SHA-256 is $actualSha, expected $ExpectedSha256. Rebuild or pass the reviewed hash explicitly."
}

switch ($Action) {
    "install" {
        Invoke-Adb logcat -c | Out-Null
        Invoke-Adb install -r $Apk
        Invoke-Adb shell am start -n "$packageName/com.pulsetalq.android.setup.MainActivity"
        Write-Output "Installed the reviewed APK and opened PulseTalq setup."
        Write-Output "Complete setup, then run this script with -Action status."
    }
    "status" {
        $registered = @((Invoke-Adb shell ime list -s) | Where-Object { $_ -eq $imeComponent }).Count -eq 1
        $selected = (Invoke-Adb shell settings get secure default_input_method).Trim() -eq $imeComponent
        $voicePid = [string]::Join("`n", @(Invoke-Adb -AllowFailure shell pidof "$packageName`:voice")).Trim()
        [ordered]@{
            serial = $serial
            manufacturer = $manufacturer
            model = $model
            sdk = $sdk
            build = $build
            memoryKb = $memoryKb
            apkSha256 = $actualSha
            acceptanceEligible = $manufacturer -match '(?i)samsung' -and -not $isEmulator
            imeRegistered = $registered
            imeSelected = $selected
            voiceProcessPid = $voicePid
        } | ConvertTo-Json
    }
    "kill-voice" {
        $voicePid = (Invoke-Adb shell pidof "$packageName`:voice").Trim()
        if ([string]::IsNullOrWhiteSpace($voicePid)) {
            throw "The :voice process is not running. Start dictation before this check."
        }
        Invoke-Adb shell run-as $packageName kill -9 $voicePid | Out-Null
        Write-Output "Killed :voice process $voicePid through the debuggable app UID. Confirm the keyboard remains open and the next attempt recovers."
    }
    "metrics" {
        Invoke-Adb logcat -d -s 'PulseTalqMetrics:I' '*:S'
    }
}
