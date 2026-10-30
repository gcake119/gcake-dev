## Problem
The production search API returns hybrid results, but the published reader page has an empty semantic endpoint and performs only keyword search.
## Root Cause
The automatic editorial Pages build omits the existing repository PUBLIC_SEARCH_ENDPOINT variable. The manual Pages build already forwards it.
## Proposed Solution
Forward the same existing variable in the automatic build and extend the existing Pages workflow contract test. Verify configured and missing-endpoint artifacts locally, then publish only an unchanged public article set after PR and exact main CI.
## Success Criteria
Both Pages build paths preserve the configured semantic endpoint; the reader performs the real hybrid request. Missing configuration retains keyword-only behavior. Publication guards, schedules, article identities, revisions and notification behavior remain unchanged.
## Capabilities
### New Capabilities
- `pages-search-endpoint-continuity`: Preserve existing semantic search configuration across publication builds.
### Modified Capabilities
None.
## Impact
- Modified: `.github/workflows/editorial-release.yml`, `test/pages-scheduled-deployment.test.ts`, `docs/article-discovery-runbook.md`, `docs/decisions/index.md`.
- No new service, dependency, database migration, secret, schedule or policy.
