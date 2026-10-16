## Context

Policy source: docs/publishing-cms-release-queue-spec.md and docs/editorial-release-policy-handoff.md. No decision registry exists. Existing Git transaction writer provides optimistic atomic commits; existing public visibility remains authoritative.

## Goals / Non-Goals

Goals: P0 queue operations, durable SQLite/D1 semantics, disabled delivery orchestration, Admin visibility, public evidence, installable Hermes poller and local dry-run evidence.
Non-goals: production activation, provider publishing, newsletter delivery, P1 calendar/analytics, editing the six finalized bodies/order, installing into the separate Hermes account without authorization.

## Decisions

Use a D1 transactional compare-and-swap runtime document with version fencing, containing operational records only. This keeps ingestion, reservations, active-series progress, events and leases atomic together instead of performing independent partial writes. Article bodies/titles/order are joined from the current immutable Git snapshot, never editable in D1. Bound event history and return optimistic conflict errors rather than silently overwriting.

Use the existing GitHub App atomic Git writer. A separate secret-authenticated automation route permits only release execution/verification, not arbitrary content changes. Gate defaults false in every environment; Actions retains contents read permission. Editorial cron also attempts hourly public verification (not Pages deployment) but never backfills skipped slots; existing failed reservations retain their date. Git writes have an unknown-result boundary persisted before invocation.

Adopt legacy schedules only through explicit preview and confirmation. Published future dates block their Taipei date only when it is Monday or Thursday; existing ready dates remain held until automatic scheduling or a fixed slot is explicitly adopted. Series progress is inferred from verified release records and contiguous published prefix; partial out-of-order publication is held.

Public verification fetches only the configured canonical origin without following redirects. Validate title, slug, canonical, publication metadata and RSS GUID/link. Feed outage never changes Git. Deployment retry uses a separately authorized rerun of the matching failed Pages workflow and preserves release identity; unknown Git write results never automatically publish again.

## Implementation Contract

- Complete snapshot ingestion: read all content blobs at one revision, reject truncated trees/invalid sources, resolve first readyAt from the pinned Git commit history (bounded to 1000 pinned first-parent commits; incomplete history stops ingestion), then preserve it and whole-series readyAt. API listing joins titles and order from Git; operational document contains timestamps, revision hashes, ids, slot records, pause/override controls and bounded events.
- Unique durable commitments: versioned CAS updates have one slot per Taipei date and one article release id. Persist publishing before external calls; stale or expired leases enter verification-unknown. Retry requires known pre-write conflict or observed build failure; unlock requires explicit confirmation and cannot erase unknown/verified commitments.
- Disabled atomic delivery: gate check precedes any ingestion/reservation/write; runner requires a secret, checks due slots, and creates a frontmatter/manifest-only transaction. Save ready alone never publishes. All environments keep gate false.
- Independent public evidence: verification records page, RSS and deployment separately. Only page plus RSS promotes verified-public; releases with persisted or uncertain writes only reverify. No Telegram assertion in CMS.
- Safe operator workflows: queue API validates owner session/CSRF, action/id/date/revision. Override preview returns old/new estimates and conflicts; confirmation checks queue version and Git revision. Series reorder is locked once started. Finalize must safely commit ready status plus matching manifest statuses before ingestion.
- Restart-safe external monitoring: installable Python standard-library poller with private state file and exclusive lock; silent baseline, page checks, backoff, pending-send persistence. No token/state in Git. Local HTTP simulation uses fixtures and never production endpoints.
- Verification: acceptance tests precede implementation; real SQLite race/CAS tests, fake Git write integration, local static page/RSS dry run, full pnpm test/check/build/build:workspaces, Worker deploy dry-run, rendered Admin desktop/mobile/error/keyboard inspection. Evidence report separates local results from manual production acceptance.

## Risks / Trade-offs

Single runtime document contention → CAS conflicts fail closed and next request retries from fresh state; personal CMS volume is bounded. Unknown sends → human reconciliation, never blind duplicate sends. Separate Hermes account → provide install procedure and leave runtime installation for human authorization.

Worker and Pages deployment workflows accept manual dispatch on main only. They do not run on push/merge or hourly schedules. PR CI retains test/check/build/simulation without deployment authority. Automatic publication-to-Pages delivery must be separately designed and authorized before enabling production publication; current manual deployment is not unattended delivery.

## Migration Plan

