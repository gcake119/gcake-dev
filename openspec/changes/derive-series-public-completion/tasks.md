## 1. Acceptance coverage

- [x] 1.1 Derive failing acceptance tests for Confirmed public completion, including complete, open, unavailable, empty, paused and exact-time cases; verify a genuine RED result before implementation using the existing Node test runner.

## 2. Shared derivation

- [x] 2.1 Derive before visibility filtering using original planned references and the build-frozen public set; verify missing and future final installments cannot falsely complete a series.
- [x] 2.2 Reuse existing schedule and pause semantics while requiring explicit manuscript completion; verify acceptance tests and existing publication tests pass, with imported series behavior unchanged.
- [x] 2.3 Deliver Consistent reading surfaces through shared public state on homepage, listing, detail and article ending; verify rendered completed and incomplete journeys, final date and final-installment message.

## 3. Content and verification

- [x] 3.1 Retain owner-confirmed completed manuscript and chapter for the behind-the-scenes series without overwriting newer article publication records; verify the isolated patch against current main and all six public references.
- [x] 3.2 Record local verification and decision-index evidence for the adopted rule; run spectra validate derive-series-public-completion and spectra analyze derive-series-public-completion plus affected existing gates, reporting local, remote and deployment evidence separately.

## 4. Follow-up environment and publication reconciliation

- [x] 4.1 Reconcile only the two stale publication headers and manifest references against saved origin/main, preserving identical article bodies and unrelated dirty files; verify exact source matching and content validation.
- [x] 4.2 Repair isolated workspace dependency installation using its frozen lockfile instead of a root-only node_modules link; verify the original 253 diagnostics disappear without source or check weakening.
- [x] 4.3 Execute existing full local gates and record both environments, remaining limitations and dirty-file preservation; verify tests, check, build:all, release:dry-run, editorial:rehearse and completed rendered journey.

## 5. CI bootstrap repair

- [ ] 5.1 Prefer the existing pinned cached Node/npm before pnpm installation on the self-hosted runner; verify local missing-cli reproduction, shell syntax, complete local gates and a successful PR CI run without changing required checks.
