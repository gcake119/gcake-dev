# Publishing CMS 長期排程操作與啟用清單

本文件保留各階段操作與交接證據。2026／10／13 章節的「本機／尚未部署」只代表當時範圍；後續 CMS 部署見 [２０２６－１０－１６結案紀錄](publishing-cms-deployment-20261016.md)。歷史版本、開關與啟用清單均不代表目前狀態，也不是重新安裝或部署授權。Substack 現行政策另見 [同步操作手冊](distribution-scripted-runbook.md)。

## 日常操作

文章用「確認定稿並儲存 Git」保存。系列只有所有篇目定稿、檔案存在、manifest 與文章狀態一致時才有資格。首次定稿時間由成功且可達的 Git 提交歷史解析，D1 一旦保存便不重建；首次掃描超過 1000 次檔案提交或歷史不完整會停止，需人工查核，不以同步時間代替。整組系列資格首次驗證成功後保存 seriesReadyAt。

週一、週四台北時間 07:00 起最多取得一篇。畫面日期是估算；Git 提交、部署、公開頁面、RSS、Telegram 是不同證據。獨立文章按首次定稿順序優先，連載依 manifest 篇序恢復。人工固定日期保留占位，後續日期變動先預覽再確認。暫停前篇會擋住後篇。

發布工作在呼叫 Git 前保存唯一 release id 與租約。D1 用同一版本條件式更新保護整個操作文件，競爭失敗回報衝突，不能覆蓋較新的操作。未知 Git 回應及租約逾時只允許重新查核。已知寫入前衝突可安全重試；人工解除承諾保留 id、事件，下一次取得時段沿用身分。已公開及未知承諾不能解鎖。

Pages build 失敗不算已公開；目前 Worker／Pages 僅允許 main 分支人工觸發，合併及每小時經過均不部署。須另取得部署授權後人工部署復原，沒有每小時自動復原。只有另外核准 Actions write 並開啟 RELEASE_DEPLOY_RETRY_ENABLED 時，才能重跑與原 commit 對應的失敗 Pages workflow。重跑不建立第二篇文章。

## 歷史啟用查核（2026／10／11）

1. 定稿、排程、暫停／恢復、指定時段預覽已由使用者回覆通過；確認固定／取消固定由代理 Computer Use 驗證通過。仍需人工確認新版資訊分區與手機可讀性、系列進度、事件／錯誤介面及真實 owner 登入流程；固定／取消若需親自操作驗收可另行補做。確認估算日期不能當成公開承諾。
2. 使用者已授權本次 atomic commits、推送 `feat/publishing-cms-release-design` 及建立 PR；PR 合併仍須另行授權。未合併或遠端部署。
3. 備份 production D1，確認現有 migrations 已套用，再授權套用 `0006_release_queue.sql`。不可重置舊資料庫。migration 新增獨立 runtime 文件，不改內容資料。
4. 確認 GitHub App 僅安裝在 gcake119/gcake-dev，Contents read/write、Metadata read、Actions read。金鑰與 installation token 僅在 Worker。原子 publication commit 必須能走既定受保護分支流程；目前不會自動觸發 Pages。正式自動發文啟用前，須另行設計、核准並驗證自動部署串接；不可直接放寬保護規則。部署重跑的 Actions write 是獨立、可選授權。
5. 確認 Worker owner 白名單、OAuth／App secrets、D1／R2 bindings；設定 Worker secret `RELEASE_AUTOMATION_SECRET`。部署新版 Worker 時仍保留 `RELEASE_WRITE_ENABLED=false`。
6. 建立 Actions `editorial-release` environment，設定 `RELEASE_WORKER_URL`（HTTPS Worker origin）及同名 secret。保留 `RELEASE_AUTOMATION_ENABLED` 未設定或 false。workflow 的 GITHUB_TOKEN 只有 contents read；實際寫入由受限 GitHub App 在 Worker 執行。
7. 在另外批准的非正式內容／環境驗收真實 App 提交 → Actions → Pages → URL／RSS。選定站點 canonical base，不可把本機 loopback 驗證當成 provider／production 證據。
8. 依下一節授權 Hermes 個別使用者的單一 RSS poller，確認 Telegram 收件者與秘密儲存；此步尚未在真實 Hermes 帳號執行。
9. 前述證據齊全後，由人明確決定 production gate 啟用、啟用時間與第一篇。屆時才將 Worker `RELEASE_WRITE_ENABLED` 與 Actions `RELEASE_AUTOMATION_ENABLED` 都設為 true。未啟用前，六篇維持 ready；10/12 等日期只是估算。

