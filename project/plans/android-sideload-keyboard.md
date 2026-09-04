---
plan_id: P-2026-09-04-android-sideload-keyboard
created_by: codex
created_at: 2026-09-04T05:30Z
target_executor: self
project: PulseTalq
baseline_sha: 08f60c246277b1096bb194face7412bdf7e47ca7
baseline_tag: android-sideload-scope-2026-09-04
scope_brief: project/scope-briefs/android-sideload-keyboard.md
goal_contract_version: 2
dispatcher_hint: frontier
estimated_tasks: 13
opus_session_turns: 0
delivery_waived: false
roadmap_item: none
affected_verification: android/gradlew.bat testDebugUnitTest assembleDebug
---

## Locked decisions

- D-android-first: The first mobile test is Android only and must install as a system keyboard with local voice insertion. (`project/scope-briefs/android-sideload-keyboard.md`)
- D-test-platform: Compile and target Android API 36. Test on Android 16 with Galaxy S20-class-or-better arm64 hardware and at least 8 GB RAM. (`project/scope-briefs/android-sideload-keyboard.md`)
- D-first-asr: Use sherpa-onnx 1.13.7 and Parakeet TDT 0.6B v2 INT8 behind a small recognizer interface. Do not add an NDK or Rust bridge to this APK. (`project/scope-briefs/android-sideload-keyboard.md`)
- D-process-isolation: Run microphone capture and model inference in `:voice`, separate from the IME process. (`project/scope-briefs/android-sideload-keyboard.md`)
- D-license-boundary: Do not copy GPL keyboard code. The keyboard layout is original and the shipped notices cover Apache-2.0 and CC-BY-4.0 dependencies. (`project/scope-briefs/android-sideload-keyboard.md`)

## Research summary

- **Android project:** absent. No Gradle, Kotlin, manifest, or Android module exists in the repository.
- **Build host:** confirmed. JDK 21, SDK platform 36, build tools 36.0.0, and ADB are installed. Gradle, NDK, `cargo-ndk`, and Android Rust targets are absent.
- **Existing transcription seam:** confirmed at `frontend/src-tauri/src/audio/transcription/provider.rs:35`. The desktop trait already separates callers from provider behavior.
- **Reusable state behavior:** confirmed at `frontend/src-tauri/src/dictation/session.rs:6`. The desktop lifecycle covers listening, transcribing, delivering, completed, failed, and cancelled states.
- **Existing Parakeet code:** partial at `frontend/src-tauri/src/parakeet_engine/model.rs:1`. The decoder is portable Rust, but it configures CPU ONNX Runtime directly and is part of the Tauri crate.
- **Android ASR runtime:** confirmed from the k2-fsa 1.13.7 release and Kotlin API. The prebuilt AAR exposes `OfflineRecognizer`; Parakeet uses encoder, decoder, joiner, tokens, and `modelType = "nemo_transducer"`.
- **Model package:** confirmed. `csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8` is English-only and CC-BY-4.0. The four required files total about 661 MB and are available as direct Hugging Face downloads.
- **IME requirements:** confirmed in Android's IME documentation. The app must declare an `InputMethodService`, require `BIND_INPUT_METHOD`, publish `android.view.im` metadata, and commit text through `InputConnection`.
- **Android 16 microphone rule:** confirmed in Android's foreground-service documentation. The service declares the microphone foreground-service type and permissions; the current IME is an allowed foreground-service start case.
- **Baseline:** partial. The Android toolchain check passes, but the unrelated desktop workspace `cargo build` fails because `llama-cpp-sys-2` cannot locate `libclang.dll`. This plan does not build the desktop package.
- **Architecture comparison:** Rust plus UniFFI maximizes code reuse but adds NDK, Android targets, JNI packaging, and mobile ONNX linking before the first proof. Direct ONNX Runtime from Kotlin avoids Rust but duplicates the TDT decoder. sherpa-onnx hides decoder and native runtime details behind one Kotlin recognizer interface and has a shipping Parakeet Android path, so it is selected.

