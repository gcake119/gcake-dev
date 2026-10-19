## Context

The 2026-10-19 HTML audit and its owner-approved revision require at most two buttons per operation context and plain wording. Existing App.vue renders overview, post, and series modes; ReleaseQueuePanel.vue owns queue operations. Existing saves and publication APIs already guard concurrency and confirmation. Current unrelated Substack backend work is excluded. The isolated clone /private/tmp/gcake-admin-ux-20261019 is based on 57a03b6. An empty managed worktree was created then archived because the sandbox did not allow writes there. Initial Spectra artifacts live in the primary repository; synchronized copies and implementation live in the clone. Only this change's artifacts are owned in primary.

## Goals / Non-Goals

**Goals:** Implement focused article/series/publishing navigation, bounded action groups, cyclic icon view switching, plain feedback, source-preserving navigation, and responsive long-form editing.

**Non-Goals:** No backend/API/schema, provider writes, migrations, CI, package, public article, commit, push, deployment, or live publication changes. No new auto-save mechanism, new routing library, analytics, WYSIWYG editor, or AI feature.

## Decisions

### Focused navigation with persistent loaded queue
Keep the existing same-page workspace modes and introduce an overview section selector for articles, series, and publishing. Keep ReleaseQueuePanel mounted using visibility rather than remounting on each navigation, and add a summary mode that displays only the next article, time, attention count, and a navigation link. Persist list filtering and return position. Reject a routing dependency because same-page state is sufficient.

### Two-button contextual disclosure
Use native details/summary for settings and grouped record actions, keeping semantics and keyboard use. Every real action group has a maximum of two buttons; More actions counts as a button when used. Native summary discloses content, never performs a mutation. Editor toolbar contains 儲存文章 alone. Two SVG tools expose cyclic view switching and direct media entry. Save/finalization errors retain the draft. Existing confirmations remain. Group media actions by insertion versus asset management, conflict actions by version choice versus manual resolution, and queue actions by selected article versus series scope. Do not split one task into cosmetic wrappers to evade the limit.

### Plain language and truthful states
Add small presentation helpers for content, preview, publication, and error states, reusing existing release/deployment helpers. Translate known states and use a plain unknown fallback. Never display raw backend errors containing implementation details in daily UI; preserve actionable safe messages for conflicts, missing dates, unavailable helper and provider failures. Do not change owner-authored source/URLs or API payload values. Existing provider names are allowed. Normal labels hide Git, YAML, SHA, source paths, status codes, and internal section IDs; advanced structural identifiers remain editable under plain labels with explanations.

### Cyclic view switching with source position retention
**Owner revision**: restore the canonical Single cyclic view control requirement.
Store cursor and source/preview scroll positions before replacing view surfaces, restore after nextTick, and retain split ratio/sync storage. Share the cyclic transition helper with EditorState and bind one accessible SVG button in App.vue; formal preview is separately disclosed with plain copy and unchanged API inputs.

### Responsive focused editor
Use existing semantic tokens and system sans. Keep existing light/dark preference. The physical scene is the owner editing long technical articles on a laptop during both day and evening; preserve the current selectable themes. Reduce heading scale in workspaces, keep the save toolbar sticky with solid surface and focus scroll padding, put settings after the body in disclosure sections, and stack content at the current small-screen breakpoint. Locked ordering renders ordinal numbers and reason text without drag controls.

## Implementation Contract

- In scope: App navigation/toolbar/settings/recovery/media layout, ReleaseQueuePanel summary/detail/actions, existing presentation copy, view state transitions, targeted acceptance tests, and shared design documentation.
- Interfaces: existing Worker endpoints and payloads remain byte-compatible. workflow-presentation.ts exports presentation-only helpers. EditorState.setView(view) changes view alone. Queue summary communicates navigation via a view-publishing event, while loaded still supplies QueueView. No second editable copy of content or queue data is introduced. QueueView does not expose override ownership; only a successful current-session fixed-time action supplies cancellation evidence. A refresh or another action clears it, and elapsed slots are not cancellable through that presentation marker. Unknown fixed state is explained rather than guessed.
- Buttons: use semantic action-group labels for rendered acceptance checks. Editor = save; body tools = cycle-view/insert-image; series = save/add-section; creation = create/cancel with slug suggestion disclosed separately; queue rows = details/more disclosure; date preview = preview/cancel, date confirmation = confirm/back; media insertion/management are distinct selected-asset tasks. All groups are checked by rendering real Vue templates, not by matching source strings.
- Failure modes: the inline continue-editing choice keeps article/series source and workspace; revision conflict retains existing working content and recovery; save/finalize busy states suppress duplicate submissions; unknown states display 狀態待確認; backend technical errors use a plain actionable fallback. No error promotes public status or retries publication automatically.
- Acceptance: derive workflow-acceptance.test.ts from every new requirement, compile actual Vue components with the installed Vue compiler and render them with Vue's existing server renderer for structural assertions; exercise state transitions at existing logic seams. A bounded local browser session uses synthetic responses only for interaction, focus, narrow layout, and save-conflict observations. Extend existing node:test suites; no new mandatory layer/dependency/CI.
- Gate: spectra analyze and validate, Admin test/build, root check and affected required workspace/public gates before any push; no push is authorized in this task. Preserve passing evidence when inputs match. Record exact commands/results and browser limitations in this change's verification notes before completion.

