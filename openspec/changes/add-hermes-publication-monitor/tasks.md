## 1. Implementation preflight

- [x] 1.1 Reconcile the implementation baseline, Worker pure-read integration point, formal timestamp semantics and live Hermes schema/job phase using authorized code discovery and read-only inventory; verify a recorded baseline/compatibility report before runtime edits, keeping secrets undisclosed and the existing pipeline intact.

## 2. Acceptance-first TDD

- [x] 2.1 Write acceptance tests for Complete authoritative observation and Current observation and explicit amendments, covering all article types, estimates, incomplete catalogue, cancellation, pause, rescheduling, missing entries and failed current reads; verify product RED for unsupported behavior in apps/admin-worker/src/publication-monitor-summary.test.ts and retain supported behavior as regression coverage.
- [x] 2.2 Write acceptance tests for Pure read and restricted access using mutation-rejecting storage, repeated reads, invalid credentials, minimal disclosure and unchanged queue/content; verify product RED through the owning Worker test command and record why fixture or infrastructure failures are excluded.
- [x] 2.3 Write monitor acceptance tests for Universal discovery and silent baseline and Hourly quiet operation and verified article notification, covering all article types, live-state transition, partial baseline, ordinary quiet checks, page identity, future dates and canonical update deduplication; verify product RED with python3 -m unittest discover -s scripts/hermes -p test_publication_monitor_acceptance.py.
- [x] 2.4 Write acceptance tests for Confirmed overdue publication after grace and Combined late publication and truthful recovery with an injected clock, exact grace boundary, unaligned polling, stale authority, page-before-RSS, repeated lateness and cancellation; verify genuine product RED and one combined late-publication message in scripts/hermes/test_publication_monitor_acceptance.py.
- [x] 2.5 Write acceptance tests for Consecutive anomaly and recovery rounds, covering transient failures, two bad/two good rounds, flapping, independent sources, within-round retries and missed rounds; verify recorded product RED and scheduled-round counts with the same acceptance command.
- [x] 2.6 Write acceptance tests for Restart-safe notification uncertainty and exclusive execution, covering concurrent invocations, restart, intent persistence, lost response, definite rejection, dry-run isolation and system/human evidence separation; verify product RED through the real planned monitor entrypoint with local transport and private temporary state.

## 3. Implement to GREEN after acceptance coverage

- [x] 3.1 Deliver Formal summary remains a pure observer and Restricted reading access and current-round evidence through the proposed summary route and projection; derive coherent-snapshot integration tests and classification unit tests from the acceptance failures, verify GREEN plus zero mutation calls and no use of the ingestion endpoint.
- [x] 3.2 Deliver Hourly event policy and evidence boundaries in the monitor: automatic catalogue/feed discovery, correct public identity, 60-minute overdue grace and two-round anomaly/recovery handling; derive transport integration and boundary unit tests in scripts/hermes/test_publication_monitor_integration.py and scripts/hermes/test_publication_monitor_unit.py, verify GREEN without production endpoints or Telegram sends.
- [x] 3.3 Deliver Durable compatibility and notification identity using the read-only-inventoried live state format, sanitized migration fixtures, exclusive lock and persisted intent/sent/unknown records; verify actual SQLite restart/concurrency/WAL tests, unchanged live state during dry-run, no rebaseline and safe rollback compatibility.
- [x] 3.4 Complete event composition so late publication consumes the corresponding overdue/evidence recovery intent while independent source recovery remains eligible; verify acceptance GREEN for message counts and exactly the approved notification kinds, without claiming exactly-once transport delivery.

## 4. Verification and gated handoff

- [x] 4.1 Verify the new acceptance, integration and unit suites actually participate in the owning test gates; then pass pnpm test:hermes, pnpm test, pnpm check, pnpm build:all, the verified local-only pnpm release:dry-run and git diff --check. Retain genuine RED/GREEN and full-gate logs separately; reproduce any CI failure locally and repeat the required complete local gate before any authorized push.
- [x] 4.2 Update docs/publishing-cms-release-operations.md and the Chinese planning guide with the one-job rollout/rollback procedure, private dedicated read-credential proposal and separate authorization boundaries; verify a handoff review that no production change, credential provisioning, republishing, workflow rerun, notification-state reset or gateway restart occurs without its applicable authorization, and that local, live-read, system-send and human-receipt evidence are labeled separately.

## 5. Local scheduler follow-up

