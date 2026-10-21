# 後台正式部署與驗收紀錄（2026-10-19）

本文件回填已完成的 PR #38 正式後台部署，不是重新部署指令或持續健康保證。事實來自當時保存的 Cloudflare 讀回、乾淨建置雜湊及正式瀏覽器量測；本輪只整理文件，不推送、不再次部署。先前的未提交／未部署敘述保留其歷史語境。

## 部署身分與來源

| 項目 | 已確認結果 |
| --- | --- |
| 來源 | [PR #38](https://github.com/gcake119/gcake-dev/pull/38) 合併後 main |
| 部署 commit | `1f3e8cf413beadc687db0dbb58ad21994aa70a1c` |
| 審查 head | `4c9dff2e1abc8262d3fce141cb3c7930e00de9c1`；合併後檔案樹與此版本完全相同 |
| Worker | `gcake-admin-worker-production` |
| 正式網址 | [https://gcake-admin-worker-production.wwhowbuhow.workers.dev/](https://gcake-admin-worker-production.wwhowbuhow.workers.dev/) |
| Worker Version ID | `2b8c3127-662a-4463-925e-598925a8e8f8` |
| Deployment ID | `7f9d4a6b-448b-4012-92b2-b8020a311a55` |
| Tag／流量 | `pr38-1f3e8cf`／100％（驗收讀回時） |
| 部署時間 | 2026-10-19 22：37：34，Asia／Taipei；UTC `2026-10-19T14:37:34.926533Z` |
| 前版回復參考 | `cee040da-ac51-4f32-81e5-aaabf71daaf4`（PR #35）；本次未執行回復 |

部署使用釘選上述 commit 的乾淨 detached 工作樹，沒有從含 Substack 未提交變更的主工作區建置。Admin／Worker 建置、Wrangler dry-run 均成功；Wrangler 4.142.0 實際部署一次，exit 0，沒有因工具驗收錯誤再次部署。**這份後續文件 commit 不代表另一個已部署版本。**

## CI 與程式審查

- [main 合併 commit CI](https://github.com/gcake119/gcake-dev/actions/runs/39267964824) 全部通過：完整測試（含 editorial／Hermes）、pnpm check、pnpm build、本機靜態站與通知去重演練。結束時間為 UTC 2026-10-19 14：22：31。
- [審查 head CI](https://github.com/gcake119/gcake-dev/actions/runs/39264727474) 通過；[Codex 重新審查](https://github.com/gcake119/gcake-dev/pull/38#issuecomment-6268553167) 對 `4c9dff2` 完成且無新發現、無未解決項目。
- 兩個 P2（舊暫存／跨文章復原、正文貼圖焦點）及後續 P1（捨棄系列被文章儲存夾帶）均先本機重現再修正，三個討論已標記完成。Admin 行為測試 64／64；這不是下方正式畫面數。

## 正式設定及 Substack 邊界

部署前實際正式版本是 PR #35，並非最後一次 GitHub Actions 部署紀錄。相對該來源，後端僅多一個既有 `ScheduleRecord` 型別欄位；已比對 TypeScript 輸出的 JavaScript 完全相同，沒有新的 Substack 執行邏輯。PR #38 的 24 個檔案僅後台前端、設計／Spectra 與共用圖示；沒有未提交的 Substack 後端、腳本、原稿或 migration 混入。

沿用既有前景部署方式，以 keep-vars 保留正式設定並明確保留現有開關。部署前後普通變數、D1／R2 綁定與 secret 名稱清單一致；沒有讀取或回填 secret 值。

| 開關 | 部署前後 |
| --- | --- |
| RELEASE_WRITE_ENABLED | true |
| SUBSTACK_WRITE_ENABLED | false |
| PARAGRAPH_WRITE_ENABLED | false |

D1 唯讀查核回覆無待套 migration，本次沒有套用 migration、還原資料庫或更動綁定。沒有操作 Substack runtime、排程、寄送或背景觀察器。正常 owner 登入與佇列查看可能更新 session／runtime metadata，不能宣稱全程零資料庫寫入。

## 實際產物與健康

正式 `/health` HTTP 200，`status=ok`、`service=gcake-admin-worker`、`contractVersion=v1`。正式 HTML、JS、CSS 與乾淨指定版本建置逐位元組相同：

| 產物 | SHA-256 |
| --- | --- |
| `index.html` | `348797dd026d92a06dd650c4ae731f0de83a40d902517bebec4946d7be7a0e40` |
| `assets/index-Ccs2ogNW.js` | `ee84fdcb625de2bd5b7c10582c7bea73a996199b3f456483bf47b729a564708a` |
| `assets/index-fVLqfW1i.css` | `610ff0111f5fea8087fca9c88c9444c9c7f30160a4149a1ab56adaa479acb06f` |

正式瀏覽器亦載入上述 JS／CSS；Cloudflare 最後讀回仍為同一 Version ID、100％ 流量。這些是當時部署驗收證據，不是後續持續健康保證。

## 桌面、手機與明暗主題

| 檢查 | 桌面明亮 | 桌面暗色 | 手機明亮 | 手機暗色 |
| --- | --- | --- | --- | --- |
| 視窗 | 1280×900 | 1280×900 | 390×844 | 390×844 |
| 正式畫面狀態 | 10 種通過 | 10 種通過 | 10 種通過 | 10 種通過 |
| 標籤、欄位、按鈕與展開間距 | 通過 | 通過 | 通過 | 通過 |
| 至少 44px 控制、無頁面水平溢出 | 通過 | 通過 | 通過 | 通過 |
| 檢視循環後原文不變 | 通過 | 通過 | 通過 | 通過 |
| 媒體庫關閉後原文／入口焦點 | 通過 | 通過 | 通過 | 通過 |

10 種狀態為文章清單、新增文章、文章設定、媒體庫、新增系列、未開始系列、已鎖定系列、發布管理、日期調整表單、發布紀錄／時間線，共 **40 組正式畫面**。實測普通按鈕 8px（正文 SVG 工具 4px）、垂直欄位 12px、展開內容 12px、媒體操作列到提示區 16px；受檢控制沒有小於 44px，沒有頁面水平溢出。對應當時的量測與保留原文／焦點斷言已隨 [結構化證據](publishing-cms-deployment-20261019.json) 納入 Git。

## 限制及證據位置

- 正式媒體庫為空，未新增假資料或上傳圖片；有圖片管理的豐富狀態由先前本機 fixture 驗證，不宣稱正式圖片寫入驗收。
- 正式只展開／查看／切換／取消；未儲存文章、系列、排程，未發布、通知、刪除或建立網站預覽。日期表單未送出確認或發布影響預覽。
- 本機 64 項行為測試、64 組本機版面及 40 組正式畫面分別記錄，不能互相替代；不宣稱完整 WCAG、獨立人工接受或正式寄送證據。
- Python HTTP 客戶端曾遭 403；curl 與正式登入瀏覽器讀取成功，線上雜湊一致。非同步等待與在 modal 後方切換主題曾產生無效量測，已改為載入後量測、開啟 modal 前先設定主題並重做。這些工具失敗未計作通過，也未因此重部署。
- 原始截圖、HTML 報告與 logs 保留在本機交付目錄 `~/.codex/visualizations/2026/10/19/01a153ab-2054-7613-8fb6-a0e9e54085b6/admin-improvement/production-acceptance/`。這是本機查核位置，並非其他協作者可直接開啟的 repo 相對連結；核心版本、雜湊、40 組量測與限制已放入上述 JSON。
- 本輪依現有 DESIGN.md／設計規範與 Spectra 回填證據，未改產品決策或建立新 ADR／CI／驗收門檻；未 archive change。本輪只檢查文件、連結、JSON／來源收據一致性及 Spectra，不重跑已完成且輸入未改的產品測試，也不重新驗收或部署。


## 文件合併與歸檔結案

部署證據文件 commit `05314f9` 經 [PR #39](https://github.com/gcake119/gcake-dev/pull/39) 合併到 main `509d71b21e6261f5b674bdc77cb38deaf73d785d`。[PR CI](https://github.com/gcake119/gcake-dev/actions/runs/39273488924)、[Codex 審查](https://github.com/gcake119/gcake-dev/pull/39#issuecomment-6270242209) 與 [main CI](https://github.com/gcake119/gcake-dev/actions/runs/39276651575) 均已完成；CI 通過，Codex 無發現或未解決項目。合併僅包含五份正式部署／驗收文件，沒有 Substack 程式或工作區變更。

使用者後續授權將 `simplify-admin-workflows` 歸檔，已由 Spectra 同步既有需求與 Gherkin 到主規格，完整結案紀錄見 [歸檔驗收紀錄](../openspec/changes/archive/2026-10-19-simplify-admin-workflows/verification.md)。本輪歸檔與獨立本機 commit 不推送、不再次部署，也不改變本文件記錄的正式部署版本或驗收範圍。
