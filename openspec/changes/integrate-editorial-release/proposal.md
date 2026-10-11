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
