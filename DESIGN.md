# PulseTalq design system

> Speak. It stays here.

This document describes the visual system implemented in
`frontend/src/app/globals.css` and the `.pt-*` primitives. It follows the
decisions in `docs/plans/2026-09-04-pulsetalq-ui-redesign-summary.md`.
When the two disagree, the decision doc wins and this file should be updated.

## 1. Visual theme

**Style:** premium desktop utility, Apple-esque. Quiet surfaces, hairline
borders, translucent chrome, one warm accent.
**Keywords:** calm, exact, private, fast, native.
**Tone:** plain and decisive. No marketing copy inside the app.

The interface follows the operating system. Light and dark come from
`prefers-color-scheme`; a `[data-theme="light"|"dark"]` attribute on `<html>`
overrides it. There is no in-app "theme" toggle in v1.

The lowercase wordmark keeps `pulse` in the text colour and `talq` in the
accent. The accent is reserved for the record action, active states, and the
single primary action on a page.

## 2. Tokens

All tokens live on `:root` and are redefined for dark in a
`@media (prefers-color-scheme: dark)` block. Consumers use `var(--pt-*)`;
shadcn/ui primitives read the HSL variables (`--background`, `--primary`, and
so on) which are mapped from the same palette.

### Colour roles

| Role | Light | Dark | Token |
| --- | --- | --- | --- |
| Window background | `#f5f5f7` | `#161618` | `--pt-bg` |
| Card / surface | `#ffffff` | `#1e1e21` | `--pt-surface` |
| Subtle fill (icon wells, hover) | `rgba(0,0,0,.05)` | `rgba(255,255,255,.07)` | `--pt-fill` |
| Translucent chrome | white at 72% | dark at 62% | `--pt-glass`, `--pt-sidebar` |
| Hairline border | `rgba(0,0,0,.08)` | `rgba(255,255,255,.10)` | `--pt-border` |
| Primary text | `#1d1d1f` | `#f5f5f7` | `--pt-text` |
| Secondary text | `#515154` | `#a1a1a6` | `--pt-text-secondary` |
| Tertiary text | `#86868b` | `#6e6e73` | `--pt-text-tertiary` |
| Accent (Hot Signal) | `#ff3b1f` | `#ff5a41` | `--pt-accent` |
| Text on accent | `#ffffff` | `#ffffff` | `--pt-accent-contrast` |
| Success / warning / error / info | system greens, ambers, reds, blues | brighter variants | `--pt-success` etc. plus `--pt-*-wash` |

Rules:

- Hairlines, not shadows, separate regions. Shadows appear only on floating
  elements (`--pt-shadow-md`) and the capture pill (`--pt-shadow-lg`).
- Never hardcode Tailwind greys or blues in components. Use the tokens.
- Semantic colours are for state chips and inline validation only.

### Typography

- UI font: `--pt-font-ui`, the system stack (`-apple-system`, `SF Pro`,
  `Segoe UI Variable`, `Segoe UI`, `Inter`, `Roboto`).
- Reading font equals the UI font. Transcripts and summaries use the reading
  column width (`820px`) and `line-height: 1.6`.
- Mono: `--pt-font-mono` for shortcuts, durations, and diagnostics.
- Scale: eyebrow `.pt-label` 11px uppercase tracked; row text 14px; section
  title `.pt-section-title` 15px semibold; page title `.pt-title` 28px
  semibold with `-0.02em` tracking; hero 22px.
- Titles use negative tracking. Body never does.

### Radii

| Token | Value | Use |
| --- | --- | --- |
| `--pt-radius-xs` | 8px | inputs, small buttons, icon wells |
| `--pt-radius-sm` | 12px | buttons, rows, menus |
| `--pt-radius` | 16px | cards, groups |
| `--pt-radius-lg` | 22px | hero cards, dialogs |
| `--pt-radius-pill` | 999px | chips, segmented controls, capture pill |

### Motion

- Easing `--pt-ease: cubic-bezier(.2,.8,.2,1)`, spring
  `--pt-ease-spring` for the record pulse.
- Durations `--pt-dur-fast` 120ms, `--pt-dur` 200ms, `--pt-dur-slow` 320ms.
- Page content enters with `.pt-enter` (fade and 6px rise, once).
- `.pt-pulse` animates the recording dot.
- `prefers-reduced-motion: reduce` disables all transitions and animations
  globally at the end of `globals.css`.

