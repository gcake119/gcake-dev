# Substack 原生同步與獨立排程

現行同步只允許 Substack。Pages 是正式來源，來源 repo 必須是 gcake119/gcake-dev／main。外部聚合、MDX、未發布、未到日期、重複 slug 或匿名 Pages 不符均保留阻擋。Paragraph 已於 main 撤除，不恢復其 API、排程、文章或未知意圖。

## 身份與寄送政策

原生 transport=macos-chrome 使用 Google Chrome 官方 Apple Events，綁定 process ID、window ID、tab ID 及 gcakedev.substack.com 管理路徑。禁止 CDP、匯出登入資料、讀取 Cookie、私有平台 API 或自動開啟權限；Chrome 或分頁重啟後停止，重新綁定前需完成唯讀驗證。

編輯器没有公開 href 時，明確配置 ui.publicIdentity={source:"anonymous-post-data",publicationId:11352259}。匿名文章 HTML 的 post.id、publication_id、canonical_url 必須與原 remote ID、刊物及平台 URL 一致；只解析單一 JSON 字串，不執行頁面資料。新網站發布的原 ID 只由匿名 archive 找出，缺失、衝突或未知結果均保留原意圖，不再次發布或建立替代 ID。

全文、標題、原文連結、圖片與日期繼續獨立匿名驗證。Substack canonical 指同篇平台文章；正文保留 Pages 原文連結。Substack 日期採來源同一分鐘，Pages／正式來源保留秒數。相同已驗證版本只匿名讀回；公開版本更新只在原 ID 立即更新，電子郵件／Substack App 與排程均關閉。

完整查找 published／draft／scheduled 及所有分頁；實際總數與觀察到的 ID 數量不符即停止。日期、寄送欄位等待實際顯示後才讀取；缺少控制或明確布林狀態不得視為已關閉。一般能力旗標不任意開啟，只在確切已授權執行範圍使用已驗收控制。

## 安裝與切換

`distribution:native-preflight --permission-approved` 只驗證已由使用者開啟的權限和控制台，不啟用設定、不寄登入信、不發布。

`distribution:launchd prepare|install|status|uninstall` 使用絕對 Node、runtime、Git 外私人目錄與原 credentials.env 路徑。憑證只透過 Node --env-file 載入；安裝器只檢查權限，不讀取內容。私人檔案 0600、目錄 0700，避免將私人設定、驗收、pin 或瀏覽器資料提交 Git。

```sh
node --import tsx scripts/publishing/distribution-launchd.ts prepare \
  --private-dir '<新私人目錄>' --runtime '<固定 runtime>' \
  --node '<Node 絕對路徑>' --credentials '<原 credentials.env>' \
  --lock '<原共享 round-lock>'
```

prepare 只產生私人 plist，逐檔核對新 pin。install 另要求實際 standalone-acceptance.json：status=passed、transport=macos-chrome、nativePermissionsVerified=true、readOnlyRound=completed、inFlight=0。政策 targets 必須只含 substack。舊 pin 不更新以跳過差異；新版本須新安裝並重新驗收。

先完成完整本機驗證、真正系統工作的原生控制／匿名讀回、全 D1 locks／checkpoints／intent 對帳，且沒有其他 writer；停用舊 heartbeat 後才能 install。固定 label 是 dev.gcake.distribution-sync，每 900 秒執行既有 sync-distribution.ts，RunAtLoad／KeepAlive 關閉，使用原共享鎖，沒有 Codex、shell 初始化或背景 agent 依賴。最後啟動一次核對首輪結果與清理。只清理本輪快照；未知意圖與未回覆 handoff 保留。

macOS 使用者須登入、電腦醒著且指定 Chrome 開啟。權限、登入、UI 或身份不符時停止；結果記錄於私人 rounds／logs。解除安裝核對精確 plist 歸屬，保留私人政策、pin、憑證、D1 及文章。回滾先移除自有系統工作，確認無 writer／未知意圖後才能恢復 Substack-only heartbeat；不得恢復雙平台政策。

## 已完成證據與此 PR 的界線

2026／10／13 已安裝版本的真實系統唯讀驗收確認原 ID 220011124、publication ID 11352259、完整編輯器及匿名正文一致、日期 11：56、寄送及排程 false，articleWrites=0。首次正式系統輪次 Substack verified，D1 locks／checkpoints／intents 為零，快照與共享鎖已清理。原 heartbeat 已 PAUSED。

已安裝 runtime 為 distribution-launchd-20261012，私人版本 native-substack-final-20261013，pin 228 檔；私人 system-native.json、standalone-acceptance.json、cutover.json 保存上述證據。此 PR 移植至移除 Paragraph 後的 main，保留已安裝版本，沒有換 pin、重新部署或重新發布。此 PR 的完整本機結果需另行記錄，不能把前一版本的系統驗收直接宣稱為新版本平台驗收。
