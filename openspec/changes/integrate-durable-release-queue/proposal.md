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

## Authorized activation extension — 2026-10-12

The owner authorizes publication-conditioned Pages delivery, restricted deployment permissions, paired Worker/Actions automation credentials, reviewed merge/manual rollout, and activation after verification. Add Pages build/deploy jobs only when the release request returns a newly committed publication identity. Keep ordinary merge and empty hourly checks deployment-free. Preserve six finalized bodies/order; Hermes installation and Telegram remain outside this authorization.

## Authorized source reconciliation and worktree closeout, 2026-10-16

The owner authorizes committing existing gcake-dev work, necessary reviewed merges and safe worktree cleanup, without production operations. Preserve the previously implemented API-free first-article verifier and evidence rather than leaving its only source in a disposable worktree. Keep all current publication/notification behavior and controls. Retired Paragraph work is historical, not a feature to re-enable. Backup all non-rebuildable local evidence and unique branch history before cleanup.
