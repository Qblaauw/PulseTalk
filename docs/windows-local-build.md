# PulseTalq Windows local build

PulseTalq keeps the signed release configuration intact. Local Windows installers use a small overlay that disables updater artifact signing because distribution credentials are unavailable to local developers.

Before changing an installer input, bump the application version when required, then refresh the installer revision from the repository root:

```powershell
node scripts/installer-version.mjs bump
```

From `frontend`:

```powershell
pnpm tauri:build:windows-local
```

The installer is written to:

```text
target\release\bundle\nsis\PulseTalq_0.4.3_installer.1_x64-setup.exe
```

This local installer is unsigned and Windows may show a SmartScreen warning. Official distribution builds still use `pnpm tauri:build` with the configured code-signing and updater keys.

Release diagnostics are written to:

```text
%LOCALAPPDATA%\com.pulsetalq.app\logs\PulseTalq.log
```

The active log is capped at 1 MB and PulseTalq retains four rotated archives. Only explicit PulseTalq lifecycle and dictation targets are written to disk; inherited meeting, profile, notification, summary, and HTTP logs are excluded. Dictation failures use stable codes such as `audio_capture_failed`, `target_lost`, `delivery_failed`, and `persistence_failed` so a failed session can be matched to its history entry without storing spoken text, credentials, profile details, or HTTP bodies in the support log.

Users can open this directory from Settings → Dictation → Diagnostics without locating AppData manually.

The application identifier is `com.pulsetalq.app`. PulseTalq data, logs, models, and database state stay separate from legacy Meetily installations.