### Layout

- `--pt-sidebar-width` 236px, `--pt-sidebar-width-compact` 68px.
- `--pt-shell-sidebar` is set on `.pt-shell` and equals the current sidebar
  width. Fixed overlays (capture pill, status toasts) use
  `left: var(--pt-shell-sidebar)` so they centre on the content, never on the
  window.
- `--pt-content-max` 1040px for standard pages; `PageBody wide` allows 1240px.
- Under 880px the sidebar compacts automatically through a media query, in
  addition to the user toggle stored in `localStorage` (`pt.sidebar.compact`).
- The Tauri main window has a minimum size of 720 by 520.

## 3. Primitives

| Class | Purpose |
| --- | --- |
| `.pt-button` + `--accent` `--secondary` `--ghost` `--danger` `--sm` `--lg` `--pill` `--icon` | All buttons. One accent button per view. |
| `.pt-card` + `--interactive` `--glass` | Surfaces. Glass is for chrome that sits over content. |
| `.pt-group` / `.pt-row` + `--interactive` | Grouped settings and list rows, macOS System Settings style. |
| `.pt-badge` + tone modifiers | State chips. Use through `StateChip`, `PrivacyChip`, `SyncChip`. |
| `.pt-segmented` / `.pt-segmented__item` | View switchers and filters. Active via `aria-selected` or `aria-pressed`. |
| `.pt-input` | Text inputs and search. |
| `.pt-kbd` | Keyboard keys. |
| `.pt-nav-item` | Sidebar links. `aria-current="page"` styles the active item. |
| `.pt-label`, `.pt-title`, `.pt-subtitle`, `.pt-section-title`, `.pt-mono` | Type roles. |
| `.pt-scroll` | Thin, token-coloured scrollbars. |

React helpers in `frontend/src/components/AppShell/`:

- `AppShell` renders the skip link, `Sidebar`, and `MainContent`.
- `PageHeader({ eyebrow, title, description, actions })` and `PageBody`.
- `StateChip`, `PrivacyChip`, `SyncChip`.

## 4. Information architecture

Sidebar, top to bottom: wordmark (Home), `Record meeting`, `Import audio`
(only when the beta flag is on), Home, Library, then Account and sync,
Settings, version, compact toggle.

- **Home**: dictation hero with shortcut keys and live phase, readiness rows
  with remedies that deep link into Settings, and a unified Recent list.
- **Library**: meetings and dictations in one list grouped by day, with
  All / Meetings / Dictations filter and transcript search. Rename and delete
  live in a row menu. `/dictation-history` redirects here.
- **Meeting review**: Summary and Transcript views. "Guide this summary" is a
  disclosure inside Summary. One generate action, one save.
- **Account and sync**: sync state only. No sign-in in v1.
- **Settings**: one page grouped by intent, with an Advanced section for Beta,
  diagnostics, endpoints and API keys, and one About block.

## 5. Privacy and sync language

Use these labels verbatim, through `PRIVACY_LABELS` and `SYNC_LABELS` in
`frontend/src/lib/privacy.ts`:

- Privacy: `Stored only on this device`, `Processed on this device`,
  `Sent to a cloud provider`, `Synced to your account`,
  `Shared with your workspace`.
- Sync: `Local only`, `Syncing`, `Synced`, `Offline`, `Sync needs attention`.

A privacy chip appears wherever data leaves or could leave the device: next to
provider pickers, on the capture header, and on the Home hero.

## 6. Accessibility

- Every interactive element is a real `<button>` or `<a>`.
- Focus rings use `--pt-accent` at 2px with a 2px offset.
- Active navigation uses `aria-current`; segmented controls use
  `aria-selected`; toggles use `aria-pressed`.
- Live regions (`role="status"`) announce dictation phase and long operations.
- Icon-only controls always carry `aria-label`.
- Minimum body text is 12px for tertiary metadata and 13px for anything the
  user must read.

## 7. Do and do not

Do:

- Keep one accent action per screen.
- Prefer a row with a control over a card with a paragraph.
- State where data lives with a chip, not a sentence.
- Let the OS decide light or dark.

Do not:

- Add marketing copy, feature tours, or "coming soon" cards outside Account.
- Use `rounded-[3px]`, hardcoded greys, or dark pills on light pages.
- Centre fixed elements on the window; centre them on the content.
- Add new fonts, GSAP, WebGL, or custom cursors.
