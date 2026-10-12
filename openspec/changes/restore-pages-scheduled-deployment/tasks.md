## 1. Acceptance and implementation

- [x] 1.1 Define acceptance tests for Automatic Pages rebuild triggers, No early publication, Preserve completed external snapshot and Preserve protected deployment boundaries; observe RED on the real missing hourly trigger using node --import tsx --test test/pages-scheduled-deployment.test.ts.
- [x] 1.2 Reuse the existing Pages workflow and Preserve build and snapshot boundaries; restore hourly/main-push triggers without changing Secret jobs or stale-artifact steps, integrate the acceptance command into test:public and observe GREEN on the accepted-event matrix.

## 2. Documentation and qualification

- [x] 2.1 Ensure Deployment lag is disclosed in scheduling and external-content documents; content review must distinguish due time, next successful build, completed snapshot and local-only implementation from actual deployment.
- [x] 2.2 Qualify the isolated candidate with pnpm test, pnpm check, pnpm build:all and spectra validate; retain logs, verify original dirty-file hashes and index, and copy only scoped files after all checks pass.

## 3. Current superseding implementation

- [x] 3.1 Deliver Existing release scheduler preserved and Single automatic delivery owner; retire the legacy triggers and demonstrate real YAML acceptance RED then GREEN without changing the two editorial cron expressions.
- [x] 3.2 Deliver Strict completed snapshot restoration before both builds; pin revision and all 30 hashes, reject unavailable/active/incomplete/tampered snapshots before atomic replacement; verify with the real restoration command tests and offline network assertions.
- [x] 3.3 Deliver SHA-specific CMS verification and exact failed-run recovery across both approved workflows; verify differing trigger/artifact SHA, no-op/skipped runs, unrelated latest runs, failed build/deploy, successful-run retry rejection and ReleaseDelivery SHA forwarding.
- [x] 3.4 Deliver Protected local qualification and current supersession documentation; retain Deployment lag is disclosed, No early publication and Preserve protected deployment boundaries evidence while recording legacy Automatic Pages rebuild triggers withdrawal. Run pnpm test, pnpm check, pnpm build:all, pnpm release:dry-run, actionlint and spectra validation; compare scoped copy-back hashes and leave push/deployment pending.
