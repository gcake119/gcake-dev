## Why
The approved editorial planner is disconnected from CMS content and deployment. Durable release attempts and verified RSS notifications are needed before production can be accepted.
## What Changes
- Persist first-observed readiness and reservations with optimistic Git writes.
- Integrate complete manifests, one Monday/Thursday Taipei slot, standalone priority, deployment recovery and public confirmation.
- Provide a disabled-by-default Hermes RSS poller with restart-safe deduplication.
- Add loopback-only controlled mock delivery for isolated RSS/canonical HTML to simulated Telegram acceptance, without real credentials or production activation.
## Capabilities
### New Capabilities
- `editorial-release`: durable gated release and public notification lifecycle.
### Modified Capabilities
None.
## Impact
- Modified: `src/lib/publishing/release-queue.ts`, `package.json`, `.github/workflows/deploy-pages.yml`.
- New: `scripts/publishing/editorial-release.ts`, `scripts/hermes/rss_monitor.py`, `src/lib/publishing/editorial-state.ts`.

The owner requested an unattended operating plan without collaborators. Add scoped GitHub App authentication for release pushes, a read-only configuration audit, and owner setup/stop instructions; production stays disabled.

Prepare a manual, exact-revision, read-only environment App Secret acceptance path independent of publication. Comparing D1 and Git journal is advisory; neither queue is retired or enabled by this change. Temporary environment branch access requires separate owner approval.

## Owner-approved D1 consolidation — 2026-10-12
The owner now selects D1 as the sole production queue. Align continuous readiness, membership, active-series recovery, latest due slot and public source verification before retiring the Git journal writer. Keep content/manifests in Git, preserve pending identities, main protections, manual deployment and read-only Secret acceptance. No merge, production deployment, activation or real Telegram is authorized.

## Owner-authorized single manual first chapter — 2026-10-12
The owner explicitly authorized the publishing task, through the verified source conversation, to publish chapter one today using the same D1 authority and latest main content, deploy Pages and verify full body/canonical/date/RSS/manifest. Do not backdate startedAt or masquerade as a scheduled 07:00 release; chapter four and other platforms remain out of scope. Add fenced owner-confirmed immediate publication where the existing interface cannot represent this operation, plus safe diagnostics for the currently failing production readiness read.

## Verified release attention repair — 2026-10-12
The owner requests a TDD correction for the already verified first chapter's old-date Needs attention false alarm. Production publishing and Hermes notifications remain enabled. This work only prepares a tested PR; no merge, deployment, repeat publication, D1 reset or notification reset is authorized.
