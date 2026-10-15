# Telegram 通知修復結案（２０２６－１０－１５）

已完成正式採用、單次補送與人工確認登錄。message_id＝40，event／outbox／continuation＝sent，正式 human_received＝1。原 predecessor 仍 unknown，所有正式備份保留。正式結果來自使用者轉回的 Hermes 交易與查核，本機測試不取代正式證據。

## 文件與來源

- REPAIR.md：依時間追加的完整修復紀錄；早期未完成敘述為歷史狀態。
- repair-evidence.json：結案摘要、正式版本、備份與 monitor_human_receipts 稽核位置。
- source-inventory.json：暫存來源、回存位置與 SHA-256 對照；不是正式憑證或資料庫副本。
- GATEWAY_SWITCH_HANDOFF.md、OWNER_SUCCESSOR_HANDOFF.md：保留當時交接內容，已加上完成提示。
- 各階段 RED／GREEN log、active-sdk-offline.json：歷史測試與離線能力查核。
- historical/：各階段固定工具與程式副本。owner-successor 下僅保存控制、準備結果及入口，不包含 bundle/payload。
- notification-repair.patch：正式採用前產生的歷史 patch，未包含後續完整結案。最新版以 scripts/hermes 與現行 Spectra 文件為準。

historical/ 的入口與 owner_continue.py 綁定已消耗的文章、operation、digest 及路徑，只供追溯，不是新的操作授權。Shell 入口以非執行權限保存。prepare_notification_successor.py 從本 repo 讀取所需歷史輸入；輸出仍限制在原固定暫存位置、baseline 仍綁定原版本，因此目前正式新版會因 baseline drift 拒絕，並非可重新採用的最新版。

## 驗證

執行 pnpm test:hermes 與 spectra validate add-hermes-publication-monitor。test_notification_saveback.py 會將來源與證據搬到新的臨時 checkout，驗證來源不依賴原暫存目錄，缺少輸入時在建立套件前拒絕。

## 正式備份與未取得的來源

SQLite 備份、live.env、Gateway .env 與 runtime bundle 均未納入 repo。正式人工作證交易的稽核位於 live.sqlite／monitor_human_receipts；本次只取得 Hermes 結果，未取得該交易的執行腳本，因此不宣稱 repo 可重現該次正式更新。原暫存目錄與 root-owned proposal／release 仍保留；不要從歷史 handoff 的清理範例推定刪除備份的授權。

本次回存不修改正式設定、排程或資料庫，也不發送通知、不 commit、不 push。

## 回存後的本機提交授權

使用者另已授權審查並只提交本次 Hermes 通知修復，不 push。前述「不 commit」描述回存階段的界線；後續本機提交依本次新授權執行，範圍與審查結果見 REVIEW.md。

## PR 驗證後續

乾淨 CI 環境的 installed-runtime 依賴問題與修正見 [CI_FIX.md](CI_FIX.md)。原四筆提交與正式交付證據保留，準備工具的來源查核不再要求安裝 owner runtime；真正製作套件仍保留既有必要條件。
