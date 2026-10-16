# safe-content-editor Specification

## Purpose

TBD - created by archiving change 'publishing-cms'. Update Purpose after archive.

## Requirements

### Requirement: Single cyclic view control
The Editor SHALL use one control that cycles exactly `markdown → rendered → split → markdown`, preserving the working source and practical cursor/reading positions across transitions.

#### Scenario: Complete view cycle
- **WHEN** the owner activates the view control three consecutive times from Markdown mode
- **THEN** the visible modes are Rendered, Split, and Markdown in that order without source loss

---
### Requirement: Resizable synchronized split view
Split mode SHALL default to a 50/50 ratio, provide a keyboard-operable draggable divider, persist the chosen ratio, synchronize scrolling by default, and allow synchronization to be disabled.

#### Scenario: Restore split preferences
- **WHEN** the owner changes the ratio, disables synchronized scrolling, and reopens the Editor
- **THEN** the prior ratio and synchronization preference are restored

---
### Requirement: Honest immediate rendering
Immediate preview SHALL render portable Markdown content with public-site content styles and SHALL surface a limitation for unsupported MDX instead of rendering a misleading substitute.

#### Scenario: Unsupported interactive MDX
- **WHEN** the working source contains an MDX construct unavailable to immediate preview
- **THEN** the Editor identifies the limitation and offers Formal Astro Preview while retaining the source

---
### Requirement: Revision-keyed browser recovery
Browser autosave SHALL be separate from Git save and keyed by repository, article slug, and base revision.

#### Scenario: Repository changed after autosave
- **WHEN** a local draft exists for an older base revision and the repository article has changed
- **THEN** the Editor enters recovery/conflict handling and does not apply the draft silently over the newer source

---
### Requirement: Optimistic concurrency on formal saves

Post writes and every series create, update, rename, and delete operation SHALL include the expected repository base revision. Post and existing-series writes SHALL include the expected blob SHA. Series creation and rename targets SHALL assert that the target path is absent. The Worker SHALL return HTTP 409 with `ARTICLE_CONFLICT` or `SERIES_CONFLICT` when any current revision or target-presence expectation differs, without creating a commit.

#### Scenario: Codex changes an open article

- **WHEN** Codex commits a newer article blob after the CMS loaded its base SHA and the owner saves from the CMS
- **THEN** the Worker creates no overwrite commit and returns current revision information for diff, reload, or manual resolution

#### Scenario: Another source changes an open series

- **WHEN** another source commits a newer series manifest after the CMS loaded its base SHA and the owner updates, renames, or deletes from the CMS
- **THEN** the Worker creates no overwrite commit and returns HTTP 409 `SERIES_CONFLICT` with current revision information

#### Scenario: Rename target appears concurrently

- **WHEN** a target series slug becomes present after the CMS uniqueness check but before the rename transaction
- **THEN** the Worker creates no commit and returns HTTP 409 `SERIES_CONFLICT`


<!-- @trace
source: complete-series-crud
updated: 2026-10-16
code:
  - apps/admin-worker/src/release-queue.ts
  - apps/admin-worker/src/router.ts
  - src/lib/content/catalog.ts
  - apps/admin-worker/src/git-writes.ts
  - packages/admin-contract/src/index.ts
  - apps/admin-worker/src/release-delivery.ts
  - docs/worktree-closeout/2026-10-16/README.md
  - apps/admin/src/series-editor.ts
  - apps/admin-worker/src/series-validation.ts
  - src/lib/content/series-membership.ts
  - docs/publishing-cms-implementation-design.md
  - package.json
  - apps/admin/src/admin.css
  - apps/admin/src/App.vue
  - apps/admin-worker/src/github.ts
tests:
  - apps/admin-worker/src/release-queue.test.ts
  - packages/admin-contract/src/contract.test.ts
  - apps/admin-worker/src/git-writes.test.ts
  - apps/admin/src/series-editor.test.ts
  - src/lib/content/series-membership.test.ts
  - apps/admin-worker/src/series-validation.test.ts
  - apps/admin-worker/src/content-routes.test.ts
  - apps/admin/src/post-series.test.ts
  - scripts/workspace/public-visibility.test.ts
  - apps/admin-worker/src/github.test.ts
  - apps/admin-worker/src/save-routes.test.ts
  - apps/admin/src/foundation.test.ts
-->

---
### Requirement: Coherent repository commits

Operations that change an article and related series manifest, or rename a series manifest path and internal identity, SHALL validate all source first and create one Git tree/commit transaction against the expected base commit.

#### Scenario: Create series article

- **WHEN** a new article joins a series and both the post and manifest validate against the expected revisions
- **THEN** one commit contains both changes, or no repository file changes if the transaction fails

