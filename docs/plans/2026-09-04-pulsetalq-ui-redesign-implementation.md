# PulseTalq UI redesign: implementation plan and record

Task: `PT-2026-09-04-ui-redesign`
Branch: `feature/PT-2026-09-04-ui-redesign` from `integration/pulsetalq-next` at `680a8ab`
Decision source: [2026-09-04-pulsetalq-ui-redesign-summary.md](2026-09-04-pulsetalq-ui-redesign-summary.md)
Design system reference: [DESIGN.md](../../DESIGN.md)

This document is the detailed plan that was executed on 2026-09-04, the state
it left the app in, and the follow-up work that remains. It is written so
that a new contributor can pick up any remaining item without re-deriving
the reasoning.

## 1. Goals

1. Ship the information architecture approved in the decision summary: a
   shell with `Record meeting`, `Import audio` (beta), Home, Library,
   Account and sync, Settings.
2. Give the app a premium, Apple-like look and feel: system fonts,
   translucent chrome, hairline borders, soft radii, restrained motion,
   light and dark following the operating system.
3. Remove everything the decision summary marked for removal.
4. Put privacy and sync language in one place and use it verbatim.
5. Keep every Tauri command, event, hook, and data flow working. No Rust
   behaviour changes beyond exposing timestamps on the meetings list.

Out of scope, by decision: cloud sync, accounts, sign-in, workspace sharing,
new fonts, any change to the audio or transcription pipeline.

## 2. Work breakdown

The work was split into five streams. Streams A to C were implemented by
the coordinator; D and E were delegated to worker agents in parallel and
reviewed before commit.

### A. Foundation

| Item | File | Notes |
| --- | --- | --- |
| Design tokens, light and dark palettes, radii, motion, layout vars | `frontend/src/app/globals.css` | `:root` block plus `@media (prefers-color-scheme: dark)`; `[data-theme]` override; legacy `--pt-*` names kept so old consumers still resolve |
| `.pt-*` primitives | `frontend/src/app/globals.css` | button, card, group, row, badge, input, segmented, kbd, nav-item, sidebar, shell, scroll, enter, pulse |
| Tailwind wiring | `frontend/tailwind.config.ts` | `fontFamily.sans` from `--pt-font-ui`; shadcn HSL colour map; `tailwindcss-animate` plugin added |
| OS theme, window minimum | `frontend/src-tauri/tauri.conf.json` | removed forced `Light` theme; `minWidth` 720, `minHeight` 520 |
| Root layout | `frontend/src/app/layout.tsx` | dropped Archivo and Newsreader, renders `AppShell`, glass Toaster |
| Privacy and sync vocabulary | `frontend/src/lib/privacy.ts` | `PRIVACY_LABELS`, `SYNC_LABELS`, `SYNC_TONE`, `CURRENT_SYNC_STATE`, provider helpers |
| Library data layer | `frontend/src/lib/library.ts` | `useLibraryItems` merges meetings and dictations, polls dictations, listens to `dictation-state` and `pulse-talq:meetings-changed` |
| Meeting timestamps | `frontend/src-tauri/src/api/api.rs` | `Meeting` gains `created_at` and `updated_at` as RFC 3339 strings |

### B. Shell and navigation

| Item | File |
| --- | --- |
| `AppShell` with skip link, `data-compact`, `--pt-shell-sidebar` | `frontend/src/components/AppShell/AppShell.tsx` |
| Sidebar: mark, Record meeting, Import audio, Home, Library, Account and sync, Settings, version, compact toggle, tooltips in compact | `frontend/src/components/Sidebar/index.tsx` |
| Compact state persisted in `localStorage` key `pt.sidebar.compact` | `frontend/src/components/Sidebar/SidebarProvider.tsx` |
| Main region with `id="pt-main"` | `frontend/src/components/MainContent/index.tsx` |
| Shared page chrome: `PageHeader`, `PageBody` | `frontend/src/components/AppShell/PageHeader.tsx` |
| State chips: `StateChip`, `PrivacyChip`, `SyncChip` | `frontend/src/components/AppShell/StateChips.tsx` |

Fixed overlays no longer receive a `sidebarCollapsed` prop. They use
`left: var(--pt-shell-sidebar)` so they centre on the content column in both
sidebar widths and on narrow windows.

### C. Home, Library, Account, redirects

| Route | File | Behaviour |
| --- | --- | --- |
| `/` idle | `frontend/src/app/_components/HomeView.tsx` | Dictation hero with shortcut keys and live phase from `dictation-state`; readiness rows for shortcut, microphone, transcription model, floating indicator, each with a remedy that deep links into Settings; Recent list of the six newest items; Record meeting and Import audio actions |
| `/` recording | `frontend/src/app/_components/TranscriptPanel.tsx` | Sticky glass header with title, status chip, privacy chip, Copy, Language; reading column transcript; capture pill fixed at the bottom |
| `/` overlays | `frontend/src/app/_components/StatusOverlays.tsx` | Glass pills for finishing and saving |
| `/library` | `frontend/src/app/library/page.tsx` | All / Meetings / Dictations segmented filter driven by `?filter=`; grouped by Today, Yesterday, This week, This month, Earlier; instant title match plus debounced transcript search through `api_search_transcripts`; copy, rename (`api_save_meeting_title`), delete with confirmation (`api_delete_meeting`); announces changes so the sidebar and Home refresh |
| `/account` | `frontend/src/app/account/page.tsx` | Local only state, privacy chips, three future sync meanings marked Coming later |
| `/dictation-history` | `frontend/src/app/dictation-history/page.tsx` | Client redirect to `/library?filter=dictations` |
| `/inbox`, `/projects`, `/notes/[id]` | deleted | |