## File targets

| path | role | touch_type | owner_task |
|---|---|---|---|
| `android/gradlew` | Gradle wrapper launcher | create | T1 |
| `android/gradlew.bat` | Windows Gradle wrapper launcher | create | T1 |
| `android/gradle/wrapper/gradle-wrapper.jar` | Gradle wrapper runtime | create | T1 |
| `android/gradle/wrapper/gradle-wrapper.properties` | Gradle wrapper pin | create | T1 |
| `android/settings.gradle.kts` | Android repositories and module registration | create | T2 |
| `android/build.gradle.kts` | Android and Kotlin plugin pins | create | T2 |
| `android/gradle.properties` | Android build defaults | create | T2 |
| `android/app/build.gradle.kts` | Application build and dependency pins | create | T2 |
| `android/app/proguard-rules.pro` | Shrinker rules placeholder | create | T2 |
| `android/app/src/main/AndroidManifest.xml` | App, IME, and voice-process declarations | create | T3 |
| `android/app/src/main/res/xml/method.xml` | IME metadata | create | T3 |
| `android/app/src/main/res/values/strings.xml` | App strings | create | T3 |
| `android/app/src/main/res/values/themes.xml` | Setup activity theme | create | T3 |
| `android/app/src/main/res/drawable/ic_pulsetalq.xml` | Test-build icon | create | T3 |
| `android/app/src/main/java/com/pulsetalq/android/dictation/DictationState.kt` | Public dictation state | create | T4 |
| `android/app/src/main/java/com/pulsetalq/android/dictation/VoiceCommand.kt` | Voice-process request types | create | T4 |
| `android/app/src/main/java/com/pulsetalq/android/dictation/VoiceResult.kt` | Voice-process result types | create | T4 |
| `android/app/src/main/java/com/pulsetalq/android/dictation/DictationReducer.kt` | State transition logic | create | T4 |
| `android/app/src/test/java/com/pulsetalq/android/dictation/DictationReducerTest.kt` | State behavior tests | create | T4 |
| `android/app/src/main/java/com/pulsetalq/android/model/ParakeetModelManifest.kt` | Model file sizes, hashes, and URLs | create | T5 |
| `android/app/src/main/java/com/pulsetalq/android/model/ModelRepository.kt` | Download, validation, and model status | create | T5 |
| `android/app/src/test/java/com/pulsetalq/android/model/ModelRepositoryTest.kt` | Model validation tests | create | T5 |
| `android/app/src/main/res/raw/third_party_notices.txt` | Dependency and model attribution | create | T5 |
| `android/app/src/main/java/com/pulsetalq/android/asr/VoiceRecognizer.kt` | Recognizer interface | create | T6 |
| `android/app/src/main/java/com/pulsetalq/android/asr/SherpaConfig.kt` | Parakeet sherpa configuration | create | T6 |
| `android/app/src/main/java/com/pulsetalq/android/asr/SherpaVoiceRecognizer.kt` | sherpa-onnx adapter | create | T6 |
| `android/app/src/test/java/com/pulsetalq/android/asr/SherpaConfigTest.kt` | Configuration tests | create | T6 |
| `android/app/src/main/java/com/pulsetalq/android/setup/MainActivity.kt` | Setup activity entry point | create | T7 |
| `android/app/src/main/java/com/pulsetalq/android/setup/SetupScreen.kt` | Compose setup flow | create | T7 |
| `android/app/src/main/java/com/pulsetalq/android/setup/SetupViewModel.kt` | Setup state and actions | create | T7 |
| `android/app/src/test/java/com/pulsetalq/android/setup/SetupViewModelTest.kt` | Setup state tests | create | T7 |
| `android/app/src/main/java/com/pulsetalq/android/ime/PulseTalqImeService.kt` | Input method lifecycle | create | T8 |
| `android/app/src/main/java/com/pulsetalq/android/ime/PulseKeyboardView.kt` | Original keyboard UI | create | T8 |
| `android/app/src/main/java/com/pulsetalq/android/ime/KeyboardLayout.kt` | Key definitions | create | T8 |
| `android/app/src/main/java/com/pulsetalq/android/ime/EditorGateway.kt` | InputConnection text operations | create | T8 |
| `android/app/src/test/java/com/pulsetalq/android/ime/EditorGatewayTest.kt` | Editor behavior tests | create | T8 |
| `android/app/src/main/aidl/com/pulsetalq/android/voice/IVoiceRecognitionService.aidl` | Cross-process voice commands | create | T9 |
| `android/app/src/main/aidl/com/pulsetalq/android/voice/ITranscriptionCallback.aidl` | Cross-process results | create | T9 |
| `android/app/src/main/java/com/pulsetalq/android/voice/VoiceRecognitionService.kt` | Foreground ASR process | create | T9 |
| `android/app/src/main/java/com/pulsetalq/android/voice/AudioRecorder.kt` | 16 kHz mono microphone capture | create | T9 |
| `android/app/src/main/java/com/pulsetalq/android/voice/VoiceNotification.kt` | Foreground notification | create | T9 |
| `android/app/src/main/java/com/pulsetalq/android/ime/ImeDictationController.kt` | IME-to-service coordinator | create | T10 |
| `android/app/src/test/java/com/pulsetalq/android/ime/ImeDictationControllerTest.kt` | Dictation and recovery tests | create | T10 |
| `android/app/src/main/java/com/pulsetalq/android/ime/PulseTalqImeService.kt` | Voice binding and insertion | edit | T10 |
| `android/app/src/main/java/com/pulsetalq/android/ime/PulseKeyboardView.kt` | Voice and recovery controls | edit | T10 |
| `android/app/src/main/java/com/pulsetalq/android/dictation/DictationReducer.kt` | Delivery and retry transitions | edit | T10 |
| `android/app/src/main/java/com/pulsetalq/android/setup/MainActivity.kt` | Permission and settings launchers | edit | T11 |
| `android/app/src/main/java/com/pulsetalq/android/setup/SetupScreen.kt` | Model progress and readiness UI | edit | T11 |
| `android/app/src/main/java/com/pulsetalq/android/setup/SetupViewModel.kt` | Repository integration | edit | T11 |
| `android/app/src/androidTest/java/com/pulsetalq/android/setup/SetupFlowTest.kt` | Setup instrumentation smoke | create | T11 |
| `scripts/android/build-debug.ps1` | Reproducible debug build and checksum | create | T12 |
| `scripts/android/install-debug.ps1` | ADB install helper | create | T12 |
| `docs/android-sideload-test.md` | Tester instructions | create | T12 |
| `docs/verification/android-build-report.md` | Build receipt | create | T12 |
| `scripts/android/device-smoke.ps1` | Android 16 ADB smoke procedure | create | T13 |
| `docs/verification/android-device-smoke.md` | Physical test measurements and results | create | T13 |

