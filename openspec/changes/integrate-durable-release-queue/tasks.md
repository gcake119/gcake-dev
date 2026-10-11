## 1. Queue foundation

- [x] 1.1 Complete snapshot ingestion with immutable readiness, legacy classification, full-manifest eligibility and active-series planning; verify acceptance and SQLite persistence tests.
- [x] 1.2 Unique durable commitments with CAS reservations, leases, idempotency and pause/override controls; verify concurrent publishers and recovery tests.

## 2. Delivery and evidence

- [x] 2.1 Disabled atomic delivery through GitHub snapshot/transaction and secret-authenticated Actions routes; verify gate, source-conflict, body/order preservation tests and workflow checks.
- [x] 2.2 Independent public evidence and safe retries with page/RSS/deployment event history; verify unknown response, RSS delay and build-failure tests.

## 3. Operator and monitoring

- [x] 3.1 Safe operator workflows in authenticated APIs and existing Editor/Series/Publishing UI; verify API security/action tests and rendered desktop/mobile/keyboard/error QA.
- [x] 3.2 Restart-safe external monitoring with private state, baseline, backoff and deduplication; verify poller restart/uncertain-send/outage tests.

## 4. Acceptance

- [x] 4.1 Run full pnpm test, check, build and workspaces builds, local migration and publication-to-page/RSS/notification simulation, Worker deploy dry-run and AI review; record exact evidence and human authorization checklist without enabling production.

## 5. Pre-merge corrections

- [x] 5.1 Reproduce and fix off-calendar legacy reservations with Taipei boundary regression coverage.
- [x] 5.2 Make Worker and Pages deployments manual-only on main, remove hourly Pages recovery, verify workflow safety and update operations.
- [x] 5.3 Complete local gates and AI review; prepare the reviewed PR #9 update without merging, deploying or enabling publication. Remote CI completion is recorded in PR Checks.
