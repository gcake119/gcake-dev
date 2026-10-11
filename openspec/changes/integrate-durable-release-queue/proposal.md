## Why

The approved Monday/Thursday policy has only pure planning helpers. The CMS needs durable, observable release operations before unattended delivery can be accepted.

## What Changes

- Add snapshot ingestion, immutable ready timestamps, reservations, fenced leases and safe Git publication.
- Expose queue workflows in the existing Admin and integrate disabled Actions orchestration.
- Verify public pages/RSS and provide a restart-safe Hermes notification runner.

## Capabilities

### New Capabilities

- `durable-release-queue`: Eligibility, runtime state, delivery, operator workflows and notification evidence.

### Modified Capabilities

None. Existing publication visibility and external provider gates remain intact.

## Impact

- New Worker release modules and migration, shared release contract, Actions runner and RSS poller.
- Modified Admin Editor, Series and Publishing views; GitHub snapshot reader and Worker router.
- No article body or manifest-order edits; no production activation, commit, push or deployment.
