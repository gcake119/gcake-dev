## Why

Finalized Git originals need complete unpublished Substack drafts that stay current without an operator. The current anonymous observer only requests foreground work and has no authenticated draft read/write capability.

## What Changes

- **BREAKING, opt-in only**: add `unattended-draft-sync-v1`, separately qualified and activated for create/read/compare/update/reload of eligible unscheduled, never-published drafts. Saving Git alone grants no provider authority.
- Cover all eligible complete main Markdown, retaining source-slug parity, one original provider ID, strict title/description/full-body/structure/code/media/alt/link verification and source-version evidence.
- Serialize against foreground work; preserve uncertain intent and reconcile without replay, replacement IDs or alternative slugs. Stop on human edit conflicts and incomplete media.
- Keep scheduled, sending and published articles outside automatic editing. Source/time/eligibility changes produce foreground handoffs; automatic sync never arms, publishes, removes or changes schedules or initiates delivery.
- Reuse the single existing timer, locks and attention/deduplication path. Keep the observer anonymous-only; implement a separate narrowly scoped worker port whose activation requires qualification and authorization. Preserve both deployed false-positive corrections.
- Use the owner-selected existing Computer Use file handoff for draft reads/writes. Official write-API selection is no longer an implementation prerequisite; real unattended executor/session qualification remains required before activation.

## Capabilities

### New Capabilities

- `unattended-substack-drafts`: Full draft synchronization, exact identity, conflicts, bounded recovery and disablement.

### Modified Capabilities

- `publishing-operations`: Separate explicit standing draft authority from foreground publication and delivery authority.
- `quiet-background-distribution`: Keep anonymous observation intact while sharing orchestration and attention with an optional qualified draft worker.

## Impact

- Affected specs: unattended-substack-drafts, publishing-operations, quiet-background-distribution. The active schedule-substack-drafts-ahead change remains authoritative for foreground scheduling and task 5.3 remains pending.
- Planned existing seams: `scripts/publishing/scheduled-source.ts`, `scripts/publishing/substack-schedule.ts`, `scripts/publishing/run-scheduled-distribution.ts`, `scripts/publishing/observe-substack-schedules.ts`, `scripts/publishing/sync-distribution.ts`, `scripts/publishing/distribution-attention.ts`, `scripts/publishing/distribution-launchd.ts`, `apps/admin-worker/src/substack-schedules.ts`.
- Planned new adapter boundary: `scripts/publishing/substack-draft-sync.ts`, `scripts/publishing/substack-draft-computer-use.ts`, `scripts/publishing/substack-draft-round.ts`, `scripts/publishing/substack-draft-activation.ts`; the owner selected Computer Use for local transport implementation. Reuse existing distribution scheduled/runtime/sync/attention tests and SQLite repository harness.
- Operational documentation at implementation: `AGENTS.md`, `docs/distribution-scripted-runbook.md`, `docs/distribution-launchd-runbook.md`. No dependency, workflow, new timer, new notification sender or migration is approved here; prefer compatible additive operational JSON fields if proven sufficient.
- The original proposal turn revised planning only; the owner now authorizes local implementation through Computer Use, including authenticated frontend-readable status APIs. Prior parked text is preserved externally with hashes; no old schedule evidence is rewritten. Provider state, credentials, installed runtime and recovery materials remain untouched during local implementation.

## Owner interface decision — 2026-10-19

The owner explicitly selected the existing successful Computer Use method and requested implementation. This supersedes the prior wait-for-supported-write-API decision. Reuse FileAttendedExchange and exact saved-content evidence; do not claim a headless Node timer itself executes Computer Use. Add authenticated read-only GET status APIs for frontend presentation. No frontend screen, provider schedule operation or runtime activation is authorized by this implementation step.

- Implemented frontend status seams: `apps/admin-worker/src/substack-draft-api.ts`, `apps/admin-worker/src/router.ts`, `apps/admin-worker/src/index.ts`; frontend handoff: `docs/substack-draft-sync-api.md`.

