## Why

Substack currently waits for a verified public Pages article and requires foreground publication, so finished articles still need intervention at release time. The owner explicitly chose advance drafts and provider-owned scheduling, accepting Substack publication and first email/App delivery even when Pages deployment fails.

## What Changes

- **BREAKING** Introduce an explicit scheduled-delivery policy that permits finalized Git content to be prepared before Pages is public; the existing Pages-first/no-newsletter policy is not silently reinterpreted.
- Prepare one persistent Substack draft per source identity, set the identical source slug, then arm a confirmed future Taipei-time schedule with email and App inbox delivery enabled for the first publication only.
- Reuse the existing release queue for source eligibility and dates. Estimated slots may prepare drafts but cannot arm provider publication until explicitly committed; provider scheduling never invents a second editorial calendar.
- Reconcile source revisions, delays and cancellations on the same remote ID. Disarm and verify removal of the old schedule before modifying content or rearming; unknown outcomes stop writes rather than create, publish or send again.
- Compare the current authoritative Git article with the actual saved Substack draft or public article, edit the original remote article when content differs, and reload/reverify before declaring synchronization. Cover unscheduled drafts, armed drafts and already published articles; equal content is a no-write result, and source changes during editing invalidate the result rather than silently reporting an old version as current.
- Preserve browser-free background rounds: foreground operations prepare/change provider state, Substack performs the timed publication, and background work reads current Git/D1/public evidence and raises existing attention when foreground reconciliation is needed.
- Separate source, saved draft, armed schedule, public verification and provider delivery evidence. Pages failure is reported independently and does not cause a Substack resend or false combined completion.
- Preserve existing public IDs and no-backfill delivery for the three already published articles; migration and rollback reconcile all armed or uncertain provider schedules before declaring them stopped.

## Capabilities

### New Capabilities

- `substack-scheduled-publication`: Advance draft preparation, explicit schedule commitments, source-authoritative content comparison and same-ID editing for drafts and public articles, revision/reschedule/cancel operations and uncertain-operation recovery.

### Modified Capabilities

- `publishing-operations`: Source-slug parity before Pages availability, explicit first-delivery authority, independent publication/delivery evidence and compatible durable state.
- `quiet-background-distribution`: Read-only observation of scheduled commitments and pending revisions without authenticated provider reads, Chrome control or repeated notifications.

## Impact

- Affected specs: substack-scheduled-publication, publishing-operations, quiet-background-distribution. The existing series-scheduling time/visibility rules and original-site queue priority remain unchanged.
- Affected code, planned modifications:
  - `scripts/publishing/prepare-distribution.ts`, `scripts/publishing/distribution-inventory.ts`, `scripts/publishing/schedule-distribution.ts`, `scripts/publishing/plan-all-distribution.ts`.
  - `scripts/publishing/run-distribution.ts`, `scripts/publishing/substack-attended.ts`, `scripts/publishing/substack-profile.ts`, `scripts/publishing/substack-browser.ts`, `scripts/publishing/distribution-handoff.ts`.
  - `apps/admin-worker/src/distribution-coordinator.ts`, `apps/admin-worker/src/distribution-runtime.ts`, `apps/admin-worker/src/publication-operations.ts`.
  - `scripts/publishing/sync-distribution.ts`, `scripts/publishing/distribution-attention.ts`, `scripts/publishing/distribution-launchd.ts`.
  - Existing distribution scheduled, attended, native, runtime, review, inventory and sync test suites under `scripts/publishing/`.
  - `AGENTS.md`, `docs/distribution-scripted-runbook.md`, `docs/distribution-launchd-runbook.md`.
- Planned new migration: `apps/admin-worker/migrations/0007_substack_schedules.sql`; additive operational schedule/delivery records only, with no article-body owner outside Git.
- Reuse existing tests, locks, checkpoints, immutable snapshots, Hermes attention channel and pinned runtime installation. No new service, dependency, CI workflow, timer or private provider API.
- This change creates planning artifacts only. It does not implement, commit, push, deploy, replace the installed runtime, schedule a real post or send messages.
