> 歷史規格：此已完成變更的分發目標已由 remove-paragraph-sync 取代。不得依此文件啟動舊目標；現行操作以 Substack-only 同步文件及新規格為準。

## Why
PR #8 prepares write-disabled bundles but production distribution lacks durable uncertainty protection and a Substack browser runtime. Continue the existing services without enabling live writes.
## What Changes
- Preserve remote identity, checkpoint uncertain writes, and serialize each platform independently in D1.
- Reuse the Paragraph REST service behind deployment and article revision approval gates.
- Add an attended Substack Playwright runtime with reviewed UI selectors and public verification.
- Add local end-to-end fixtures and operator commands; retain no-email defaults.
## Capabilities
### New Capabilities
- controlled-distribution: Explicit revision-bound distribution, checkpoints, browser adapter, and verification.
### Modified Capabilities
- publishing-operations: Preserve identities and independently recover uncertain attempts.
## Impact
- Modified: apps/admin-worker/src/publication-operations.ts, apps/admin-worker/src/paragraph-provider.ts, scripts/publishing/prepare-distribution.ts, package.json.
- New: apps/admin-worker/src/distribution-coordinator.ts, scripts/publishing/substack-browser.ts, scripts/publishing/run-distribution.ts.

## Accepted continuation, 2026-10-12
The user selected option 3: Substack full-text mirror with a platform canonical exception, Pages source link, and original date restored after initial web-only publication. This authorizes implementation only. Paragraph remains strict. Production gates stay disabled.

## Trial preparation continuation

The user requested completion of the engineering blockers without live writes. Add a revision-scoped controlled-trial entry separate from general production gates, an attended side-browser handoff behind the existing D1 coordinator, and latest-main integration. Preserve the approved Pages article and existing runtime; no provider draft, publication, newsletter, merge or unattended activation is authorized.

## Superseding workflow authorization, 2026-10-12
The user corrected the premature Pages publication and selected Pages-first unattended synchronization using Codex scheduling and the authenticated side browser. This supersedes repeated article-level prompts and the earlier no-unattended-activation boundary for the configured article. The original remains ready/withdrawn until its normal release. No provider write is authorized before current Pages verification; no newsletter, PR #8 merge, historical replay or cookie export.

## Superseding all-article scope, 2026-10-12
The latest user request extends Pages-first synchronization to every formal gcake-dev Markdown article, including first-time backfill and later revisions. Earlier single-article and repeated approval restrictions are superseded. Inventory every local Markdown/MDX candidate and external aggregate entry; report nonportable and non-authoritative sources without substituting summaries. Reuse existing platform services, D1 identity and side-browser exchange. No original deployment, PR merge, historical bulk publication or concurrent writer activation.

## Scripted workflow continuation
The user requested reusable scripts for the synchronization flow. Replace per-round temporary controller programs with one pinned round CLI and a source/intent-bound side-browser handoff CLI. Retain existing providers, D1 coordinator, zero notifications and current live runtime until the scripted candidate is validated.

## Independent system scheduler continuation
The user explicitly approved replacing the Codex heartbeat and side browser with a script-controlled dedicated browser profile, signed in by the owner, while retaining both platforms. Implement a macOS user LaunchAgent and source-bound profile transport; preserve the old runtime until real standalone read-only acceptance and single-writer cutover pass.

## Accepted macOS existing-Chrome continuation
The owner selected macOS automation of the manually authenticated existing Chrome, replacing the separate-profile transport for system scheduling. Use Chrome Apple Events with a single bound authorized tab; no CDP, profile copying, authentication export or private provider API. Permission activation remains a separately confirmed step.

## Public identity repair continuation
Use the anonymous public article HTML's explicit post ID, publication ID and canonical URL together with the bound editor post path. This replaces the absent editor href for the explicit native policy; no private API or popup permission change. Newly published IDs resolve through the public archive HTML; absence or ambiguity retains the original intent, never republication.

## Current target boundary, 2026-10-13
Paragraph authorization was revoked and its executable implementation removed in main. This continuation targets Substack only and does not restore retired provider code, routes or commands. Preserve historical IDs and unknown intent; maintain all-target read-only D1 reconciliation. Commit and PR preparation are authorized; merging and deployment are not.
