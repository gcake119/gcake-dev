# 正式部署、驗收與結案（２０２６－１０－２３）

本紀錄回填已完成的外部操作與驗收，不代表本次重新部署或重新執行正式模型查詢。正式網站為 [gcake-dev](https://gcake119.github.io/gcake-dev/)。原階段的本機限制、失敗結果與人工驗收界線保留，不以最終成功覆寫歷史。

## 版本、授權及遠端證據

[PR ＃６７](https://github.com/gcake119/gcake-dev/pull/67) 的功能來源為 `430affbe7980726313c5405c3ef02242acbd0b51`；使用者後續明確授權合併、部署及正式驗收，於 `2026-10-23T13:14:45Z` 合併為 main `30ac9643baab718a7690bbea5af22658832cb616`。兩者產品 tree 相同。

| 階段 | 證據及結果 |
| --- | --- |
| 提交前本機 | [完整驗證](pre-pr-verification.md)：１，０７６項測試通過，Astro ２７８檔零診斷，全部建置及兩項發布演練通過。 |
| PR CI | [39958933774](https://github.com/gcake119/gcake-dev/actions/runs/39958933774)：功能來源 success。 |
| 遠端程式審查 | [已完成的 Codex 審查](https://github.com/gcake119/gcake-dev/pull/67#issuecomment-6365640314)：釘選 `430affb`，無 findings／未解決 findings；不是人類 Approve。 |
| main CI | [39959610473](https://github.com/gcake119/gcake-dev/actions/runs/39959610473)：合併版本 success。 |
| Pages 部署 | [39960141344](https://github.com/gcake119/gcake-dev/actions/runs/39960141344)：同一 main success。 |

本次封存前唯讀重新核對上述 PR 身分及三份 workflow 結果，未重跑 workflow。使用者另外明確授權正式 D1／Vectorize 重用、補段、完整讀回後切換索引；零付費超額、不改 Worker／排程。最初自動核准拒絕索引寫入，理由為原合併／部署授權未涵蓋正式資料維護；被拒絕指令未執行，取得具體授權後才續作。這次文件封存只獲准提交及建立 PR，不合併或再次部署。

## 正式文章結尾

[evidence/production-20261023/](evidence/production-20261023/) 內收據與４張代表截圖逐位元複製自本機正式驗收輸出；[source-manifest.json](evidence/production-20261023/source-manifest.json) 保存來源路徑、大小與 SHA-256。原始部署 artifact、完整清冊、大型向量／模型輸出及操作腳本不加入 Git。

- `pages-readback.json`：３６篇文章、首頁、搜尋頁，共３８份正式 HTML 與部署產物一致；manifest、JS 及３份搜尋資產亦相符。`styles-readback.json`：正式 CSS 與產物相符。
- `production-rendered.log`：對實際部署產物執行既有建置驗收，３／３通過，涵蓋篇尾順序、公開前後篇、推薦上限與去重、分享 SVG／文案／閱讀網址、訂閱、canonical／OG／原文連結。
- `ending-result.json`：Chrome 155.0.8059.86，系列中段、已完結末篇、獨立文章、本地連載最新篇，１２８０／３９０px、明暗主題，共１６組；字級、順序、無水平溢出、鍵盤焦點與實際 Enter 導覽通過。代表畫面為 `ending-day-08-1280-light.png`、`ending-standalone-390-dark.png`。
- 正式分享錯誤與取消使用瀏覽器能力替身，驗證可選完整網址與中性取消；不支援、無 JavaScript 與引用展開通過。使用者先前已確認本機真實系統選單開啟／取消正常及接受新版面；不冒稱本輪重新驗證系統選單，也不推定接收平台發文或送達。

## 搜尋降級與恢復

Pages 公開 corpus 為 `aefe3aff5eb302a1e8bba18b7b224ed15bdaa15f4d646cc2f81855228cc840a5`。部署前公開 manifest 也已不同於作用中索引，不能把部署前狀態視為已正常。初次正式 API 實際回覆４０９／CORPUS_MISMATCH，保留於 `semantic-api-before-index-alignment.json`；`search-observed.json` 與 `search-fallback-390.png` 證明關鍵字２６篇、分頁、文章導覽與手機無溢出可用。這是當時的成功降級，當時語意搜尋尚未恢復。

後續獲授權維護的結果：

- 既有２，６８８筆相容向量完整核對後重用，沒有重新推論；缺少２６７段分１７批補齊，自然 cron 與前景維護共同完成。`index-alignment.json`、`foreground-fill.json` 分別記錄重用與後段補齊；後者的１７１段不是整輪２６７段總數，另重用１６筆已保存 pending 結果。
- 沿用正式單一租約、原子配額預留與未知結果不重播政策。本機 protected-trigger 憑證檔不存在，首次嘗試於讀檔即停止；後續以既有 OAuth 的前景 API adapter 與既有同步函式執行。在正常步驟結束、owner 空且租約歸零時才取得維護租約，停止本次 driver 並保存已完成結果；沒有新增正式 Secret、公開操作入口、服務或排程。
- `complete-readback.json`：２，９５５筆×１，０２４維完整讀回，核對 finite／正規化、metadata／namespace、修訂與內容 hash；原２，６８８筆逐維比對容許差異１e－６。完成於 `2026-10-23T13:58:47.538362Z`，先於自然 cron 的 promoted 收據２７７４（`2026-10-23T13:59:31.323Z`）。前景提升檢查隨後回覆 no_change，沒有直接跳過讀回修改 policy。
- 最初整庫檢查曾因已保存 pending 停止（`complete-readback-known-pending-detected.log`）；未忽略 reserved 未知結果。後續已知輸出核對分支準備完成時，自然 cron 已完成該批；最終 `knownPendingFullyReconciled=0`。最初最終快照尚無獨立自然收據，另一次碰到自然 cron 短租約，兩份失敗／等待 log 均保留。之後以單一 SQL 同讀 owner／pending，確認自然續作完成，不停用或改動 cron。
- `final-index-readback.json` 與 `index-recovery-receipt.json`：游標２，９５５、pending＝０、owner＝null、leaseUntil＝０；獨立自然 no_change 收據２７７７至２７８０。政策只切換 activeCorpusId，Worker 部署、settings、排程與額度限制不變，沒有補滿已消耗額度。
- `semantic-api.json`：真實２００／hybrid／新版 corpus，首筆為 Day 24；單次約３．７７秒是有限 smoke，不是延遲或全量搜尋品質保證。`semantic-restored.json` 與 `semantic-restored-390.png`：真實正式回應、沒有 route 覆寫或回應替身；手機第一／第二頁各１０筆、總數２６，分頁、文章跳轉、重試隱藏及無水平溢出通過。API smoke 與瀏覽器使用不同查詢，總數分開記錄。

## 免費保護、保留限制與清理

BGE-M3 plain／１０２４維、paidOverage＝０、原免費硬上限與每日上限、證據期限 `2026-11-20T00:00:00Z` 不變。２６７段的 `tokensReserved=48459`、`unitsReserved=52.093425` 是保守預留，不是供應商實際用量；新增儲存２７３，４０８維，整庫３，０２５，９２０維。索引重用零嵌入不代表整輪零模型呼叫。OAuth 缺 Billing Read，未讀帳單，不宣稱實際帳單金額或由速度推算節費。

`temporary-vector-cleanup.json` 保存２２份本次向量／模型暫存檔的雜湊及刪除紀錄，共４４，１４２，６１８ bytes；未刪正式資源。驗證瀏覽器已關閉，未使用 Docker，既有本機預覽保留。非本次的 `AGENTS.md` 修改與歷史 `output/` 不納入提交。

另一變更 `build-article-discovery-knowledge` 的１．１歷史 RED 證據與１２．２首次自然新增文章完整同步仍未完成。本次有前景維護，不能用最終自然 no_change 取代全程自然同步驗收，也不封存該變更。

## 本次封存的驗證範圍

Decision context 為 Level 2：沿用閱讀優先篇尾決策、公開設計規範、canonical／OG 所有權及 ADR-001 免費搜尋政策；只回填結果與後續授權，不新增架構或政策，更新決策索引即可，無新 ADR。Codebase Memory MCP 的決策讀取回覆 Transport closed，改讀 repository 的決策索引與 ADR 文件。

本次只變動文件、證據及 Spectra 封存／正式規格，執行程式、依賴、測試及工作流程與受測 main 相同，重用上述完整本機 gate 與精確 main CI 證據。另驗證 Spectra、所有攜帶證據 SHA-256、完整讀回早於提升、收據一致性、文件連結與 staged diff。不新增測試層、workflow 或正式查詢；封存 PR 的遠端 CI 結果另行判讀。

封存完成：`openspec/changes/archive/2026-10-23-add-article-sharing/`，１７／１７任務；CLI 同步 `article-ending` 五項與 `article-sharing` 六項需求，沒有未完成 artifact／task 或封存警告。正式規格的自動 `@trace` 曾收錄本機未提交輸出及無關 `AGENTS.md`；已只校正追溯中繼資料，改指實際產品／測試檔案，不改需求或 Gherkin。所有正式規格 `spectra validate --specs --json` 通過；封存前 analyze 零 Critical／Warning，２３項具體 Example 建議維持原狀。直接 `spectra validate article-sharing`／`article-ending` 會被此 CLI 解讀為 active change 而回覆找不到，改用支援的 `--specs` 完成驗證，未使用已移除的 `--strict`。遠端身分及審查摘要另保存於 `evidence/production-20261023/github-receipt.json`。

本次文件檢查收據：[evidence/closeout-validation.json](evidence/closeout-validation.json)：２３份正式證據逐位元相同、１１項需求與 Gherkin 未變、１７項任務完成、２０份正式規格有效，並核對本次連結與正式收據的一致性。
