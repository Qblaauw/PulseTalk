# PulseTalq Android sideload test

This debug build is an English, local-first voice keyboard for an arm64 Samsung phone running Android 16. Use a Galaxy S20-class-or-better device with at least 8 GB RAM. The original Galaxy S20 does not officially receive Android 16, so use a newer supported Galaxy or a deliberately managed Android 16 test image.

## Build

From the repository root in PowerShell:

```powershell
.\scripts\android\build-debug.ps1
```

The script runs unit tests, builds the app and instrumentation APKs, checks that only `arm64-v8a` native libraries are packaged, confirms that no model files are bundled, and prints the app APK SHA-256.

## Install

1. Enable Developer options and USB debugging on the phone.
2. Connect exactly one authorized phone and confirm `adb devices` reports it as `device`.
3. Run:

```powershell
.\scripts\android\install-debug.ps1
```

The package is `com.pulsetalq.android.debug`. The debug signing key is for internal testing only.

## Set up the keyboard

1. In PulseTalq, tap **Allow** and grant microphone access.
2. On Wi-Fi, tap **Download**. The English Parakeet model is 661 MB. Keep at least 1 GB free while it installs. Every file is checked by size and SHA-256 before it becomes active.
3. Tap **Open settings**, enable **PulseTalq Voice Keyboard**, and accept Android's standard third-party keyboard warning.
4. Return to PulseTalq, tap **Choose**, and select PulseTalq.

After the model is verified, recognition runs locally. The app still declares network access because setup downloads the model.

## Test in another app

1. Open a notes app and focus an editable text field.
2. Confirm ordinary QWERTY typing, shift, symbols, backspace, space, and enter work.
3. Tap **Tap to dictate**, speak a sentence, then tap **Stop**.
4. Wait for **Transcribing locally**. The final text should appear at the current cursor.
5. Repeat in a messaging app.
6. Enable airplane mode and repeat. Dictation should still work after model installation.
7. During recording, tap **Cancel**. No text should be inserted.
8. If the target app rejects insertion, PulseTalq keeps the transcript and shows **Retry insertion** and **Copy**.

## Diagnostics and removal

Capture logs with `adb logcat` if setup or dictation fails. To remove the debug package and its downloaded model:

```powershell
adb uninstall com.pulsetalq.android.debug
```

Uninstalling removes the private model directory. Reinstalling requires another model download.
