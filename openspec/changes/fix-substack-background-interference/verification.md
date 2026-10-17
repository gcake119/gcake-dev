# Substack 背景干擾修復驗證

日期：2026-10-17，Asia／Taipei。

## 決策與範圍

本輪使用者明確要求人工處理項目不要每輪重試，背景同步不要重整一般 Chrome 分頁或切到前景。此指示取代歷史規格允許背景操作原生 Chrome 的部分。保留 Pages-first、同 ID、零 Email／App 寄送、來源完整性、D1 未知意圖與鎖、精準清理。沒有新增登入方式、私人 Substack API、CDP 或憑證匯出。

決策檢查為 Level 2，範圍是背景同步、瀏覽器控制與私人安裝。repo 沒有 docs/decisions/index.md；依 AGENTS.md、distribution-launchd-runbook、controlled-distribution 與 substack-unattended-reliability 的契約判斷。本次新增持續規則，記於本 change 的 design／spec 與 runbook；不為此次修復另建重複 ledger。

## 實作與根因

舊 planTarget 把 manual_required 當成一般待準備項目，回傳 prepare／publish；下一輪仍會重走原生 Chrome preflight 與清單導向。新邏輯保持人工暫停，即使來源變更或殘留 checkpoint 都不自動放行。

背景 prepareAllDistribution 僅為同版本、已有公開身分、verified／published、無 checkpoint 的文章排定 verify。其他工作清楚標為需前景處理。production dispatch 強制 --background；執行入口與 transport 都拒絕背景後台操作，transport 再讀目前持續狀態。前景明確操作保留原核准與同 ID 契約。

原始調查沒有發現明確 activate 指令，因此沒有把「視窗搶前景」的 OS 細節宣稱為已重現。本次採更強的可驗證邊界：背景完全不呼叫瀏覽器，不需靠操作後再把焦點切回來補救。

## 本機證據

基準：main b5f8d7c。程式候選：/private/tmp/gcake-substack-background-20261017，分支 codex/fix-substack-background-interference，尚未提交／推送。Spectra artifacts 依 CLI 行為位於主 checkout 同名 change。

- 人工暫停 RED：舊 planner 錯誤回傳 prepare／publish；修正後原測試 GREEN。
- 背景 RED：舊 transport 確實呼叫測試 browser opener（BROWSER_OPENED）；舊驗證未重新拒絕人工暫停；舊 CLI 沒有背景模式。修正後 GREEN。
- 新安裝收據 RED：舊安裝器拒絕匿名背景驗收；新增明確 anonymous-only 契約後 GREEN，瀏覽器呼叫／文章寫入／未完成預檢／未解意圖皆維持拒絕。
- 完整 pnpm test 通過，含 distribution 與既有 native／匿名驗證回歸；Hermes 測試有既有 SQLite ResourceWarning，整體成功。
- pnpm check：201 files，0 errors／warnings／hints。
- pnpm build:all 通過。
- pnpm release:dry-run 通過；productionWrites=false、telegramNetworkCalls=0。
- Spectra analyze：零 findings；validate 通過；git diff --check 通過。

原始日誌保存在新版私人安裝 verification／。測試成功後只移除本次 worktree 的 dependency symlink；獨立安裝依賴保留。

## 真實唯讀預檢

安裝：/Users/caiyijun/Library/Application Support/gcake-distribution/installed-background-20261017。

獨立 runtime 由受測 worktree 的 tracked files（含本次未提交修復）複製，587 個檔案有 SHA-256 pin，12 個變更檔與受測 worktree 雜湊一致。依賴鎖與舊安裝一致，依賴以 APFS copy-on-write 複製，不依賴臨時 worktree。

預檢來源：preflight-evidence-2.json，round-Ul5doW。兩篇正式文章均回報 DISTRIBUTION_MANUAL_REQUIRED；executions=0、browserCalls=0、d1Writes=0、D1 statesUnchanged=true、inFlight=0、cleanup.source=removed。這是安全略過驗收，兩篇文章的公開身份歧義仍未解除，不能說文章已重新驗證成功。

診斷程式攔截 osascript／open，拒絕非 SELECT 的 D1 要求與非 GET 的來源要求。第一次診斷攔截器未保留 Node execFile 的 promisify 契約，造成來源快照前失敗；該次證據保留為 failed，修正的是診斷程式，並非產品。第二次才是成功預檢。

新版收據由成功預檢產生，明確使用 anonymous-only／anonymous-public 與 manual_required；沒有拿舊版 verified 收據冒充。舊排程先確認 not running 且無 lock 才卸載；原 plist 及舊安裝保留。既有安裝器 prepare／install 成功，新排程 StartInterval=900、RunAtLoad=false、KeepAlive=false；沒有 kickstart。

## 自然排程

首輪自然 StartInterval 執行完成，runs 由 0 增至 1，未送 kickstart。round-dJ0qwV 的兩項結果均為 plan／DISTRIBUTION_MANUAL_REQUIRED，all-plan 沒有可執行的 run，沒有建構 browser transport，也沒有文章操作。notification=quiet；來源快照與執行鎖均已清除；final D1 locks／checkpoints／intents 為空。執行前後完整 target states 逐值相同。587 個 runtime 檔案 pin 重新核對一致。

排程 last exit code=1 對應已保存的 attention／人工暫停結果，stderr 為空；不是把持續人工問題改成成功。automatic-acceptance.json 與 verification/natural-scheduler-state.txt 保存自然排程證據。
