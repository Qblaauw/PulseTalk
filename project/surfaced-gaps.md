# Surfaced gaps

- **medium** · G-2026-09-02-product-artifact-set · PulseTalq currently has a lean design, decisions, known-gaps, and plan set, but no canonical PRD, sitemap, workflows, tool-flow, roadmap shards, or rendered workspace. Scaffolding those artifacts is outside this requested refinement and needs an explicit product-structure decision.
- **medium** · G-2026-09-02-bun-test-types · `pnpm exec tsc --noEmit` reaches the pre-existing `frontend/tests/lib/blocknote-markdown.test.ts`, but `bun:test` types are not installed or excluded from product type checking. The dictation work needs a focused product type-check receipt until that baseline is repaired.
- **low** · G-2026-09-02-preview-snapshot · The collaborative preview can navigate to the port 3118 app, but `preview_snapshot` returned an unavailable error on both Home and Settings. Retry at final verification and use the webapp-testing fallback if the capability remains unavailable.
- **medium** · G-2026-09-02-settings-child-branding · Review found legacy blue and rounded child panels still rendered inside the new Settings shell; T6 ownership was expanded before completion to resolve the full surface.
- **low** · G-2026-09-02-home-tooltip · Review found the compact Home mark lacked the tooltip pattern used by adjacent controls; T6 will resolve it before completion.
