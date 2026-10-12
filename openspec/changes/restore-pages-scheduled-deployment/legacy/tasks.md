## 1. Acceptance and implementation

- [x] 1.1 Define acceptance tests for Automatic Pages rebuild triggers, No early publication, Preserve completed external snapshot and Preserve protected deployment boundaries; observe RED on the real missing hourly trigger using node --import tsx --test test/pages-scheduled-deployment.test.ts.
- [x] 1.2 Reuse the existing Pages workflow and Preserve build and snapshot boundaries; restore hourly/main-push triggers without changing Secret jobs or stale-artifact steps, integrate the acceptance command into test:public and observe GREEN on the accepted-event matrix.

## 2. Documentation and qualification

- [x] 2.1 Ensure Deployment lag is disclosed in scheduling and external-content documents; content review must distinguish due time, next successful build, completed snapshot and local-only implementation from actual deployment.
- [x] 2.2 Qualify the isolated candidate with pnpm test, pnpm check, pnpm build:all and spectra validate; retain logs, verify original dirty-file hashes and index, and copy only scoped files after all checks pass.
