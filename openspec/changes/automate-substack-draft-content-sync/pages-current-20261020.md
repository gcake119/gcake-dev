# GitHub Pages 現行發布與公開驗證紀錄呈現

正式 version b7019878-d470-4558-9d68-ebaee8a7fe4a，deployment 52534827-254e-46c8-90d0-5042f1c4deab，100％流量。回復基準 099cf828-63ac-41c9-aadf-5ce8e4f1b707 保留，未回復。台北 2026／10／20 01：59：55 部署一次成功。

## 已證實根因

前一修正接通的是 publication_target_states 舊表，該表只有三筆 Substack 與一筆退役 Paragraph，沒有 Pages。因此當時的空列表是舊表的真實內容，卻沒有涵蓋現行發布來源。

此次唯讀查核 release_queue_runtime，version 176 有三筆 verified-public 現行紀錄：ithome-2026-chatgpt-writing-workflow、ithome-2026-publishing-toolchain、ithome-2026-astro-choice，均有對應發布 commit、publication digest、文章頁／RSS GUID／verifiedAt 與部署證據。正式 Chrome 修正前 GET 只有舊 states，沒有 pages 投影；沒有把該舊回應說成包含現行證據。

## 修正與契約

在既有 GET /api/v1/publications/:slug?sourceRevision=… 加上 pages 物件，states 保持相容。pages.source=release-queue；readPagesStatus 只呼叫 D1ReleaseStore.read，不呼叫 queue.view／ingest／reverify／provider。

pages 分開包含 state／historyCount、releaseId／sourceRevision／commitSha／releaseAt、deployment.state／url，以及 verification.state／verifiedAt／pageVerifiedAt／publicUrl。當前有效紀錄優先；沒有有效紀錄仍回 not-recorded，historyCount 可區別解鎖歷史。多筆有效身分、無法解析或資料庫失敗回既有 503 PUBLICATION_STATE_UNAVAILABLE，不能用空列表掩飾。

完整公開驗證呈現須為 verified-public、有保存的文章頁與整體驗證時間、publication digest、原 commit 及完全一致的 canonical RSS GUID。只有 deployed 不構成公開成功；部署 commit 不符顯示來源待確認；證據不全不顯示完整驗證。前端不以後續無關 main SHA 判斷歷史證據失效；也不宣稱現在內容已重新驗證。每次換文章／讀取先清除舊 pages，仍保留原讀取失敗訊息。

## 驗證證據

四個真實 RED 後實作，39 個聚焦 Worker entrypoint／Vue setup／模板測試通過。涵蓋現行紀錄而舊表空、無關 main revision、deployment-only、錯 commit、缺 RSS、解鎖、無紀錄、多有效身分、儲存失敗、換文章清除及三種呈現。五項既有完整 gate 全通過：check（228 files，0 errors／warnings／hints）、test、build:all、release:dry-run、editorial:rehearse。原 Hermes SQLite ResourceWarning 若出現於 test log，保留而不吞掉。來源／依賴／設定逐檔 SHA256 與 passing candidate 一致；沒有新測試框架、依賴、timer 或 migration。

production dry-run 後再檢查當時正式版本，隔離候選只覆蓋八個本次來源／測試／契約檔及資產；正式 vars、bindings、secret 名稱及 runtime settings 與前版完全相同，RELEASE_WRITE_ENABLED=true、SUBSTACK_WRITE_ENABLED=false、PARAGRAPH_WRITE_ENABLED=false 保留。三個 HTML／JS／CSS 逐 bytes 符合候選，health=ok；匿名新舊三端點 401／no-store。

正常 owner session 的實際 Chrome Document／資產，無 override／代理：

- 已公開 ithome-2026-astro-choice 顯示「已有公開驗證紀錄」、「部署：網站已部署」、「公開驗證：文章與 RSS 已驗證」、台北 2026／10／19 08：46、正確文章連結與已保存證據說明。正式 pages.releaseId、sourceRevision、verifiedAt 與部署前 D1 原紀錄一致。
- 桌機原尺寸 1728×907，以及 390×844 手機明／暗主題可讀，手機 document scrollWidth=375，無水平溢出。
- 切到未發布原稿 221099415，Pages 為 not-recorded／尚無發布紀錄，沒有上一篇的成功或連結；Substack 原 ID 與獨立三狀態保留。該草稿 API 的 inconclusive 查核時間 01：52 早於本次 Pages 部署，未重試、未假裝成功。
- 兩篇 publications 與兩篇 Substack detail 共四個相關 GET 皆 200／no-store；所有捕捉到的後台 API 請求都是 GET。未點擊儲存、排程、發布、公開驗證、寄送或已驗證文章連結。這是後台呈現驗收，不是本次重新匿名驗證公開站。

## 保留與清理

Chrome 完成後，三筆 Pages release 完整物件（含 commit、slot、部署、頁面／RSS／查核時間與事件）逐項完全未變；paused／overrides／adopted 控制也未變。queue version 176→177 是既有後台 GET releases 的 metadata 更新，不能宣稱整體 D1 零寫入。

六篇 Substack 原 ID／slug／URL、已確認排程、發布歷史、寄送 channels／armed／delivered revisions 及 intent 均保留；私有同步設定 SHA256 相同，allowCreate=false、scheduled.writeEnabled=false。同步 runtime 與 timer 未改，沒有通知或 provider operation。

Chrome 自建分頁已關閉，viewport reset，初始暗色主題恢復；未用 Brave、無本機伺服器／Docker。畫面保留 /Users/caiyijun/.codex/visualizations/2026/10/19/01a153a5-b815-7753-ac1f-b3b7f9318c2b/pages-current-evidence-20261020。一個滾動座標超出可操作 viewport 被工具拒絕，先讀取實際截圖與範圍後重定位，沒有重試點擊或變更文章。

私有原件 /private/tmp/gcake-pages-status-20261020；遮蔽後摘要 pages-current-results.json。不含 Cookie、CSRF、session body、secret 或文章全文。程式仍在已附加隔離 worktree；主工作區只同步自己本次的後端／契約及文件，未覆蓋舊前端或其他 dirty 工作。沒有 commit／push／merge。

最終 Spectra analyze 無 findings、validate 與 git diff --check 通過，33／33 任務完成；最終候選來源、依賴與設定雜湊仍匹配完整 passing gates。
