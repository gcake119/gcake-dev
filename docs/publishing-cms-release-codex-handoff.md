# Codex handoff — Publishing CMS long-term release queue

## Latest implementation handoff — 2026-10-11

成果工作目錄：`/Users/caiyijun/project/gcake-dev-release`，分支 `feat/publishing-cms-release-design`，基底 `dd1b9de`。本次交付依功能拆為 atomic commits；主 checkout 的既有 dirty main 未改動。下方 original baseline 是接手前快照，當時的 UNVERIFIED／缺少功能敘述不是現在的狀態。

Spectra change `openspec/changes/integrate-durable-release-queue` 已完成持久化 D1 佇列、Git 歷史首次定稿時間、唯一時段與 fenced lease、停用的原子 Git 發布、公開頁／RSS 分別驗證、CMS owner／CSRF 操作、受 gate 保護的 Actions 排程及可安裝的 Hermes poller。最終 220 Node／4 Python tests、check（144 files 無 errors／warnings／hints）、build:all 與本機 release:dry-run 通過。AI review 的預覽競態與 scope 暫停問題已以 RED→GREEN 修正並複查關閉；停用說明已釐清 Worker 才是寫入 gate。完整測試／build／模擬及 AI review 以 `docs/publishing-cms-release-verification.md` 為證據，部署與啟用步驟見 `docs/publishing-cms-release-operations.md`。

### Admin 介面調整

- 發布總覽：正式發布狀態、週一／四政策、下一篇、估算時段、需處理數量分區呈現。
- 文章排程：文章標題為主、時段為次、系列／資格為輔；重複的 Telegram 外部監控說明整併至清單註解。
- 時段調整：點擊「指定時段」會移至並聚焦日期欄位，預填台北估算日期。修改日期即清除舊預覽。
- 預覽以文章標題與「原時段／調整後」呈現；確認固定為主要動作。桌面分欄，390px 手機上下排列且無橫向溢出，沿用既有主題與 design tokens。

### 本機驗收與證據邊界

使用者已回覆確認：定稿、排程、暫停／恢復、指定時段預覽（第 1–4 項）可正常操作。

依使用者明確要求，以 Computer Use 操作測試文章「本機驗收文章（不會正式發布）」：
1. 確認固定至 2026-10-19 07:00，前兩篇系列改為 10/12、10/15，與預覽一致。
2. 重新整理排程與重新載入頁面後，固定日期仍保留。
3. 取消固定後，測試文章回到 10/12，前兩篇系列回到 10/15、10/19；重新整理後維持。
4. 正式發布狀態仍停用。

固定／取消是代理 Computer Use 驗證通過，不能記成使用者親自操作通過。QA host 使用 loopback、記憶體 SQLite 與 Git snapshot；儲存不提交 Git，重啟清空。本機模擬通知使用 stub，不代表 Hermes／Telegram 真實收件。

截圖位於 `/Users/caiyijun/.codex/visualizations/2026/10/11/01a12b25-7297-7012-8e8d-f5c39a392ef8/`：`cms-hierarchy-mobile.jpg`、`cms-fixed-slot-acceptance.jpg`、`cms-fixed-confirmed.jpg`、`cms-fixed-cancelled.jpg`、`cms-final-review-acceptance.jpg`（最終修正後重跑）。本機管理介面 `http://127.0.0.1:4319/`，啟動命令 `node --import tsx scripts/qa/release-admin-host.ts --demo`。

### 保護與後續權限

正式發布保持停用：所有 Worker 環境 `RELEASE_WRITE_ENABLED=false`；Actions 需另外明確啟用 `RELEASE_AUTOMATION_ENABLED`。使用者已授權 atomic commits、推送此分支及建立 PR；未授權合併或部署。未遠端 migration／部署、未安裝 Hermes／送 Telegram、未啟用 production。

六篇正文與 manifest 閱讀順序不變。唯一內容檔修正為既有無效 frontmatter topic `automation` → `development-automation`，並有回歸測試與 SHA-256 保存證據。

仍需人決定：新版視覺分區與手機可讀性、正式 owner 流程與異常介面驗收；PR 合併；遠端 D1 備份與 migration、Worker 部署、GitHub App 最小權限與受保護分支流程、Actions secrets／environment、核准的非正式真實發布測試、Hermes 帳號安裝及 Telegram 收件驗證。最後 production 啟用時間／第一篇與兩個 gates 為另一次明確授權。完整清單見 operations 文件，估算日期不是正式發文承諾。

## Current decision

This document is a handoff of product requirements, not evidence that production publishing is complete. Branch `feat/publishing-cms-release-design` is forked from `feat/editorial-release-queue`. Do not activate production publishing or change the body or reading order of the six finalized `ithome-2026-extensions` posts without explicit instruction.

Read in this order:
1. `docs/editorial-release-policy-handoff.md`
2. `docs/publishing-cms-release-queue-spec.md`
3. `src/lib/publishing/release-queue.ts` and tests
4. `docs/publishing-cms-architecture.md`, `docs/publishing-cms-implementation-design.md`
5. `openspec/specs/series-scheduling/spec.md`, `openspec/specs/publishing-operations/spec.md`
6. `apps/admin/src/App.vue`, `apps/admin/src/scheduling.ts`, `apps/admin-worker/src/*`, `src/lib/content/publication.ts`
7. `src/content/series/ithome-2026-extensions.yaml`, `.github/workflows/deploy-pages.yml`

## Original handoff baseline — work already committed

- Added `docs/publishing-cms-release-queue-spec.md` (product information architecture, state model, P0/P1, acceptance scenarios).
- Added `src/lib/publishing/release-eligibility.ts` and `.test.ts` (pure snapshot-based whole-manifest eligibility, fail-closed on incomplete/mismatched/missing articles and ambiguous membership).
- Registered both existing planner tests and new eligibility tests in `package.json` `test:public`.
- No production scheduler, queue persistence, CMS routes, Hermes job, GitHub Actions write permission, or release activation was added.
- GitHub connector operations cannot execute the repository test/build pipeline here; `pnpm test`, `pnpm check`, `pnpm build` remain UNVERIFIED, not PASS.

## Original handoff baseline — findings

- The existing pure planner is not production-connected, nor can it validate omitted series posts.
- The old CMS has editable per-post schedule UI and Paragraph/Substack target-state display, but no durable aggregate release queue.
- Git is editorial SSOT; D1 is runtime SSOT; R2 is media SSOT.
- The hourly Pages deploy does not promote `ready` to `published`; GitHub Actions write permissions require a safe, explicit solution.
- Hermes runs in a separate local user; Telegram delivery is not proof of page publication.
- Do not assume any existing or newly written test ran in this hosted environment. Run full test/build/static and production-like dry-run locally before any merge or rollout.

## Original implementation sequence

1. Make an OpenSpec change from the accepted product policy; turn the P0 items in `docs/publishing-cms-release-queue-spec.md` into tasks and acceptance scenarios.
2. Implement robust manifest-wide eligibility + durable D1 ingestion; test unchanged timestamps and partial series.
3. Implement reservation/lease, state machine, idempotent execution and Git atomic changes behind disabled feature gate.
4. Integrate GitHub Actions schedule safely, preserving hourly deploy recovery.
5. Build Admin queue and workflows; retain existing Editor, Series Editor, Publishing Center.
6. Complete RSS / Hermes integration, event/audit/status evidence.
7. Run comprehensive tests and manual UI/design QA.
8. Report on remaining secrets/production permissions and request a single explicit production enablement decision.

Do not silently merge these branches into main and do not mark Oct 12 or later as promised release dates until the scheduler has been activated and checked.
