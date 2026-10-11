## Why
The approved editorial planner is disconnected from CMS content and deployment. Durable release attempts and verified RSS notifications are needed before production can be accepted.
## What Changes
- Persist first-observed readiness and reservations with optimistic Git writes.
- Integrate complete manifests, one Monday/Thursday Taipei slot, standalone priority, deployment recovery and public confirmation.
- Provide a disabled-by-default Hermes RSS poller with restart-safe deduplication.
## Capabilities
### New Capabilities
- `editorial-release`: durable gated release and public notification lifecycle.
### Modified Capabilities
None.
## Impact
- Modified: `src/lib/publishing/release-queue.ts`, `package.json`, `.github/workflows/deploy-pages.yml`.
- New: `scripts/publishing/editorial-release.ts`, `scripts/hermes/rss_monitor.py`, `src/lib/publishing/editorial-state.ts`.