- [x] 5.1 Deliver Explicit scheduler context and drift-safe rounds acceptance coverage: record genuine RED for interval phase drift and actual script-runner metadata absence, covering retries, missed rounds, unscheduled work and job isolation through Python discovery.
- [x] 5.2 Implement Explicit scheduler context in the isolated owner-supplied Hermes script runner and monitor CLI; verify shell/Python subprocesses, heartbeat and fallback branches, inherited-context replacement, canonical UTC time and rejection before state/source access. Export a source-hash-bound patch without installed runtime changes.
- [x] 5.3 Repair Consecutive anomaly and recovery rounds with interval-derived gap bounds and persistent job/execution scope; verify drifted two-bad/two-good recovery, duplicates, missing rounds, restart and unchanged notification history.
- [x] 5.4 Repeat the complete repository local gate and retain new RED/GREEN plus runner source provenance; document full Hermes runtime activation as unverified and preserve no deployment/job changes/commit/push.

## 6. Isolated full gateway verification

- [x] 6.1 Prepare the matching complete source and locked dependencies, and implement Isolated full gateway verification with a single lifecycle script; verify filesystem/network isolation before startup and keep startup failures distinct from product RED.
- [x] 6.2 Verify Explicit scheduler context through the real gateway main/ticker, test no-agent job and durable execution ledger on baseline and patched source, including delayed original time and isolated homes; retain true dispatch RED/GREEN without production Telegram or direct fixture dispatcher calls.
- [x] 6.3 Verify Gateway test teardown for successful/failed/timed-out/interrupted runs, save evidence and exact process cleanup receipts, and document tested topology and remaining production/Linux limits without deployment/job edits/commit/push.

## 7. Wrapper cutover and rollback

- [x] 7.1 Deliver Wrapper cutover and rollback compatibility shell acceptance coverage and complete candidate renderer; verify isolated Python import, private env loading, immutable scheduler context, wrong-job/missing-context refusal and dry-run state preservation, retaining genuine import RED/GREEN.
- [x] 7.2 Exercise actual gateway dispatch of the new wrapper, then restore the hash-bound original wrapper and core against the same test job/state; verify sent/uncertain/baseline and new sent/unknown outcomes never resend through recorded fixture transport calls.
- [x] 7.3 Save wrapper/DB/transport/source and cleanup evidence, run appropriate repository gates and update the rollout review with exact tested scope; keep deployment, production jobs/Telegram and commit/push unchanged.


## 8. Approved local updater safety

- [x] 8.1 Complete Approved immutable release identity through Isolated evidence and teardown requirements and Gherkin before implementation tasks, preserving prior accepted scenarios; validate/analyze artifacts and retain acceptance RED for the missing updater seam.
- [x] 8.2 Deliver Approved immutable release identity and Exclusive bounded update lifecycle with manifest/digest approval, bounded owned-root validation, unknown skip/review deduplication, unsafe payload rejection and exclusive disk/drain preflight in scripts/hermes/updater_guard.py; verify acceptance tests before any service operation.
- [x] 8.3 Deliver Verified installation and activation and Complete runtime recovery without history rollback with durable staging/switch/recovery and explicit activation using full payload backups and latest external history; verify success, failure, interruption, fresh-process recovery and recovery failure without mixed runtime, duplicate senders or state rollback.
- [x] 8.4 Extend managed wrapper integrity/mode preflight while preserving unmanaged behavior; verify altered installed payload, pending recovery and unauthorized live refusal before monitor/state access.
- [x] 8.5 Exercise the same manager with complete self-contained Python 3.11.15/interpreter/dependencies and full real gateway dispatch, metadata/ledger and wrapper transport fixtures in scripts/hermes/verify_runtime_update.py; verify complete runtime recovery, no resend and successful new delivery after recovery, plus cleanup receipts.
- [x] 8.6 Run required repository gates and source/hash/disk/process/Spectra final checks, save RED/GREEN and local runtime evidence, and update rollout documentation with tested scope and remaining formal permissions.


## 9. Isolated update entry integration

