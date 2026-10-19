# 單篇無人 Computer Use 自然輪次

## 授權與安裝

使用者本輪明確授權接上無人背景 Computer Use，沿用未排程原稿 ID `221099415`、slug `ithome-2026-template-hardening` 完成一次自然輪次，不更動既有排程、發布或寄送。原稿已與 Git 相符，因此本次採用單篇、單次、限時的完整唯讀 qualification，保持一般草稿寫入停用。這不是全面自動寫入或媒體／建立／來源改版資格。

2026／10／19 19：48：04（Asia／Taipei）已安裝私人釘選 runtime：`/Users/caiyijun/Library/Application Support/gcake-distribution/installed-draft-qualification-20261019`。同一 `dev.gcake.distribution-sync` timer 維持 900 秒、RunAtLoad=false、KeepAlive=false；保留舊 runtime、原共用 round lock、Hermes ledger 與回復 plist。安裝後 runs=0，沒有 kickstart、RunAtLoad、第二個 timer 或手動執行驗收輪次。

`draftQualification` 的 grant 綁定原 ID／slug、原稿 revision、runtime pin digest、執行者路徑、受控新分頁與四小時期限；在 provider dispatch 前消耗一次 claim。`draftSync.enabled=false`、`draftSync.writeEnabled=false`，既有 scheduled.writeEnabled=false。本次沒有先造一份 unattended passed receipt 解除一般寫入門檻。

背景呼叫鏈為既有 timer → runSyncRound → syncDrafts → 單篇唯讀 qualification → FileAttendedExchange → 桌面版內附 Codex CLI → 真實 cua_repl。執行者只操作自己的新分頁，獨立檢查 Drafts／Scheduled／Published、重載原 ID、讀取全文與保存 slug，最後關閉自己的分頁。子程序只取得允許的基本環境變數，不繼承 Cloudflare credentials；控制程式獨立核對 v2 請求、來源、D1 generation 與完整內容後才寫回回覆及 metadata。

## 本機及入口證據

- 原 shell CLI 0.147.0 在模型請求階段拒絕目前設定的 gpt-6.1-sol，尚未進行 CU；改用電腦上已安裝的桌面版 CLI 0.163.0-alpha.10.2，保留同一設定模型，實際成功呼叫 `mcp__cua_repl.js`／`cua.getState()`。沒有更換帳號、模型或匯出登入資料。
- 初始新增模組的 RED 為缺少元件。接著 production hook 的測試先重現「沒有接入 qualification 驗證」；一次額度到期後的測試先重現不必要的重複錯誤。修正後，同一檔案的 26 項測試通過，包含真正私人檔案交換與 SQLite 持久狀態。程序／內容失敗案例使用 fixture，不冒稱真實 provider。
- pnpm test、pnpm check、pnpm build:all、pnpm release:dry-run、pnpm editorial:rehearse 全數 exit 0，15 個程式／測試檔驗證前後雜湊一致，安裝後再次比對相符。既有 Hermes Python 測試仍有 SQLite ResourceWarning，原始日誌保留，未修改無關測試。
- runtime pin 包含 19,141 個一般檔案（含依賴），安裝前 verifyRuntimePin 通過；這是內容釘選數量，不是速度／成本量測。
- Spectra analyze／validate 與 diff check 通過；沒有 commit、push、Worker 部署、migration 或 subscriber 操作。

本機 gate 原始日誌、候選及最終一致性、已遮除其他分頁內容的入口能力證據：`/Users/caiyijun/.codex/visualizations/2026/10/19/01a153a5-b815-7753-ac1f-b3b7f9318c2b/draft-sync-natural-20261019`。能力探測的其他分頁／帳戶原始 inventory 未保留。

## 首次安裝當時狀態（歷史）

安裝與本機接線已完成，等待原 timer 自然觸發。此時不能宣稱自然輪次或無人 provider 驗收通過。正式結果以私人 qualification/result.json、executor-events.jsonl、該輪 result.json、launchd runs 與事後 remote D1 對帳為準；本聊天不操作瀏覽器或代填自然請求。

