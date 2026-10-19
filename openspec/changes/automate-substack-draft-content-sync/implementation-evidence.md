# 本機 Computer Use 草稿同步實作與證據

後續證據更新：本文件下方「零真實 provider 寫入」描述原本機實作階段。2026／10／19 另獲單篇前景授權後，已完成原 ID `221099415` 的真實 Computer Use 全文重存與重新讀回，並以 remote D1 對帳通過；詳見 [單篇 provider 紀錄](live-provider-20261019.md)。這不代表無人執行者、背景啟用或正式部署已通過。

## 交付範圍

使用者指定沿用已成功的 Computer Use handoff。本機實作採用既有 FileAttendedExchange 的精確 request／reply，不等待官方寫入 API；實際無人執行者與正式切換仍另行驗收。

- 新增只允許 find／read／create／update 的 DraftPort 與同 ID 同步核心；保存前記錄意圖，寫入後重載驗證，未知建立不自動重建，未知更新只以原 ID 讀回對帳。
- 比對實際保存的標題、摘要、完整正文結構、程式碼、媒體／alt 與連結；來源與平台各自變更時保留人工衝突。原稿失去資格、刪除、改名、已排程或公開時交前景處理。
- 私人來源每次查核均核對遠端 main；即使 UI 已保存，main 前進也不能把舊版報為目前已同步。已保存與期望版本分開。
- 草稿階段與匿名觀察器是獨立 hook，沿用單一輪次／鎖／通知去重；草稿失敗不阻擋匿名觀察。沒有新 timer、服務、套件、migration 或 CI workflow。
- qualification／authorization 為實際私人文件，綁定政策範圍、有效期限及 runtime pin digest；本次沒有建立正式通過文件或啟用寫入。
- 新增後台已登入 owner 可讀的列表／單篇狀態 API，分開同步、發布、寄送與獨立待辦，禁止狀態路由寫入。契約見 [前端 API 文件](../../../docs/substack-draft-sync-api.md)。

## 本機驗證

46 項相關局部測試通過，包含實際私人檔案交換、SQLite 持久狀態及 API 路由。這是合成 UI 回覆的程式邊界驗證，沒有真實 Substack 寫入。

最終同一程式／測試候選通過 pnpm test、pnpm check、pnpm build:all、pnpm release:dry-run、pnpm editorial:rehearse。原始執行結果見 local-gate-results.json；程式／測試 SHA256 見 local-candidate-sha256.json，驗證前後一致的確認見 local-candidate-matched.json。Spectra analyze／validate 與 diff check 另於結束前查核。

52 個 Gherkin 情境與本機測試的對應見 acceptance-test-map.md；本機證據不能取代真實 Computer Use、provider、自然輪次、正式部署或真人收件。

## 原始失敗與限制

初始新增模組前的 RED 是缺少元件；另有實際行為 RED／GREEN 證明獨立 hold 阻擋、前景基準更新、公平輪替、階段隔離、分頁、遠端 URL、main 競態與重複快照清理的修正。沒有把後補 regression 案例全部稱為 test-first。

早期 pnpm 因 sandbox 中套件管理器狀態檔不可寫而未能啟動建置；依授權提高執行權限後執行既有 gates，未安裝新依賴。Spectra task 的第一個歸屬路徑因位於規格目錄而被 CLI 拒絕，改用對應程式／測試檔記錄，沒有手改內部資料庫。

中間候選的各 gate 曾通過，但後續修正造成雜湊不一致，因此 superseded-* 紀錄不是最終候選通過證據。最後交付候選重新完成完整 gates，並有 matched=true。既有 Hermes Python 測試出現未關閉 SQLite 的 ResourceWarning；該階段 exit 0，原始警告保留，未修改無關 Hermes 測試。

Node 程式不會自行呼叫 Codex Computer Use。正式啟用前仍要接上並驗收真正的執行者與受控工作階段，完成真實 create／read／same-ID update／read 及自然輪次。UI 前後檢查也不能冒稱平台原子式條件寫入保證；外部人工競態屬明列限制。

未決本輪 handoff 保留必要來源與 payload；只有舊未知 intent 而沒有本輪新請求時，移除新輪次的無用快照，避免每輪累積副本。強制終止或當機後仍須先確認擁有者與未決結果再恢復，不能依鎖的年齡接管。

## 未變更的邊界

本次零真實 provider 寫入、零真實寄送、零正式 runtime／D1 migration／開關／排程變更，沒有 commit、push、merge 或 archive。舊 schedule-substack-drafts-ahead 的 5.3 仍待驗，沒有重做試行。復原分支、bundle 與原稿備份未改動。

工作期間另外出現未追蹤的 simplify-admin-workflows 規格目錄，保留且不納入本次任務或程式候選。沒有清理、接管或提交其他工作的資料。

原始紀錄與日誌 SHA256：/Users/caiyijun/.codex/visualizations/2026/10/19/01a153a5-b815-7753-ac1f-b3b7f9318c2b/draft-sync-implementation-20261019


## 2026-10-19 approved media candidate

The 18-file code/test candidate in continuous-media-local-candidate.json passed all five existing local gates, recorded in continuous-media-local-results.json. The matching check.log reports 222 files, 0 errors/warnings/hints; it was reused rather than repeated. Draft acceptance file: 43 passing tests. Spectra analyze/validate and git diff --check passed after the approved-media artifacts. No new CI workflow or test layer, commit/push, Worker deployment or migration.

The draft-only PNG identity projection and parent before-paste verdict are locally complete. Actual provider A/B restoration and the standing natural inventory remain separately evidenced in continuous-provider-20261019.md; local passes do not establish those outcomes.


## 2026-10-20 00：06（台北）目前結果

前述「零 provider 寫入／未啟用 runtime」為本機實作階段歷史。其後獲得明確授權並完成：新 supported PNG A 的真實無人全文寫入與讀回、同 ID 完整 Git B 恢復、既有 timer 上啟用持續寫入，以及自然完整六筆盤點。圖片與 Git 恢復為 16／17 次 Chrome 呼叫，自然輪次為 25 次 Chrome 呼叫、兩篇 verified／四篇 excluded、零寫入（內容相同）。六筆承諾未變、來源／分頁／intent／lock／checkpoint 清理通過，runtime pin 全匹配。任務 23／23 完成；當前範圍新建停用、HTTP 未部署，其他排程變更 5.3 仍待驗。詳見 continuous-provider-20261019.md 與 continuous-provider-results.json。
