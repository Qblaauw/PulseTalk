# Dictation UX refinement design

## Context

The Windows dictation foundation is already shipped. This refinement aligns its navigation, settings, overlay placement, activation shortcut, and installed shortcuts with the PulseTalq product model shown in the owner review on 2026-09-02.

## Locked interaction decisions

- The compact Pulse `p` mark is Home. The expanded wordmark has the same behavior.
- The waveform icon is Dictation history. The Sidebar must not show a second waveform for Home.
- Settings keeps the existing routes and tabs, but uses the Deep Focus tokens and geometry from `DESIGN.md`.
- Hold-to-talk has a keyboard capture control. A chord such as `Ctrl+Alt+D` is validated, registered without restarting, persisted, and reflected on every surface that names the active shortcut.
- Shortcut replacement is atomic. PulseTalq registers the candidate before releasing the current chord; a conflict or persistence failure leaves the current shortcut active and explains the failure.
- The floating dictation control follows the monitor containing the pointer. It moves only when the pointer crosses monitors, not for every pointer pixel.
- Activation still captures the foreground window and focused text control before showing the non-focusable overlay. Delivery remains bound to that captured control even if the pointer and text caret are on different monitors.
- The taskbar and tray icon are already correct and are not changed.
- NSIS fresh installs and PulseTalq updates recreate canonical Start-menu shortcuts with an explicit Pulse icon resource. Existing desktop shortcuts are refreshed without creating a desktop shortcut the user did not request. A transitional `PulseTalk.lnk` is removed only when it points at the old `PulseTalk\\meetily.exe` installation.

## Architecture

### Shortcut registration

`dictation::activation` owns a small public interface: initialize, query status, and replace the configured shortcut. It hides accelerator parsing, display formatting, fallback selection, global registration order, persistence, rollback, and event emission. Tauri global-shortcut and store APIs are external adapters. Focused tests use fakes at those external seams and observe returned status and retained registration.

Rejected alternatives:

- A frontend-only preference cannot change the operating-system registration.
- Saving a chord for the next launch makes Settings report a state that is not active.
- Unregistering first can leave dictation unusable when the candidate is occupied.

### Overlay placement and delivery target

Overlay placement and text delivery are separate concerns. Overlay state tracks enabled, expanded, and last pointer-monitor identity. A lightweight runtime loop checks the cursor periodically and repositions only on monitor transition. The coordinator captures the Windows target first and never derives overlay placement from that target. The window remains non-focusable, so moving or showing it cannot replace the active text control.

### Installed shortcut icon

The bundled executable already contains the Pulse icon. The installer adds a separately named Pulse shortcut icon resource and an NSIS post-install hook that recreates canonical shortcuts with an explicit `IconLocation`. The distinct icon path also avoids retaining the old implicit executable-icon cache key. Verification inspects target and icon locations for Start-menu and existing desktop shortcuts.

## Error behavior

- Modifier-only or bare character input is rejected in the capture UI.
- An occupied or invalid candidate keeps the current chord and exposes an inline error.
- A missing cursor monitor leaves the overlay on its last valid monitor and logs a redacted warning.
- Shortcut migration never removes Meetily shortcuts or installations.

## Verification

- Rust unit tests cover chord normalization, safe replacement behavior, fallback startup, cursor monitor selection, and negative virtual-desktop coordinates.
- Frontend tests cover keyboard-event to accelerator/display conversion.
- Static and browser checks cover Home/history navigation, Settings keyboard capture, live shortcut propagation, and Deep Focus styling.
- Installer checks require the explicit Pulse shortcut icon, a PulseTalq executable target, and narrowly scoped transitional shortcut cleanup.
- Existing Windows target-capture and delivery tests remain green.

