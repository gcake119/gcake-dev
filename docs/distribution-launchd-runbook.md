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

## 2026／10／15 可靠性修復

原生導向與控制項採有上限的 30 秒等待。切換清單後，先確認該清單已選取，再讀取總數與文章；仍須完整掃過已發佈、草稿與排程，數量不符即停止。已發佈清單的匹配文章先以匿名 archive 解析原 ID 的公開網址，交由既有完整驗證接手，不當成尚待改寫的草稿。

匿名 HTML 讀回在套用已驗收選取器前，依 HTML 屬性名稱不分大小寫的規則處理 time 的 datetime／dateTime；同一控制項有多個此類屬性或匹配多個日期均拒絕。全文、連結、圖片、canonical、刊物與文章 ID，以及原文分鐘精度繼續獨立驗證。

私人 UI 契約需保留實際觀察到的「僅在網站上發佈」確認控制。發佈確認只按一次，等待該對話框顯示後完成網站限定確認；電子郵件、Substack App 與排程均關閉。缺少控制或結果未知仍保留原意圖，不重播。

此機器已觀察到 Node 自動嘗試多個網路位址時，來源請求在連線階段逾時，而指定 IPv4 可連續取得來源。新 LaunchAgent 使用 --no-network-family-autoselection 與 --dns-result-order=ipv4first；保留 TLS 驗證、原憑證檔與無自動寫入重試。此設定只控制同步程序的連線路徑，不修改系統 DNS 或代理。

切換必須使用新私人目錄、獨立 runtime 副本與新雜湊清單，保存原 PR27 安裝供回復。先通過完整本機 gates、真正的原生三清單掃描與同 ID 匿名讀回，再切換；不得把人工啟動的一輪稱為自動排程驗收。新文章實際公開發佈的場域證據，需等下一篇符合條件的正式原文，不能為驗收提前發佈未到期內容。

## 2026／10／17 安靜背景同步

本節依使用者指示取代上方「背景直接操作既有 Chrome」的執行方式。系統排程只做不需登入的公開文章驗證，不開啟或操控 Chrome，也不切頁、重整或切到前景。原 transport 與登入綁定保留給明確前景操作；不另開瀏覽器、不匯出登入資料。

manual_required 是持續人工暫停狀態。下一輪、來源版本更新或殘留 checkpoint 都不解除暫停；原錯誤、文章 ID 與未知意圖保留。須明確前景處理並更新為 verified 後，背景才恢復同版本匿名驗證。不要為了排程顯示成功而直接修改狀態。沒有現成安全的一鍵解除指令；使用既有 reviewed dry-run／精確 revision approval／前景 distribution:run 流程處理，不在背景發送 retry。

一般背景規劃只允許同版本、已 verified 或 published、具有已知公開身分且沒有 checkpoint 的 verify。新文章、來源更新、草稿與日期復原記為 SUBSTACK_BACKGROUND_ATTENDED_REQUIRED；原本需要自動同步的新內容會暫停等待前景處理。公開身分解析支援既有內嵌 JSON 字串與新版唯一的 application/json preloads 資料；若資料缺漏、重複、格式錯誤或身分不符，仍保持人工暫停。解除誤判須明確執行原 ID 的匿名全文驗證，不會自動解除其他人工暫停。

sync-distribution 的 production dispatch 強制帶 --background；run-distribution 在讀取來源或平台前拒絕背景 prepare／publish／finalize／retry／login，且不得退回 attended handoff 或普通瀏覽器。transport 在匿名驗證前再讀目前持續狀態與 checkpoint，避免舊計畫重新放行人工暫停。

新安裝接受 executionMode=anonymous-only、transport=anonymous-public、browserAccess=false、articleWrites=0、readOnlyRound=completed、inFlight=0 的真實驗收收據。providerStates 允許明確記錄 manual_required／attended_required；這只證明背景安全暫停，不能冒稱文章驗證通過。禁止用舊 native 成功紀錄冒充新版本驗收。首次真實唯讀預檢可使用專屬 dependencies 只跳過「尚未產生的驗收收據」檢查，保留 pin、政策、來源及 D1 稽核；完成後正式 CLI 必須讀新收據。保留舊安裝與回滾證據，但舊版會恢復干擾，不能自動回滾啟用。

## Hermes 待人工處理通知

使用者 2026／10／17 補充授權：需要人工處理的項目透過既有 Hermes Telegram home channel 通知。原本 round 結果的 meaningful／quiet 只是一個標記，並不會真正發訊息；新增通知 producer 必須獨立處理現有人工暫停，即使先前標記 quiet 也要首次通知。

notifyViaHermes=true 的正式執行完成後，將公開 slug 與標準化原因寫到固定共享輸入檔，不匯出憑證。已知人工暫停與需前景操作會合併通知；一般來源／稽核失敗不得把舊人工暫停清空。confirmed clear 不發訊息，但允許日後相同問題重新通知。

傳送器由原 hermes 帳號執行，使用已選用正式 release 的 Hermes 官方 send_message_tool 與該帳號設定的 Telegram home。獨立 WatchPaths 檔案事件工作沒有 StartInterval，不建立新時間輪詢器、不重啟 gateway、不改既有 Hermes job。輸入只授權 hermes 讀取，收據只額外授權主使用者讀取，SQLite 發送 ledger 保持 Hermes-private。

每個新的問題集合先記錄 durable intent，再嘗試一次傳送。相同問題集合跨重啟保持安靜；明確成功且有 message ID 才記 sent。skipped、partial、沒有 message ID、錯誤或逾時均保持 unknown／待確認，不自動重送；任何 transport acknowledgement 都不等於真人已讀。Hermes selector 改變時停止，不偷偷改用其他 runtime 或 recipient。

啟用需要具系統密碼的 owner：先核對 candidate pin、既有安全排程與 Hermes selector，再安裝 root-owned sender、特定帳號 ACL 與事件工作。從最近一小時內的真實完成輪次產生首次待處理通知，取得 Hermes transport receipt 後才切換持續 producer。沒有真實傳送收據時保留原安全排程，不自行清除 unknown 或重跑一次性啟用。部分啟用失敗保留 ledger／收據供人工對帳，不能批次刪除或重播。

## PR33 審查補強

此排程的安裝及執行收據一律要求 anonymous-only；舊 profile／macos-chrome 成功收據不能代用。背景執行取得文章鎖後會再次檢查人工暫停、來源版本、公開身分及 checkpoint，拒絕時保留原狀態與診斷。

Hermes producer 在更新快照前讀取所有 D1 Substack 人工暫停，包含已刪除或不符合目前來源清單的文章。缺少完整持續狀態證據、讀取失敗或輪次失敗時不能清除既有通知快照；首次 owner seed 只能建立尚不存在的非空快照。

本段對應 Git 中的審查修正；本次合併不更新、不重啟已固定版本的私人安裝，後續安裝需另行驗證與切換。
