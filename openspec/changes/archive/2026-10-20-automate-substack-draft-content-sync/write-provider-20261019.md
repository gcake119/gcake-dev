# Chrome 無人背景：單篇實際寫入與重新讀回

## 本次授權與範圍

使用者明確要求 Chrome、同一原 ID `221099415`、原 slug `ithome-2026-template-hardening` 的無人背景實際寫入及重新讀回；不更動既有排程、發布文章或寄送訂閱通知。此為明確授權的相同內容完整重存，不修改 Git 來源，不宣稱來源 A → B、建立文章、圖片上傳或全面常態寫入資格。

沿用既有 900 秒 timer、原共用 round／target lock、ScheduleRepository 更新意圖、v2 handoff、嚴格內容比較器及匿名 observer；只加入一次性的 `single-draft-write-qualification-v1`。grant 綁定 ID／slug／來源 revision／既有 baseline／runtime pin／Chrome／到期時間；一般 draftSync 與 scheduled.writeEnabled 維持停用。

Chrome 執行者只操作自己建立的新分頁，先讀取三份清單與完整 before，執行既有嚴格內容基準檢查，然後以真實 UI 填入標題、摘要、完整 HTML 富文字正文，觀察保存，離開編輯器再開回原 ID 並重新載入。slug 只讀，不改 SEO 設定。程序最長 600 秒；逾時或讀回不完整保留原 update-draft 意圖與 unknown 結果，不重播。

## 本機證據

既有 Node／SQLite acceptance 檔案新增六項寫入驗收：成功、程序失敗、保存證據不足、before 衝突、錯誤 baseline、已排程身分。先有四項 RED，實作後同檔案 34 項通過。第一次完整 gate 的 pnpm test 通過，但 pnpm check 找到缺少資料停止分支的型別縮限問題，原日誌保留。已明確標註 never 並修正型別；修正後 pnpm test、pnpm check、pnpm build:all、pnpm release:dry-run、pnpm editorial:rehearse 全部 exit 0；15 個程式／測試檔候選雜湊保持一致。既有 Hermes Python ResourceWarning 原樣保留，未修改無關測試。

21：06 已安裝私人釘選 runtime `installed-draft-write-chrome-20261019`，保留原 plist 與舊 runtime。pin 包含 19,141 個一般檔案（含依賴）；原 900 秒 timer、RunAtLoad=false，安裝後 runs=0，沒有 kickstart。等待自然觸發，尚無這次實際 provider 寫入證據。上一輪 Chrome 唯讀自然驗收仍在 natural-provider-20261019.md；不得用它替代這次的寫入驗收。

## 第一次寫入候選的保留失敗

21：22：27 消耗第一份 write grant，真實 Chrome 讀取清單時發生 `lists is not defined`。完整 transcript 只有建立 Chrome 分頁、辨識 browser family、讀 Drafts／Scheduled、點 Scheduled tab；沒有進入原草稿編輯器，沒有任何 fill／paste／save／Continue／Publish／Send。最後 finally 關閉唯一自有 Chrome 分頁，工具 surface 的 openTabIds 為空。此輪沒有實際寫入，不算通過；原 result.json 的 providerMutations=null 與意圖先保守保留。

根因：跨步驟的變數在 try 區塊內宣告，CU REPL 不把該宣告保存到下一次呼叫。以此真實驗收失敗作為 RED，修正執行者指示，要求先以獨立 top-level 呼叫建立持久 state，再於 try/finally 操作既有 state。這是修正同一驗收流程，不修改成功條件。原 claim／request 不重播；在完整操作證據確認尚未送出任何文章寫入，並以精確原意圖／版本對帳後，結清這筆未送出的自有意圖，保留 inconclusive，不改稱 verified。依仍在執行的使用者寫入指示，新候選使用另一份綁定 runtime 的單次範圍；沒有增加背景自動重試機制。

原失敗候選與修正候選安裝前的六篇 D1 身分、URL、provider 狀態、排程與寄送承諾逐欄一致。修正候選 `installed-draft-write-chrome-r2-20261019` 的五項完整 gate 全部 exit 0；原意圖結清收據在失敗候選的 reconciliation-unsent.json。等待新候選的自然輪次，尚未宣稱實際寫入通過。

修正候選 r2 的自然輪次於 21：44：46 開始，已完成三份清單核對；在切回 Drafts 後立即點文章標題時，遇到尚未可見的舊 DOM 連結而逾時。仍未進入草稿編輯或執行貼上；catch 關閉自有分頁。第二次寫入前失敗同樣保留，不能宣稱通過。新的修正沿用已成功的唯讀自然流程：完成清單後以原 ID 編輯網址 tab.goto 直接導覽，等待實際 editor／Saved 及重載；允許有界的唯讀載入等待與重新取得快照，對認證／身分／baseline／保存不明／讀回不符仍立即停止，任何 paste 後的寫入均不得重播。成功條件、嚴格比較器及未知意圖保留規則均未放寬。

直接導覽修正候選 r3 於 21：50：18 安裝至 `installed-draft-write-chrome-r3-20261019`，完整五項本機 gate 通過，維持原 900 秒 timer；尚未自然觸發時不宣稱成功。它以原 ID 直接導覽並確認載入，只允許有界唯讀快照／導覽恢復，不允許重播寫入；原兩次 claim 均保留。

