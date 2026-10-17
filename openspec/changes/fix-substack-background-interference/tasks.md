## 1. Durable manual hold

- [x] 1.1 Durable manual hold: Hold manual-required targets until attended resolution: reproduce repeated preparation with a failing planTarget acceptance test, then block all automatic operations across revision changes and checkpoints; verify distribution-inventory.test.ts and two-round distribution-sync.test.ts preserve hold and quiet repetition.

## 2. Browser-free background execution

- [x] 2.1 Browser-free background execution: Enforce anonymous-only scheduled execution: reproduce native preflight access with a failing createProfileTransport test and direct CLI acceptance test, then restrict scheduled planning and production dispatch to anonymous verification with current-state checks; verify distribution-profile.test.ts plus focused distribution tests with zero browser opens and zero UI access.

## 3. Preserve evidence and scheduling

- [x] 3.1 Preserve evidence and scheduling: Preserve installation evidence and regression protections: document attended deferral and explicit resolution, run pnpm test, pnpm check, pnpm build:all, pnpm release:dry-run and Spectra analyze/validate; inspect the final diff and retain RED/GREEN and local gate logs.
- [x] 3.2 Cut over to a fresh pinned private runtime after checking writer and D1 evidence; preserve credentials and old installation, verify a real held-target round without Chrome access, then observe a natural scheduled occurrence and owned-source cleanup without changing article identities or clearing holds.

## 4. Hermes human-action notification

- [x] 4.1 Implement Hermes human-action notification status production through runSyncRound with RED then GREEN for held/quiet rounds, confirmed clear and failed-source retention; verify distribution-attention.test.ts and existing sync tests.
- [x] 4.2 Implement Hermes-owned event delivery with durable one-attempt deduplication, recurrence after clear, sanitized receipts and official configured-home sending; verify test_substack_attention.py rejects stale/malformed inputs and uncertain/skipped acknowledgements without resend.
- [x] 4.3 Prepare a reviewed owner activation bundle with root-owned sender, user-specific input/output ACLs, WatchPaths instead of a timer, preserved Hermes gateway and safe runtime cutover; run installer fixture tests plus full required local gates and save a bounded handoff when owner authentication is unavailable.
- [x] 4.4 Activate through the authenticated owner step and obtain a real Hermes transport receipt for the current held items; keep pending until actually executed and distinguish transport acceptance from human receipt.

## 5. Inert public identity format compatibility

- [x] 5.1 Implement Inert public identity format compatibility with genuine RED from observed designated JSON data, preserve the legacy format and reject malformed/duplicate/mixed identities; verify distribution-public-identity.test.ts and exact captured anonymous HTML.
- [x] 5.2 Pass affected full local gates and prepare a fresh pinned Hermes-enabled runtime while preserving browser-free background holds and event sender; verify source hashes, immutable prior installation and idle LaunchAgent cutover.
- [x] 5.3 Explicitly reconcile only the two held original articles through full anonymous coordinator verification under the shared lock; verify exact original IDs, current source receipts, zero Substack writes/Email/App/browser calls, settled D1 state and normal background plan eligibility.

## 6. PR33 review corrections

- [x] 6.1 Enforce Reviewed scheduler boundaries for legacy receipts: reproduce install/runtime fallback acceptance, require anonymous-only receipts unconditionally and verify launchd/production validation regressions.
- [x] 6.2 Preserve omitted durable manual holds in Hermes attention: reproduce deleted/ineligible-source omission, read the complete durable hold set before clear and verify temporary-file/local-database notification tests including read failure.
- [x] 6.3 Enforce background eligibility under the target lock: reproduce a hold installed between transport selection and coordinator lock acquisition, preserve exact state/checkpoint on rejection and verify coordinator/transport acceptance tests with zero public/browser calls.
- [x] 6.4 Pass full pnpm test/check/build:all/release:dry-run and prepare only the review fixes for push; verify primary dirty files and live runtime hashes remain unchanged before the separate remote CI/review/merge operation.
