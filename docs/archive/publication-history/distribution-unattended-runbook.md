> 歷史紀錄：Paragraph 同步已於 2026／10／13 停止。本頁不得作為啟動或恢復授權。

> 2026-10-13 後續操作說明：使用者確認 Substack 改用已開啟的 Chrome，經由 Computer Use 操作。現行受控流程以 [同步發文腳本操作手冊](../../distribution-scripted-runbook.md) 為準，目標只有 Substack。下文雙平台、側邊瀏覽器與舊排程描述保留為歷史，不構成恢復 Paragraph 的授權。新文章首次電子報政策與尚待正式啟用的界線，見 [多平台發佈文件](../../multi-platform-publishing.md)；本次沒有寄信或更改設定。


## 最新有效政策：2026／10／12 分鐘精度核准

使用者明確核准 Substack 顯示原文時間到分鐘。來源、Pages、Paragraph 保留 11：56：38；Substack 比對同一瞬間所屬分鐘 11：56，不比對平台內部秒數／毫秒。預設精確政策仍有效，只有明確 `displayedDatePrecision=minute` 綁定到 review 與 approval 的 Substack full-mirror 才使用此例外；舊授權不能重用。

正式 Substack 同一 ID 220011124 已保存原日期，重新載入設定為 2026-10-12T11:56；無 Cookie 匿名完整讀回為 2026-10-12T03:56:00.165Z，完整標題／正文／原文連結／平台 canonical 已通過。Paragraph ID J452GmnhN6v4Ooy8mXW8 已 verified。未寄電子郵件或 App 通知，未建立第二篇。原 metadata attempt 延續後結束。

日期控制流程：填入 datetime-local 後，必須用原生鍵盤變更事件確認實際 DOM 值已變更（可定位分鐘分段，上一步／下一步各自等待讀回，再恢復正確分鐘）。不能只信 fill 的畫面。完成後等已儲存，重新載入設定及匿名公開日期。已公開日期在「完成」後即保存，若仍需更新正文，繼續→確認 email／App 與排程都關閉→立即更新；禁止再次發布。日期已正確時 finalize 只匿名讀回，不再寫入。

匿名 Substack HTML 採唯一 verification 查詢避免 CDN 舊頁；仍驗證原公開 URL 的平台 canonical 與完整正文。實際獨立匿名結果見 `.distribution-handoff/live-acceptance-20261012/`。

以下是先前方案及歷史狀態，凡「未公開／待秒級驗收／舊排程 ACTIVE」皆由本節與最終切換紀錄取代。

> 本 checkout 的最新範圍已改為所有正式 Markdown。請先讀 [通用同步交接](distribution-all-articles-handoff.md)；下方單篇敘述保留為先前執行版本紀錄。舊釘選 runtime 位於另一份 checkout，沒有改動。

# Pages 先公開，再由 Codex 無人值守同步

2026-10-12 使用者已改為：確認原文站上公開後，自動同步到 Substack 與 Paragraph，使用 Codex 排程與已登入側邊瀏覽器，不逐篇要求核准。這取代先前「每階段另問核准／不啟用無人值守」的限制；不寄電子報、不提前公開、不合併 PR #8、Markdown 唯一來源與 Pages 原文身分仍有效。

目前只納入 `ithome-2026-publishing-in-production`。這篇先前誤提早公開，最新 main 改回 `ready` 並移除日期，公開網址 HTTP 404；歷史 sourceRevision 與 dry run 不能啟用本次同步。依最新 main 的正常文章排程公開後，使用當時 Markdown 與日期重新生成精確版本。

## 執行入口

- 隔離執行程式：`/Users/caiyijun/project/gcake-dev/.spectra/worktrees/distribution-integration-20261012`，未提交／推送，不影響原 dirty checkout。
- 本機憑證：`/Users/caiyijun/Library/Application Support/gcake-distribution/credentials.env`，只由 Node `--env-file` 載入，不讀回或印出內容。
- 排程政策：同目錄 `unattended.json`，沒有秘密。`unattended.enabled` 是本篇自動同步政策；一般 `paragraph.writeEnabled`／`substack.writeEnabled` 与能力驗證旗標維持 false。每次通過來源驗證才產生僅此篇／此版／此平台／此操作的 trial 設定。
- 執行檔案與 D1 操作意圖分開：每輪 review、approval、config、request、reply 都放 Git 外，資料夾 0700、檔案 0600。只有 D1 是跨輪操作／遠端 ID 的正式紀錄。

排程從遠端 main 取一次固定 commit 的 Markdown，保存在私人暫存 `src/content/posts/<slug>.md`。不得使用舊本機 checkout、歷史審閱檔或 Substack 編輯器內容代替來源。先檢查 published 狀態、已到時間，再呼叫 `schedule-distribution.ts <slug> <private-config> <private-output> <source-root>`，工作目錄為隔離執行程式。入口會匿名 GET Pages，對照完整正文、標題、canonical、日期、連結及圖片；任何失敗都不產生可執行授權。MDX／互動來源如無法精確驗證會停止，不猜測內容相同。