## 第一次自然輪次的瀏覽器範圍失敗

20：03～20：06 的首次自然輪次完成全文讀取且內容 digest 相符，但執行者的瀏覽器數字 ID「2」在新程序對應到 Brave。原 result.json 的 passed 僅反映當時控制程式的內容核對，不能算作 Chrome 驗收通過。保留原紀錄，不覆寫或重播 claim。執行者已在 finally 關閉自己建立的分頁，沒有 provider 寫入。

依使用者「用 chrome 瀏覽器，不要跟我搶 brave」修正為 literal chrome，拒絕數字 ID，控制程式另核對實際 CU toolSurface.browserFamily；非 Chrome 或缺少證據不得通過。使用既有 acceptance 檔案先重現兩個缺口，修正後 28 項通過。後續以新候選、新的一次性範圍及既有 timer 重新驗收，原始失敗證據保留。

Chrome 修正候選於 20：12：14 安裝至 `installed-draft-qualification-chrome-20261019`，同一 timer 的 runs 歸零，無 kickstart。15 個程式／測試檔的候選 digest 與五項完整 gate 相符；原失敗候選的六篇 D1 承諾對帳全部保留，鎖及 intent 為空。等待新候選自然觸發，尚未宣告通過。

## Chrome 自然輪次：通過

修正候選的同一 timer 自然觸發，runs 由 0 → 1；claim 為 20：28：54，Computer Use 與內容核對於 20：31：20 完成，事後 remote D1 對帳於 20：32：41 完成。整輪 `round-wOXj2A` 為 completed、LaunchAgent exit 0；沒有 kickstart，也沒有本聊天代操作 provider 或代填回覆。

實際 transcript 的首個瀏覽器操作為 `cua.createBrowserTab("chrome", ...)`，15 個完成的 CU 呼叫所帶 browserFamily 全為 chrome。執行者獨立讀取 Drafts／Scheduled／Published 三份完整清單：目標只在 Drafts，沒有排程或公開身分；重載同 ID 後讀取全文 HTML、標題、副標題、程式碼／連結及保存 slug，已儲存可見，關閉設定後擷取畫面，最後關閉自己建立的分頁。紀錄未出現內容編輯、保存變更、Continue、Publish、Send 或排程操作。

原 ID `221099415`、slug `ithome-2026-template-hardening`、main commit `57a03b6ff3adb11831509a1049d29361fb3f4734`、source revision `sha256:6bd00a9217daefa1d9775b93523e10d063231e1fba5c9f0fc02202391de7890b` 保持一致。預期與實讀全文 digest 均為 `sha256:e0bf0977ae22ffe1d050ad9a51ebcada48dbf526ef332c596e617d5c21b16721`。原稿沒有圖片，這不是媒體上傳資格。因內容相同，providerMutations=0；D1 僅更新最後驗證的內容 metadata。

remote D1 六篇紀錄的原 ID、slug、provider 狀態、既定時段、排程／寄送設定、armed／delivered 版本及公開承諾逐欄相符。既有排程 ID `221098688` 未更動；publication locks、checkpoints、未決 intent 均為空，暫存 Git source 已移除。單次 claim 保留且不重播，後續輪次跳過 authenticated qualification。一般 draftSync.enabled／writeEnabled 仍為 false；本次僅結束 7.2，廣泛來源改版／媒體／一般寫入資格 5.2／5.3 與排程 change 5.3 保持待辦。

私人原始證據位於 `installed-draft-qualification-chrome-20261019` 的 qualification、rounds 及 natural-audit.json。可直接檢視的精簡摘要、Chrome 畫面、前端投影與五項 gate 日誌保存於 `/Users/caiyijun/.codex/visualizations/2026/10/19/01a153a5-b815-7753-ac1f-b3b7f9318c2b/draft-sync-natural-20261019`。後台投影為 verified／draft_prepared／not_armed，HTTP 路由仍未部署；沒有 commit、push 或 Worker 部署。
