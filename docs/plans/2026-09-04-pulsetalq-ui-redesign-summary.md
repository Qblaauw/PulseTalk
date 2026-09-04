# PulseTalq UI redesign decision summary

`task_id: PT-2026-09-04-ui-redesign-summary`

## Purpose

This document captures the product context, accepted decisions, removal scope,
and first approved layout direction for the PulseTalq application redesign. It
is a decision summary, not the final visual specification or implementation
plan.

The redesign began with a deliberate question: what can PulseTalq remove before
redesigning what remains? A code-backed review was performed from three
perspectives: human usability, workflow efficiency, and information
architecture. The reviewers independently reached the same conclusion. The
released interface presents unfinished concepts and duplicate routes as if they
were equal to working product capabilities.

## Repository and product context

- Target product candidate: `integration/pulsetalq-next`
- Audited integration commit: `680a8ab19a8c2ad98310f5ddd627800b5e4462df`
- Product decision already in the repository: Windows dictation ships before
  the meeting and calendar diary.
- Known product gap already in the repository: meeting diary and project
  directory linking belong to later phases.
- Current desktop architecture remains Next.js and React inside Tauri, with the
  Rust core owning recording, transcription, persistence, and dictation.

An earlier scope task, `docs/PT-2026-09-02-ui-modernization-scope` at commit
`10af08f`, proposed an immersive dark audio-studio treatment and full
accessibility review. Its broad accessibility and whole-app goals remain useful.
This document replaces its information-architecture assumptions where they
conflict with the decisions below. The final visual theme still needs explicit
review before implementation.

## Product focus

PulseTalq is privacy first and productivity first.

Every primary screen must help a user complete at least one of these jobs:

1. Dictate into another application and recover text if delivery fails.
2. Record a meeting with a live transcript.
3. Find previous meetings or dictations.
4. Review a transcript and produce a useful summary.

Anything that does not support one of these jobs should be removed, moved into
contextual help, or placed under Advanced settings.

## Accepted product principles

### Privacy

The default promise is:

> Your data never leaves this device by default.

- Local processing is the default.
- Cloud processing is an explicit fallback for devices that cannot run local
  models well enough.
- The first use of cloud processing requires informed, affirmative consent.
- PulseTalq never uploads audio or transcripts without prior consent.
- The interface always states whether processing happens `On this device` or
  in the `Cloud`.
- Cloud-processing consent and cross-device-sync consent are separate choices.
- Neither choice is preselected, bundled into onboarding, or enabled silently.
- A user can withdraw either consent later from Settings.

### Productivity

- Working actions take priority over dashboards, previews, promotion, and
  configuration.
- Common tasks stay within one or two deliberate interactions from the shared
  application shell.
- PulseTalq uses plain labels such as `Record meeting`, `Dictation`, `Library`,
  `Summary`, and `Transcript`.
- The app keeps one canonical route to each major task.
- Recovery and failure information remains visible because it helps users
  finish interrupted work.

## Accepted removal scope

### Remove from the released application

| Item | Reason |
|---|---|
| Inbox | It is an unconnected preview that redirects users to the existing meeting list. |
| Projects | It uses temporary sample data and loses changes after refresh. Persistent project linking is a later phase. |
| Mock Notes route | It contains hard-coded sample meetings and fictional data. |
| Stale `Type anywhere` preview | Working native dictation already exists. The preview contradicts it with unavailable services and a disabled action. |
| Today statistics card | Word and delivery totals do not help users complete a task, and current counts can represent partial history. |
| Marketing content in About | Product promotion and future-agent advertising do not belong in the application workflow. |
| Static explanation cards in Settings | Privacy and feature explanations belong in onboarding or contextual help when users cannot change them. |
| Duplicate version and About entries | Version, updates, privacy, licenses, and support belong in one Settings location. |

### Merge or relocate

- Merge meeting retrieval and dictation history into one searchable `Library`.
- Give Library clear `Meetings` and `Dictations` views or filters.
- Move transcript search from the permanent sidebar into Library.
- Replace the unbounded sidebar meeting tree with a short recent-items view.
- Make `Import audio` a secondary option attached to `Record meeting`.
- Move meeting context into Summary as an expandable `Guide this summary`
  control.
- Keep one summary-generation action and one save mechanism.
- Use one Settings page rather than a page plus legacy settings modals.
- Place Beta, diagnostics, provider endpoints, API keys, and other technical
  controls under Advanced.

### Keep and strengthen

- Native dictation and its recoverable history
- Meeting recording and live transcription
- Meeting Summary and Transcript views
- Search across saved transcript content
- Device, language, model, storage, overlay, and permission controls
- Recording, processing, saving, sync, and failure states
- Clear routes to recover or copy work after a failed dictation

## Approved application shell

The shared navigation is intentionally small:

```text
PulseTalq

[ Record meeting ]

Home
Library

Account and sync
Settings
```

