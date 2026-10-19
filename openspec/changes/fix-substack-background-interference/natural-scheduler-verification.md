# PR33 私人安裝與自然排程結案

> 歷史證據：本頁只記錄 2026／10／17 的 PR33 安裝、自然輪次與當日清理；文中的「最新」「新固定版本」均限定該日。原稿由本機提交 `42424f7` 保留，本文回存不重做 Spectra 歸檔，也不移動既有 change。現行觀察器與政策見 [同步操作手冊](../../../docs/distribution-scripted-runbook.md)；本頁不能證明新排程政策的 5.3，也不授權恢復舊 runtime 或重寄通知。

2026／10／17，Asia／Taipei。PR #33 已合併為 b10d3525e2106d63b2e6f0030ccc61d855fdb5b5；三項 P2 審查意見均於本機 RED→GREEN 修復，完整本機 gate 與新 head 的兩項 CI 通過，自動審查無新增問題。

## 正式私人安裝

新固定版本 installed-pr33-reviewed-20261017-b10d352 的 601 個來源檔案均有 SHA-256 pin。Git tree 與受測的 10a6ce5 相同，沿用相同 Node 與依賴鎖。候選副本 34 項邊界測試與 7 項隔離 Hermes sender 測試成功。切換前的實際匿名輪次成功後，取得共享執行鎖、確認 GUI 排程閒置及 D1 無未解操作，才安全切換。切換後另一次明確執行的 CLI 驗證成功；它與以下自然觸發證據分開。

## 自然觸發證據

LaunchAgent runs 自 0 增至 2，last exit code=0。未送 kickstart、未改 900 秒間隔、RunAtLoad=false、KeepAlive=false。首輪 round-RPsiSp 於台北 13：28：38、13：28：41 分別驗證兩篇文章；第二輪 round-oYkbrB 於 13：45：18、13：45：26 成功。兩輪固定來源均為 b10d352，只有 verify，且 notification=quiet。

原文章 ID 220011124、220473117、公開網址與來源版本保持；全文及日期仍依既有嚴格契約核對。兩輪來源 clone 均已移除，final D1 locks／checkpoints／intents 為零，共享實體執行鎖不存在。後續唯讀 SELECT 再次核對兩篇 verified、原 ID 不變、newsletter_sent_at 為空，以及零未解操作。

## Hermes 與資料邊界

兩輪 producer 均成功處理空問題集合；正式 consumer 最新收據為 clear／issueCount=0，晚於最後 feed 更新，未產生重複通知。正式 sender 雜湊與通過跨重啟去重、解除後復發及 unknown 不重送測試的 consumer 相同，沒有重裝 sender、重新啟用 owner activation 或植入測試問題。humanReceived=false 不能當作真人已讀。

原安全版本 installed-identity-repair-20261017、舊設定與精確 previous-safe-agent.plist 均保留。新舊 runtime 雜湊、Hermes daemon／selector／gate 與主工作目錄的其他成果保持。完整原始 D1 rows、服務輸出及私人安裝收據留在私人 verification 目錄；本專案只回存去識別化的操作摘要、公開文章 ID 與證據 SHA-256，未匯入憑證或私人訊息。

本次結案只更新 Git 文件與 Spectra 主規格；不啟動或重啟同步、不操作 Chrome、不建立／更新／發布文章，也不寄送 Email／Substack App 通知。原先文件中的「待啟用」「自然輪次尚未觀察」均為前階段歷史紀錄，以本結案紀錄為最新狀態。

## 清理範圍

已合併修復工作樹 /private/tmp/gcake-substack-background-20261017 與 codex/fix-substack-background-interference 為本次唯一清理對象。清理前核對乾淨工作樹、PR33 merged head 與 squash merge 完整 tree 相同，並保存 Git bundle 與主工作目錄舊規格副本。因 squash 合併，原 commit 並非 main 的祖先；以精確內容等價與 bundle 保全確認後刪除該本機分支及對應遠端分支。其他工作樹與分支不動，私人運行／回滾版本不在 Git 工作樹內，完整保留。

詳見 natural-scheduler-acceptance.json 的機器可讀摘要與雜湊。
