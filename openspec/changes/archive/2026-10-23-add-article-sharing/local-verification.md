# 文章分享本機實作與驗證（２０２６－１０－２３）

## 來源與權限

- 基底：`451805a68f9557c76b2e148541031e87e6e77fa6`，本次產品程式、測試、文件仍未提交。原有 `scripts/publishing/distribution-draft-sync.test.ts` 修改保留，未編輯。交接提及的另兩個 Hermes 檔案於開始盤點時沒有 dirty。
- 使用者已授權恢復 parked 提案、驗收測試先行、本機實作、必要驗證及預覽。未提交、推送、部署、對外發文或選擇接收平台。
- 完整六項需求及十三個 Gherkin 情境維持原文；只修正 proposal 列表被 Spectra 誤解析的路徑格式，並補上建置後測試檔案清單。
- 決策檢核：Level 2；採用新部落格閱讀網址與既有 canonical 分離政策，未改正文、內容權威、Open Graph URL、原始版本連結或 ADR-001。已更新設計文件與決策索引，無新 ADR／封存回填。

## 驗證結果

| 階段 | 命令／範圍 | 結果與限制 |
| --- | --- | --- |
| Acceptance RED | `node --import tsx --test test/article-sharing.acceptance.test.ts` | 實作前１０項全部因缺少行為／整合而失敗；不是匯入或語法錯誤。當時測試對尚不存在的控制器使用無行為 baseline；實作後已改為直接匯入正式控制器。原始 log 保存在 `output/article-sharing/red.log`。 |
| Build | `pnpm build` | 通過，５２頁；同一份 build 用於下列整合及瀏覽器檢查。 |
| Public GREEN | `pnpm test:public` | 最終１０４／１０４，包含９項 DOM 行為驗收。初次１０５項亦通過，之後將１項建置 HTML 檢查移到建置後階段。 |
| Rendered integration | `node --import tsx --test test/article-sharing.rendered.test.ts` | １／１；遍歷所有建置文章，涵蓋公開獨立、本地系列與３０篇匯入文章。檢查唯一群組、正文後／延伸閱讀前、標題、正式閱讀網址、可及標籤、唯讀復原欄位、canonical／OG 與原始版本連結。 |
| 全專案 Astro check | `pnpm check` | **失敗**：既有 `output/discovery/merge-deploy-cloud-20261021/cloud-evaluate.ts` 的 `results` 隱含 any，２ errors；另有既有 output 檔案１ hint。未修改歷史證據，也未更改正式 gate。 |
| 補充來源範圍 check | `pnpm exec astro check --tsconfig output/article-sharing/check-scope.json` | ７０檔，０ errors／warnings／hints。臨時 config 納入 src、Astro types 及本次兩個測試檔，僅為縮小診斷範圍，**不取代完整 check 或推送 gate**。 |
| Browser | `node output/playwright/article-sharing/verify.mjs` | Chrome 155.0.8059.86，３篇×２寬度（１２８０／３９０）×２主題，共１２組通過。實際鍵盤 Tab／Enter、可見焦點、４４px 目標、真實剪貼簿、含 query／fragment 的開頁網址、無溢出、無內容遮蔽及無 JavaScript 手動連結均通過。複製拒絕以 capability double 產生，再以實際鍵盤選取完整復原網址。 |
| Spectra | `spectra validate add-article-sharing`；`spectra analyze add-article-sharing --json` | validate 通過；０ Critical／Warning，１３項補 Example 建議。preflight 已 clean。 |

正式原生分享 API 的呼叫資料與取消／錯誤／完成結果以 DOM capability doubles 驗證；完成不宣稱發文或送達。未新增另一層重複 unit tests、依賴、CI workflow 或 required check。既有 CI 先 `pnpm test` 再 build，因此 rendered suite 不併入 pre-build public aggregate；它是明確建置後的本機整合命令，沒有 skip 或削弱斷言。

日誌位於 `output/article-sharing/`；程式、依賴鎖定檔及測試的 SHA-256 見 `source-digests.json`。瀏覽器執行腳本、１２張版面截圖、手動複製截圖及結構化結果位於 `output/playwright/article-sharing/`，已檢視手機暗色與桌面明亮文章尾端截圖。上述 output 為本次本機證據，不代表已提交保存。

## 未完成的真實原生／人工驗收

Task 3.2 保持未完成。可見的 macOS Chrome 原生分頁有顯示「分享文章」，經 Computer Use 啟動後出現「無法開啟分享，請改用複製連結」，未觀察到系統選單；改用原生視窗操作時工具回傳 `noWindowsAvailable`，無法完成可靠的開啟及取消驗收。根因未確立，不能據此斷定是產品、權限、裝置或自動化限制，也不以 headless 的 `navigator.share` 存在或模擬成功代替真實選單。

目前「不支援原生分享時隱藏按鈕」有 DOM capability double 證據，尚無另一個實際不支援的裝置證據。沒有社群接收、平台預覽或發布證據；使用者人工確認仍待進行。未以本機驗證宣稱整體上線完成。

## 預覽與停止方式

- 擁有者：本次 `add-article-sharing` 實作聊天 `01a1681e-3316-7192-8ad4-7f25f30682d5`。
- 啟動命令：`pnpm exec astro preview --ignore-lock --host 127.0.0.1 --port 4397`；僅本機 loopback。
- 已核對 listener：`node` PID `15965`，`127.0.0.1:4397`。保留至使用者人工確認／要求停止，不自動部署。
- 獨立文章：<http://127.0.0.1:4397/gcake-dev/posts/ai-agent-development-workflow/>。
- 本地系列：<http://127.0.0.1:4397/gcake-dev/posts/ithome-2026-astro-choice/>。
- 鐵人賽：<http://127.0.0.1:4397/gcake-dev/series/ithome-2026/day-01/>。
- 精準停止：先用 `lsof -nP -iTCP:4397 -sTCP:LISTEN` 確認仍為本次 listener，再執行 `kill -TERM 15965`。不要依模糊程序名稱批次終止。
- 驗收重點：捲至正文尾端、切換明暗主題／手機寬度、用 Tab 操作複製，核對剪貼簿只含正式閱讀網址；在可用的真實裝置開啟分享選單並取消，確認中性結果。不要選擇平台發送。

未執行完整跨工作區／發文流程 regression，因本次只修改公開文章互動，沒有推送授權。未來若另獲推送授權，須先解決或正式處置完整 check 的既有錯誤，並依當時規則執行完整 gate；本次縮小範圍的 check 不是豁免。
