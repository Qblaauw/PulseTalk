# PulseTalq Android 16 Samsung device smoke

Status: waiting for a physical Samsung handset

Reviewed APK SHA-256: `a600b8099bbcfc58c3809fd6803594221497abe5a5a4852bdffa5e31cde5d8f7`

## Device

| Field | Value |
|---|---|
| Manufacturer | Pending |
| Model | Pending |
| Android SDK | Must be 36 |
| Build fingerprint | Pending |
| Total memory | Pending |

## Procedure

1. Connect exactly one authorized Android 16 Samsung device.
2. Run `scripts/android/device-smoke.ps1 -Action install`.
3. Grant microphone permission, download and verify the model, enable PulseTalq, and select it.
4. Run `scripts/android/device-smoke.ps1 -Action status` and paste the JSON into this report.
5. Complete every manual check below in both a notes app and a messaging app.
6. During an active voice request, run `scripts/android/device-smoke.ps1 -Action kill-voice` and verify recovery.
7. Run `scripts/android/device-smoke.ps1 -Action metrics` and record the structured timing line.

The script rejects non-Samsung devices by default. Maintainers can run
`scripts/android/device-smoke.ps1 -Action status -PermitEmulatorPreflight` on an
API 36 emulator to check the script itself. Emulator output always sets
`acceptanceEligible` to `false` and cannot satisfy this report.

## Harness check

The API 36 emulator preflight returned valid status JSON while the optional
`:voice` process was idle. Running the same command without
`-PermitEmulatorPreflight` rejected the Google emulator, so the Samsung hardware
gate remains active.

## Result matrix

| Check | Result | Evidence |
|---|---|---|
| APK installs without root | Pending | |
| PulseTalq appears in keyboard picker | Pending | |
| Basic tap typing works in notes | Pending | |
| Basic tap typing works in messaging | Pending | |
| Local dictation inserts in notes | Pending | |
| Local dictation inserts in messaging | Pending | |
| Airplane-mode dictation works | Pending | |
| Cancel inserts no text | Pending | |
| Rejected insertion retains text | Pending | |
| Retry inserts retained text | Pending | |
| Copy exposes retained text | Pending | |
| Killing `:voice` does not crash IME | Pending | |
| Next voice attempt reloads or reports recovery | Pending | |

## Performance

| Metric | Value |
|---|---|
| Model load time | Pending |
| Audio duration | Pending |
| Transcription duration | Pending |
| Real-time factor | Pending |
| Peak process PSS | Pending |

## Conclusion

Pending physical-device evidence. API 36 emulator setup, IME registration, and Google Messages tap typing passed, but emulator evidence does not satisfy the arm64 Samsung microphone and Parakeet checks.