## Task DAG

### T1: Add the pinned Gradle wrapper
- blocked_by: []
- blocks: [T2]
- dag_level: 1
- files_touched: [android/gradlew, android/gradlew.bat, android/gradle/wrapper/gradle-wrapper.jar, android/gradle/wrapper/gradle-wrapper.properties]
- acceptance:
  - Generate the wrapper from the official Gradle 8.13 distribution.
  - Pin `distributionSha256Sum` to Gradle's published checksum.
  - `android/gradlew.bat --version` reports Gradle 8.13 under JDK 21.
- dispatch_model: sonnet
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: [network:gradle-distribution]
- shard_writes: []

### T2: Configure the Android application build
- blocked_by: [T1]
- blocks: [T3, T4, T5]
- dag_level: 2
- files_touched: [android/settings.gradle.kts, android/build.gradle.kts, android/gradle.properties, android/app/build.gradle.kts, android/app/proguard-rules.pro]
- acceptance:
  - Configure namespace and application ID `com.pulsetalq.android`.
  - Set `compileSdk` and `targetSdk` to 36 and `minSdk` to 29.
  - Pin AGP 8.13.2, compatible Kotlin and Compose plugins, and sherpa-onnx 1.13.7.
  - Restrict native packaging to `arm64-v8a` for the first APK.
  - Witness a failing then passing Gradle project-configuration check.
