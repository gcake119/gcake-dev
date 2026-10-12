> 2026-10-13 supersession: the push main / minute-37 candidate below is legacy and MUST NOT be activated. The Current implementation section supersedes its delivery decisions. Completed historical tasks remain evidence only.

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

## Current implementation

Decision context: gate level 2; scheduling, sync and operational evidence boundaries apply. No decision ledger exists. The user's 2026-10-13 instruction supersedes the old automatic-trigger decision; record supersession in this change, with no unrelated ADR bootstrap or archive.

### Strict completed snapshot restoration
**Supersedes**: restore-pages-scheduled-deployment / Preserve build and snapshot boundaries
Both delivery builds run content:restore:ithome before pnpm build. Fetch only the site's saved snapshot, reject active/partial data, and pin source revision plus every article SHA-256 against a separately tracked completed manifest. Validate all bytes offline before temporary-file write and atomic rename. Any fetch/parse/hash/revision/write failure rejects the build; never read retired sources or use tracked 19-post fallback. Keep the historical ongoing sync helpers available only outside these workflows.

### Single automatic delivery owner
**Supersedes**: restore-pages-scheduled-deployment / Reuse the existing Pages workflow
Editorial release retains its existing cron expressions and D1 release identity. Ordinary Pages remains manual only; no push/minute-37 trigger or new workflow. Existing release outputs select build/deploy once; no-op ticks produce neither. Failed-job recovery reruns only failed jobs of the recorded run, never dispatches a new release or replays successful deployment jobs. Explicit manual deployment is a separate operator action, not a second automatic delivery path.

### SHA-specific CMS verification
Read both approved Pages workflows, bounded to the latest 100 main runs each. Job names Build publication <40-hex SHA> and Deploy publication <40-hex SHA> expose the actual artifact revision; editorial run.head_sha precedes the publication commit and cannot be used as its artifact identity. Manual checkout pins github.sha so its named revision is exact. Ignore skipped/secret-only/no-op runs. Filter observations by the release SHA, prefer the newest matching deployment attempt, and require a successful deploy job for deployed. Missing/over-budget observations stay unknown; no unrelated latest run is substituted. Retry resolves the same failed run again and calls rerun-failed-jobs only after SHA/state checks. Preserve the existing actions-write gate. Pass the release commit SHA through ReleaseDelivery and keep public page/body/date/RSS evidence separate.

## Current Implementation Contract
In scope: strict snapshot restoration, pinned completed manifest, existing workflow guards and artifact SHA job names, GitHubAppReadClient deployment observation/retry, ReleaseDelivery SHA forwarding, acceptance tests, and docs. Out of scope: scheduler timing/eligibility/state edits, provider/email writes, new schedules, Git push, deployment or live D1 writes. Tests exercise the real YAML and restoration command with fake network plus real 30-post data, retaining the old output on failures; GitHub fetch fakes exercise editorial head/artifact mismatch, skipped ticks, unrelated/newer runs, failed build/deploy and exact-run recovery. Local qualification requires pnpm test, pnpm check, pnpm build:all, pnpm release:dry-run, actionlint, spectra analyze and validate. Copy only qualified scope files back after original file hash comparisons. Provider/live acceptance remains pending.
