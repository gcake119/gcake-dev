## 1. Queue and lifecycle
- [x] 1.1 Add acceptance tests then implement Git queue journal, complete manifest ingestion, FIFO, active series and strict slot validation.
- [x] 1.2 Add integration tests then implement gated CLI and Deployment recovery workflow with atomic conflict rejection and public confirmation.
## 2. Hermes
- [x] 2.1 Add failing poller tests then implement Hermes outbox, baseline, canonical verification, backoff, private state and installation documentation.
## 3. Verification
- [x] 3.1 Run explicit queue/Python tests, complete test/check/build, simulated static deployment and security review; document production/manual acceptance gates.
## 4. Controlled mock delivery
- [x] 4.1 Test-first Controlled mock delivery through CLI subprocesses and loopback RSS/HTML/API servers; implement exactly-once observed mock requests, canonical failure/backoff, uncertain response handling, restart/GUID deduplication and mode/site state isolation. Verify with test:hermes.
- [x] 4.2 Document the mock-only operator command and evidence boundary; run complete test/check/build, static rehearsal and Spectra validation before feature-only commits and PR update. Production activation and real Telegram remain disabled.
## 5. Boundary re-review
- [x] 5.1 Reproduce and fix Controlled mock delivery transport/activation and production-state isolation gaps; verify direct interface regression tests and CLI mock integration without external requests.
- [x] 5.2 Review complete PR diff and exact-head CI, run complete test/check/build/rehearsal, and document remaining human acceptance without production activation.

## 6. Unattended release preparation
- [x] 6.1 Test-first Unattended release preparation: missing token/wrong remote cause no authenticated push, credentials stay out of Git config/arguments, App writer scopes remain constrained; verify editorial tests and workflow validation.
- [x] 6.2 Provide read-only Unattended release preparation audit and owner App/ruleset/stop instructions; verify simulated gh responses, actual disabled configuration and full local gates before pushing PR updates. Provider/human acceptance stays incomplete.
- [x] 6.3 Unattended release preparation: preserve the owner-approved CMS direct-save exception with failing acceptance tests, reject missing/extra identities and integrity bypass, retain unavailable private metadata as incomplete, and run full local verification before pushing. Provider installation/key/review rules remain pending.

## 7. Read-only Actions Secret acceptance
- [x] 7.1 Implement Read-only Actions Secret acceptance with manual mode, exact revision and disabled-flag preflight, scoped read-only App checks and publication-job exclusion; verify RED/GREEN workflow and shell acceptance tests, full local gates and CI.
- [x] 7.2 Perform Read-only Actions Secret acceptance after owner approval of temporary feature-branch environment access; verify exact run, revoked token, main-only restoration and disabled production.
- [x] 7.3 Verify Reproducible isolated rehearsal against latest published source content with observed RED/GREEN, unchanged bodies/order and full gates.
- [x] 7.4 Fix Read-only Actions Secret acceptance for installation repository schema, prove local RED/GREEN and full gates/CI before a separately approved retry.

## 8. D1 sole release authority
- [x] 8.1 Align continuous readiness/history, complete membership, active-series reconciliation and latest due slots using observable D1 acceptance RED/GREEN tests. Preserve commitments and six bodies/order.
- [x] 8.2 Persist and verify expected publication source SHA before Git write; reject stale public source and changed/missing pending Git content with RED/GREEN delivery tests.
- [x] 8.3 Retire callable Git journal writer and Actions write jobs, block legacy journal evidence, and move isolated static/Hermes rehearsal to D1 with RED/GREEN integration coverage.
- [x] 8.4 Complete full local tests/check/build/rehearsals/workflow/Worker dry-run/security review, document remaining provider gates, split functional commits, push PR 7 and confirm exact-head CI while production remains disabled.

- [x] 8.5 Fix production readiness request budget with test-first batch reads and immutable per-request caches; retain first-parent readiness, refresh main and fail closed on ambiguous provider data. Run full local gates without publication.
