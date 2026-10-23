# 提交前驗證與 PR 準備（２０２６－１０－２３）

## 當次授權與候選

使用者已確認實際文章結尾版本，重新授權完成提交前完整驗證、提交及建立 PR；不合併或部署。這取代前輪「僅本機實作」的執行限制，但保留 [前輪紀錄](reading-ending-verification.md) 的歷史範圍與結果。

候選分支 `codex/article-sharing`，基底 `53f1e69dd284ff865ede5c5d218078a4290fe36a`；提交前 fetch 後與 `origin/main` 無分歧。本次程式、測試與規格屬於同一項完整文章結尾功能。`AGENTS.md` 的既有其他工作修改與 `output/` 的暫存輸出不納入提交。

完整 required local gate 依現行 `.github/workflows/validate-pr.yml`，在本次既有隔離工作目錄 `/private/tmp/gcake-article-sharing-verify-20261023` 執行。候選來源逐檔複製並比對 SHA-256，沿用同一份已安裝依賴，不修改 lockfile、tsconfig、工作流程或 required checks。隔離的原因是原 checkout 的歷史 `output/` 有不屬於本次候選的 TypeScript 檔案；沒有刪除或排除那些原有檔案來製造通過。

環境為 macOS、Node 22.23.4、pnpm 10.17.1、Python 3.11.15；PR CI 為 Ubuntu 24.04／Node 24，遠端結果須另外確認。設定 `EDITORIAL_RELEASE_ENABLED=false`、`HERMES_RSS_NOTIFY_ENABLED=false`，本機 fixtures 與正式服務分離。

## 完整本機結果

| 檢查 | 最終結果 |
| --- | --- |
| `pnpm test` | exit 0；Node ７９０項＋Python／Hermes ２８６項，共１，０７６項，０失敗、０略過。涵蓋 editorial、public、foundation／visibility、全部工作區、distribution 與 observability。 |
| `pnpm check` | ２７８檔，０ errors／warnings／hints；測試修訂後重跑通過。 |
| `pnpm build:all` | 公開站５２頁與所有工作區建置通過。後續只修改測試／紀錄，產品、依賴與建置設定不變，沿用此 artifact。 |
| `pnpm release:dry-run` | 本機模擬 passed；來源 digest、失敗重試同身分、內容與閱讀順序、通知去重通過。 |
| `pnpm editorial:rehearse` | 本機可拋棄部署／通知演練 passed。 |
| Spectra | validate valid；analyze ０ Critical／Warning，２３項補具體 Example 建議，既有 Gherkin 與驗收完整。 |

最終精簡機器紀錄見 [evidence/pre-pr-gates.json](evidence/pre-pr-gates.json)，同時保存原始 logs 的 SHA-256；實際受測產品／測試／package 來源見 [evidence/pre-pr-source-digests.json](evidence/pre-pr-source-digests.json)。

建置後額外執行既有 rendered／subscription 驗收：３／３，覆蓋３６篇公開文章與首頁。前輪的１６組桌面／手機、明暗主題與鍵盤瀏覽結果仍適用，產品來源、依賴及版面未變，不為階段切換重跑。

## 發現與處理

首次完整 `pnpm test` 通過 Hermes ２８６項與 public １０３項後，於舊 `public-visibility.test.ts` 的篇尾分頁原始碼正規表示式失敗：它要求已被核准新版取代的 `<nav class="article-pagination">`。保留 manifest 來源與公開過濾的架構契約，移除兩項依賴舊版面寫法的 UI 斷言，將可見行為補強於建置 HTML 驗收：已知獨立文章沒有系列控制；已知連載最新篇提供正確上一篇與總覽、不顯示未公開下一篇、顯示最新篇中性文案。不是略過該需求，沒有修改產品或放寬驗收條件。１８項 foundation／visibility 與３項建置驗收均通過；修正後重新執行完整 aggregate。

發布 dry-run 首次因沙箱拒絕啟動 localhost 測試伺服器（`listen EPERM 127.0.0.1`）而失敗；保留原始錯誤，經執行權限允許後重跑同一指令通過，沒有更改檢查。兩項發布演練均回報 `productionWrites=false`、`telegramNetworkCalls=0`、重複通知０，只有 disposable fixture 的 Git／D1 模擬寫入。

提交檢查另發現３份 RED log 的空白行帶有測試框架輸出的行尾空白；提交副本只正規化行尾空白，原始逐位元版本保留在本機 `raw-*.log`，不更改失敗內容或結果。

未改變部署或發布 workflow。首次失敗與最終 logs 保存於 `output/article-sharing/full-gates/`；精簡摘要與來源 digest 保存於 `evidence/`。沒有使用 Docker，也沒有新增依賴、CI job 或測試層。

## 決策與驗收界線

Decision context：Level 2；範圍為公開文章結尾、導覽與原生分享。依循本索引的分享／閱讀優先修訂、`docs/design-system.md` 與本變更規格；canonical／Open Graph／原文所有權、搜尋 ADR-001、排名與 provider 權限均不變。沒有新架構決策，只需在 ledger 補上當次授權與證據；本次不封存。

使用者已確認真實原生分享選單開啟與取消正常，並接受實際新版面；自動測試則證明 payload、復原、閱讀順序與可見結果。兩者均不能證明接收平台實際發文或送達。本輪不觸發真實分享、發布、通知或部署；PR CI、合併與正式驗收不屬於本機通過證明。