- The PulseTalq mark returns to Home.
- `Record meeting` is the single primary application action.
- `Import audio` is a secondary action associated with Record meeting.
- Home and Library are the only persistent product destinations.
- Account, sync, and Settings remain available without competing with the main
  workflow.
- Inbox, Projects, About, Dictation History, and a permanent meeting tree do not
  appear as separate global destinations.
- Compact layouts may reduce the sidebar automatically. The design should not
  depend on a large floating collapse button.

## Approved Home direction

Home is a working status and resume screen, not an analytics dashboard.

The first section shows dictation readiness:

- active keyboard shortcut;
- microphone and transcription-model status;
- current processing location;
- floating-overlay status;
- a clear remedy when dictation is blocked.

A visible `Record meeting` action supports the second major workflow. Dictation
does not need an in-app start button because users invoke it with the global
shortcut from another application.

Home also shows one unified Recent list containing meetings and dictations. Each
item identifies its type, timestamp, processing location, sync state, and one
relevant quick action. The complete collection and search live in Library.

Privacy appears as state that helps the user understand current behavior:

- `Stored only on this device`
- `Processed on this device`
- `Cloud processing enabled with your consent`
- `End-to-end encrypted`
- `Available on 3 devices`

During meeting recording, the controls remain persistent. Navigation should be
blocked only when leaving would interrupt capture or unsaved processing.

## Cloud-processing contract

Cloud processing exists for limited hardware, not as the default path.

1. PulseTalq checks whether the device has a practical local model option.
2. It recommends a local model when the expected experience is acceptable.
3. When local processing is impractical, PulseTalq may offer cloud processing.
4. Before the first upload, the consent screen names the provider, content being
   sent, purpose, and relevant retention behavior.
5. The user confirms the choice before processing begins.
6. PulseTalq never changes from local to cloud silently after an error or
   timeout.

The final provider list, credential model, retention disclosures, and consent
copy still require detailed design.

## End-to-end encrypted sync contract

PulseTalq will offer optional account-based sync. PulseTalq operates the sync
service but cannot decrypt user content.

Sync is disabled by default and requires consent separate from cloud AI.

The approved sync payload is:

| Data | Sync behavior |
|---|---|
| Meeting and dictation titles | Included, encrypted before upload |
| Transcripts | Included, encrypted before upload |
| Summaries | Included, encrypted before upload |
| Essential metadata | Included only when needed for ordering, identity, conflict handling, or display |
| Audio recordings | Excluded and kept local |
| Local model files | Excluded |
| Diagnostics and support logs | Excluded unless the user performs a separate support-sharing action |

The interface should show quiet sync states such as `Local only`, `Syncing`,
`Synced`, `Offline`, and `Sync needs attention`. Users can review and revoke
connected devices. Turning sync off stops future uploads without deleting local
copies.

Account recovery, encryption-key recovery, conflict resolution, remote deletion,
and device-revocation behavior remain open technical and UX decisions. They must
preserve the rule that PulseTalq cannot read encrypted transcript content.

## Recommended next design sections

The following direction was supported by the audit but has not received the same
screen-level approval as the application shell and Home:

1. Library structure, search, filters, item actions, and empty states
2. Meeting review with Summary and Transcript as the two main views
3. Settings grouped by user intent rather than implementation subsystem
4. Onboarding for local capability checks, cloud consent, and optional sync
5. Error, recovery, offline, sync-conflict, and revoked-device states
6. Final visual system, density, motion, compact-window behavior, and
   accessibility rules

## Out of scope for the current summary

- Building Inbox or Projects
- Implementing account, sync, or cloud infrastructure
- Selecting a cloud provider or pricing model
- Changing the audio, recording, or transcription pipeline
- Finalizing the visual theme
- Writing the implementation task plan

## Success checks for the eventual redesign

- A new user can identify how to dictate and record a meeting without opening
  Settings.
- Every retained product destination has working content and a clear purpose.
- No screen advertises unfinished functionality as a primary destination.
- The user can find any saved meeting or dictation through Library.
- The interface states where processing and storage occur before data leaves the
  device.
- Cloud processing and encrypted sync each require their own first-time consent.
- No audio recording enters the transcript-sync payload.
- Keyboard, screen-reader, focus, contrast, reduced-motion, zoom, and compact
  window behavior meet the accessibility contract defined in the final design.

## Evidence and confidence

The removal and navigation recommendations came from a code review of the
current integration candidate and three independent role-based audits. No user
analytics, usability sessions, or production task-completion measurements were
available. The accepted decisions therefore have strong product-owner support
and code evidence, but later interaction details should still receive usability
testing.

**Created:** 2026-09-04 . **Last opened:** 2026-09-04 . **Last edited:** 2026-09-04 . **Status:** stable . **Owner:** Q. Blaauw
