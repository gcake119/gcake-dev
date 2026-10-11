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
- [ ] 6.2 Provide read-only Unattended release preparation audit and owner App/ruleset/stop instructions; verify simulated gh responses, actual disabled configuration and full local gates before pushing PR updates. Provider/human acceptance stays incomplete.