Apply migration locally and simulate first; deploy only after human approval. Production gate remains false through deployment. Rollback disables gate first and preserves D1 commitments; never delete or reset release history. Human acceptance covers secrets, App permissions, D1 migrations, live Pages/RSS, Hermes identity and Telegram before activation.

## Authorized publication-conditioned delivery contract — 2026-10-12

This extension supersedes the prior production activation exclusion only for the explicitly authorized editorial pipeline. Keep ordinary Worker/Pages workflows manual-only. The editorial release job retains contents read; a separate build job checks out the exact returned 40-character commit SHA, validates content, installs from frozen lockfile and builds without synchronizing external content. The deploy job alone receives pages write and id-token write, uses the existing github-pages environment and shared pages concurrency group. No new GitHub App permissions or private key are needed.

The runner exports release_id and release_sha to GITHUB_OUTPUT only for a newly returned awaiting-verification release with valid identity. Missing release is a successful verification-only no-op. Failed/malformed requests fail closed. Do not use arbitrary response fields as shell code; pass the SHA through checkout configuration. Recovery uses GitHub rerun-failed-jobs for the original build/deploy jobs, retaining release job outputs, or the authorized manual Pages workflow. Whole-workflow reruns/hourly verification do not redispatch an old release. Unknown Git responses remain manual reconciliation. This extension deliberately does not restore hourly unconditional deployment or automatic failed-build retries. Public verification remains in the next editorial check and records page/RSS independently.

In scope: workflow, testable orchestration runner, acceptance/workflow tests, local simulation, paired private automation secret, provider configuration/read-only checks, gated rollout. Out of scope: body/order changes, Hermes/Telegram, enabling external provider writes, weakening branch protections, automatic Worker deploy/migration. Activation must follow full tests/check/build/dry-run/review and CI. Keep automation disabled until the paired secrets, main-only environment policy and Worker gate are verified. Secure rollback closes the Worker gate first, then the Actions gate, retaining release history.

Deployment observation safety: reverify SHALL attach manual Pages observation only when its commitSha equals the release commitSha; otherwise preserve the release's prior observation or leave it absent. Editorial run build/deploy results remain available in Actions; the CMS does not claim a manual workflow run proves editorial delivery. Verify this with the unrelated-deployment regression test.

## Consolidation boundary — current PR 7 owner instruction

D1 is the sole operational authority. The integrate-editorial-release extension aligns continuous main-visible readiness, active series, latest due slot, public source digest and retired Git journal behavior. It adds no current activation/merge/deploy authorization; historical activation evidence above does not override the present request to keep production disabled. Existing D1 records stay intact; missing digest and legacy journal need explicit reconciliation.

## 2026-10-12 authorized activation and provider readiness repair

The owner subsequently explicitly authorized PR 7 merge and production Worker deployment, followed by publication and existing private Hermes DM notifications after live baseline. PR 7 merged at 4a54cf211b16b4e475caa183136a92d2a8883936; D1 was backed up without modifying its records. GitHub automation remains disabled while production CMS readiness is repaired. This supersedes the previous disabled-only instruction for the authorized activation scope, not unresolved provider evidence.

Production readiness queries use read-only GraphQL batches of ten exact first-parent snapshots for eligible paths. Request-local immutable blob/tree caches reduce repeated reads; the main branch is always refreshed. The existing 1000-commit semantic bound stays in effect. Partial payloads, non-file NOT_FOUND errors and oversized replies stop ingestion. Confirmed nullable historical file errors only terminate a previously observed ready period. No readiness timestamps are backfilled and no database is reset.

## Public-only verifier source saveback, 2026-10-16

Decision context Level 2: Git/content and publication policy remain authoritative; preserve the API-free evidence boundaries from the read-only-release-acceptance worktree. Save scripts/hermes/public_release_acceptance.py, its 29 tests and static fixtures byte-for-byte. Preserve current first-parent ingestion, protected 30-post snapshot and all newer release behavior; do not copy the older worktree document wholesale. The fixed article verifier is a manual historical evidence tool, not the current generic notification runtime. Move its consumed shell wrapper under historical documentation with mode 0644 and an explicit no-rerun notice.

Verify isolated fixtures, API/credential/redirect denial, bounded process-group cleanup, incomplete-response reporting, parent/run/checkout provenance and independent page/RSS evidence through unittest discovery. Do not execute the real network CLI, update jobs, source private environment or deploy. Complete local gates before authorized PR/merge. Preserve original dirty/staged/untracked and ignored browser/SQL evidence in a private durable backup before worktree removal.