r3 自然輪次於 22：06：07 開始，已成功直接進入原編輯器、重載、讀完整 before 與 slug，且本機嚴格驗證器實際輸出 SUBSTACK_BEFORE_VERIFIED。接著在貼上前呼叫未定義的 browser.documentation() 而停止；沒有 fill／clipboard.write／paste。這是第三次寫入前失敗，不算實際寫入通過。修正改為直接提供本次工具入口回傳的 TabClipboardAPI／TabClipboardItem／TabClipboardEntry 與 locator.press 介面：HTML clipboard entries、聚焦實際 body textbox、Meta+A／Meta+V；不再要求猜測文件查詢物件。保留原比較器、before 驗證器、一次 paste 與完整重載成功條件。

明確 API 候選 r4 於 22：13：49 安裝至 `installed-draft-write-chrome-r4-20261019`，五項完整 gate 通過，仍等候原 900 秒 timer 自然執行。原三次寫入前失敗的請求、raw result、精確呼叫審閱與未送出意圖結清均保留；未改稱成功，也未修改嚴格比較器。

## 最終結果：Chrome 無人自然實際寫入與重新讀回通過

2026／10／19 22：30：16 的 r4 claim，由原 900 秒 timer 自然觸發；22：33：36 完成實際保存／完整讀回，22：34：42 的 remote D1 事後對帳通過。整輪 `round-Yg3WyN` 為 completed、LaunchAgent exit 0，該候選 runs 由 0 → 1；沒有 kickstart、第二個 timer、本聊天代貼內容或代填回覆。此前三次失敗均在任何文章編輯前停止，原失敗與未送出意圖的對帳結清已保留；此處不是宣稱首次嘗試即通過。

實際執行者共有 17 個完成的 CU 呼叫，其 browserFamily 全為 chrome。它讀取完整 Drafts／Scheduled／Published 清單，以 `tab.goto` 進入原 ID，再重新載入讀取實際標題、摘要、全文 HTML、圖片與保存 slug；實際執行 verify-before.mts，輸出 `SUBSTACK_BEFORE_VERIFIED` 後才寫入。接著真實 UI fill 標題／摘要、寫入 HTML clipboard、聚焦正文並 Meta+A／Meta+V 完整貼上一次；觀察已儲存後離開編輯器，重新確認三份清單，再直接進入同一 ID 並 reload，完整重新讀取保存後內容與 slug。最後擷取畫面、保存 actual observation，於 finally 關閉自己的 Chrome 分頁。沒有 Continue／Publish／Send、排程／解除排程、建立或刪除文章、slug／SEO 欄位修改。

原 ID `221099415`、slug `ithome-2026-template-hardening` 保留。等待期間 main 有新提交，因此本輪固定來源 commit 為 `1f3e8cf413beadc687db0dbb58ad21994aa70a1c`；本篇 source revision 仍為 `sha256:6bd00a9217daefa1d9775b93523e10d063231e1fba5c9f0fc02202391de7890b`，內容沒有版本改動。預期、before 與重新載入後的完整 digest 均為 `sha256:e0bf0977ae22ffe1d050ad9a51ebcada48dbf526ef332c596e617d5c21b16721`。所以這是已實際完成的相同內容重存，不是來源 A → B 的 provider 證明；本篇沒有圖片，不能據此宣稱圖片上傳已驗收。

result.json 為 passed=true／writeVerified=true／providerMutations=1；這個 1 指一次邏輯上的完整草稿更新，沒有量測自動保存的 HTTP 請求次數。raw before／after 的完整 content 與 images 也相同，嚴格比較器沒有放寬。真正 D1 執行中快照驗證 request／intent／recordVersion／自有 target lock 相符；最後六篇紀錄的原 ID、slug、URL、provider 狀態、排程、armed／delivered 版本、Email／App 設定及公開承諾逐欄保留。原排程 ID `221098688` 不變。自有更新意圖已清除，locks／checkpoints／未決 publication intents 均為空，原暫存 Git source 實際不存在；關閉分頁的實際工具證據已核對。

remote D1 v53 的前端投影為 `verified`／`draft_prepared`／`not_armed`，checkedAt=`2026-10-19T14:33:36.275Z`、unresolvedOperation=false、code=null。subscriberReceipt 仍為 unknown；沒有發布或寄送訂閱通知。HTTP 路由仍未部署，這是實際 D1 的本機候選投影。

最後安裝的 15 個程式／測試檔與通過五項完整本機 gate 的候選一致，runtime pin 包含 19,141 個一般檔案（含依賴）。私人原始證據在 `installed-draft-write-chrome-r4-20261019` 的 qualification、rounds、records-during-write.json、natural-audit.json、records-after.json。精簡摘要、前端投影、真正 Chrome 畫面與各版 gate／失敗證據位於 `/Users/caiyijun/.codex/visualizations/2026/10/19/01a153a5-b815-7753-ac1f-b3b7f9318c2b/draft-sync-write-natural-20261019`；原 screenshot 名稱 editor.png 的 bytes 為 JPEG，展示副本使用正確 `.jpg` 副檔名，沒有修改像素。

單次 grant 已消耗，後續自然輪次不重播這次 authenticated 操作；一般 draftSync.enabled／writeEnabled 與 scheduled.writeEnabled 仍停用。此子範圍完成 8.2；廣泛建立／來源改版／圖片資格 5.2、全清單常態寫入 5.3 與 schedule-substack-drafts-ahead 的發布／寄送 5.3 仍保留待辦。本次沒有執行 commit、push、migration 或 Worker 部署。
