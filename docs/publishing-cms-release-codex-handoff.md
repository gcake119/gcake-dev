# Codex handoff — Publishing CMS long-term release queue

## Latest implementation handoff — 2026-10-11

成果工作目錄：`/Users/caiyijun/project/gcake-dev-release`，分支 `feat/publishing-cms-release-design`，基底 `dd1b9de`。本次交付依功能拆為 atomic commits；主 checkout 的既有 dirty main 未改動。下方 original baseline 是接手前快照，當時的 UNVERIFIED／缺少功能敘述不是現在的狀態。

Spectra change `openspec/changes/integrate-durable-release-queue` 已完成持久化 D1 佇列、Git 歷史首次定稿時間、唯一時段與 fenced lease、停用的原子 Git 發布、公開頁／RSS 分別驗證、CMS owner／CSRF 操作、受 gate 保護的 Actions 排程及可安裝的 Hermes poller。最新合併前修正後 225 Node／4 Python tests、check（144 files 無 errors／warnings／hints）、build:all 與本機 release:dry-run 通過。AI review 的預覽競態與 scope 暫停問題已以 RED→GREEN 修正並複查關閉；停用說明已釐清 Worker 才是寫入 gate。完整測試／build／模擬及 AI review 以 `docs/publishing-cms-release-verification.md` 為證據，部署與啟用步驟見 `docs/publishing-cms-release-operations.md`。

### PR #9 合併前修正 — 最新政策

非週一／四的 legacy published 日期不再占用下一個發文時段；UTC 時間先取台北日期再判定星期，舊日期與內容不改。Worker／Pages workflow 改為僅 main 人工觸發，移除 push／merge 部署與 Pages 每小時排程。PR CI 繼續自動測試。下方 original baseline 的 hourly recovery 僅為歷史需求，已由這次使用者指示取代。正式自動發布 → Pages 的無人值守部署尚須另行設計、授權及驗證，不可只打開兩個 gates 就宣稱完整上線。

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

PR #9 原無 CI 的原因與新增只讀 pull_request workflow，見 verification 的「PR #9 CI 補強」；線上成功以 PR Checks 為準。未合併、未部署，正式發文停用。

## 正式啟用授權延伸 — 2026-10-12

PR #9/#10 已經明確授權合併與人工部署。正式 owner OAuth 更新後 Computer Use 登入通過且reload保持，六篇ready／三組系列／排程正常。使用者現已授權補齊 conditional Pages delivery、驗證後合併及 rollout 並啟用兩道 gates。新增流程只在新 publication SHA 時建置／部署，一般 merge 與空 hourly check不部署。復原以原 run 的 failed jobs 為主，未知Git結果保留身分需人工查核。Hermes／Telegram未啟用，其他providers仍停用。最新驗證見verification啟用延伸，操作與metadata限制見operations啟用延伸。


## 正式啟用完成紀錄 — 2026-10-12 01：44（Asia/Taipei）

本段取代此前「正式發文尚未啟用／待授權」的狀態敘述。使用者已明確授權補齊、驗證後啟用。PR #12 於 01：41 合併，部署來源為 f2cf3a8fed1c2613bc584541e732fc29cee48ec0；最新候選 c554258 的必要 CI validate 通過（run 38160597474）。本機完整 234 Node／4 Python tests、check、build:all、release:dry-run 與三面向 AI review 證據見上方啟用延伸。

Worker 已人工部署，版本 4b93b235-0810-4891-9813-b5a2379133df；RELEASE_WRITE_ENABLED=true。Actions repository variable RELEASE_AUTOMATION_ENABLED=true；editorial-release environment 限 main，Worker／Actions 共用 secret 已配對。停用 gate 時真實請求回應 RELEASE_DISABLED，證明憑證通過但寫入仍被阻擋。OAuth／preview 設定保留，其他 providers 仍停用。

正式 controlled workflow run 38160839881 成功：release 成功，build／deploy 均 skipped；當時尚未到 07：00，沒有新增 publication commit，也沒有部署 Pages。production health 200；Computer Use reload 後 owner gcake119 仍登入，介面顯示「正式發布已啟用」、六篇 ready、首篇〈我是怎麼跟 ChatGPT 協作寫完 30 篇系列文的〉估算 10/12 週一 07：00起。接續日期為 10/15、10/19、10/22、10/26、10/29；遵守台北週一／四、一時段一篇。正文與篇序保留。

這是「已啟用與正式空巡查通過」，不是「首篇已公開」。啟用前六篇頁面 404、RSS 未包含六篇；首次真實 publication → Pages build/deploy → public page/RSS 的完整生產證據仍待到時觀察。一般合併不部署；每小時巡查只在新發文提交時觸發 Pages。若建置失敗，重跑原 run 的 failed jobs，未知 Git 寫入結果先查核原身分，不重新發布。

剩餘人工／授權界線：首篇實際頁面與 RSS 可讀性驗收；需要時人工處理未知寫入或失敗部署；Hermes 安裝、Telegram 收件驗證及外部 provider 發布仍未啟用、未包含本次授權。公開驗證由 CMS 與頁面／RSS 判定，editorial 部署紀錄查看 Actions，CMS 不宣稱舊人工部署證明新 editorial 部署。

證據：PR https://github.com/gcake119/gcake-dev/pull/12；CI https://github.com/gcake119/gcake-dev/actions/runs/38160597474；正式空巡查 https://github.com/gcake119/gcake-dev/actions/runs/38160839881。啟用 UI 截圖保存在本次 Codex visualization 的 production-release-enabled-20261012.png。隨後 main 的 PR #13 僅修正本機 dry-run fixture，Worker／editorial workflow 無差異，不需再次部署。
