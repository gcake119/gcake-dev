> 歷史規格：此已完成變更的分發目標已由 remove-paragraph-sync 取代。不得依此文件啟動舊目標；現行操作以 Substack-only 同步文件及新規格為準。

## 1. Baseline and regression
- [x] 1.1 Run full tests/check/build, fix invalid topic and preserve operational identity with RED/GREEN evidence.
## 2. Durable checkpoints and locks
- [x] 2.1 Add D1 checkpoints and locks with concurrency, crash, and secret-safe error tests.
## 3. Existing Paragraph REST service
- [x] 3.1 Extend verified gate injection and receipt validation; block uncertain create/publish replay and add reconciliation tests.
## 4. Attended browser runtime
- [x] 4.1 Implement Playwright UI contract, profile isolation, login detection, draft/create/update, no-email publish and readback; prove behavior on local browser fixtures.
## 5. Public verification
- [x] 5.1 Integrate both providers in a shared D1-backed operator CLI with exact approvals and test content/images/links/canonical/dates/duplicates/failure isolation.
## 6. Acceptance
- [x] 6.1 Run complete local gates, review diff, update handoff and report configuration/approval gaps.
- [x] 6.2 Observe live Substack editor and record selectors/canonical/date support after human login.
- [x] 6.3 Perform controlled provider publication and public read-back after the authorized Pages-first workflow becomes eligible.

## 7. Accepted Substack full-mirror policy
- [x] 7.1 Verify Explicit Substack mirror policy with RED/GREEN for policy-bound approval, platform canonical plus original link, single publication then date restoration, and read-only versus explicitly approved recovery.
- [x] 7.2 Implement Original date after publication with post-publication date browser controls and durable metadata intent; prove same-ID recovery and no-email behavior with real local Chrome fixtures.
- [x] 7.3 Review Controlled writes, Durable uncertain recovery, Browser integration, Public evidence and Disabled Substack production path; run full tests/check/build, update disabled configuration, operator instructions and outstanding live verification.

## 8. Attended setup
- [x] 8.1 Implement Publication-free setup: make login independent of article eligibility and D1 credentials with RED/GREEN; apply unique additive D1 migration and prepare private browser/configuration with writes disabled.

## 9. Controlled trial readiness
- [x] 9.1 Prove Revision-scoped controlled trial through exact prepare/publish scope, publication identity and prepared-draft prerequisites; retain disabled general gates.
- [x] 9.2 Prove Attended side-browser handoff through durable intent, bound request/reply, saved draft evidence, no-email publication and anonymous public verification; retain uncertainty on lost or stale replies.
- [x] 9.3 Integrate the existing runtime with latest main, run complete local gates and both current-article eligibility dry runs, review boundaries and document exact operator steps with no provider writes during preparation.

## 10. Pages-first unattended correction
- [x] 10.1 Prove anonymous current-source Pages verification before any provider write, including 404, stale body, date, canonical and asset failures; preserve withdrawn ready content.
- [x] 10.2 Implement Pages-first unattended synchronization by connecting Codex scheduling to the shared side-browser request protocol with an explicit unattended policy and independent platform recovery; verify before enabling.

## 11. All formal articles
- [x] 11.1 Implement All-article fixed-source discovery with complete Markdown/MDX/aggregate inventory, eligible Pages proofs and explicit blockers; prove multi-article, ready, future, ambiguity and first-public-article cases in distribution-inventory.test.ts.
- [x] 11.2 Implement General policy with exact operations using existing schedule planner and D1 state; prove scope mismatch, same-version verification, independent failures and unknown intent recovery in distribution-inventory.test.ts.
- [x] 11.3 Implement Published revision update without republication and complete historical adoption using existing providers; prove same-ID update and read-only uncertain recovery in provider/coordinator tests.
- [x] 11.4 Prepare Single-writer runtime handover with full tests/check/build/release dry run, all-candidate public inventory, candidate hash manifest and first-article bounded live plan; document current locks/intents and unchanged old pin/schedule.

## 12. Approved Substack date precision
- [x] 12.1 Verify Explicit Substack minute precision: prove default exact dates, approved minute dates, wrong-minute rejection and precision-bound approvals with RED/GREEN.
- [x] 12.2 Complete same-ID live metadata recovery, anonymous verification and single-writer schedule handover.

## 13. Scripted workflow
- [x] 13.1 Implement Scripted synchronization round with acceptance RED/GREEN for unchanged verification, rate-limit isolation, lock/pin failure, uncertain prepare blocking and owned cleanup.
- [x] 13.2 Implement Scripted side-browser handoff with acceptance RED/GREEN for exact source/intent identity, expired/malformed evidence, complete observed body and exclusive replies.
- [x] 13.3 Run full local gates and a fresh real read-only scripted round; document one-command use and preserve the installed runtime.

## 14. Independent system scheduler
- [ ] 14.1 Implement Independent dedicated browser transport with policy-bound review digest, no attended requests, login failure stops, complete discovery and same-ID web-only update regression tests.
- [x] 14.2 Implement macOS scheduled script cutover with secret-free private plist, absolute runtime paths, 15-minute cadence, readiness/pin gate and explicit rollback tests.
- [ ] 14.3 Run complete local gates, owner profile login and real standalone same-version verification, then disable old heartbeat and activate the verified LaunchAgent with no concurrent writer.

## 15. Existing Chrome macOS transport
- [x] 15.1 Implement Existing Chrome system transport using origin/tab-bound Apple Events bridge and DOM page adapter with ambiguity, off-origin, denied permission, before-write source failure and once-only async tests.
- [x] 15.2 Integrate transport-bound approvals and anonymous public verification into the existing coordinator and LaunchAgent readiness policy; pass complete local gates.
- [x] 15.3 Obtain owner-confirmed automation permissions, observe live controls, run real standalone same-version acceptance and perform single-writer scheduler cutover.

## 16. Actual public identity verification
- [x] 16.1 Implement Anonymous Substack post identity with acceptance RED/GREEN for missing editor href, wrong original ID/publication/canonical, malformed/multiple public data and unresolved post-publication archive identity without replay.
- [x] 16.2 Verify actual native UI selectors and checkbox label handling with real DOM regressions; preserve same-ID, source proof, zero delivery and independent full anonymous readback.
- [x] 16.3 Run full local and actual native/system read-only qualification, install a fresh independent version pin and perform single-writer LaunchAgent cutover only after all observed contract gates pass.

## 17. Revoked Paragraph authorization
- [x] 17.1 Implement Revoked platform authorization: reject revoked targets before provider access, even with historical matching approval; bind acceptance to current targets.
- [x] 17.2 Install only Substack policy, audit all preserved in-flight identities and disable the superseded heartbeat after independent qualification.

14.1／14.3 的專用 profile 登入方案已由使用者改選 macOS 現有 Chrome transport；未宣稱該 profile 登入通過。生效替代驗收為 15.3／16.3／17.2，僅 Substack。