- [x] 9.1 Define Authority and runner permission separation, Fixed isolated supervisor mapping, First entry backup and verified restoration, Durable interrupted supervisor recovery and Privileged isolated drill and teardown requirements with Given/When/Then before tasks; verify Spectra validation/analysis and record acceptance RED.
- [x] 9.2 Implement Authority and runner permission separation with sealed fixed releases, writer checks, read-only invocation leases and maintenance gate; verify test_update_entry.py ownership, drift and lock acceptance.
- [x] 9.3 Implement Fixed isolated supervisor mapping and first-entry transaction with First entry backup and verified restoration; verify fixed-command rejection, exact settings recovery, single supervisor and unchanged latest history through acceptance tests.
- [x] 9.4 Implement Durable interrupted supervisor recovery with fresh-process journal recovery at each switch boundary, maintenance wait and committed receipt errors; verify persistent fake-supervisor crash and recovery-failure acceptance.
- [x] 9.5 Deliver Privileged isolated drill and teardown; verify genuine root/hermes write denial, read-only shared lease, actual owned system launchd start/stop, interrupted recovery and cleanup using owner-provided sanitized evidence. Pending owner evidence must remain unchecked.
- [x] 9.6 Verify complete CLI gateway dispatch on Python 3.11.15 with isolated homes and no network, run affected local gates and record exact tested scope in operations/evidence documents; validate/analyze Spectra without deployment, official jobs or commit/push.

## 10. Combined privileged full gateway qualification

- [x] 10.1 Define Combined privileged full gateway qualification with observable Gherkin before tasks; validate/analyze and record acceptance RED for the missing exclusive dry-run verification lease.
- [x] 10.2 Connect the approved EntryStore verification lease, pinned native wrapper child, isolated Unix IPC and complete gateway environment; verify dry-run during maintenance, live/abandoned/wrong selection refusal and ordinary lease regressions.
- [x] 10.3 Prepare complete hash-bound Python 3.11.15 old/new/bad bundles and root-only combined lifecycle driver; verify prebuilt manifest identity, fixed dispatcher source, source/runtime modes, inventory and root command syntax before owner execution.
- [x] 10.4 Run Combined privileged full gateway qualification using real root/hermes and actual test LaunchDaemon: verify real scheduled metadata/wrapper, successful update, three SIGKILL/fresh-controller recoveries, failed candidate/recovery, sent/unknown preservation and one later new article through fixture-only transport; preserve owner evidence and exact cleanup, no mocks substitute for the combined result.
- [x] 10.5 Pass affected Python gates and Spectra checks; document combined results/limits and provide owner command plus user-forwardable Hermes Telegram handoff without sending, deployment, official job changes or commit/push.

## 11. Authorized production rollout

- [x] 11.1 Define Authorized fixed production rollout, Durable first production installation recovery and Production verification before job activation with Gherkin; validate/analyze artifacts, preserve completed isolated work and save fresh owner baseline provenance.
- [x] 11.2 Implement separate production root policy, fixed supervisor/plist mapping and original-home launch environment in production_entry.py; acceptance-test wrong labels/users/homes, arbitrary roots, writable authority, immutable runner access and isolated adapter refusal.
- [x] 11.3 Prepare a complete fixture-free production bundle and pinned owner installer controls; verify source/runtime/real library tree, no secret/fixture leakage and exact manifest/tool hashes before service operations.
- [x] 11.4 Establish the authenticated read-only summary and private configuration prerequisite through deployment inventory and handler qualification; verify missing/invalid configuration blocks activation and evidence contains no credentials.
- [x] 11.5 Implement first-install journal, exact ACL/slot backups, updater/sender exclusion, bounded drain and fixed service replacement/recovery; run isolated success/failure/interruption and complete original-layout recovery before owner execution.
- [x] 11.6 Execute authorized owner installation/restart after readiness; verify true hermes UID, selected Python/code, single gateway, Unix identity and natural existing-job dry-run context with unchanged notification history, preserving sanitized receipt and any rollback evidence.
- [x] 11.7 After successful production qualification, apply authorized existing-job correction and activation policy, run affected complete gates and commit/push only this change; verify job identity/interval, preserved history, no test Telegram sends, no secrets/backups/runtime in Git and remote commit identity.
- [x] 11.8 Deliver Request-bound authority freshness after measured production clock difference, retaining strict fixture time checks and unchanged grace/streak rules; verify echo authentication, missing/mismatched/replayed identities, five-second boundary, real native observer and Worker/Python regression before rebuilding the formal artifact.

## Closeout trace

Task 5.1/5.2 cover Explicit scheduler context and Wrapper cutover and rollback compatibility; tasks 7–10 cover the subsequently accepted update design. Historical task completion is recovered from this conversation and real owner combined results, not reconstructed raw log files. Task 11.7 is complete: full closeout gates passed and remote source commit 373299fae570884c3efb58d21a1a3be884b02a43 was verified. The following documentation commit records completion; it does not change the production release.
