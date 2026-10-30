## Why

目前以本機 Wrangler 管理 API 讀取 D1 的追蹤曾遭 7403 拒絕，讓監測中斷；這不證明原 Cloudflare Cron 或索引停止，根因也尚未確立。需要將日常唯讀觀察與高權限管理操作分離，同時保留完整供應商驗收的證據界線。

## What Changes

- 在既有搜尋 Worker 新增受獨立監測憑證保護的 GET 狀態端點，透過既有 D1 綁定讀取一致快照；不經 Cloudflare 管理 API，不執行同步、推論、額度重設或向量操作。
- 提供有版本的最小摘要：來源／作用中集合、已記錄驗證進度、待確認數量、排程等待、證據期限與最近安全收據；明確區分進行中、等待、受阻與完成候選。
- 增加小型本機監測客戶端，核對當期公開 manifest，保存增量安全收據與失敗證據；可供既有對話追蹤使用，不新增排程服務。
- 將全量完成候選、獨立 provider audit、正式語意 API／瀏覽器與人工品質各自列示，不以進度摘要取代驗收。

- 在既有後台「發布管理」加入「搜尋索引」唯讀區塊，以圖形化進度條搭配段數／百分比顯示進度、等待／停止原因、最後更新與驗收階段；由後台既有登入授權的伺服器代理讀取，監測token不送至瀏覽器。

- 沿用 docs/design-system.md 既有後台字級、間距與基本元件樣式，補齊共用進度條的已知／未知／過期／失敗／空集合呈現與無障礙契約。

## Capabilities

### New Capabilities

- `readonly-index-status`: 已驗證操作者的無管理 API 唯讀索引摘要、有限收據分頁、監測與完成候選判定。

### Modified Capabilities

None. Existing search, index synchronization, free-only policy and publication behavior remain unchanged.

## Impact

- Affected specs: readonly-index-status；沿用 fix-discovery-corpus-identity 的 proof 與證據界線，不改其驗收條件。
- Affected code:
  - Modified: `apps/search-worker/src/index.ts`、`apps/search-worker/wrangler.jsonc`、`apps/search-worker/worker-configuration.d.ts`
  - New: `apps/search-worker/src/index-status.ts`、`scripts/discovery/monitor-index.ts`、`test/discovery/index-status.acceptance.test.ts`、`test/discovery/index-monitor.acceptance.test.ts`
  - Modified: `docs/design-system.md`、`docs/article-discovery-runbook.md`、`docs/decisions/ADR-001-cloudflare-semantic-search.md`、`docs/decisions/index.md`
  - New: `packages/admin-contract/src/index-status.ts`、`packages/admin-contract/src/index-source.ts`、`packages/admin-contract/src/index-source.test.ts`；透過既有export／test入口共用純schema與公開來源reader，不新增依賴。
- Admin additions: `apps/admin/src/IndexStatusPanel.vue`、`apps/admin/src/index-status.ts`、`apps/admin/src/index-status.test.ts`、`apps/admin-worker/src/index-status.ts`、`apps/admin-worker/src/index-status.test.ts`；modify `apps/admin/src/admin.css`、`apps/admin/src/App.vue`、`apps/admin-worker/src/router.ts`、`apps/admin-worker/src/index.ts`、`apps/admin-worker/wrangler.toml` and generated binding types.
- No new service, package dependency, schema migration, CI workflow or cloud Cron. Reuse existing runtime bindings and test gates. Initial secret provisioning and Worker deployment remain separate external actions; this planning request performs neither.
