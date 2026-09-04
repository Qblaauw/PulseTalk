# PulseTalq Android build report

Date: 2026-09-04

## Debug artifact

- Source commit: `2a95d3209a993ba0dfc9ed87b1921cdd4ae5a81d`
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Package: `com.pulsetalq.android.debug`
- Version: `0.1.0-dev-debug` (`versionCode` 1)
- Byte size: 59,083,306
- SHA-256: `a600b8099bbcfc58c3809fd6803594221497abe5a5a4852bdffa5e31cde5d8f7`
- Compile and target SDK: 36 / Android 16
- Minimum SDK: 29
- Native ABI: `arm64-v8a` only
- Signature: Android debug certificate, APK Signature Scheme v2 verified
- Bundled model files: none

The sherpa-onnx 1.13.7 AAR resolved by Gradle has SHA-256 `c4ef49e309f24fcee5c106b8a279481aaecaabb078cd37b2cd6e9a62cc8a73c8`.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Clean package gate | Pass | `scripts/android/build-debug.ps1` completed 86 Gradle actions from source commit `2a95d32` |
| Unit tests | Pass | 18 tests, 0 failures, 0 errors |
| Android lint | Pass | `lintDebug` completed with no blocking findings |
| Debug app APK | Pass | `assembleDebug` produced the checksummed artifact above |
| Instrumentation APK | Pass | `assembleDebugAndroidTest` completed |
| APK ABI inspection | Pass | Only `lib/arm64-v8a/*.so` entries are present |
| Model exclusion | Pass | No encoder, decoder, joiner, or token model file is packaged |
| APK signature | Pass | `apksigner verify --verbose` reports one valid v2 signer |
| API 36 emulator setup test | Pass | One Compose instrumentation test ran on `Pulse_Code_API_36(AVD) - 16` |
| Emulator IME registration | Pass | ADB enabled and selected `PulseTalqImeService` |
| Emulator cross-app tap typing | Pass | Custom canvas-key taps inserted `hello` into Google Messages |

The emulator-only run used the opt-in `-PpulsetalqEmulatorAbi=true` build to add x86_64 native libraries. The deliverable APK was rebuilt afterward without that property and remains arm64-only. Screenshots are in `docs/verification/android-setup-emulator.png` and `docs/verification/android-keyboard-emulator.png`.

## Still requires Android 16 Samsung hardware

No physical Android device was attached to ADB during this build. The following checks remain open and must use this exact APK hash:

- sideload on a supported Galaxy S20-class-or-better arm64 handset running Android 16;
- microphone capture and local Parakeet model loading;
- speech insertion in a messaging app and a notes app;
- airplane-mode dictation after model installation;
- cancel, rejected-insertion retention, retry, copy, and `:voice` process-kill recovery;
- model load time, transcription latency, real-time factor, and peak process memory.

## Non-blocking host notes

- Android SDK tooling prints an SDK XML-version warning because the installed command-line tools are older than the platform metadata. Compilation, lint, packaging, and tests still pass.
- Debug native libraries are packaged without symbol stripping. This is acceptable for the internal debug artifact.
- The unrelated desktop Cargo workspace still requires a configured `libclang.dll` for `llama-cpp-sys-2`; the Android build is isolated from it.
