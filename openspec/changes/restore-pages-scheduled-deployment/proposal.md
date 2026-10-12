> 2026-10-13 supersession: the push main / minute-37 candidate below is legacy and MUST NOT be activated. The Current implementation section supersedes its delivery decisions. Completed historical tasks remain evidence only.

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

## Current implementation

The existing editorial-release workflow already commits and deploys releases. Its build lacks completed snapshot restoration, and CMS only observes the ordinary Pages workflow. Preserve the existing two cron expressions and editorial eligibility; remove the legacy ordinary Pages push/hourly candidate. The pages-scheduled-deployment capability now means safe delivery through the existing scheduler, not new automatic triggers. Repair completed snapshot restoration, automatic deployment ownership, and SHA-specific CMS deployment observation/retry. No live calls, push, deploy, article changes or new schedules are authorized.

Current impact: both existing Pages workflows, strict offline snapshot validation plus saved-snapshot restoration command, pinned completed manifest, GitHub deployment reads/retry and ReleaseDelivery SHA forwarding, acceptance tests, scheduling/operations documents. Existing public-page/RSS verification remains authoritative; an Actions success alone never proves public acceptance.
