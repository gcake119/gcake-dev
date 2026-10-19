# 後台唯讀狀態介面驗收

## 實作與來源

以正式 PR38 來源 1f3e8cf413beadc687db0dbb58ad21994aa70a1c 建立並附加隔離 worktree：
/Users/caiyijun/.codex/worktrees/admin-draft-status/gcake-dev。
承接已驗收的同步／唯讀 API 來源，新增 SubstackStatusPanel.vue、substack-status.ts，接上既有 App.vue 發布管理與文章資訊，沿用 admin.css 的色彩、字級與間距 tokens。沒有新依賴、timer、provider 寫入按鈕或 API。primary 的舊版前端與其他未提交工作未覆蓋。

## 可觀察行為與測試

先以新模組尚不存在、App 尚未掛接的真實 RED 驅動實作；既有 Node／Vue SSR 測試涵蓋獨立三狀態、台北時間、收件未知、獨立 attention、同源 GET、分頁、503 保留舊資料、401 清除、404 未追蹤、錯誤身分／格式、晚到回應及 dispose。34 個聚焦測試通過。完整測試發現 publishing-center.test.ts 仍比對已移除的舊 strong 標籤，改由實際 Vue 模板驗收 Substack 的可見三狀態；原測試保留退役 Paragraph 不得再接入的靜態架構限制，未弱化該限制。

## Chrome 畫面與資料來源

1. 本機 127.0.0.1:4187 使用實際 Vue App，資料為先前正式六篇回應快照，失敗狀態為明確模擬。1440×960 與 390×844 各驗收明／暗主題，六列均有草稿同步、發布、寄送標籤，沒有頁面水平溢出。原稿單篇、503、401、404、結果未知、人工衝突與恢復正常均通過。15 個 API 請求全部 GET。不能把模擬故障說成正式注入失敗。
2. 真實同源驗收只在自建 Chrome 分頁將既有 Script／Stylesheet URL 的回應暫換為候選 build 資產 index-DVBQ00qb.js／index-EBQCjx1N.css；正式 Document、owner 登入及 API 使用原正式服務，沒有部署或代理 API。列表六篇、原 ID 221099415 單篇與重新讀取三個新端點請求都是 GET／200／no-store；所有捕捉到的後台請求也都是 GET。未讀取或匯出 Cookie、CSRF、session body 或完整網路標頭。
3. 正式列表當時 ID 221099763 為 inconclusive，顯示「驗證未完成」。原稿 221099415 為 verified／draft_prepared／not_armed。221098688 仍顯示排程 10／22 07：00 台北及 armed，均標「尚無實收證據」。這是當時快照，非持續成功保證。舊 publications 查詢的「發佈中心尚未設定。」訊息保留，不歸為新 API 失敗。

## 保留與清理

真實唯讀 D1 比對六篇原 ID、slug、URL、provider 狀態、確認時間、時段、channels、armed／delivered revision、公開歷史與 intent，均與本輪前基準一致；同步私有設定 SHA256 一致、allowCreate=false、scheduled.writeEnabled=false。未執行排程、發布、寄送或 Substack 修改。背景同步可更新查核 metadata，因此不宣稱所有 D1 欄位完全靜止。

Chrome 的資產覆寫清空、自建兩個分頁關閉、viewport reset、本機主題恢復；驗收 Vite 伺服器已停止、4187 無監聽。正式前端尚未部署，沒有 commit／push／merge 或 migration。工作樹保留供後續審閱。

## 非通過紀錄與限制

初次 Vite 設定遇 CJS 載入失敗，改用 createRequire 後成功；首個分頁早於伺服器啟動，待伺服器 ready 後重用。初次 CDP Document 覆寫不受支援，未繞過限制，改為限定 Script／Stylesheet；Fetch.disable 不受支援時依工具文件以空 patterns 清除。定位器主題用字與原生 summary 語意差異均先讀取實際 DOM 再修正定位，沒有 provider 操作。原 RED／首次 GREEN 與工具紀錄保留。

自動審核拒絕新 worktree 的 codebase-memory index_repository，因唯讀授權不包含衍生索引寫入。未執行索引；沿用原 repo 已有索引的唯讀搜尋，再核對已釘選 Git 版本的來源檔。

額外部署 metadata GET 使用 D1 專用憑證回 403，未擴權或重試其他憑證；正式前端資產及健康以匿名 GET 比對。先前 API 部署 version 66a6ea7d-8d71-49a7-b91a-67cd2a095f9c 為歷史證據，本輪不把該 metadata GET 說成通過。

私有原件：/private/tmp/gcake-admin-status-ui-20261020。畫面：
/Users/caiyijun/.codex/visualizations/2026/10/19/01a153a5-b815-7753-ac1f-b3b7f9318c2b/admin-status-ui-20261020。
遮蔽後機器摘要見 frontend-ui-results.json；不納入 owner session、私人全文或網路憑證。


## 最終本機 gate

相同候選來源與依賴通過 pnpm check（227 files，0 errors／warnings／hints）、pnpm test、pnpm build:all、pnpm release:dry-run、pnpm editorial:rehearse。最終輸入 SHA256 與 gate 開始時逐檔一致；文件更新不改變測試來源。Hermes 原有 Python 測試輸出 unclosed SQLite ResourceWarning，測試本身通過，未把警告吞掉。正式三個 HTML／JS／CSS 雜湊逐 bytes 一致，/health 為 ok。Spectra analyze／validate 與 git diff --check 另行收尾；新需求的 task 明確引用已補齊，沒有更動驗收條件。

最終 Spectra analyze 無 findings、validate 通過、git diff --check 通過，27／27 任務完成。Spectra task CLI 解析主專案路徑，已將本次文件與任務同步回主專案並回寫隔離工作樹；程式候選仍只在隔離工作樹。CLI 不接受 spec 目錄作 touched file，改以實際 API handoff 文件登記驗收任務。
