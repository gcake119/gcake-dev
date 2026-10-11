## Context

Policy source: docs/publishing-cms-release-queue-spec.md and docs/editorial-release-policy-handoff.md. No decision registry exists. Existing Git transaction writer provides optimistic atomic commits; existing public visibility remains authoritative.

## Goals / Non-Goals

Goals: P0 queue operations, durable SQLite/D1 semantics, disabled delivery orchestration, Admin visibility, public evidence, installable Hermes poller and local dry-run evidence.
Non-goals: production activation, provider publishing, newsletter delivery, P1 calendar/analytics, editing the six finalized bodies/order, installing into the separate Hermes account without authorization.

## Decisions

Use a D1 transactional compare-and-swap runtime document with version fencing, containing operational records only. This keeps ingestion, reservations, active-series progress, events and leases atomic together instead of performing independent partial writes. Article bodies/titles/order are joined from the current immutable Git snapshot, never editable in D1. Bound event history and return optimistic conflict errors rather than silently overwriting.

Use the existing GitHub App atomic Git writer. A separate secret-authenticated automation route permits only release execution/verification, not arbitrary content changes. Gate defaults false in every environment; Actions retains contents read permission. Cron also attempts hourly recovery but never backfills skipped slots; existing failed reservations retain their date. Git writes have an unknown-result boundary persisted before invocation.

Adopt legacy schedules only through explicit preview and confirmation. Published future dates block their Taipei date; existing ready dates remain held until automatic scheduling or a fixed slot is explicitly adopted. Series progress is inferred from verified release records and contiguous published prefix; partial out-of-order publication is held.

Public verification fetches only the configured canonical origin without following redirects. Validate title, slug, canonical, publication metadata and RSS GUID/link. Feed outage never changes Git. Deployment retry uses a separately authorized rerun of the matching failed Pages workflow and preserves release identity; unknown Git write results never automatically publish again.

## Implementation Contract

- Complete snapshot ingestion: read all content blobs at one revision, reject truncated trees/invalid sources, resolve first readyAt from the pinned Git commit history (bounded to 1000 path commits; incomplete history stops ingestion), then preserve it and whole-series readyAt. API listing joins titles and order from Git; operational document contains timestamps, revision hashes, ids, slot records, pause/override controls and bounded events.
- Unique durable commitments: versioned CAS updates have one slot per Taipei date and one article release id. Persist publishing before external calls; stale or expired leases enter verification-unknown. Retry requires known pre-write conflict or observed build failure; unlock requires explicit confirmation and cannot erase unknown/verified commitments.
- Disabled atomic delivery: gate check precedes any ingestion/reservation/write; runner requires a secret, checks due slots, and creates a frontmatter/manifest-only transaction. Save ready alone never publishes. All environments keep gate false.
- Independent public evidence: verification records page, RSS and deployment separately. Only page plus RSS promotes verified-public; releases with persisted or uncertain writes only reverify. No Telegram assertion in CMS.
- Safe operator workflows: queue API validates owner session/CSRF, action/id/date/revision. Override preview returns old/new estimates and conflicts; confirmation checks queue version and Git revision. Series reorder is locked once started. Finalize must safely commit ready status plus matching manifest statuses before ingestion.
- Restart-safe external monitoring: installable Python standard-library poller with private state file and exclusive lock; silent baseline, page checks, backoff, pending-send persistence. No token/state in Git. Local HTTP simulation uses fixtures and never production endpoints.
- Verification: acceptance tests precede implementation; real SQLite race/CAS tests, fake Git write integration, local static page/RSS dry run, full pnpm test/check/build/build:workspaces, Worker deploy dry-run, rendered Admin desktop/mobile/error/keyboard inspection. Evidence report separates local results from manual production acceptance.

## Risks / Trade-offs

Single runtime document contention → CAS conflicts fail closed and next request retries from fresh state; personal CMS volume is bounded. Unknown sends → human reconciliation, never blind duplicate sends. Separate Hermes account → provide install procedure and leave runtime installation for human authorization.

## Migration Plan

Apply migration locally and simulate first; deploy only after human approval. Production gate remains false through deployment. Rollback disables gate first and preserves D1 commitments; never delete or reset release history. Human acceptance covers secrets, App permissions, D1 migrations, live Pages/RSS, Hermes identity and Telegram before activation.
