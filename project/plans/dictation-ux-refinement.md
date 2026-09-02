---
plan_id: P-2026-09-02-dictation-ux-refinement
created_by: codex
created_at: 2026-09-02T14:55Z
target_executor: sonnet-subagent
project: PulseTalq
baseline_sha: 680a8ab19a8c2ad98310f5ddd627800b5e4462df
baseline_tag: main-680a8ab
goal_contract_version: 2
dispatcher_hint: frontier
estimated_tasks: 7
opus_session_turns: 1
delivery_waived: true
---

## Locked decisions

- D-dictation-navigation: The Pulse mark owns Home and one waveform owns Dictation history (`docs/plans/2026-09-02-dictation-ux-refinement-design.md`).
- D-dictation-shortcut: Hold-to-talk shortcut replacement is immediate, persisted, and rollback-safe (`docs/plans/2026-09-02-dictation-ux-refinement-design.md`).
- D-overlay-placement: Pointer monitor controls overlay placement while captured focus controls delivery (`docs/plans/2026-09-02-dictation-ux-refinement-design.md`).
- D-installer-icons: Tray behavior stays unchanged; installed shortcuts get an explicit Pulse icon (`docs/plans/2026-09-02-dictation-ux-refinement-design.md`).

## Research summary

- **Premise:** Home and history need distinct navigation semantics. **Status:** confirmed in `frontend/src/components/Logo.tsx` and `frontend/src/components/Sidebar/index.tsx`; the mark currently opens About and two waveform buttons point at Home and history.
- **Premise:** Settings cannot change the active chord. **Status:** confirmed in `frontend/src/components/DictationSettings.tsx` and `frontend/src-tauri/src/lib.rs`; the UI is read-only and startup registers a hard-coded fallback list.
- **Premise:** Delivery already targets the active control. **Status:** confirmed in `frontend/src-tauri/src/dictation/coordinator.rs` and `windows_delivery.rs`; target capture occurs before overlay display and delivery validates the original focused control.
- **Premise:** Overlay placement follows the text target rather than the pointer. **Status:** confirmed in `frontend/src-tauri/src/dictation/overlay.rs`; focused-control coordinates are preferred and there is no monitor-transition watcher.
- **Premise:** The source Pulse icon is wrong. **Status:** absent. The executable and tray asset render the Pulse mark. The installed canonical shortcut has implicit `IconLocation=,0`, updates may skip shortcut recreation, and a transitional `PulseTalk.lnk` remains. The pre-edit shortcut probe exited 1 with `RED_OBSERVED`.
- **Architecture trigger:** shortcut registration adds a mutable adapter seam. Loaded `Vocabulary` and `Core design checks` from the ProductOps codebase-design reference. The chosen interface hides registration, persistence, fallback, and rollback behind dictation activation commands.
- **Baseline:** `cargo test dictation:: --lib` passed 32 tests with 4 intentional interactive ignores. Product TypeScript checking is partially blocked by the pre-existing missing `bun:test` type in `frontend/tests/lib/blocknote-markdown.test.ts`.

## File targets

| path | role | touch_type | owner_task |
|------|------|------------|------------|
| `frontend/src-tauri/src/dictation/activation.rs` | shortcut manager and tests | edit | T1 |
| `frontend/src-tauri/src/dictation/commands.rs` | shortcut command | edit | T1 |
| `frontend/src-tauri/src/lib.rs` | startup and command registration | edit | T1 |
| `frontend/src-tauri/src/dictation/overlay.rs` | pointer-monitor follower | edit | T2 |
| `frontend/src-tauri/src/dictation/coordinator.rs` | placement/target separation | edit | T2 |
| `frontend/src-tauri/src/dictation/mod.rs` | overlay interface export | edit | T2 |
| `frontend/src-tauri/tauri.conf.json` | shortcut resource and NSIS hook | edit | T3 |
| `frontend/src-tauri/installer/pulsetalq-shortcuts.nsh` | shortcut refresh and migration | create | T3 |
| `scripts/verify-installer-branding.ps1` | installed shortcut icon gate | edit | T3 |
| `docs/installer-verification.md` | installer acceptance | edit | T3 |
| `frontend/src/lib/dictationShortcut.ts` | keyboard chord capture model | create | T4 |
| `frontend/tests/lib/dictation-shortcut.test.mjs` | shortcut capture tests | create | T4 |
| `frontend/src/components/DictationSettings.tsx` | editable hold-to-talk control | edit | T4 |
| `frontend/src/components/VoiceHub.tsx` | live shortcut status | edit | T5 |
| `frontend/src/app/dictation-overlay/page.tsx` | live shortcut status | edit | T5 |
| `frontend/src/components/Logo.tsx` | Home mark | edit | T6 |
| `frontend/src/components/Sidebar/index.tsx` | Home/history navigation | edit | T6 |
| `frontend/src/app/settings/page.tsx` | Deep Focus Settings shell | edit | T6 |
| `frontend/src/components/PreferenceSettings.tsx` | Deep Focus General settings panel | edit | T6 |
| `frontend/src/components/RecordingSettings.tsx` | Deep Focus Recording settings panel | edit | T6 |
| `frontend/src/components/TranscriptSettings.tsx` | Deep Focus transcription settings panel | edit | T6 |
| `frontend/src/components/SummaryModelSettings.tsx` | Deep Focus summary-model settings panel | edit | T6 |
| `frontend/src/components/BetaSettings.tsx` | Deep Focus beta settings panel | edit | T6 |
| `docs/windows-dictation-acceptance.md` | end-to-end acceptance record | edit | T7 |

