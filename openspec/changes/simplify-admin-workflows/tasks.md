## 1. Acceptance first

- [x] 1.1 Add failing rendered and state acceptance tests for Focused workspace navigation, Two-button operation contexts, Plain interface language, Source-preserving editing and feedback, Contextual scheduling and locked series, Accessible responsive workspaces, and Direct view selection; supersede Single cyclic view control assertions without weakening source-retention coverage. Verify the expected RED failures in workflow-acceptance.test.ts before UI implementation.

## 2. Focused editing

- [x] 2.1 Implement Focused navigation with persistent loaded queue in App.vue and ReleaseQueuePanel.vue: article default, separate article/series/publishing views, compact queue summary, disclosed creation forms, filter/return-position retention and discard protection. Verify focused-navigation and unsaved-navigation acceptance cases.
- [x] 2.2 Implement Plain language and truthful states in workflow-presentation.ts and existing presentation/copy modules; retain backend values and return honest unknown/conflict feedback. Verify plain-copy, unknown-state, saved-not-public and existing presentation suites.
- [x] 2.3 Implement Direct view selection with source position retention in EditorState and App.vue: native mode selector, save/preview toolbar, cursor/scroll restoration and split-only synchronization; protect duplicate save/finalize submissions. Verify direct-view, position-retention and busy/conflict tests.
- [x] 2.4 Implement Two-button contextual disclosure across article/series creation, editor settings, recovery, media and section controls, preserving explicit deletion/publication confirmation. Verify rendered action-group limits and cancel-without-write behavior.

## 3. Publishing and layout

- [x] 3.1 Implement Contextual scheduling and locked series: per-article disclosure, series-scoped pause/resume once per series, separate time-preview/confirmation stages, known-fixed cancellation only, read-only ordinal locked lists. Verify queue-action, fixed-slot, date-preview and locked-series acceptance cases.
- [x] 3.2 Implement Responsive focused editor styling with existing tokens, reduced workspace headings, solid sticky two-action toolbar, focus scroll padding, disclosed settings and narrow single-column layout. Verify Admin build plus browser checks at desktop/390px and both themes without provider writes.

## 4. Verification and handoff

- [x] 4.1 Replace affected foundation source-string assertions with rendered observable coverage while retaining architecture checks; document shared UI rules in docs/design-system.md. Verify the complete Admin suite, affected workspace/public checks, root type check and builds; record real failures and fixes without manufacturing CI evidence.
- [x] 4.2 Record local browser acceptance for navigation, view/source retention, two-button groups, unsaved-discard cancellation, conflict recovery, long draft focus and locked series; rerun spectra analyze and validate, inspect final diff/dirty ownership, and record limits in verification.md. No commit, push, deployment, provider writes or independent-human acceptance claim.

## 5. Owner refinement

- [x] 5.1 Add failing acceptance coverage for the cyclic SVG tools, direct media entry, settings hierarchy, media paste/drop success and failure; retain source-position coverage.
- [x] 5.2 Implement the shared cyclic transition, remove duplicate preview and wire direct SVG media entry with paste/drop and focus restoration.
- [x] 5.3 Implement Article settings hierarchy: regroup article metadata and separate other management; update design documentation.
- [x] 5.4 Verify affected Admin tests, types/build and desktop/narrow browser behavior; record evidence and synchronize only owned artifacts.

## 6. Adopted design supplement

- [x] 6.1 Publish Adopted Admin visual foundations and Shared theme and SVG contracts in DESIGN.md, docs/design-system.md and Spectra with normal, failure and narrow-boundary Gherkin; verify spectra analyze/validate before application edits and capture computed-style RED against the previous build.
- [x] 6.2 Implement Adopted Admin visual foundations in Admin/queue CSS: role sizes, spacing, gutters, reading width, 44px controls and 5px radii; implement Shared theme and SVG contracts with root overlay and shared path data while retaining public icon geometry. Verify Admin acceptance and shared icon rendering/build.
- [x] 6.3 Verify Desktop settings hierarchy, Mobile long title and long draft, Four visual combinations and Visible failure feedback in both themes using actual local browser computed styles/screenshots; run required affected type/build/test gates, record evidence and synchronize owned design/spec files without deployment.
