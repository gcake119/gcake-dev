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
