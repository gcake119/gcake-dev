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

## 6. Production owner login repair

- [x] 6.1 Restore verified OAuth client and owner deployment configuration, pin authorization and token exchange to the initiating environment, and verify RED/GREEN plus full gates.
- [x] 6.2 Review and deliver the fix; production callback registration requires browser action-time confirmation before submission, then verify owner login without enabling publication.

## 7. Authorized production activation

- [x] 7.1 Publication conditioned Pages delivery: prove runner acceptance RED/GREEN for exact committed SHA, no-op, invalid response and disabled gate; wire isolated build/deploy jobs with least privilege and workflow safety tests.
- [ ] 7.2 Complete full pnpm test/check/build:all/release:dry-run and AI review; update activation/recovery evidence, atomic commits, PR and successful CI before authorized merge.
- [ ] 7.3 Configure paired private Worker/Actions credentials and main-only automation environment; verify disabled authentication, activate Worker and Actions gates, run a controlled due/no-op check and verify production UI/public evidence without modifying bodies/order.
