## Why

Series manifests remain the repository source of truth, but the Admin only edits sections and article order. Owners still need direct YAML edits or an AI coding workflow to create, rename, or delete a series, which leaves routine publishing incomplete and makes slug changes especially prone to stale routes or references.

## What Changes

- Add Series list actions to create a series, edit its display name and slug, show article counts, and delete a series with explicit confirmation.
- Extend the Series API and Git write boundary for create, metadata update, atomic slug rename, and manifest deletion.
- Preserve optimistic concurrency for every mutation and reject duplicate or stale revisions without creating a commit.
- Treat deleting a series as deleting only its manifest so referenced Markdown posts remain and become standalone posts.
- Keep series identity, route generation, navigation, and derived indexes consistent after rename or deletion.
- Add public-site and Admin regression coverage for create, rename, delete, conflicts, routes, standalone fallback, tests, and builds.

## Capabilities

### New Capabilities

- `series-lifecycle-management`: Create, rename, and delete Git-backed series manifests safely from the Publishing Admin.

### Modified Capabilities

- `safe-content-editor`: Extend optimistic-concurrency and coherent Git transaction requirements to full series lifecycle operations.
- `admin-runtime`: Extend the Admin and Worker runtime contract with complete Series CRUD while preserving public-site build behavior.

## Impact

- Affected specs: series-lifecycle-management, safe-content-editor, admin-runtime
- Affected code:
  - New: none
  - Modified: apps/admin-worker/src/router.ts, apps/admin-worker/src/save-routes.test.ts, apps/admin-worker/src/series-validation.ts, apps/admin-worker/src/series-validation.test.ts, apps/admin-worker/src/git-writes.ts, apps/admin-worker/src/git-writes.test.ts, apps/admin-worker/src/github.ts, apps/admin-worker/src/github.test.ts, apps/admin/src/App.vue, apps/admin/src/series-editor.ts, apps/admin/src/series-editor.test.ts, apps/admin/src/admin.css, packages/admin-contract/src/index.ts, packages/admin-contract/src/contract.test.ts, src/lib/content/catalog.ts, scripts/workspace/public-visibility.test.ts, scripts/content/validate-series.ts, docs/publishing-cms-implementation-design.md
  - Removed: none
