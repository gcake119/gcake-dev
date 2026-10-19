## Summary

Simplify the Publishing Admin into focused article, series, and publishing workspaces with at most two action buttons per operation context and plain Traditional Chinese interface wording.

## Motivation

The approved 2026-10-19 audit found that full release controls obscure article discovery, save/delete/publish controls compete in the editor, and technical status values leak into everyday tasks. The owner explicitly authorized the updated report, specification, acceptance scenarios, then implementation.

## Proposed Solution

- Default to the article list; separate Articles, Series, and Publishing navigation while retaining a compact release summary and attention signal.
- Limit every operation action group, including expanded forms and media/recovery controls, to two buttons. Navigation and form fields remain semantic navigation and inputs, not disguised mutation buttons.
- Keep Save article alone in the editor toolbar; move exceptional operations into progressively disclosed settings. Use one SVG icon to cycle views and another to open the media library directly.
- Translate labels, errors, statuses, and confirmation copy into plain Traditional Chinese; retain provider names but keep storage implementation, revision parameters, and raw status codes out of everyday controls.
- Preserve unsaved drafts, concurrency failures, split preferences, ordering locks, existing API contracts, release evidence boundaries, and explicit publication/deletion confirmation.

## Capabilities

### New Capabilities

- `focused-admin-workflows`: focused navigation, bounded contextual action groups, plain wording, progress disclosure, responsive editing, and truthful save/publication feedback.

### Modified Capabilities

- `safe-content-editor`: refine Single cyclic view control with SVG accessibility and source/cursor/reading-position retention.

## Impact

- Affected specs: focused-admin-workflows and safe-content-editor.
- Affected code:
  - Modified: `apps/admin/src/App.vue`, `apps/admin/src/ReleaseQueuePanel.vue`, `apps/admin/src/admin.css`, `apps/admin/src/editor-state.ts`, `apps/admin/src/deployment.ts`, `apps/admin/src/release-presentation.ts`, `apps/admin/src/manual-release.ts`, `apps/admin/src/series-editor.ts`, `apps/admin/src/scheduling.ts`, `apps/admin/src/slug-suggestion.ts`, `apps/admin/src/foundation.test.ts`, `apps/admin/src/editor-state.test.ts`, `apps/admin/src/deployment.test.ts`, `apps/admin/src/release-presentation.test.ts`, `apps/admin/src/manual-release.test.ts`, `apps/admin/src/series-editor.test.ts`, `apps/admin/src/scheduling.test.ts`, `apps/admin/src/slug-suggestion.test.ts`, `docs/design-system.md`.
  - New: `apps/admin/src/workflow-presentation.ts`, `apps/admin/src/workflow-acceptance.test.ts`.
- No API, Worker, publication-policy, dependency, CI, content, production, commit, or deployment changes. Existing unrelated dirty files remain outside this work.

## Owner refinement（2026-10-19）
Single cyclic SVG view control replaces the first implementation’s direct selector. Remove duplicate preview action. A second SVG tool opens the media library directly with paste/drop support. Regroup article settings into basic details, article URL and separate other management.

## Adopted design supplement（2026-10-19）
The owner adopted design-conformance-report.html and authorized project design documents, specs/Gherkin first, followed by Admin styling and four-combination visual verification without deployment. Scope adds documented typography/spacing, semantic overlay/status tokens and shared SVG data with framework-specific rendering. Public icon geometry remains unchanged; public layout, content and publishing behavior stay out of scope.

Adopted supplement files: DESIGN.md, docs/design-system.md, apps/admin/src/admin.css, ReleaseQueuePanel.vue, App.vue, src/components/Icon.astro and the new src/components/icon-paths.ts. Existing public icon geometry and public layout/color values are retained.
