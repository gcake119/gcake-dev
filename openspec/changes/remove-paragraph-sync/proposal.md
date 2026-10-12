## Why

Paragraph synchronization authorization has been withdrawn. Executable integrations and current operating instructions must no longer restart that destination.

## What Changes

- Remove provider services, workflow, CLI commands, bindings and UI actions.
- Prepare and execute only Substack, rejecting retired targets before network access.
- Preserve historical migrations, receipts, remote identities and unsettled intentions without replay.
- Replace current integration documents with Substack and site RSS instructions.

## Capabilities

### New Capabilities

- retired-destination-safety: Substack-only operations with historical-state preservation.

### Modified Capabilities

## Impact

- Modified: apps/admin-worker/src/distribution-coordinator.ts, apps/admin-worker/src/publication-operations.ts, apps/admin-worker/src/router.ts, scripts/publishing/run-distribution.ts, scripts/publishing/prepare-distribution.ts, apps/admin/src/App.vue, package.json.
- Removed: apps/admin-worker/src/paragraph-provider.ts, apps/admin-worker/src/paragraph-gate.ts, apps/admin-worker/src/paragraph-newsletter.ts, .github/workflows/sync-paragraph.yml.
