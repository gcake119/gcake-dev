> 本輪授權更新：使用者已明確授權核對範圍後提交本change、push並建立PR；不合併、部署或操作正式資料。下列歷史階段的提交限制保留為當時紀錄。

> ２０２６－１０－２４執行授權更新：使用者已授權本機實作及驗證本change，取代以下提案階段的僅文件限制；仍禁止commit／push／PR、正式模型／資料操作或部署。歷史提案與外部驗收界線保留。

## Problem

同一份已完結文章快照每次還原會更新 generatedAt，導致搜尋內容未變卻產生新 corpusId，重設同步進度並延長語意搜尋降級。這是 Bug Fix；先修內容身分，再改善既有同步步驟效率。

## Root Cause

Pages 建置先執行快照還原；collectSnapshot 重寫產製時間，site 對完整快照取 snapshotDigest，buildPublicDiscovery 將它納入 corpusId。sourceTree 只供追溯，沒有直接列入該 corpus 雜湊，不能歸因於 main SHA 本身。同步目標改變會歸零游標；每批１６段，上傳、完整讀回後各自結束輪次，連相容向量也需換 namespace。

封存的 before／after manifest 顯示 corpus 與 snapshotDigest 不同，configurationDigest、passages 與 connections digest 相同；index digest 並不相同。來源及證據見設計文件。

## Proposed Solution

- 分離穩定搜尋內容身分與建置追溯，依明確白名單建立確定性內容投影，保留真實修訂、公開資格、連結、中繼資料與設定的失效保護。
- 保留現有１６段批次、每分鐘 cron、單一租約與 pending，允許完整讀回已確認的一批後，在同輪剩餘預算內準備下一批；不忙等供應商、不重播未知推論。
- 規劃舊身分一次性轉換、容量核算及可中斷續作；完整供應商讀回與最終公開來源重查後才切換。
- 以既有 acceptance 測試先取得真實 RED，區分本機、供應商、自然排程與人工驗收。

## Capabilities

### New Capabilities

- `stable-discovery-synchronization`：補強內容身分、版本轉換與有界同步進度契約。

### Modified Capabilities

無。public-article-knowledge 目前仍位於未封存的 build-article-discovery-knowledge，尚非正式規格目錄；本 change 以獨立補充能力依賴該契約，避免兩個 active change 修改同一 delta。

## Success Criteria

同內容於不同還原時間／建置版本保持同一搜尋身分且不重啟同步；真實文章修訂、公開資格或檢索設定變動仍失效。安全狀態情境全部可驗收；同樣供應商可讀時序下，已讀回批次不再強制多等一輪才續作。後續實作、正式寫入與自然新增文章驗收仍須另獲授權。

## Impact

本次只新增本 change 的 proposal、design、specs、tasks；不改產品、正式規格或既有任務勾選。

後續候選修改範圍：
- Modified：`src/lib/discovery/site.ts`、`src/lib/discovery/build.ts`、`apps/search-worker/src/sync.ts`、`test/discovery/corpus.acceptance.test.ts`、`test/discovery/assets.acceptance.test.ts`、`test/discovery/cloud-sync.acceptance.test.ts`、`test/discovery/cloud-runtime.acceptance.test.ts`。
- 參考而非預設修改：`scripts/external/ithome-sync.ts`、`scripts/external/restore-completed-ithome-2026.ts`、`.github/workflows/deploy-pages.yml`。
- 決策回填：未來採納／實作時同步 `docs/decisions/ADR-001-cloudflare-semantic-search.md` 與 `docs/decisions/index.md` 的有界輪次說明；不放寬免費／安全政策。
- 不新增服務、依賴、測試層、workflow 或排程。相容 manifest schema 與現有 D1 狀態優先；需要破壞相容或 migration 時先補規格並另行取得授權。

## Gate 修正追加範圍（２０２６－１０－２４）

使用者授權修復完整本機gate：保留歷史output腳本並補明確型別，批次化同次Hermes authority ACL檢查以減少重複子程序啟動，保留既有期限及安全拒絕。對應同能力新增Complete local gate without weakened authority checks需求；不操作正式runtime或改歷史驗收。


## First-principles architecture repair (2026-10-26)

The authorized local repair separates durable vector identity (model configuration), verified passage proofs, and public release identity. A nineteen-passage addition must not move or reread 2,955 unchanged passages. Retain all previous completion and production evidence as historical; sections describing namespace-per-release are superseded for this new candidate only. Do not raise any limits to conceal amplification.

Scope: search Worker, additive D1 proof/wait-state migration, existing discovery acceptance tests, and architecture/runbook documentation. No new services or dependencies. Production migration, deployment, capacity renewal and switch activation require a concrete reviewed candidate and separate authorization. Public corpus identities and manifests remain unchanged. The existing production pause remains in force.