#### Scenario: Rename series identity

- **WHEN** an existing series changes from `old-series` to the available slug `new-series` and all revisions validate
- **THEN** one commit deletes the old manifest path and creates the new manifest path with internal slug `new-series`, or no repository file changes if the transaction fails


<!-- @trace
source: complete-series-crud
updated: 2026-10-16
code:
  - apps/admin-worker/src/release-queue.ts
  - apps/admin-worker/src/router.ts
  - src/lib/content/catalog.ts
  - apps/admin-worker/src/git-writes.ts
  - packages/admin-contract/src/index.ts
  - apps/admin-worker/src/release-delivery.ts
  - docs/worktree-closeout/2026-10-16/README.md
  - apps/admin/src/series-editor.ts
  - apps/admin-worker/src/series-validation.ts
  - src/lib/content/series-membership.ts
  - docs/publishing-cms-implementation-design.md
  - package.json
  - apps/admin/src/admin.css
  - apps/admin/src/App.vue
  - apps/admin-worker/src/github.ts
tests:
  - apps/admin-worker/src/release-queue.test.ts
  - packages/admin-contract/src/contract.test.ts
  - apps/admin-worker/src/git-writes.test.ts
  - apps/admin/src/series-editor.test.ts
  - src/lib/content/series-membership.test.ts
  - apps/admin-worker/src/series-validation.test.ts
  - apps/admin-worker/src/content-routes.test.ts
  - apps/admin/src/post-series.test.ts
  - scripts/workspace/public-visibility.test.ts
  - apps/admin-worker/src/github.test.ts
  - apps/admin-worker/src/save-routes.test.ts
  - apps/admin/src/foundation.test.ts
-->

---
### Requirement: Guarded destructive deletion
Article deletion SHALL require explicit confirmation, report series references, and block deletion while unresolved references remain; it SHALL NOT delete R2 objects automatically.

#### Scenario: Referenced article deletion
- **WHEN** the owner requests deletion of a post still referenced by a series manifest
- **THEN** deletion is blocked until the manifest is coherently updated or the operation is cancelled

---
### Requirement: Editable AI slug suggestion

The Editor SHALL place an explicit slug generation control next to the article title and slug fields for new and existing articles, fill the editable slug field on success, and preserve user control over the final value.

#### Scenario: User edits a suggestion

- **WHEN** the service returns `add-gherkin-to-sdd-workflow` and the user changes it to `gherkin-sdd-acceptance-workflow`
- **THEN** the manually edited value remains the value submitted to existing CMS validation

#### Scenario: Title changes after slug exists

- **WHEN** an article already has a slug and the user modifies its title
- **THEN** the Editor does not request or apply another suggestion until the user explicitly activates `產生 slug`

---
### Requirement: Existing validation remains authoritative

AI suggestions SHALL pass through the existing slug format and duplicate validation during formal save, and generation SHALL NOT decide uniqueness.

#### Scenario: Suggested slug already exists

- **WHEN** a generated suggestion conflicts with an existing article slug and the user attempts to save it
- **THEN** the existing CMS validation blocks the duplicate and creates no Git commit

---
### Requirement: Production GitHub writes remain bounded and atomic

The Worker SHALL use the configured GitHub App installation credentials to perform content saves without persisting credentials or exposing a generic arbitrary-path deletion API, and SHALL make content changes visible through exactly one non-force default-branch ref update after optimistic checks pass.

#### Scenario: Save through the production Worker

- **GIVEN** the Worker has valid GitHub App installation credentials and the article base commit is current
- **WHEN** the authenticated owner saves an article
- **THEN** the Worker creates the required Git objects and advances the default branch once without exposing the installation token

#### Scenario: Branch changes during a save

- **GIVEN** another writer advances the default branch after the CMS read its base commit
- **WHEN** the CMS attempts its non-force ref update
- **THEN** the save returns a conflict and does not overwrite the newer branch head

---
### Requirement: Slug rename preserves every series reference

When an existing local article slug changes, the Worker SHALL update every matching series post entry and editorial pointer in the same Git transaction as creating the new post path and removing the old post path.

#### Scenario: Rename an article referenced by multiple series locations

- **GIVEN** `old-slug` is referenced by series post entries and an editorial pointer
- **WHEN** the owner saves the article as `new-slug`
- **THEN** the new post path, old post removal, and all affected series manifests become visible in one commit with every reference changed to `new-slug`

#### Scenario: Referencing series changed concurrently

- **GIVEN** a referencing series manifest no longer has the blob SHA read for the rename
- **WHEN** the owner attempts to save the new slug
- **THEN** the rename is rejected as a conflict and neither post path nor any series reference changes