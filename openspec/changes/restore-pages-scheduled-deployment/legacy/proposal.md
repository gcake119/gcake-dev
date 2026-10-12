## Why

The behind-the-scenes series is complete and serializing, but Pages currently deploys only on manual dispatch. Due articles cannot become visible without an operator. The user authorized restoring hourly and main-push deployment locally, without commit, push, or live deployment.

## What Changes

- Restore hourly deployment at minute 37 and pushes to main, retaining manual deployment and read-only Secret acceptance.
- Reuse publication-time filtering and the completed 30-post snapshot; retain stale-artifact rejection and provider separation.
- Add local workflow acceptance coverage and correct scheduling documentation.

## Capabilities

### New Capabilities

- `pages-scheduled-deployment`: automatic static rebuilding after publication time and main pushes, with protected deployment boundaries.

### Modified Capabilities

No existing requirement changes; the visibility rules of series-scheduling remain authoritative.

## Impact

- Modified: `.github/workflows/deploy-pages.yml`, `package.json`, `scripts/publishing/deployment-rehearsal.test.ts`, `scripts/workspace/foundation.test.ts`, `docs/article-scheduling.md`, `docs/external-content.md`.
- New: `test/pages-scheduled-deployment.test.ts`.
- Related specification: series-scheduling. No provider, newsletter, credential, or article-state changes.
