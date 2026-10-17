# Substack 待人工處理 Hermes 通知

目前狀態：已由使用者完成系統授權並啟用。2026／10／17 台北 03：09：04，Hermes 已接受兩項待處理事項的合併通知，eventId=1、messageId=72。humanReceived=false，尚未取得真人收件確認。背景同步仍不操作 Chrome。

## 已完成的 owner 啟用（請勿重跑）

先前本工作階段遇到 sudo 密碼限制；使用者已在 Terminal 完成以下命令。這是歷史紀錄，不再是待辦步驟：

```sh
sudo /usr/bin/python3 -I -B -S "/Users/caiyijun/Library/Application Support/gcake-distribution/installed-hermes-attention-20261017/handoff/activate.py"
```

啟用檔 SHA-256：327d25e1d6b49e5b19d83602da8214ac42d7732025544c767b695ba8bca54463。

這個命令會核對目前安全排程、Hermes selector、所有 candidate runtime 檔案、通知政策與收據的雜湊；若有變動或其他同步正在執行，會停止。然後安裝 root-owned、以既有 hermes 帳號執行的檔案事件傳送器，新增特定帳號的輸入／收據讀取權限，從最近一小時內的實際完成輪次彙整目前待處理文章，透過 Hermes 官方 send_message_tool 發到原設定的 Telegram home。收到明確 message ID 後，才啟用持續通知的同步候選。

此命令會實際通知你目前的待人工處理事項；不發測試訊息，不更動原文章、憑證、Hermes gateway、既有 Hermes job 或 Bot 設定。不建立時間輪詢器。發送器會在每次同步輸入更新時醒來；相同問題集合不會再次發送。問題清空後再次出現可產生新通知。

## 未知結果與後續確認

如果回傳 unknown、blocked 或 activation_pending，不要重跑整個啟用命令，也不要刪除事件 DB。這時原安全排程仍保留；回傳結果與 /Users/Shared/gcake-substack-hermes/receipts/current.json 用於對帳。已嘗試或結果不明的通知不自動重送。sent 只代表 Hermes／Telegram 確認接受，不代表真人已讀。

若 owner 執行時同步正在跑，腳本會在任何 bridge 變更前停止，可等該輪結束後再執行；若已建立 bridge 或開始發送則需依收據對帳，不能直接重播。

## 目前證據

producer 透過既有 runSyncRound 的真正 RED→GREEN：原本未呼叫通知、通知失敗未回報，現在均通過。新驗證失敗與下一輪持續人工暫停會正規化成同一問題，避免重複提醒。來源／round 失敗保留既有問題，不會誤判為解除。

sender 與 owner preparation 有 10 個本機測試：初次通知、跨重啟去重、解除後再發生、發送逾時／結果不明／程序中斷不重送、skipped／partial／缺少 message ID 不當成功、無效／過期／symlink 輸入拒絕、事件工作而非輪詢、特權操作前身分拒絕。這些是 fixture 證據，不是正式 Hermes 傳送證據。

真實 candidate background round-1f1NkA 使用 notifyViaHermes=false；兩篇文章均在 plan 階段保持人工暫停，沒有文章操作、未清除原狀態，D1 in-flight 為零，來源與執行鎖已清理。此為啟用前的唯讀證據；owner 已完成後續啟用與實際 Hermes 傳送。

完整本機 pnpm test、pnpm check、pnpm build:all、pnpm release:dry-run 通過。owner 政策雜湊綁定增補後，相關測試再通過，完整 Hermes 依正常權限補驗，234 項通過；沙箱補跑的環境拒絕日誌另存，不當作產品失敗或通過。

修復程式與私人 pin／rollback／啟用檔保存在 installed-hermes-attention-20261017；原 safe installed-background-20261017 保留，未被覆寫。沒有 commit、push 或部署 Worker。

## 啟用後唯讀收尾

正式事件工作 dev.gcake.substack-hermes-notify 為 username=hermes、runs=1、last exit code=0，使用 WatchPaths；公開收據與 root-owned activation receipt 都是 sent、issueCount=2、eventId=1、messageId=72。沒有重跑 sender 或發送第二次通知。

原有 900 秒同步工作已指向 installed-hermes-attention-20261017，通知旗標已啟用；唯讀查核時新 runtime 的自然 runs=0，尚未把未發生的新自然輪次宣稱為已驗收。既有安全背景核心自然排程證據及同問題去重測試保留。沒有更動 Hermes gateway 或新增時間輪詢工作。
