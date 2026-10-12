## 1. Production-only measurement

- [x] 1.1 Prove Production-only traffic measurement with acceptance RED on emitted production HTML, then implement the Production-only beacon and verify GREEN for all articles, disabled builds, origin/path boundaries, duplicate execution and invalid tokens.
- [x] 1.2 Configure both Pages build workflows to explicitly enable the beacon and read public repository variables; verify workflow content and the full local gates pnpm test, pnpm check, pnpm build:all and pnpm release:dry-run.

## 2. Search reporting and production evidence

- [x] 2.1 Implement Optional Google verification and prove Search Console verification and evidence through emitted head metadata tests; document existing sitemap and canonical exceptions without token values.
- [ ] 2.2 After owner account selection, configure public build variables and property verification, deploy the reviewed candidate through the existing Pages workflow and inspect actual beacon requests, Cloudflare traffic, Search Console ownership, sitemap acceptance and index status; retain pending evidence explicitly.

## Production evidence — 2026-10-13

PR #22 merged and Pages run 38289819202 succeeded at source ffb058c4c89418b83591ea47634ec03d9fb89033. Both public repository variables are configured. Actual homepage, local article and imported article each load one official module beacon; script HTTP 200 and RUM HTTP 204 observed. Cloudflare page-views report contains 6 test views: homepage 3, local article 2 and imported Day 30 article 1. Google HTML ownership verification succeeded.

Sitemap submission succeeded, but processing status remains Couldn't fetch. Public XML HTTP 200, valid XML and 10 in-scope production URLs are verified. Google live URL inspection confirms crawl allowed and fetch successful. The identical sitemap URL was resubmitted once after this new evidence, with processing still pending. Homepage and local article index lookups report unknown/unindexed; both live inspections are indexable with their correct gcake-dev production canonicals. Task 2.2 remains unchecked until Sitemap processing is observed successful. Indexing/data accumulation remain external processing states, not code acceptance.
