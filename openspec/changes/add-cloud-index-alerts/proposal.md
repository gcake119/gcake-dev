## Why
Index progress is visible in the owner admin, but off-page alerts still require a local Codex heartbeat. The user authorizes cloud checks, Telegram alerts and owner-visible notification history, with replacement only after real acceptance.
## What Changes
- Add a bounded fifteen-minute scheduled observer to the existing Admin Worker, using only the fixed read-only search status endpoint and verified public source assets.
- Persist an isolated CMS checkpoint, lease, pause state and deduplicated notification journal. Keep search D1, index Cron, model, quotas and evidence expiries unchanged.
- Deliver alerts to the verified existing owner's Telegram destination, with explicit uncertain-send handling and no automatic resend.
- Show safe read-only alert history and monitor health under the existing index progress panel, including expiry and delivery status.
- Retain the current heartbeat until qualified cloud deployment, real delivery and scheduled observation evidence permit handoff.
## Non-Goals
No article publication, newsletter, index triggers, provider audits, semantic queries, quota changes, automatic renewals, extra Worker, queue, UI framework or CI workflow. No browser push, email or unread inbox in this change.
## Capabilities
### New Capabilities
- cloud-index-alerts: Independent bounded scheduled observation, durable notification journal and owner-visible history.
### Modified Capabilities
(none)
## Impact
- Affected specs: cloud-index-alerts; existing readonly-index-status remains unchanged.
- New: apps/admin-worker/src/index-alerts.ts, apps/admin-worker/src/index-alerts.test.ts, apps/admin-worker/migrations/0008_index_alerts.sql, apps/admin/src/IndexAlertHistory.vue, apps/admin/src/index-alerts.ts, apps/admin/src/index-alerts.test.ts, packages/admin-contract/src/index-alerts.ts, docs/index-alerts-runbook.md
- Modified: apps/admin-worker/src/index.ts, apps/admin-worker/src/router.ts, apps/admin-worker/wrangler.toml, apps/admin/src/IndexStatusPanel.vue, packages/admin-contract/src/index.ts, docs/design-system.md, docs/decisions/index.md