- dispatch_model: sonnet
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: [android-gradle-cache]
- shard_writes: []

### T3: Declare the app, IME, and voice process
- blocked_by: [T2]
- blocks: [T7, T8, T9]
- dag_level: 3
- files_touched: [android/app/src/main/AndroidManifest.xml, android/app/src/main/res/xml/method.xml, android/app/src/main/res/values/strings.xml, android/app/src/main/res/values/themes.xml, android/app/src/main/res/drawable/ic_pulsetalq.xml]
- acceptance:
  - Declare `MainActivity`, `PulseTalqImeService`, and `VoiceRecognitionService` in the manifest.
  - Protect the IME with `android.permission.BIND_INPUT_METHOD` and publish `android.view.im` metadata.
  - Put the voice service in `:voice` with microphone foreground-service type.
  - Request microphone, foreground-service microphone, notification, and network permissions required by the scoped flow.
  - `processDebugMainManifest` succeeds and its merged manifest contains the three components.
- dispatch_model: sonnet
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: []
- shard_writes: []

### T4: Define tested dictation state transitions
- blocked_by: [T2]
- blocks: [T8, T9, T10]
- dag_level: 3
- files_touched: [android/app/src/main/java/com/pulsetalq/android/dictation/DictationState.kt, android/app/src/main/java/com/pulsetalq/android/dictation/VoiceCommand.kt, android/app/src/main/java/com/pulsetalq/android/dictation/VoiceResult.kt, android/app/src/main/java/com/pulsetalq/android/dictation/DictationReducer.kt, android/app/src/test/java/com/pulsetalq/android/dictation/DictationReducerTest.kt]
- acceptance:
  - Specify idle, listening, transcribing, delivering, recoverable failure, completed, and cancelled states.
  - Reject invalid transitions without destroying a retained transcript.
  - Record cancelled sessions as insertion-free and delivery failures as retryable with text.
  - Witness `DictationReducerTest` red before implementation and green afterward using the same command.
- dispatch_model: sonnet
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: []
- shard_writes: []

### T5: Add verified Parakeet model installation
- blocked_by: [T2]
- blocks: [T6, T7]
- dag_level: 3
- files_touched: [android/app/src/main/java/com/pulsetalq/android/model/ParakeetModelManifest.kt, android/app/src/main/java/com/pulsetalq/android/model/ModelRepository.kt, android/app/src/test/java/com/pulsetalq/android/model/ModelRepositoryTest.kt, android/app/src/main/res/raw/third_party_notices.txt]
- acceptance:
  - Pin the four v2 INT8 file URLs, byte sizes, and SHA-256 values.
  - Download to temporary files, report progress, enforce free-space checks, verify hashes, and rename atomically.
  - Preserve valid completed files and retry only absent or invalid files.
  - Include Apache-2.0 sherpa-onnx and CC-BY-4.0 Parakeet attribution.
  - Witness repository validation tests red then green with fake local files and a fake downloader.
- dispatch_model: sonnet
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: []
- shard_writes: []

