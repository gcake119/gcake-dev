# Publishing CMS 長期排程操作與啟用清單

狀態：程式可供本機驗收，正式發布停用。這份文件不是生產啟用授權。

## 日常操作

文章用「確認定稿並儲存 Git」保存。系列只有所有篇目定稿、檔案存在、manifest 與文章狀態一致時才有資格。首次定稿時間由成功且可達的 Git 提交歷史解析，D1 一旦保存便不重建；首次掃描超過 1000 次檔案提交或歷史不完整會停止，需人工查核，不以同步時間代替。整組系列資格首次驗證成功後保存 seriesReadyAt。

週一、週四台北時間 07:00 起最多取得一篇。畫面日期是估算；Git 提交、部署、公開頁面、RSS、Telegram 是不同證據。獨立文章按首次定稿順序優先，連載依 manifest 篇序恢復。人工固定日期保留占位，後續日期變動先預覽再確認。暫停前篇會擋住後篇。

發布工作在呼叫 Git 前保存唯一 release id 與租約。D1 用同一版本條件式更新保護整個操作文件，競爭失敗回報衝突，不能覆蓋較新的操作。未知 Git 回應及租約逾時只允許重新查核。已知寫入前衝突可安全重試；人工解除承諾保留 id、事件，下一次取得時段沿用身分。已公開及未知承諾不能解鎖。

Pages build 失敗不算已公開；目前 Worker／Pages 僅允許 main 分支人工觸發，合併及每小時經過均不部署。須另取得部署授權後人工部署復原，沒有每小時自動復原。只有另外核准 Actions write 並開啟 RELEASE_DEPLOY_RETRY_ENABLED 時，才能重跑與原 commit 對應的失敗 Pages workflow。重跑不建立第二篇文章。

## 人工部署前查核

1. 定稿、排程、暫停／恢復、指定時段預覽已由使用者回覆通過；確認固定／取消固定由代理 Computer Use 驗證通過。仍需人工確認新版資訊分區與手機可讀性、系列進度、事件／錯誤介面及真實 owner 登入流程；固定／取消若需親自操作驗收可另行補做。確認估算日期不能當成公開承諾。
2. 使用者已授權本次 atomic commits、推送 `feat/publishing-cms-release-design` 及建立 PR；PR 合併仍須另行授權。未合併或遠端部署。
3. 備份 production D1，確認現有 migrations 已套用，再授權套用 `0006_release_queue.sql`。不可重置舊資料庫。migration 新增獨立 runtime 文件，不改內容資料。
4. 確認 GitHub App 僅安裝在 gcake119/gcake-dev，Contents read/write、Metadata read、Actions read。金鑰與 installation token 僅在 Worker。原子 publication commit 必須能走既定受保護分支流程；目前不會自動觸發 Pages。正式自動發文啟用前，須另行設計、核准並驗證自動部署串接；不可直接放寬保護規則。部署重跑的 Actions write 是獨立、可選授權。
5. 確認 Worker owner 白名單、OAuth／App secrets、D1／R2 bindings；設定 Worker secret `RELEASE_AUTOMATION_SECRET`。部署新版 Worker 時仍保留 `RELEASE_WRITE_ENABLED=false`。
6. 建立 Actions `editorial-release` environment，設定 `RELEASE_WORKER_URL`（HTTPS Worker origin）及同名 secret。保留 `RELEASE_AUTOMATION_ENABLED` 未設定或 false。workflow 的 GITHUB_TOKEN 只有 contents read；實際寫入由受限 GitHub App 在 Worker 執行。
7. 在另外批准的非正式內容／環境驗收真實 App 提交 → Actions → Pages → URL／RSS。選定站點 canonical base，不可把本機 loopback 驗證當成 provider／production 證據。
8. 依下一節授權 Hermes 個別使用者的單一 RSS poller，確認 Telegram 收件者與秘密儲存；此步尚未在真實 Hermes 帳號執行。
9. 前述證據齊全後，由人明確決定 production gate 啟用、啟用時間與第一篇。屆時才將 Worker `RELEASE_WRITE_ENABLED` 與 Actions `RELEASE_AUTOMATION_ENABLED` 都設為 true。未啟用前，六篇維持 ready；10/12 等日期只是估算。

## Hermes 安裝與驗收

`scripts/hermes/rss_poller.py` 只用 Python 標準函式庫，單次執行一次；排程由 Hermes 帳號的既有 supervisor／工作排程器擇一管理，不另開第二個 poller。可每小時呼叫一次；這僅輪詢公開證據，不會觸發 Pages 部署。若要縮短通知延遲，可在人工驗收後調整輪詢間隔。

將 runner 安裝到該帳號可讀的位置，以該帳號執行。私有環境檔供應 TELEGRAM_BOT_TOKEN／TELEGRAM_CHAT_ID，檔案權限 0600，不寫入 Git、shell 命令參數或 log。預設 state 是該帳號 `~/.local/state/gcake-release/rss.json`，目錄 0700、state／lock 0600，必須位於 repository 外。第一次執行只建立靜默 RSS baseline，不補送歷史文章。

可先執行 `python3 scripts/hermes/rss_poller.py --dry-run`；它使用另一份 `.dry-run.json`，不消耗真實通知去重狀態。實際啟用時，先建立正式 baseline，再用核准的測試文章確認標題、canonical URL、台北發布時間以及重啟不重送。

通知前核對 RSS GUID／URL、canonical、頁面文章 metadata 與發布時間。送出前先保存 pending-send；收到成功回應後才記錄 sent。timeout／未知回應保留 unknown，重啟不盲目重送。人工先核對 Telegram 實際收件紀錄，再決定是否另外授權重送；目前 CMS 顯示「外部監控／未回報」，沒有通知回報入口，不宣稱已送達。

## 停用與復原

先關閉 Worker release gate，再關閉 Actions automation gate；Worker gate 停用會阻止正式寫入；Actions gate 停用只停止 Actions 排程觸發，不能取代 Worker 的寫入保護。保留 D1 runtime／release id／事件與 Hermes state，未知結果繼續查核而非刪除記錄。不要用改正文、改 manifest 順序或重新建立文章來復原。

D1 單一 CAS 文件適合個人 CMS 的發文量；每篇事件保留最近 100 筆，文章 release 身分長期保留。若未來資料量或併發量大幅增加，須另外規劃分表遷移、事件封存與負載驗證，不能宣稱目前已通過大量壓力測試。
