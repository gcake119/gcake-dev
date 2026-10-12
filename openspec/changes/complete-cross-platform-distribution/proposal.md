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