### T6: Adapt sherpa-onnx behind the recognizer interface
- blocked_by: [T5]
- blocks: [T9]
- dag_level: 4
- files_touched: [android/app/src/main/java/com/pulsetalq/android/asr/VoiceRecognizer.kt, android/app/src/main/java/com/pulsetalq/android/asr/SherpaConfig.kt, android/app/src/main/java/com/pulsetalq/android/asr/SherpaVoiceRecognizer.kt, android/app/src/test/java/com/pulsetalq/android/asr/SherpaConfigTest.kt]
- acceptance:
  - Expose `load`, `transcribe`, `isLoaded`, and `close` without leaking sherpa types to callers.
  - Configure the four verified model paths with `modelType = "nemo_transducer"` and CPU provider.
  - Return typed model-missing, load, transcription, and closed errors.
  - Keep recognizer construction inside the `:voice` process.
  - Witness configuration tests red then green using the same unit-test command.
- dispatch_model: sonnet
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: []
- shard_writes: []

### T7: Build the setup activity shell
- blocked_by: [T3, T5]
- blocks: [T11]
- dag_level: 4
- files_touched: [android/app/src/main/java/com/pulsetalq/android/setup/MainActivity.kt, android/app/src/main/java/com/pulsetalq/android/setup/SetupScreen.kt, android/app/src/main/java/com/pulsetalq/android/setup/SetupViewModel.kt, android/app/src/test/java/com/pulsetalq/android/setup/SetupViewModelTest.kt]
- acceptance:
  - Show microphone permission, model, keyboard enablement, and keyboard selection as separate readiness rows.
  - Expose actions for permission, model install, input-method settings, and input-method picker.
  - Keep progress and recoverable errors visible after configuration changes.
  - Witness setup state tests red before implementation and green afterward.
- dispatch_model: sonnet
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: []
- shard_writes: []

### T8: Implement the minimal tap keyboard
- blocked_by: [T3, T4]
- blocks: [T10]
- dag_level: 4
- files_touched: [android/app/src/main/java/com/pulsetalq/android/ime/PulseTalqImeService.kt, android/app/src/main/java/com/pulsetalq/android/ime/PulseKeyboardView.kt, android/app/src/main/java/com/pulsetalq/android/ime/KeyboardLayout.kt, android/app/src/main/java/com/pulsetalq/android/ime/EditorGateway.kt, android/app/src/test/java/com/pulsetalq/android/ime/EditorGatewayTest.kt]
- acceptance:
  - Render an original QWERTY layout with shift, symbols, space, backspace, and enter.
  - Commit ordinary text through `InputConnection` and handle delete and editor actions without deprecated `KeyboardView`.
  - Keep the keyboard usable when no voice service is connected.
  - Witness editor behavior tests red then green through the editor interface.
- dispatch_model: sonnet
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: []
- shard_writes: []

### T9: Implement the isolated microphone and ASR service
- blocked_by: [T3, T4, T6]
- blocks: [T10, T11]
- dag_level: 5
- files_touched: [android/app/src/main/aidl/com/pulsetalq/android/voice/IVoiceRecognitionService.aidl, android/app/src/main/aidl/com/pulsetalq/android/voice/ITranscriptionCallback.aidl, android/app/src/main/java/com/pulsetalq/android/voice/VoiceRecognitionService.kt, android/app/src/main/java/com/pulsetalq/android/voice/AudioRecorder.kt, android/app/src/main/java/com/pulsetalq/android/voice/VoiceNotification.kt]
- acceptance:
  - Bind across processes and expose start, stop, cancel, status, and callback operations.
  - Capture 16 kHz mono PCM after foreground-service promotion and stop cleanly on cancel.
  - Load and run the recognizer only in `:voice`, one request at a time.
  - Return elapsed recording time, transcription duration, audio duration, and peak process memory with the result.
  - Release recorder and recognizer resources after errors and service destruction.
- dispatch_model: sonnet
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: [android-microphone]
- shard_writes: []

