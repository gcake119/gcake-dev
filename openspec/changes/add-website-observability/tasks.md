## 1. Production-only measurement

- [x] 1.1 Prove Production-only traffic measurement with acceptance RED on emitted production HTML, then implement the Production-only beacon and verify GREEN for all articles, disabled builds, origin/path boundaries, duplicate execution and invalid tokens.
- [x] 1.2 Configure both Pages build workflows to explicitly enable the beacon and read public repository variables; verify workflow content and the full local gates pnpm test, pnpm check, pnpm build:all and pnpm release:dry-run.

## 2. Search reporting and production evidence

- [x] 2.1 Implement Optional Google verification and prove Search Console verification and evidence through emitted head metadata tests; document existing sitemap and canonical exceptions without token values.
- [ ] 2.2 After owner account selection, configure public build variables and property verification, deploy the reviewed candidate through the existing Pages workflow and inspect actual beacon requests, Cloudflare traffic, Search Console ownership, sitemap acceptance and index status; retain pending evidence explicitly.