## 歷史 RSS poller 安裝與驗收說明

`scripts/hermes/rss_poller.py` 只用 Python 標準函式庫，單次執行一次；排程由 Hermes 帳號的既有 supervisor／工作排程器擇一管理，不另開第二個 poller。可每小時呼叫一次；這僅輪詢公開證據，不會觸發 Pages 部署。若要縮短通知延遲，可在人工驗收後調整輪詢間隔。

將 runner 安裝到該帳號可讀的位置，以該帳號執行。私有環境檔供應 TELEGRAM_BOT_TOKEN／TELEGRAM_CHAT_ID，檔案權限 0600，不寫入 Git、shell 命令參數或 log。預設 state 是該帳號 `~/.local/state/gcake-release/rss.json`，目錄 0700、state／lock 0600，必須位於 repository 外。第一次執行只建立靜默 RSS baseline，不補送歷史文章。

可先執行 `python3 scripts/hermes/rss_poller.py --dry-run`；它使用另一份 `.dry-run.json`，不消耗真實通知去重狀態。實際啟用時，先建立正式 baseline，再用核准的測試文章確認標題、canonical URL、台北發布時間以及重啟不重送。

通知前核對 RSS GUID／URL、canonical、頁面文章 metadata 與發布時間。送出前先保存 pending-send；收到成功回應後才記錄 sent。timeout／未知回應保留 unknown，重啟不盲目重送。人工先核對 Telegram 實際收件紀錄，再決定是否另外授權重送；目前 CMS 顯示「外部監控／未回報」，沒有通知回報入口，不宣稱已送達。

## 停用與復原

先關閉 Worker release gate，再關閉 Actions automation gate；Worker gate 停用會阻止正式寫入；Actions gate 停用只停止 Actions 排程觸發，不能取代 Worker 的寫入保護。保留 D1 runtime／release id／事件與 Hermes state，未知結果繼續查核而非刪除記錄。不要用改正文、改 manifest 順序或重新建立文章來復原。

D1 單一 CAS 文件適合個人 CMS 的發文量；每篇事件保留最近 100 筆，文章 release 身分長期保留。若未來資料量或併發量大幅增加，須另外規劃分表遷移、事件封存與負載驗證，不能宣稱目前已通過大量壓力測試。

## 2026-10-12 已授權的正式啟用延伸

使用者已授權補齊條件式 Pages 部署、共用 automation 憑證、完整驗證後合併／人工 rollout／啟用。此授權不涵蓋 Hermes 安裝或 Telegram 寄送。先前 manual-only 決策仍適用一般 Worker／Pages workflow；editorial workflow 只有取得新發文 commit 時，才能建置該 SHA 並部署，沒有新發文的每小時巡查不部署。

Actions editorial-release environment 僅允許 main。設定 RELEASE_WORKER_URL 與 RELEASE_AUTOMATION_SECRET，Worker 使用同一 secret。憑證只透過私有輸入設定；不要貼到聊天、命令參數或 log。Worker secret put 會立即建立版本並部署，因此須在 review 完成且已有部署授權後執行。Production gate 透過 Cloudflare 變數明確設為 true，之後再啟用 repository RELEASE_AUTOMATION_ENABLED=true。版本控制中的 gate 保留 false，日後依該設定重新部署會安全停用，必須重新查核啟用状态。

恢復：若 editorial workflow 的 build／deploy 失敗，先從該次 run 選擇 Re-run failed jobs，沿用成功 release job 的 SHA 輸出。不要重跑整個 workflow 來期待重新發文；每小時巡查不會再次部署舊 release。另一條既有人工 Pages workflow 需取得授權後使用，並確認它所建置的版本包含原發文提交。未知 Git 結果先查核，不重建 release identity。