### T10: Wire voice dictation and transcript recovery into the IME
- blocked_by: [T8, T9]
- blocks: [T12]
- dag_level: 6
- files_touched: [android/app/src/main/java/com/pulsetalq/android/ime/ImeDictationController.kt, android/app/src/test/java/com/pulsetalq/android/ime/ImeDictationControllerTest.kt, android/app/src/main/java/com/pulsetalq/android/ime/PulseTalqImeService.kt, android/app/src/main/java/com/pulsetalq/android/ime/PulseKeyboardView.kt, android/app/src/main/java/com/pulsetalq/android/dictation/DictationReducer.kt]
- acceptance:
  - Bind while the IME is visible and survive binder death without crashing the keyboard.
  - Start, stop, and cancel dictation from the voice control with visible state changes.
  - Commit final text at the current cursor only after a successful result.
  - Retain failed delivery text and expose retry and copy controls.
  - Witness controller tests red then green with a fake external voice binder and fake editor.
- dispatch_model: sonnet
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: []
- shard_writes: []

### T11: Connect setup actions and add setup instrumentation
- blocked_by: [T7, T9]
- blocks: [T12]
- dag_level: 6
- files_touched: [android/app/src/main/java/com/pulsetalq/android/setup/MainActivity.kt, android/app/src/main/java/com/pulsetalq/android/setup/SetupScreen.kt, android/app/src/main/java/com/pulsetalq/android/setup/SetupViewModel.kt, android/app/src/androidTest/java/com/pulsetalq/android/setup/SetupFlowTest.kt]
- acceptance:
  - Connect the setup activity to the real model repository and Android input-method actions.
  - Refresh readiness after returning from permission or settings screens.
  - Display model progress, checksum failure, insufficient space, and ready states.
  - Compile an instrumentation test that exercises the setup screen without downloading the model.
  - `assembleDebugAndroidTest` succeeds.
- dispatch_model: sonnet
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: []
- shard_writes: []

### T12: Build and document the sideload package
- blocked_by: [T10, T11]
- blocks: [T13]
- dag_level: 7
- files_touched: [scripts/android/build-debug.ps1, scripts/android/install-debug.ps1, docs/android-sideload-test.md, docs/verification/android-build-report.md]
- acceptance:
  - `testDebugUnitTest`, `assembleDebug`, and `assembleDebugAndroidTest` pass from a clean Android build.
  - Produce `android/app/build/outputs/apk/debug/app-debug.apk` and record its SHA-256 and byte size.
  - Confirm the APK contains only arm64 native libraries and no model files.
  - Document model-download size, install steps, keyboard enablement, diagnostics, and uninstall.
  - Record exact command exits and known unrun physical checks in the build report.
- dispatch_model: sonnet
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: [android-gradle-cache]
- shard_writes: []

### T13: Verify the APK on Android 16 hardware
- blocked_by: [T12]
- blocks: []
- dag_level: 8
- files_touched: [scripts/android/device-smoke.ps1, docs/verification/android-device-smoke.md]
- acceptance:
  - Install the APK through ADB on the declared Android 16 Samsung handset without root.
  - Enable and select PulseTalq, then enter tap text in a messaging app and notes app.
  - Download and verify the model, dictate into both apps, and repeat dictation in airplane mode.
  - Verify cancel inserts nothing, failed insertion preserves text, and killing `:voice` does not crash the IME.
  - Record model load time, transcription latency, real-time factor, peak memory, device model, OS build, APK hash, and pass or fail for every check.
- dispatch_model: sonnet
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: [adb-device:android16-samsung]
- shard_writes: []

## Dispatch plan

- width: 3
- levels: {T1} {T2} {T3,T4,T5} {T6,T7,T8} {T9} {T10,T11} {T12} {T13}
- max_width: 3
- critical_path: 8
- exclusive_resources_in_play: [network:gradle-distribution, android-gradle-cache, android-microphone, adb-device:android16-samsung]
- barriers:
  - before T12, the build and verification pass must see the complete app tree
  - before T13, the physical device test must use the exact checksummed APK from T12
