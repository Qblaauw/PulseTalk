## Scope brief: immersive dark audio studio UI

> **Goal:**
> `/goal Redesign every shipped PulseTalq screen as an accessible immersive dark audio studio, removing Inbox and Projects rather than completing them; done when core features are easy to discover, keyboard and screen-reader flows pass an accessibility review, motion respects user preferences, and the redesigned capture-to-summary journey passes visual and interaction QA.`

### 1. Objective

Replace the dated, fragmented interface with one coherent desktop experience that feels like a focused audio workspace. Make recording, dictation, transcript review, summaries, history, settings, and onboarding easier to find and operate without weakening PulseTalq's local-first character.

The redesign should reduce navigation ambiguity and make the app's current state immediately legible: ready, listening, transcribing, processing, complete, or blocked.

### 2. In scope

- Audit the current information architecture, feature discoverability, visual consistency, interaction feedback, and accessibility.
- Redesign every shipped user-facing screen and shared shell, including onboarding, home and capture, live transcript, recording controls, meeting history and details, summaries, settings, model management, import and recovery flows, dictation history, and the dictation overlay.
- Establish an immersive dark audio-studio visual system with clear hierarchy, restrained depth, responsive audio visualization, and purposeful motion.
- Consolidate navigation so every retained primary feature has an obvious home and common actions remain close to the user's current task.
- Treat accessibility as part of the interaction design: full keyboard operation, visible focus, semantic names and structure, sufficient contrast, non-color state cues, reduced-motion behavior, scalable text, and usable target sizes.
- Remove Inbox and Projects from navigation and delete their unfinished route implementations. Remove or revise links, labels, and empty-state copy that imply those features are available.
- Implement the redesign in the existing Next.js and Tauri frontend and verify it in the desktop app.

### 3. Out of scope

- Building or completing Inbox, Projects, project organization, or capture triage.
- Changing transcription, recording, summary generation, persistence, or audio-pipeline behavior except where a small UI-facing adjustment is required to present existing state correctly.
- Introducing a separate backend or reviving the archived FastAPI application.
- Adding unrelated product features as part of the visual modernization.
- Rebranding PulseTalq beyond the interface system needed for the dark audio-studio direction.

### 4. Deliverables

| Artifact | Format / location | Notes |
|----------|-------------------|-------|
| Current-state UX and accessibility audit | Markdown under `project/` | Inventory retained features feature paths, discoverability problems, accessibility failures, visual inconsistencies, and recommended priorities. |
| Information architecture and navigation specification | Markdown and diagrams under `project/` | Define the retained destinations, contextual actions, settings organization, and removal of Inbox and Projects. |
| UI design specification | Root `DESIGN.md` or the repository's established design-spec location | Define tokens, typography, density, depth, states, audio visualization, motion, focus treatment, component behavior, and responsive rules for the immersive dark audio-studio direction. |
| Implemented application shell and shared components | `frontend/src/app`, `frontend/src/components`, and shared styles | Apply one navigation, layout, feedback, and interaction language across the desktop app. |
| Redesigned retained workflows | Existing frontend routes and components | Cover onboarding, capture, live transcription, dictation, history, meeting review, summaries, settings, import, recovery, and model management. |
| Inbox and Projects removal | Navigation definitions plus `frontend/src/app/inbox` and `frontend/src/app/projects` | Remove the unfinished destinations and all user-facing references without implementing replacement behavior. |
| Verification evidence | Tests, accessibility results, screenshots, and a commit-scoped handoff | Attach automated and manual evidence to the exact implementation commit. |

### 5. Constraints

- Keep the existing Next.js, React, Tailwind, Radix/shadcn, Framer Motion, and Tauri architecture unless planning proves a small dependency change necessary.
- Preserve local-first recording, transcription, and summary behavior.
- Use the current Rust/Tauri commands and events. Do not add new behavior to the archived FastAPI backend.
- Support Windows and macOS desktop interaction patterns and layouts at the app's supported window sizes.
- Use a dark interface as the primary authored experience. Contrast and legibility take priority over decorative glow, blur, transparency, or animation.
- Respect `prefers-reduced-motion`; existing shared styles already provide a global reduced-motion rule in `frontend/src/app/globals.css`.
- Follow the repository's task-owned worktree, integration-branch, checkpoint, and commit-scoped verification rules.

### 6. Success criteria

- [ ] A first-time user can identify how to start a meeting recording, use dictation, find past meetings, review a transcript, generate or edit a summary, import audio, and open settings without hidden or duplicate navigation paths.
- [ ] Every retained primary destination is reachable from the shared shell in no more than two deliberate interactions.
- [ ] All retained workflows can be completed by keyboard, with logical focus order, visible focus, no keyboard traps, and correctly restored focus after dialogs.
- [ ] Screen-reader checks find meaningful landmarks, headings, control names, status announcements, and error associations on core workflows.
- [ ] Text, icons, controls, focus indicators, and state treatments meet WCAG 2.2 AA contrast expectations; state is never communicated by color alone.
- [ ] Controls have usable target sizes, text remains functional at 200% zoom, and content does not disappear at supported compact window sizes.
- [ ] Motion explains recording and processing state, avoids decorative churn, and becomes effectively static when reduced motion is requested.
- [ ] Inbox and Projects no longer appear in navigation, routing, shortcuts, onboarding, empty states, or other user-facing copy.
- [ ] Existing recording, transcription, meeting review, summary, import, recovery, dictation, and settings behavior still passes relevant automated tests and manual smoke checks.
- [ ] Representative screenshots show a coherent dark audio-studio system across onboarding, idle home, active recording, meeting details, settings, and dictation states.

### 7. Audience and context

The primary audience is a desktop user who records meetings or dictates into other applications and expects local, private transcription. The work covers the full shipped PulseTalq desktop client, not a single page or a marketing site.

### 8. Open assumptions

- No delivery deadline or fixed implementation budget was supplied. Planning should divide the work into reviewable slices while preserving the whole-app target.
- The success thresholds above are the proposed definition of done. The user asked for "all of it" but did not provide numeric usability or accessibility targets, so planning should treat these checks as binding unless the user vetoes them.
- The immersive dark theme is the primary experience. A separate light-theme redesign is not required unless current product requirements or platform behavior make it necessary.
- "Remove Inbox and Projects" means deleting their unfinished route implementations and references, not merely hiding sidebar entries.

### 9. Confidence

| Area | Band | Score | Evidence |
|------|------|-------|----------|
| Objective | Certain | 96 | User requested improvements to "total accessibility to features" and how immersive the app feels, and said it currently feels "very two thousand esque era." |
| Boundaries | Certain | 96 | User confirmed every user-facing screen and explicitly said to "remove inbox, and projects" because they are not ready. |
| Deliverables | Confident | 90 | When asked to choose between an audit and roadmap or implementation plus removal, the user answered "all of it." |
| Constraints | Leaning | 74 | The user selected "immersive dark audio studio"; `CLAUDE.md` fixes the app architecture as Next.js plus Rust/Tauri. Deadline and budget remain unstated. |
| Success | Leaning | 72 | The accessibility and interaction thresholds are proposed from the stated objective and current UI technology, not explicitly accepted by the user. |
| Audience | Confident | 90 | `CLAUDE.md` identifies a Tauri desktop application, and the user confirmed that the redesign covers every user-facing screen. |

### 10. User notes captured during scoping

- "yes. also remove inbox, and projects,As inbox and projects are not ready yet to be integrated."
- "all of it"
- "immersive dark audio studio"

### 11. Calibration log

Empty at initial issue.
