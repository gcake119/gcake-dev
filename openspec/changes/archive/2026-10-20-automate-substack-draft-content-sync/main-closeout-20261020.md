# main 正式執行者收尾驗收（2026／10／20）

> 歷史紀錄：本文與配對 JSON 保存 2026／10／20 當時的版本、驗收與未來待辦，不代表 2026／10／23 的即時狀態，也不構成再次部署、寫入或通知授權。文內「尚未 commit／push」、「10／22 尚未到」及唯讀追蹤為當時情況；本次僅回填既有證據。後續發布與 Hermes 私訊驗收另見 [通知修復結案](../2026-10-22-repair-substack-publication-notifications/closeout-20261022.md)。使用者已決定不追蹤訂閱者寄送，排程試行 5.3 保留未完成，Codex 唯讀 heartbeat 已暫停；本次不更動正式排程。

本次依使用者「照建議完成」授權，對最新 main `6ea5c0b47f0551feb8a2381edc841573aa077f58` 完成正式後台核對、既有 ID 背景執行者更新與自然輪次驗收。這個 main 相較 PR43 合併只新增 PR44 的正式證據文件；359 個程式／依賴／設定輸入仍與五項完整本機 gate 通過的候選一致，最新 main CI 亦成功，未重跑相同 gate。

## 正式後台

即時確認現有正式 version `c65baef6-faa6-40c8-bb89-6a5047db216d`、deployment `55c29a09-1ac7-4eb0-be36-ce0ec091d546`，100％流量。它已包含 main f4ea22f 的後台修正，與目前 main 的 admin／Worker／contract 程式沒有差異；三個正式 HTML／JS／CSS SHA256 與已驗證產物一致，resources／bindings／plain vars／secret 名稱維持原樣，因此本次沒有重複部署或 migration。

Chrome 使用正常 owner OAuth、自有分頁與真實正式資產，無回應覆寫。列表六筆、原 ID 221099415 單篇、介面刷新均成功，觀察到兩個 API 真實 GET／200／no-store。介面分開呈現「已保存並驗證／草稿／未安排寄送」，實收仍 unknown。原稿新 checkedAt 為 UTC 2026-10-20 07:45:39.953，台北 15：45；另一草稿 221099763 為台北 15：49。桌面及實際 390px 分頁狀態可讀；390px 的 clientWidth／scrollWidth 均為 390。暫時版面模擬與網路觀察均已恢復，沒有改主題或內容。

保留一個 summary 元素的 DOM locator 等待未匹配與初始 browser viewport 未套用的原始結果；其後依實際 AX 開啟狀態區，並以自有分頁版面模擬及真實 DOM 寬度確認手機畫面。沒有為工具等待或版面設定問題修改應用程式，也不把先前 1713px 截圖稱作手機驗收。

## 最新執行者與自然輪次

Chrome 前景完整 Saved 重新讀回原 ID 221099415、slug `ithome-2026-template-hardening`，其全文指紋與目前 Git 一致：`sha256:e0bf0977ae22ffe1d050ad9a51ebcada48dbf526ef332c596e617d5c21b16721`。前景僅讀、不寫入 D1 成功狀態。

在既有 round lock 下備份及更新 13 個正式 runtime 的 publishing／Worker／contract 來源與測試檔，新 pin `1a07ebc26ed597c4d44a9402dec91fde9702978943a66b62f4d0b811b1f25b22`，保留舊 pin `154d9195…` 的收據鏈。資格／授權連結明列新版本真實讀回與本次授權；政策設定 SHA256、到期日 2026／11／18 23：44 台北、900 秒 timer／plist 均不變。沒有 reload／kickstart，allowCreate=false、scheduled.writeEnabled=false。

第 43 次自然輪次 `round-IpVZG9` 完成、exit 0，六筆草稿同步均 observed：兩篇合格草稿 verified、四篇保護文章 excluded；匿名 observer 同輪保留既有唯讀邊界。原稿 221099415 與另一篇 221099763 分別 16／15 次實際 Chrome 呼叫，動作均 draft-read，完整重新讀回及三清單驗證通過。本輪內容相同、零 provider 內容寫入；既有媒體寫入資格保留為歷史，不宣稱本次重新貼上或媒體寫入驗收。

六篇原 ID／slug／URL、時段、公開歷史、電子郵件／App／armed／delivered 承諾及 intent 逐項不變。final locks／checkpoints／intents 均為零，來源快照與 draft sessions 已清理；本次六個已知專用 Chrome 分頁確認全部關閉。既有使用者分頁及 Brave 未操作。已合併的乾淨 PR43 worktree 由 Codex app 保存可復原快照後封存；混合修改 worktree 724 個原檔案雜湊保持一致。

## 封存與未來試行

本 change 的草稿同步收尾驗收已完成，主規格同步預覽為 publishing-operations 修改 1 項、quiet-background-distribution 新增 1／修改 1 項、新增 unattended-substack-drafts 18 項，無衝突；不啟用未驗收的新建能力。決策登錄尚未初始化，本次沿用現有使用者／Spectra 邊界，沒有新增政策或 ADR。

另一 change 的 5.3 仍未完成：原 ID 221098688 的既定台北 10／22 07：00 尚未到，不修改或提前執行它。已建立 Codex 同對話唯讀追蹤「Substack 排程試行唯讀收尾」，10／22 07：30 前不執行驗收，其後才確認平台自行發布、後續普通匿名輪次及獨立寄送證據；無真人實收證據仍維持 unknown。只在完成、失敗或需人工處理時通知，終局後暫停追蹤。這不是新的 provider／Substack timer，不增加寫入權限。

機器摘要見 [main-closeout-20261020-results.json](main-closeout-20261020-results.json)。私人原始畫面、正文及 D1 快照在 `/private/tmp/gcake-main-closeout-20261020`，不納入 Git。本次沒有修改 Git 原稿、排程、發布文章或寄送通知，沒有 commit／push；本機封存變更另待提交。


## 本機封存結果

54／54 項任務完成後，已使用 Spectra 正式同步主規格並封存至 `openspec/changes/archive/2026-10-20-automate-substack-draft-content-sync`。新增 19 項、修改 2 項需求，沒有刪除需求或清理警告，原始主規格快照與歷史證據保留。三份現行操作／API 文件的連結同步指向封存位置。此為本機文件與規格變更，尚未 commit／push；程式碼與正式設定未因封存改動。