## Risks / Trade-offs

- Hidden controls reduce immediate discoverability → clear settings headings and action-specific entry labels; retain visible exception counts.
- Source-string foundation tests assert old labels/layout → replace affected assertions with rendered behavior assertions; retain explicit architecture/security source checks.
- SSR cannot prove layout/focus → bounded local browser verification complements existing unit suites; never call SSR human/provider acceptance.
- Dirty primary repository → code stays in the owned worktree, only this change's Spectra artifacts are written in primary; recheck dirty scope at handoff.

## Migration Plan

No data migration. Deliver uncommitted local worktree changes for review. A later authorized deployment uses the existing release process; rollback is the prior frontend build with unchanged APIs and data. No runtime or scheduler cutover is included.

## Open Questions

None required for implementation. Commit, deployment, and independent human acceptance remain outside current authorization.

### Revised metadata and media hierarchy
Use section headings for basic details and article URL, and a separate Other management disclosure for backup and deletion. Keep website preview and publication separate. The media icon opens the existing dialog directly; reuse image paste/drop handlers inside it, focus the dialog on entry and restore the icon on close. No extra dependency or verification layer.

### Adopted Admin visual foundations
The owner edits long drafts on a laptop in daylight and evenings and checks articles on a phone; retain the existing selectable light/dark themes. Adopt the report as durable design rules in DESIGN.md and docs/design-system.md. Use semantic CSS size/spacing variables in the current Admin stylesheet and queue scoped styles, replacing redundant overrides rather than adding another parallel theme. Keep 17px input text independent of 14px labels. Bound rendered reading content to 44rem while retaining split overflow behavior for code/tables.

### Shared theme and SVG contracts
Move existing icon path data to src/components/icon-paths.ts; Astro and Vue render the same data, preserving existing auxiliary circles and paths. Add eye/split/code/image paths to that map for existing editor tools. No icon library or wrapper component is needed. Move overlay color into root variables, preserving current values in both themes. Status text uses explicit labels and body-sized failures.

## Adopted supplement implementation contract
- Source: owner-approved design-conformance-report.html; durable authority is the adopted supplement in docs/design-system.md, with DESIGN.md as entry point. No new ADR subsystem is introduced because existing decisions are recorded in these design documents and Spectra.
- In scope: Admin and queue CSS, shared SVG data, Icon.astro path lookup, App.vue SVG bindings, design documents and existing acceptance tests. Out of scope: public layout/color changes, business/API changes, dependencies, new CI, commit/push and deployment.
- Observable contract: exact documented role sizes, setting gaps/gutters and shared theme values; four desktop/mobile × light/dark combinations preserve draft text, two-button contexts, keyboard focus and media entry.
- Verification: first run browser assertions of the adopted computed sizes against the old local build and save the actual RED mismatches. This is the cheapest sufficient acceptance seam for visual CSS behavior; SSR cannot prove computed layout. Reuse existing Admin tests for behavior, astro check, Admin/public build for shared icon extraction, and the same local browser for final visual checks. No new mandatory test layer or dependency. Public icon path data must remain identical after extraction.
- Failure: long text wraps or stays within its intended scroll surface; conflict/media errors retain draft text and use readable body text in either theme. No styling change sends a write or promotes a saved status to public.

Delivery refinement: after the owner adopted the design supplement, the owned DESIGN.md and docs/design-system.md are also synchronized into primary. Application changes and shared icon code remain in the isolated clone; unrelated primary changes remain untouched.

### Media action section spacing
The header has no bottom margin and the following hint has zero top margin, leaving the action row touching its next section. Give the media header an explicit 16px bottom margin using the existing space token; preserve the existing 8px button gap and all upload behavior. Measure actual row-to-hint boundaries in all four viewport/theme combinations.

Mobile action rows previously used space-between, producing 147px instead of the documented 8px gap. Align the two actions together at the end of their row; actual geometry remains the acceptance authority.
