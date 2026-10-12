# Production history redirect compatibility repair

PR 17 was approved and merged at c23c1c2b292425f80f1754c4c078f126a2368c90; Worker deployment 38201304017 succeeded. Its safe diagnostics reported RELEASE_FAILED / TypeError for the production queue. A local native Workerd Request reproduced the cause: redirect `error` is unsupported at the edge and fails before the GraphQL transport runs. The earlier injected transport did not construct a native Request, so it did not detect this defect.

The history reader now uses `manual`; existing HTTP success checks reject a 302 without following the redirect or forwarding its authorization to another destination. Two native Workerd regression tests construct the actual request before a synthetic provider responds. Both failed with the unsupported-mode TypeError before the change and pass after it. All responses and credentials in these tests are fixtures; no external provider is contacted. The runtime is disposed on both success and failure.

## Separately approved chapter-one publication

- Owner confirmed PR 17 merge, production deployment and one manual publication today.
- D1 release identity: 3219666a-9730-4b8e-8561-362d50447620; mode manual.
- Actual publication time: 2026-10-12T11:56:38+08:00; no 07:00 backdating.
- Source: c23c1c2b292425f80f1754c4c078f126a2368c90.
- Publication commit: eb6b988ad3f030fab2555a789897b7e81e5a0ad6.
- Publication source SHA-256: ba1e53cbadcd3766141cb7f1f970a36b52187647844ef39938d15bdd62aeaa57.
- Pages deployment 38201797158 succeeded for that publication commit.
- Full Markdown body remained byte-identical. Only publication metadata and this chapter's manifest status changed; six reading positions remain unchanged.
- Production page matches title, canonical, source digest and actual date; full body including final paragraph renders. Desktop and 390px mobile checks found no horizontal overflow.
- RSS contains exactly one matching title/link/GUID with the same actual date. Chapter four remains absent.
- D1 public re-verification remains pending while the normal queue read is broken. Do not create a second identity or replay the publication.
- GitHub automatic release remains disabled. Native local success is not production queue acceptance; deployment and queue/public re-verification require approval of this new repair candidate.
- Existing Hermes live job and DB must be retained. Owner-side RSS delivery and repeat-run reconciliation are pending; do not claim the approved connection-test receipt proves article delivery.

## Candidate verification

Full local gate passed: 295 Node tests, 31 Python tests, Astro check (154 files, zero errors/warnings/hints), build:all, isolated D1/static/RSS-to-mock-Telegram rehearsal, production Worker dry-run, and both integrate-editorial-release / integrate-durable-release-queue Spectra validations. Rehearsal retained all six bodies and reading order, recorded no production writes or Telegram network calls, and emitted no repeat notification. Main publication was checked separately against actual provider evidence, not these fixtures.

After the one approved Git publication, D1 version 27 has exactly one awaiting-verification record with attempts 1 and startedAt 2026-10-12T03:56:38.624Z. Worker writing was restored to false pending repair acceptance; GitHub automatic release remains false. Neither the pending identity nor the Hermes baseline was reset.
