# 真實 Computer Use：單篇草稿全文保存與重新讀回

2026／10／19 19：23（Asia／Taipei）完成前景單篇驗收；19：24 另以 remote D1 唯讀對帳通過。本次沒有啟用背景寫入、切換正式 runtime 或部署 Worker。

## 身分與來源

- 原 ID：`221099415`；原 slug：`ithome-2026-template-hardening`。
- 標題：〈從「可以 fork」到「真的能接手」，模板還缺哪些東西？〉。
- 固定 remote main：`57a03b6ff3adb11831509a1049d29361fb3f4734`，使用獨立乾淨來源快照，操作及回覆時重新核對 main。
- 原稿 revision：`sha256:6bd00a9217daefa1d9775b93523e10d063231e1fba5c9f0fc02202391de7890b`。
- 原稿已與草稿相符；依本次明確授權重新寫入完整內容。因此是相同內容重存，沒有修改 Git 來源，也不宣稱 source A → B 的真實同步證據。

## 真實執行路徑

以暫存、限定單篇與期限的前景 harness，直接連接本次候選的 `ComputerUseDraftPort`、既有 `FileAttendedExchange`、真實 D1 `ScheduleRepository` 與共用 target lock。瀏覽器操作由本次 Codex Computer Use 執行，沒有以合成 observation 或私有 API 取代。

成功工作階段的三個 v2 請求為 `draft-read → draft-update → draft-read`；回覆使用實際 DOM 全文，經現有 `validateDraftHandoff`、`validateDraftReply`、request digest、期限、來源及 D1 generation 驗證。更新前 D1 保存 `update-draft` 意圖；UI 編輯前再核對實際全文等於請求 precondition。標題、摘要與完整富文字正文均在原編輯器寫入；離開後重新開啟原 ID，另外重載回應最後讀取請求。SEO 欄位唯讀確認原 slug。

這是使用者明確授權的前景 qualification 路徑，沒有假造 `unattendedExecutor=true`、跳過正式啟用憑證檢查或呼叫測試用 activation override。正式 `draftHandoff`／round 的啟用門檻不變。

## 驗收結果

- 標題、摘要、全文結構、程式碼空白與原文連結，使用未改動的嚴格內容比較器通過。
- 期望與最終讀回 digest 同為 `sha256:e0bf0977ae22ffe1d050ad9a51ebcada48dbf526ef332c596e617d5c21b16721`，差異清單為空。
- 本篇沒有圖片；不能據此宣稱真實圖片／alt 或其他內容類型已全部驗收。
- remote D1 版本 34：`draftSync.status=verified`、`observedState=draft_prepared`、`delivery=not_armed`，intent 已解除，自有鎖已釋放。D1 沒有保存全文。
- 真實 D1 紀錄經本機候選 `draftStatusView` 投影，得到 `sync.status=verified`、`publication.state=draft_prepared`、`delivery.evidence=not_armed`、`unresolvedOperation=false`。這不是已部署 HTTP API 的驗收。
- 寫入後三份清單仍為 Drafts 3、Scheduled 1、Published 3；原排程 ID `221098688` 仍為 10／22 07：00。其餘五筆 D1 身分、排程、首次寄送與歷史寄送承諾欄位，逐欄比對均不變。另一正式草稿 ID `221099763` 保留。
- 未操作 Continue、Publish、排程、解除排程、測試寄信或任何寄送按鈕；沒有建立新文章。訂閱者實收仍為 unknown。

## 保留的失敗及修正

首次暫存腳本以 `.ts` 在 Git 外載入，被視為 CommonJS 而無法使用 top-level await，改為 `.mts` 後才能開始。第一輪 D1 連線在 acquire 前發生 connect timeout；唯讀確認無鎖。第二輪已完成真實 read 回覆，但下一次 D1 查核遇到 read timeout，finally 釋放自有鎖；唯讀確認無 intent，版本增加來自既有匿名 observer。兩次均未寫入 Substack。沿用正式 runtime 的 IPv4 參數；沒有新增自動重試。一次唯讀對帳的自動權限審核逾時，命令未執行，依工具許可重試一次後通過。另一次 env-file 路徑輸入錯字在載入前失敗，修正後執行，未讀出憑證。

第一次真實貼上已保存，但 HTML renderer 的程式碼終止 LF 被 Substack 轉成多一空行與 `ProseMirror-trailingBreak`，嚴格比對失敗，原始 `after.json` 保留。確認原因後，在同一更新意圖內改用完整 HTML，僅於貼上序列化時省略該單一 renderer 終止 LF，再保存、離開及重開；最後 digest 相符。未修改原稿、比較器或驗收條件，未把失敗的第一次讀回當成通過。這個觀察不構成所有程式碼尾端空行的通用資格證明。

## 證據與保留

私人證據目錄：`/Users/caiyijun/.codex/visualizations/2026/10/19/01a153a5-b815-7753-ac1f-b3b7f9318c2b/draft-sync-live-20261019`。

保留 41 個來源／請求／回覆／DOM／D1／暫存 harness 證據檔，`artifact-sha256.json` 記錄逐檔雜湊。目錄 0700、檔案 0600；未保存 credential 或瀏覽器登入資料。`result.json` 明示 `unattendedExecutor=false`、`sameContentResave=true`；`audit.json` 為另一次 remote D1 查核，`frontend-projection.json` 為實際投影。保留至 2026／11／19 供驗收追溯，精準清理方式在私人 `cleanup.json`。本次已移除自有 `/private/tmp/gcake-draft-live-20261019`，包含乾淨 Git 快照；沒有留下驗收程序或新 timer。

截圖：同一 visualization 根目錄的 `substack-draft-editor-readback.png` 與 `substack-draft-live-verified.png`。前者是最終重載編輯器，後者是草稿與原排程並存的首頁。

## 未完成的較大範圍

task 5.2 仍未勾選：本次完成既有身分採用／read／same-ID full write／reload 的子範圍；沒有真實建立、新來源版本、媒體／alt 或無人執行者全面資格證據。task 5.3 與另一變更 `schedule-substack-drafts-ahead` 的 5.3 均保持 pending。正式背景仍為匿名觀察，沒有產生正式資格憑證、變更 runtime／開關、commit、push 或部署。

候選的 14 個程式／測試檔與先前完整本機 gates 通過版本相符，沒有因本次前景驗收修改程式。既有 unrelated dirty 變更與復原資料保持原狀。
