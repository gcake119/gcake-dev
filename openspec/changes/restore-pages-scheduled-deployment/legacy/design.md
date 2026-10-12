## Context

Pages currently supports manual deploy and a protected read-only Secret acceptance path. Series scheduling already filters visibility using Taipei publication instants. Completed iThome content is restored from its saved 30-post snapshot. The root checkout is dirty and other worktrees belong to separate work.

Decision context: existing series-scheduling, publishing-operations and local external-content documentation apply. There is no docs/decisions ledger. This change restores deployment triggers without altering visibility or platform authority; no ADR, ledger bootstrap or archive backfill is needed in this local implementation.

## Goals / Non-Goals

Goals: restore automatic static deployments after due times and main pushes, preserving manual acceptance isolation and completed snapshot integrity.
Non-Goals: commit, push, merge, live deployment, article status/date changes, provider or newsletter writes, other worktree edits, secrets, and a guarantee of punctual delivery.

## Decisions

### Reuse the existing Pages workflow

Add push branches main and cron 37 * * * *; preserve workflow_dispatch inputs. Existing job conditions compare the manual mode against secret-check and require main. Absent automatic-event inputs are empty, so automatic runs pass the deploy condition. Tests evaluate the actual restricted condition expression across schedule, push, manual deploy, and protected acceptance events. Do not introduce a second workflow or supervisor.

### Preserve build and snapshot boundaries

Keep checkout main, completed-snapshot restoration, build dependency, concurrency without cancellation, least-privilege permissions, stale source revision rejection, and the read-only Secret jobs unchanged. Frozen snapshot tests use the current 30-post saved data, assert zero source requests, and reject corrupted content. Existing public visibility tests cover due-time filtering.

## Implementation Contract

In scope: .github/workflows/deploy-pages.yml trigger configuration and checkout label, test/pages-scheduled-deployment.test.ts accepted-event matrix and snapshot integrity, package.json inclusion in test:public, updating only the obsolete no-automatic-trigger assertions in scripts/publishing/deployment-rehearsal.test.ts and scripts/workspace/foundation.test.ts while retaining queue-writer rejection and manual-only Admin deployment, and scheduling documentation. The acceptance command is node --import tsx --test test/pages-scheduled-deployment.test.ts, followed by pnpm test, pnpm check and pnpm build:all in an isolated clone.

The first acceptance run must fail because the real workflow lacks the hourly trigger. After adding the triggers, schedule and main push must select build/deploy, feature push must not select deployment, manual main deploy remains usable, and Secret acceptance cannot select deployment. A completed snapshot must return all 30 posts without network callbacks, including when corruption is rejected. Existing visibility tests must retain the exact Taipei boundary.

Inspect the unrelated Secret job definitions and all existing build/deploy steps against the backed-up workflow. Copy only validated scoped files back with hash comparisons; preserve every pre-existing dirty file outside this scope and the index. CLI artifacts remain an unarchived local change.

## Risks / Trade-offs

GitHub schedules can be delayed or skipped; document the next successful deployment rather than a punctual guarantee. Main must be the repository default branch for hourly runs. These local checks do not prove GitHub event delivery, Pages environment approval or a live deployment. Automatic builds spend runner minutes. A concurrent main edit can fail the stale-artifact check; a later scheduled run retries the new main state.

## Migration Plan

No live change is performed here. A separately authorized future commit/push to main enables the triggers. Rollback removes only the two automatic triggers while preserving the completed snapshot and manual controls.