## Scoped natural qualification authorization — 2026-10-19

The owner now authorizes connecting an unattended Computer Use executor and one natural occurrence for existing unscheduled ID 221099415 / ithome-2026-template-hardening. This authorizes a bounded private runtime installation under the same existing timer, with a new executor-owned tab rather than operating an existing user tab. The unchanged source requires a complete saved read with zero mutations. A one-use, expiring read-only qualification grant is separate from general draft-write activation and cannot fabricate a prior unattended receipt. No new timer, create/update, schedule, publication, subscriber delivery, broad inventory activation or Worker deployment belongs to this qualification slice.

## Scoped write qualification authorization — 2026-10-19

The owner explicitly requested unattended actual write and reload on the same original ID 221099415 / ithome-2026-template-hardening using Chrome only, preserving schedules, publication and notification settings. Add a one-use write qualification alongside the completed read-only qualification; general draft write activation and full inventory coverage remain outside this grant. The equal-content optimization is bypassed only for this explicit same-content resave qualification.


## Read-only production API delivery — 2026-10-20

The owner explicitly authorizes deploying the implemented admin read-only API and production acceptance, with endpoint/state handoff. Preserve current production frontend assets, variables/bindings and provider commitments. Do not change the Chrome sync runtime, allowCreate=false, schedules, publication or subscriber delivery. No commit/push/merge, migration or new frontend screen is inferred.


## Read-only frontend integration — 2026-10-20

The owner authorizes connecting the two deployed GET APIs in the existing admin UI, separate sync/publication/delivery presentation, and interface acceptance. Reuse the deployed PR38 interface as base in an owned worktree; preserve the dirty primary. No provider mutation, creation enablement, schedule/publication/delivery operation, commit/push or production frontend rollout is inferred. The existing read-only MCP authorization remains unchanged; no new index is required after automatic review rejected index_repository.


## Authorized production frontend delivery — 2026-10-20

The owner explicitly authorizes deploying the qualified frontend candidate and Chrome production acceptance of both read-only APIs and independent synchronization/publication/delivery presentation. Preserve disabled creation, existing schedules, public articles, delivery commitments, production variables and bindings. No source change, migration, provider mutation or commit/push is required.


## Legacy publication reader repair — 2026-10-20

Owner authorizes fixing the production legacy publication query and Chrome acceptance. Root cause: handleRequest never supplies the publications reader, so normal article GET returns configuration 503. Wire existing persisted target-state reads only, retain disabled operations, truthful missing/stale evidence and unchanged provider commitments.


## Current Pages evidence projection — 2026-10-20

Owner authorizes connecting the current release_queue_runtime publication/deployment/public verification records to the existing read-only article status response and production Chrome acceptance. Three verified-public production records exist but the old target-state table has no Pages rows. Preserve every schedule/provider commitment and disabled creation.


## Clean Git delivery of deployed status features — 2026-10-20

The owner authorizes packaging the deployed Substack status UI, legacy publication read repair and current Pages evidence as an independent commit based on merged main 6e8f715, full local verification, push and PR/CI/Codex review. Do not merge, deploy, enable scheduling writes or initiate delivery. Preserve PR41 regressions and keep Admin archive and subsequent draft-list runtime repair out of this delivery.

## Original draft inconclusive read repair — 2026-10-20

Owner authorizes diagnosing and repairing ID 221099415 readback and natural Chrome synchronization acceptance. Preserved failed transcript shows complete published links at /publish/posts/detail/ID were incorrectly discarded by child ad hoc /publish/post/ filtering before opening the draft. Replace this duplicated guess with shared deterministic full-list identity validation, retain all discovery/content guards, qualify full read then repair the installed pin/receipts under the existing round lock without kickstart, new timer, creation, schedule/publication/delivery operation or Worker deployment.