### D. Meeting review (delegated)

| Item | File |
| --- | --- |
| Sticky glass header, Summary and Transcript segmented control, context view removed | `frontend/src/app/meeting-details/page-content.tsx` |
| One generate or regenerate action with model and privacy chip; Guide this summary disclosure hosting the existing context editor | `frontend/src/components/MeetingDetails/SummaryPanel.tsx`, `SummaryGeneratorButtonGroup.tsx` |
| One save action plus Copy and Open folder | `frontend/src/components/MeetingDetails/SummaryUpdaterButtonGroup.tsx` |
| Reading column and tokenised buttons | `frontend/src/components/MeetingDetails/TranscriptPanel.tsx`, `TranscriptButtonGroup.tsx` |
| Tokenised title editing and empty state | `frontend/src/components/EditableTitle.tsx`, `EmptyStateSummary.tsx` |
| Capture pill as glass card, theme-aware text, accent record button | `frontend/src/components/RecordingControls.tsx` |

### E. Settings (delegated)

| Item | File |
| --- | --- |
| Single page: jump list, sections `#dictation`, `#recording`, `#transcription`, `#summary`, `#notifications`, `#advanced`, `#about`; legacy `?tab=` mapped to anchors; wrapped in `Suspense` | `frontend/src/app/settings/page.tsx` |
| Static explanation cards removed, controls only, Library link | `frontend/src/components/DictationSettings.tsx` |
| Storage and notifications split by props, tokenised | `frontend/src/components/PreferenceSettings.tsx` |
| Tokenised | `RecordingSettings.tsx`, `SummaryModelSettings.tsx`, `BetaSettings.tsx`, `AnalyticsConsentSwitch.tsx` |
| Advanced: beta features, diagnostics folder, analytics consent | inside `settings/page.tsx` |
| About: version from Tauri, check for updates, privacy, licenses, support | inside `settings/page.tsx` |

### Removed

`VoiceHub`, `CaptureModeSwitcher`, `ProjectWorkspacePreview`, `SettingTabs`,
`About`, `Info`, `Logo`, `CustomDialog`, `MainNav`, the Inbox and Projects
pages, and the notes route. The Type anywhere preview and Today stats card
went with `VoiceHub`.

## 3. Verification

| Check | Result | Notes |
| --- | --- | --- |
| `pnpm exec tsc --noEmit` | pass | One pre-existing error in `tests/lib/blocknote-markdown.test.ts` (missing `bun:test` types) |
| `pnpm run build` | pass | Eleven routes prerendered |
| `git diff --check` | pass | |
| `pnpm run lint` | blocked | `next lint` prompts for setup; the flat `eslint.config.mjs` is not read by Next 14 and eslint is not installed. Pre-existing |
| `cargo check` | blocked | `whisper-rs` fails to compile in this environment. The Rust change mirrors an existing mapping in the same file |
| Manual review against the decision summary | pass | Removal list, navigation, Home, Library, review, Settings, privacy and sync labels |

Receipts are recorded in `project/state/tasks/PT-2026-09-04-ui-redesign.json`.

## 4. Follow-up plan

Ordered by value. Each item is one task branch.

1. **Lint tooling** (`chore`): add eslint and `eslint-config-next` as dev
   dependencies and either migrate to `.eslintrc.json` or upgrade Next so the
   flat config is honoured. Then run lint across the redesign and fix findings.
2. **Rust build environment** (`chore`): make `cargo check` pass in a clean
   worktree. Investigate the `whisper-rs` and `whisper.cpp` version pairing
   and commit the sidecar binary acquisition step so the build script does
   not depend on untracked files.
3. **Visual QA pass** (`fix`): run the desktop app in light and dark on
   Windows and macOS, at 720 by 520 and at full screen, and correct spacing,
   contrast, and focus-ring issues. Capture screenshots into
   `docs/plans/assets/` for the record.
4. **Legacy summary renderer** (`refactor`): `AISummary/index.tsx` still
   carries its own Regenerate button for old non-BlockNote summaries. Route it
   through the consolidated generate action or retire the renderer.
5. **Onboarding and dialogs** (`feature`): restyle the onboarding flow,
   model download dialogs, and confirmation modals with the new primitives so
   no legacy grey surfaces remain.
6. **Dictation overlay** (`feature`): align the floating overlay window with
   the token palette and the capture pill.
7. **Library export** (`feature`): the Account page promises export before
   reinstalling. Add an export action to the Library row menu.
8. **Sync states** (`feature`, later): when sync infrastructure exists, drive
   `CURRENT_SYNC_STATE` from the Rust core and surface `Sync needs attention`
   remedies on Home.

## 5. Conventions established

- One accent action per screen. Accent is `--pt-accent`, reserved for record,
  active, and primary.
- Rows over cards: label plus one line of help on the left, control on the
  right.
- Where data lives is shown with a `PrivacyChip`, never a paragraph.
- Fixed elements centre on the content column with `--pt-shell-sidebar`.
- No hardcoded Tailwind greys or blues; no `rounded-[3px]`; no new fonts.
- Never use an em dash in authored prose.