## Task DAG

### T1: Add atomic configurable shortcut registration
- blocked_by: []
- blocks: [T4, T5, T7]
- dag_level: 1
- files_touched: [frontend/src-tauri/src/dictation/activation.rs, frontend/src-tauri/src/dictation/commands.rs, frontend/src-tauri/src/lib.rs]
- acceptance:
  - A public Tauri command accepts a validated modifier-plus-key accelerator and returns the active display chord.
  - The candidate registers before the old chord is released; registration or persistence failure retains the old chord.
  - The selected chord persists in `preferences.json`, is used at startup, and emits `dictation-shortcut-changed` after success.
  - Focused Rust tests witness invalid, conflict, rollback, startup fallback, and `Ctrl+Alt+D` behavior red then green through the activation interface.
- dispatch_model: sonnet-subagent
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: [global-shortcut-registration]
- shard_writes: []

### T2: Follow the pointer between monitor work areas
- blocked_by: []
- blocks: [T7]
- dag_level: 1
- files_touched: [frontend/src-tauri/src/dictation/overlay.rs, frontend/src-tauri/src/dictation/coordinator.rs, frontend/src-tauri/src/dictation/mod.rs]
- acceptance:
  - The overlay repositions when the cursor crosses to another monitor and does not move for pointer changes within one monitor.
  - Activation captures the focused Windows control before showing the non-focusable overlay and never uses that control to choose the overlay monitor.
  - Monitor selection tests cover negative coordinates, boundaries, and unchanged-monitor suppression.
- dispatch_model: sonnet-subagent
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: [dictation-overlay-window]
- shard_writes: []

### T3: Refresh installed shortcuts with the Pulse icon
- blocked_by: []
- blocks: [T7]
- dag_level: 1
- files_touched: [frontend/src-tauri/tauri.conf.json, frontend/src-tauri/installer/pulsetalq-shortcuts.nsh, scripts/verify-installer-branding.ps1, docs/installer-verification.md]
- acceptance:
  - NSIS bundles a distinct Pulse shortcut icon and recreates the canonical Start-menu shortcut after fresh install and update.
  - An existing PulseTalq desktop shortcut is refreshed without creating a new desktop shortcut.
  - A transitional `PulseTalk.lnk` is removed only when it targets `PulseTalk\\meetily.exe`; Meetily shortcuts remain untouched.
  - The installed-branding gate fails for implicit or legacy icon locations and passes only for existing Pulse target and icon paths.
- dispatch_model: sonnet-subagent
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: [windows-start-menu-shortcuts]
- shard_writes: []

### T4: Add keyboard capture to Dictation settings
- blocked_by: [T1]
- blocks: [T6, T7]
- dag_level: 2
- files_touched: [frontend/src/lib/dictationShortcut.ts, frontend/tests/lib/dictation-shortcut.test.mjs, frontend/src/components/DictationSettings.tsx]
- acceptance:
  - Change shortcut enters a focused capture state, Escape cancels, and modifier-only or bare-key input cannot be saved.
  - `Ctrl+Alt+D` is rendered as distinct key chips and saved through `dictation_set_shortcut` with inline progress, success, and rollback-safe error feedback.
  - Frontend conversion tests witness representative Windows chords red then green at the exported capture seam.
- dispatch_model: sonnet-subagent
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: []
- shard_writes: []

### T5: Synchronize shortcut labels across live surfaces
- blocked_by: [T1]
- blocks: [T7]
- dag_level: 2
- files_touched: [frontend/src/components/VoiceHub.tsx, frontend/src/app/dictation-overlay/page.tsx]
- acceptance:
  - Home and the hover overlay listen for `dictation-shortcut-changed` and update without reload.
  - Initial status loading and unavailable-state copy remain correct.
- dispatch_model: sonnet-subagent
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: []
- shard_writes: []