歷史觀察限制（2026-10-13 本機修補前）：GitHub reader 只取得 manual deploy-pages 的觀察。reverify 僅接受與 release SHA 相符的觀察；editorial run 的部署成功／失敗請查看該次 Actions build／deploy job。不可把舊人工部署當成本次發文證據。CMS 的公開頁與 RSS 驗證仍独立執行；兩者成功才標記 verified-public，單靠 workflow 綠燈不代表已公開。


## 2026-10-13 建置與 CMS 觀察修補（本機，尚未部署）

既有兩個 editorial cron、時段、D1 身分與篇序保持不變。普通 Pages 的 push／minute-37 本機候選撤回為 legacy，仍只接受手動；自動連載部署由 editorial workflow 單一負責，不新增重複排程。兩条建置都先核對部落格已保存的 completed 30 篇與獨立固定 revision／逐篇雜湊 manifest；不完整或核對失敗立即停止，不能退回 main 舊 19 篇。操作與歷史工具邊界見 [文章排程](article-scheduling.md)。

新版 reader 同時查核 editorial 與普通 Pages，使用 `Build publication <SHA>`／`Deploy publication <SHA>` 的實際 artifact 身分。普通手動 checkout 固定該次 main SHA，editorial checkout 固定 Worker 回傳 SHA。查核只關聯對應 release commit，略過空巡查及 Secret-only run；只有 deploy job 成功才報告 deployed。各 workflow 最近 100 次 main run 以外、舊版沒有 artifact 身分的 run 或 API 缺少證據時，保持未知，人工查核原 run，不推測身份。舊失敗 run 不具新版 job 身分，仍由 owner 從原 Actions run 明確復原；本機修補不自動遷移歷史證據。

新版重試在原 actions-write 授權與 Worker retry gate 下，重新核對同一 SHA 的失敗 run，再呼叫 `rerun-failed-jobs`。較新的其他 run、成功或未能證實的 run 不會被重試；不呼叫 workflow dispatch 或新的文章提交。手動全 workflow rerun 仍應避免。GitHub API 合約參考：[workflow jobs](https://docs.github.com/en/rest/actions/workflow-jobs)、[failed-job recovery](https://docs.github.com/en/rest/actions/workflow-runs#re-run-failed-jobs-from-a-workflow-run)。

本機測試以假 GitHub／saved-site 回應驗證，不使用正式 token、不調整 production gates、不查寫 D1、不推送或部署。公開頁的 canonical、文章 SHA-256、發布時間與 RSS GUID 仍須通過既有獨立驗證，才能標示 verified-public。推送前核對修補範圍；正式 rollout 另需確認現有 D1、gate 與 Worker／workflow 版本，不能把本機通過視為 Production 驗收。

## 歷史單篇公開驗收工具來源回存（２０２６－１０－１６）

`scripts/hermes/public_release_acceptance.py` 與其 fixture tests 已由舊驗收工作樹原樣回存。它只針對固定的歷史首篇，使用隔離公開 Git 與無憑證靜態 GET，拒絕 GitHub REST／GraphQL／內部 JSON API；公開頁／RSS 與 scheduled／部署 provenance 分別判斷。來源不足保持 unconfirmed，不重發、不重跑 workflow。這不是正式 Hermes 通用監控入口，也不要求重建已完成 job。舊 shell 入口只保存於 docs/worktree-closeout/2026-10-16/historical，不能照抄執行。回存及工作樹保留依據見該目錄 README。

## PR ＃32 CMS 部署歷史（２０２６－１０－１６）

[部署與結案紀錄](publishing-cms-deployment-20261016.md) 保存該日版本、開關讀回、D1 備份與介面證據。它補充上方較早的待部署紀錄，不代表目前版本或開關值，也不授權重新部署。Substack 單篇新政策另見 [同步操作手冊](distribution-scripted-runbook.md)。