輸出的 `run.json` 有每平台 prepare／publish 指令資料，以及 Substack 日期恢復 finalize 授權。授權由既有 unattended 政策衍生，綁定這輪精確 digest，不代表一般正式能力已驗收。執行每個操作時，仍重新驗證來源；Paragraph 每次 create／update／publish 前再確認 Pages，側邊 UI 寫入前也須新查 Pages。

## Codex 側邊交接

執行 `run-distribution.ts <operation> <slug> <target> --mode controlled-trial --config <run-config> --receipt <review> --approval <operation-approval> --source-root <source-root>`。載入既有憑證；工作目錄仍為隔離執行程式。不要把憑證轉入程式參數或輸出。這個 trial 僅是能力尚未有真實證據時的精確版本入口，不需要有人逐次操作。

Substack CLI 會等待並印出 `attendedRequest` 檔案位置。這裡的 attended 指有 Codex 控制器接手側邊，不要求人類在場。Codex 僅使用 `cua_repl` 操作已登入的 gcakedev.substack.com，不連 CDP、不複製 Cookie、不使用未公開 API。

讀取 request.json 後確認 version、requestId、slug、sourceRevision、operation、action、remoteId 與 expiresAt，全數原樣帶入 reply.json。寫入前唯讀確認同篇 D1 checkpoint；只接受對應動作。reply 使用 `{...envelope, ok: true, result: <observed evidence>}`，獨占新建 0600；超時或結果不明不得重做，讓 CLI 保留原意圖。

- preflight：觀察目前刊物與登入，回 origin／loggedIn。
- find：完整讀 draft／published／scheduled 與所有分頁，逐篇核對標題、原文連結／完整內容；回 scanned／complete／items。查找不完整就回停止，不能猜 empty。診斷草稿 `219884438` 保持不變。
- create：只建立一次不公開候選，立即保存新 remote ID。若取得 ID 但結果不明，保留原 request，不能重建。
- update／readDraft：使用 request.html，透過側邊 HTML clipboard 或 paste 完成；重新載入後讀回 title、全部 text、links、images（src／alt／loaded）與 saved。不可只用「已儲存」判定內容正確。
- checkPublish：先驗證同一草稿，再確認 email／App 傳送未勾選、未排程，回完整草稿證據與 emailDisabled／scheduleDisabled。
- publish：再確認原文仍公開及對話框，單次網站發布，保存同一 ID 的公開 URL，回 emailDisabled／scheduleDisabled。不得因跳轉或讀回失敗再按一次。
- locatePublic：只定位既有 ID 對應公開文章，不能建立／發布。
- metadata：先完整匿名核對同一公開文章，僅修改顯示日期，原 ID 不變，讀回正文與 saved。未確定保存時保留意圖。

首次正式公開後，Codex 可從該公開頁可見 DOM 觀察唯一標題／正文／日期 selector，保存於這輪 config 的 substack.ui.publicTitle／publicBody／publicDate，再回應 publish。不得猜 selector 或將一般能力旗標改 true。CLI 重新載入同一精確 scope 的 config，匿名無 Cookie GET 全文與圖片；平台 canonical、Pages 原文連結及原文日期全數符合才寫 verified。選擇器或原日期控制不明時保留 checkpoint 並停止，通知具體阻擋。

## 跨輪恢復

先讀本篇 D1 的 states、locks、checkpoints。不確定意圖只執行 retry／verify，不能建立新輪次來繞過意圖。metadata 意圖先匿名核對全部正文／連結／canonical，再使用這輪 finalize 授權補改同一篇日期，不重新發布。其他平台可以獨立完成；不得因單平台失敗撤銷已成功的另一平台。

重新同步同版 verified 狀態只读回，不重新建立或發布。新 Markdown 版本如與未完成意圖不同，停止并報 revision mismatch。來源撤回、404、過期版本或未来日期時，兩平台均停止，不能用歷史網站證據補發。

## 運行條件與驗收界線

Codex 桌面排程需本機可執行，側邊登入需仍有效；關機、工具無法取得側邊或登入失效時停止並通知。例行狀態無變化保持安靜，只有首次同步完成、未知结果、失敗或需要使用者操作時通知。

已完成本機 SQLite／Chrome fixture 驗證，不等於正式平台發布驗收。D1／Paragraph 憑證目前只驗證讀取權限。真實 Substack 原日期控制與公開讀回，仍须在原文正確公開後，以第一次受控網站同步取得證據；失敗時保留原 ID，而不是再發一篇。本次沒有建立正式候選、發布或寄信。
