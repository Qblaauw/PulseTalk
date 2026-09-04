## Scope Brief: Android sideload keyboard

> **Goal:**
> `/goal Build a debug Android APK that installs as the PulseTalq system keyboard on a Galaxy S20-class-or-better device running Android 16 and inserts locally transcribed speech into another app; done when the APK sideloads, keyboard setup succeeds, microphone dictation inserts text, and failure recovery preserves the transcript.`

### 1. Objective

Produce the first installable Android test build. It must prove the complete path from APK installation, through keyboard enablement and microphone capture, to local transcription inserted at the cursor in another app.

### 2. In scope

- A new Kotlin Android application and debug build configuration.
- A companion setup activity for microphone permission, model installation, keyboard enablement, and keyboard selection.
- A minimal `InputMethodService` with ordinary tap typing, backspace, shift, symbols, enter, and a prominent voice control.
- Android `AudioRecord` capture with start, stop, cancel, elapsed-time, transcribing, and failure states.
- Local ASR in a separate app process. Use sherpa-onnx 1.13.7 with Parakeet TDT 0.6B v2 INT8 and keep a narrow recognizer interface so a smaller model can replace it if the device benchmark fails.
- IPC between the keyboard and ASR process.
- Cursor-safe insertion through `InputConnection`.
- Recovery that retains completed text when insertion fails and offers copy and retry actions.
- A reproducible debug APK and sideload instructions for an Android 16 test handset.
- Measurements for model load time, first transcription latency, real-time factor, and peak memory on the test handset.

### 3. Out of scope

- Play Store submission, production signing, staged rollout, or automatic updates.
- Autocorrect, next-word prediction, swipe typing, imported dictionaries, or AOSP LatinIME integration.
- Dictation history, correction learning, personal words, cloud sync, desktop sync, meeting features, or an iOS target.
- Product analytics, accounts, remote transcription, and cloud cleanup.
- Full visual parity with the dynamic mockup. The test build implements only the states needed for the end-to-end proof.

### 4. Deliverables

| Artifact | Format or location | Notes |
|---|---|---|
| Android project | `android/` | Gradle Kotlin DSL, Kotlin, Compose setup activity, and one debug application module |
| Keyboard service | `android/app/src/main/` | Minimal IME declaration, layout, lifecycle, and `InputConnection` delivery |
| Voice service | Android service plus native library boundary | Separate process, model lifecycle, transcription request, result, cancellation, and error contract |
| Local ASR adapter | Kotlin interface backed by the sherpa-onnx Android AAR | No Tauri, Rust, NDK, desktop path, `cpal`, or Windows delivery dependencies in the first APK |
| Model installer | Companion setup activity | Download or import with progress, free-space check, checksum, attribution, and retry |
| Automated checks | Android unit, instrumentation, and Rust tests | Cover state transitions, IPC payloads, and insertion recovery where practical |
| Test package | Debug APK under the Android build output | Exact path and SHA-256 recorded in the task handoff |
| Test guide | `docs/android-sideload-test.md` | Install, enable, select, dictate, collect diagnostics, and uninstall |

### 5. Constraints

- First test OS is Android 16.
- Hardware floor is Galaxy S20-class arm64 hardware with 8 GB RAM or more. The actual Android 16 handset must be a newer officially supported Galaxy or a deliberately supported custom-ROM device.
- Speech recognition runs locally after model installation.
- The model lives outside the IME process. The keyboard must remain usable if Android kills or restarts the ASR process.
- The first build is English-only unless the selected Parakeet package adds other languages without extra keyboard work.
- Do not copy GPL keyboard code. Permissive reference code and separately licensed model assets require attribution and a dependency notice.
- Pin sherpa-onnx to 1.13.7 and verify the downloaded AAR digest. Pin each Parakeet model file by byte size and SHA-256.
- The inherited desktop workspace currently fails `cargo build` because `llama-cpp-sys-2` cannot find `libclang.dll`. Android planning must either configure that prerequisite or isolate Android builds from the desktop LLM package.

### 6. Success Criteria

- [ ] `assembleDebug` produces one installable APK and the handoff records its SHA-256.
- [ ] The APK installs on the Android 16 test handset without root access.
- [ ] The setup activity guides the tester through microphone permission, model installation, keyboard enablement, and keyboard selection.
- [ ] PulseTalq appears in Android's keyboard picker and basic tap typing works in another app.
- [ ] The tester records speech from the keyboard and the final local transcript appears at the current cursor in at least a messaging app and a notes app.
- [ ] Dictation still works in airplane mode after model installation.
- [ ] Cancelled dictation inserts nothing, and a failed insertion retains the transcript for retry or copy.
- [ ] Killing the ASR process does not crash the keyboard. The next voice attempt either reloads the model or shows a recoverable error.
- [ ] The test report records model load time, transcription latency, real-time factor, and peak memory on the handset.
- [ ] No GPL-derived source is present, and bundled notices cover the ASR model and native dependencies.

### 7. Audience and context

This is an internal engineering build for the PulseTalq team. Testers sideload it onto an Android 16 Samsung handset, enable it as a system keyboard, and dictate into ordinary third-party applications before work begins on the complete public v1 feature set.

### 8. Open assumptions

- The first Android 16 handset has at least 8 GB RAM and an arm64 chipset. The original Galaxy S20 is a performance reference, not necessarily the exact OS test device.
- The app downloads the model during setup instead of embedding roughly 670 MB of model data in the APK. Planning may replace this with an import flow if model hosting is not ready.
- Parakeet INT8 remains the preferred engine. If it misses the device gate, the first test APK may use the smaller provider without changing the keyboard, IPC, or recovery contracts.

### 9. Confidence

| Area | Band | Score | Evidence |
|---|---|---:|---|
| Objective | Certain | 98 | User requested: "Build the first Android app that we can side load and test." |
| Boundaries | Confident | 90 | User confirmed: "first sideloaded APK already install as a system keyboard and dictate into another Android app." |
| Deliverables | Confident | 88 | The repository has no Android project. `frontend/src-tauri/src/parakeet_engine/model.rs` confirms Parakeet behavior exists only in the desktop Tauri package, so the APK needs a new Android app, IME, and local recognizer adapter. |
| Constraints | Confident | 84 | User specified "S20 and above" and "andriod 16". The research sets local Parakeet and separate-process constraints. |
| Success | Confident | 90 | The user's end-to-end requirement fixes installation, keyboard registration, dictation, and cross-app insertion as the core proof. |
| Audience | Certain | 96 | "side load and test" identifies an internal tester rather than a Play Store user. |

### 10. User notes captured during scoping

- "first sideloaded APK already install as a system keyboard and dictate into another Android app"
- "S20 and above"
- "andriod 16"

### 11. Calibration log

- 2026-09-04: Deliverables was scored 88 at gate; the proposed Rust or shared-core implementation was too specific because the installed machine has no NDK or `cargo-ndk`, while sherpa-onnx publishes a prebuilt Android AAR with Parakeet support. Anchor implication: scope mobile behavior and the recognizer interface before choosing the native implementation.

**Created:** 2026-09-03 . **Last opened:** 2026-09-04 . **Last edited:** 2026-09-04 . **Status:** stable . **Owner:** Q. Blaauw