- coordinator_inline_exemption: T1 through T13 will execute in DAG order in this session because the active runtime exposes no subagent dispatch API. Independent tasks retain separate commits and verification receipts.

## Goal DoD

- G1: `assembleDebug` produces one installable APK and the handoff records its SHA-256. - satisfied_by: [T1, T2, T3, T12]
- G2: The APK installs on the Android 16 test handset without root access. - satisfied_by: [T13]
- G3: The setup activity guides the tester through microphone permission, model installation, keyboard enablement, and keyboard selection. - satisfied_by: [T7, T11, T13]
- G4: PulseTalq appears in Android's keyboard picker and basic tap typing works in another app. - satisfied_by: [T8, T13]
- G5: The tester records speech from the keyboard and the final local transcript appears at the current cursor in at least a messaging app and a notes app. - satisfied_by: [T6, T9, T10, T13]
- G6: Dictation still works in airplane mode after model installation. - satisfied_by: [T13]
- G7: Cancelled dictation inserts nothing, and a failed insertion retains the transcript for retry or copy. - satisfied_by: [T4, T10, T13]
- G8: Killing the ASR process does not crash the keyboard. The next voice attempt either reloads the model or shows a recoverable error. - satisfied_by: [T9, T10, T13]
- G9: The test report records model load time, transcription latency, real-time factor, and peak memory on the handset. - satisfied_by: [T9, T13]
- G10: No GPL-derived source is present, and bundled notices cover the ASR model and native dependencies. - satisfied_by: [T5, T6, T12]

## Delivery contract

- schema: product-ops.delivery-policy/v1
- delivery_locator: project/state/deliveries/P-2026-09-04-android-sideload-keyboard.json
- provider: github
- base_branch: integration/pulsetalq-next
- pr_evidence: required (`pr-evidence/v1`)
- human_confirmation: standing authority covers scoped commits, clean base synchronization, ordinary task-branch push, draft PR creation or update, and the terminal locator write; ready-for-review, approval, merge, deployment, force operations, history rewriting, conflict resolution, verification bypass, and worktree cleanup require their own authority
- merge_method: merge
- atomic_head_guard: required
- terminal_authority: provider `MERGED` plus merge OID
- worktree_cleanup: separate authorization
- execution_archive_dependency: none

## Gap classification

- **medium** · G-2026-09-04-android16-device-unavailable · No Android device is currently attached to ADB. T13 waits for the declared handset after T12 produces the APK.
- **medium** · G-2026-09-04-android-roadmap-unlinked · The repository has no roadmap shard or Android roadmap item, so this plan declares `roadmap_item: none`.
- **medium** · G-2026-09-04-desktop-libclang-baseline · The unrelated desktop workspace baseline fails because `libclang.dll` is not configured. Android verification uses its own Gradle build.

## Close-of-execution contract

```
**Plan-handoff close: P-2026-09-04-android-sideload-keyboard, 13 tasks closed**

## Summary
Built and physically verified the first PulseTalq Android voice-keyboard APK.

## Findings
- **severity** · finding · evidence pointer

## Actions
- **Applied:** closed task IDs, commits, Android checks, APK hash, and device checks
- **Proposed:** any remaining delivery or product follow-up

## Surfaced gaps
- **severity** · gap ID · summary

## Handoff fields
- tasks_closed: [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13]
- tasks_blocked: []
- escalated_to_opus: []
- goal_dod: project/state/goals/P-2026-09-04-android-sideload-keyboard.json
- execution_state: execution_complete
- delivery_locator: project/state/deliveries/P-2026-09-04-android-sideload-keyboard.json
- delivery_state: execution_complete
- archive_path: project/plans/archive/android-sideload-keyboard.md
```

**Created:** 2026-09-04 . **Last opened:** 2026-09-04 . **Last edited:** 2026-09-04 . **Status:** active . **Owner:** Q. Blaauw
