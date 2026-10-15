# Hermes 通知修復回存審查（２０２６－１０－１５）

審查結論：未發現阻擋本次本機提交的問題，未混入原有未提交變更。此結論適用本次回存清單與本機提交，並非額外的正式部署或通知授權。

## 範圍與來源

基底為 main／20b6578060ee0ee76b30b77f9038e78a1b5f7662。原始回存清單共 64 個檔案；另新增本審查文件，並補記本機提交授權。本次候選共 65 個檔案：11 個 scripts/hermes 原始碼與測試、4 個現有 Spectra change 文件、50 個本次修復的結案文件與歷史證據。

已核對原有 20 個未提交檔案的內容 SHA-256，與回存前紀錄完全一致，且與本次路徑不重疊。暫存區原為空。提交採明確路徑清單，不使用 git add . 或 git add -A。正式 SQLite、環境設定、runtime bundle 與備份未納入。

## 程式與證據審查

- 未解決通知會以非零退出碼呈現，診斷只保留固定類型及數字代碼，不保存原始 exception text。
- 原 unknown／uncertain 不會自動重送；人工補送先備份、取得既有鎖並保存單次 intent，重複操作或中斷不取得新的發送機會。
- Bot 切換的 continuation 要求指定原操作與確定 rejected 的傳送紀錄；保留 predecessor、備份與原事件身分。
- Gateway Token 逐次讀取固定私密檔案並核對 Bot pin，來源不安全或不同 Bot 時拒絕，不回退舊 Token。
- Owner adapter 使用既有 approval／updater／qualification／selector 介面；原生自然排程證據與本機測試分開記錄。
- 回存的準備工具從 repo 取得來源與證據；歷史 baseline、固定輸出與正式採用限制不變。
- 歷史交付工具、舊 patch 及階段性未完成敘述已由索引標記；正式完成狀態為 message_id＝40、human_received＝1。

## 驗證

完整 Hermes 185 tests 與原生 Python 3.11 的兩項搬移測試已於前次回存驗證通過。此次核對候選程式與該次驗證的 SHA-256 一致，未為純文件授權註記重跑測試。Spectra validate／analyze 與暫存區範圍、雜湊、機密模式及非歷史原始碼 whitespace 檢查於提交前確認。歷史 patch 保留原字節，不用一般原始碼 whitespace 規則改寫其證據。

## 保留限制

人工收件交易腳本未取得；repo 保存的是 owner 回報、正式備份與 monitor_human_receipts 稽核位置，不宣稱可重現該交易。正式傳送與收件結果仍以已記錄證據為準。本次提交不重新執行任何歷史入口，不發送通知，也不 push；原始暫存目錄與所有正式備份保留。
