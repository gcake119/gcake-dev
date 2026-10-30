# 搜尋索引雲端告警操作手冊

本文件對應 `add-cloud-index-alerts`。目前為本機候選，正式 Admin Worker、CMS schema、排程與 Telegram secrets 尚未改動；既有 automation-3 保留。機械功能、供應商確認、真人實收與搜尋品質各自需要證據。

## 範圍與資料流

既有 Admin Worker 的十五分鐘 scheduled handler → 固定安全索引摘要與公開 manifest／digest → CMS 專用 checkpoint／通知帳本 → 固定 Telegram owner 私訊。後台 owner GET 只讀通知歷史，不執行背景輪次或寄送。

原搜尋 Worker、每分鐘索引 Cron、模型、500 requests／500 vectorQueries、paidOverage0、既有 billing 與 syncCapacity 期限全部維持。既有正式語意驗收六次嘗試額度已用盡；不得再查詢模型。此功能只有進度候選與告警，不代替 provider 全清冊、真正新文章自然同步、API／瀏覽器或人工相關性驗收。

## 配置與可信起點

- `INDEX_ALERTS_ENABLED` 預設 false；repo 不預先安裝新排程。
- `INDEX_ALERTS_SEED` 只能從原唯讀監測的完整連續收據與已驗收基準取得 afterReceipt、workerVersionId、acceptedCorpusId。不能用猜測的 MAX(id) 跳過收據，不能藉 reseed 重播未知通知。
- `INDEX_ALERTS_VALID_UNTIL` 不得晚於原容量證據 UTC2026-10-30T17:21:49.667084Z；`INDEX_STATUS_VALID_UNTIL` 須與已安裝獨立監測 token 的 UTC2026-11-28T00:00:00Z 相符。
- 已有 Admin secret `INDEX_STATUS_TOKEN` 沿用。新 Telegram token／chat 使用獨立命名的 server secrets；expected bot ID 只作身分釘選。不要把本機 Keychain／Hermes 讀取程式搬進瀏覽器。
- Telegram 現有程式存在不等於 Cloudflare 已有寄送資格。先核對現用 immutable runtime、bot 身分與既有 owner 私訊的非秘密回執，再就確切目的地、憑證放置及一次測試寄送取得缺少的授權。不得印出 token／chat，放入 argv、Git、一般檔案或工具輸出；私有記憶體與 stdin 傳遞，明確驗證 unknown outcomes，不盲目重送 secret put。

## 部署與遷移前核對

正式變更包含既有 Admin 來源／前端、CMS additive0008、三項新 Telegram 配置、有效期／seed／開關及新的 Admin 十五分鐘 Cron；這些不是舊唯讀進度部署的同一組正式變更。

先完成本機規格、行為驗收與既有完整 gate，再核准範圍、提交 PR、必要檢查與 exact main CI。部署前讀回當期正式 Admin metadata／bundle／資產、原 business flags、bindings、secret 名稱與所有現有排程。保留已整合的立即發布通知修補及 global_fetch_strictly_public。

0008 只建立 `index_alert_state`、`index_alert_events` 與最近事件索引。盤點既有 d1_migrations 與所有 CMS 表，確認同名表不存在或與本候選完全相符；不要使用會連帶套用其他未核准 migration 的寬泛命令。執行前保存精確 SQL digest 與原表 row count／必要內容；執行後獨立核對 schema 與原資料不變，保留操作身分及完整 JSON。連線或結果不明即對帳，不重送未知 mutation。

以 live-derived 設定部署；不讓 repo 中 RELEASE_WRITE_ENABLED=false 等候選預設回退現場設定。只新增 Admin `*/15 * * * *`，不改搜尋 Cron；初始驗收期間原 heartbeat 保留。下載正式 Worker／資產比對候選位元，核對環境值、排程與 secret 名稱；從 owner browser 驗證歷史、匿名401與無權403分開。

## 事件與寄送語義

- 當期 accepted corpus 的一般進度與 no_change 不通知。
- 新版本完成只稱「同步完成候選，搜尋驗收仍待確認」。
- 有效 lease 或明確 future wait 不當成停止；pending 本身不能解釋長時間沒有新收據。對齊中的合法新來源保持等待。
- stale、明確阻擋、未知推論、資格／容量／監測憑證到期、讀取失敗、runtime 變更、收據 gap／reset 產生一次事件並暫停。
- 單輪網路30秒、每頁50筆、最多11頁、狀態5秒、Telegram5秒，無自動請求重試。來源冷啟動會驗證三份公開資產，暖 isolate 重用已驗證 cache；不把資源上界稱為官方費用節省。

通知先保存 sending intent 才送出。Telegram HTTP成功、ok=true、訊息編號與回覆 chat 身分相符才記 sent。明確拒絕記 rejected；網路、逾時、格式或 chat 不符記 unknown。若供應商已回覆但 CMS 保存失敗，sending 留在帳本，下次只轉 unknown 並暫停，不另寄第二個錯誤告警。

通知去重 key 綁 runtime／corpus／reason。這不是 exactly-once 送達承諾；Telegram 接收也不代表真人已讀。unknown、rejected、not_configured 均需人工處理，不提供 UI 自動重送。不能藉刪除表、清 checkpoint 或換 seed 來重播。

## 後台閱讀與設計

「發布管理 → 搜尋索引」下方顯示背景檢查狀態、背景最後檢查、監測期限、最近20筆事件、寄送結果與時間。這些時間與「本頁最後讀取」分開。通知歷史只在開啟頁面與手動刷新時讀取，不新增第二組自動輪詢；手動間隔10秒、等待27秒、離開取消。401／403清除保護資料；其他失敗保留原時間並清楚標示舊紀錄。

沿用既有標題20px、正文17px、metadata14px與8／12／16／24px間距、44px控制與雙主題。空紀錄、失敗與未啟用不同；未知寄送需完整文字說明，不能只有顏色。手機320px／390px及桌面明暗均需驗收。畫面假資料不作正式送達證據。

## 正式驗收與切換

以 release-only INDEX_ALERTS_ACTIVATION_CHECK=true 啟用一次具明確標籤的啟用驗證通知；只有已驗收 baseline 的新鮮完成候選才寄送，正常部署預設不設此旗標。驗收不偽造新 corpus、不改索引資料。需要、正確 bot／owner destination 的供應商 acknowledgement、owner 後台實測及兩個自然十五分鐘雲端輪次。正常 accepted baseline 在兩輪中不得重複告警；checkpoint 必須由原連續證據續行，保留查核憑據。真人實收若未取得本人確認，明確列未確認。

全部機械證據齊全後才暫停原 automation-3，保留其設定與舊本機證據，不刪除 runtime 或未知通知紀錄。若原容量期限先到，停止並通知，不能為完成驗收而續期。若資格或網路不足，保留 heartbeat 於原期限內並列出未完成項目。

## 回復與限制

關閉新 cloud alert flag、移除本次 Admin Cron 即停止新觀測／寄送；不變更原搜尋。保留兩張表、sending／unknown帳本及完整證據。要恢復 paused 狀態或變更 bot／seed，先核對未決 intent，再用有具體範圍的前景操作；不得自動清理或重送。需要回到先前 Admin 版本時核對 schema 相容性、業務開關與路由設定，不回退已部署通知修補。

Admin Worker 或同一 Cloudflare 平台整體故障時，這個雲端告警器本身也可能無法寄送；本方案沒有承諾外部獨立可用性監測。CMS不可用時不在缺少 intent 的情況下寄送。外部可用性探測屬另一個需要獨立成本／維護判斷的功能。