### T6: Align Home, history, and Settings with Deep Focus
- blocked_by: [T4]
- blocks: [T7]
- dag_level: 3
- files_touched: [frontend/src/components/Logo.tsx, frontend/src/components/Sidebar/index.tsx, frontend/src/app/settings/page.tsx, frontend/src/components/PreferenceSettings.tsx, frontend/src/components/RecordingSettings.tsx, frontend/src/components/TranscriptSettings.tsx, frontend/src/components/SummaryModelSettings.tsx, frontend/src/components/BetaSettings.tsx]
- acceptance:
  - Compact and expanded Pulse marks navigate to `/` and expose Home semantics and current-page state.
  - Collapsed Home follows the tooltip pattern used by adjacent navigation controls.
  - Exactly one waveform navigation control remains and it navigates to `/dictation-history` in both Sidebar modes.
  - The Settings shell and every existing tab panel use `--pt-*` tokens, 3 px geometry, accent focus states, and information-dense section boundaries without blue/indigo styling.
- dispatch_model: sonnet-subagent
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: []
- shard_writes: []

### T7: Verify the complete dictation refinement and record acceptance
- blocked_by: [T1, T2, T3, T4, T5, T6]
- blocks: []
- dag_level: 4
- files_touched: [docs/windows-dictation-acceptance.md]
- acceptance:
  - Focused Rust, frontend, static branding, and product type checks run against the final tree with exact results recorded.
  - Browser verification covers `/`, `/settings`, and `/dictation-history` at the 1280 by 800 owner-review viewport with no new console or page errors.
  - The acceptance record distinguishes automated proof, installed-shell proof, and any bounded manual checks still required.
- dispatch_model: skill:webapp-testing
- render_verify_required: false
- writes_shared_state: false
- exclusive_resources: [port:3118]
- shard_writes: []

## Dispatch plan

- width: 3
- levels: {T1,T2,T3} {T4,T5} {T6} {T7}
- max_width: 3
- critical_path: 4
- exclusive_resources_in_play: [global-shortcut-registration, dictation-overlay-window, windows-start-menu-shortcuts, port:3118]
- barriers:
  - before T7, because render and integration verification must observe the complete tree

## Goal DoD

- G1: The Pulse mark opens Home and one waveform icon opens Dictation history in both Sidebar modes. - satisfied_by: [T6, T7]
- G2: Dictation settings use the PulseTalq Deep Focus system and let the user capture and save a chord such as Ctrl+Alt+D. - satisfied_by: [T4, T6, T7]
- G3: A saved hold-to-talk chord is active immediately, survives restart, rolls back safely on failure, and updates every visible shortcut label. - satisfied_by: [T1, T4, T5, T7]
- G4: The floating overlay follows the pointer across monitors while delivery remains bound to the active text control captured at activation. - satisfied_by: [T2, T7]
- G5: Installed Start-menu and existing desktop shortcuts use the Pulse icon after fresh install or PulseTalq update while the correct tray icon remains unchanged. - satisfied_by: [T3, T7]
- G6: Automated and bounded Windows acceptance evidence covers the refined behavior without regressing existing dictation delivery. - satisfied_by: [T1, T2, T3, T4, T5, T6, T7]

## Gap classification

- **medium** · G-2026-09-02-product-artifact-set · This repository has the lean design/plan/decision set but no canonical PRD, sitemap, workflow, tool-flow, roadmap, or rendered workspace shards; this refinement does not silently scaffold them.
- **medium** · G-2026-09-02-bun-test-types · The baseline product TypeScript command includes `frontend/tests/lib/blocknote-markdown.test.ts` but lacks the `bun:test` declaration.
- **low** · G-2026-09-02-preview-snapshot · The T3 preview navigated to the local pages but its snapshot call returned an unavailable error; final verification must retry or use the pinned webapp-testing fallback.

## Close-of-execution contract

```
**Plan-handoff close - P-2026-09-02-dictation-ux-refinement, 7 tasks closed**

## Summary
<one sentence>

## Findings
- **<severity>** · <one-liner> · <file:line>

## Actions
- **Applied:** <task IDs closed> · <verification receipts> · <commits>
- **Proposed:** <empty if clean close, else next-step hints>

## Surfaced gaps
- **<severity>** · G-YYYY-MM-DD-slug · <summary>

## Handoff fields
- tasks_closed: [T1, T2, T3, T4, T5, T6, T7]
- tasks_blocked: []
- escalated_to_opus: []
- goal_dod: project/state/goals/P-2026-09-02-dictation-ux-refinement.json (check: exit 0)
- execution_state: execution_complete
- archive_path: project/plans/archive/dictation-ux-refinement.md
```
