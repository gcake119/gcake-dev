# Hermes 正式導入與運作紀錄

２０２６－１０－１３台北１７：０６：１１的正式自然輪次通過：job `550aaf17723d`、UID 502、mode `live`、exit code 0，原訂時間與 execution ledger 一致。首次安裝與重開機後 dry-run 也已 verified。資料來源是主使用者 Terminal 的實際 JSON，不以本機替身取代正式驗收。

## 已生效的內容

- Hermes 0.21.4／Python 3.11.15，來源 `7ce190446e548e2e1c0ae6ba0225be0490d12fc2`。`cron/scheduler_script.py` 注入 job、execution、原訂 UTC 時間；檢查 inherited／private env 無法覆蓋該上下文。`scripts/hermes/hermes-cron-context.patch` 與正式 runtime 正向套用結果一致，原始 SHA256 先核對。
- 本輪已驗證的完整封存 runtime：`/usr/local/share/gcake-hermes-runtime/releases/8e285697719b62295eae5bd8db23ed52b8da6f6dbe585eabef91b835462f9f2e`。root 管理核准、selector、更新與回復；hermes 執行 gateway／wrapper，通知狀態與私有設定位於版本外。
- system LaunchDaemon `ai.hermes.gateway.boot` 使用 `/usr/local/libexec/hermes-gateway-managed`；重開機後 running。正式 wrapper `gcake-rss-live.sh` 經管理入口選定同一 release，沿用原 `live.sqlite`。
- 舊測試 job `ea3c550669f1` 已 paused；正式 job `550aaf17723d` 維持 enabled、no-agent、每６０分鐘與 local delivery。沒有建立新 poller、修改排程時刻或手動 run-now。
- 自動更新入口 `/usr/local/libexec/hermes-auto-update` 保留原 LaunchDaemon 的週三台北０４：３０排程與既有 updater exclusion。未核准 successor 跳過並去重保留審閱；已核准固定 proposal 才進完整 runtime 更新，不 fetch 移動中的 main。
- Cloudflare 純讀摘要 `/api/v1/monitoring/publications` 與專用 `MONITOR_READ_SECRET` 已導入。初次本輪回復基準 version `864a61b6-c7e9-4bbe-b92d-7f1275b83cc9`，本輪最終部署 version `cb62580d-5c24-4fb1-8682-e3a98b23c88c`。不修改 D1 或發文排程；既有 provider 寫入開關保持。
- 私有摘要 env 已存在於 `/Users/hermes/.config/gcake-rss/publication-monitor.env`，UID 502／0600／非連結；憑證值不進 repository、聊天或 CLI arguments。Bearer 只送指定摘要端點；當輪隨機 request ID 與５秒時鐘容差配對，６０分鐘 grace／連續兩輪規則保持。

正常狀態保持安靜；只有新文章、正式承諾逾期或符合規則的異常恢復才通知。沒有發 Telegram 測試訊息，也沒有宣稱人已收到。啟用後是正常正式監控，依既有通知權限處理實際事件。

## 備份與失敗回復

首次備份、安裝 journal、qualification 位於 `/usr/local/share/gcake-hermes-runtime/private`，root-only。原程式與 interpreter 保留在原絕對路徑。uv `cpython-3.11` 連結及固定 3.11.15 目標分別核對／保存；不是放寬到任意 runtime。

首次未完成安裝由固定管理入口的 `recover` 對帳 durable journal，再還原 exact slots、ACL／擁有者／模式及原 gateway，驗證後才開放 sender。已完成安裝不重跑首次 installer。Routine 更新由 persisted approved proposal 與 UpdateEntry transaction 恢復到先前完整 release；回復失敗維持 maintenance gate，交由 owner 查核 root-private 診斷，沒有無限重啟或重送。沒有核准 successor 時自動更新只跳過。

備份 DB 僅供 reconciliation，不能直接覆蓋最新通知 state／execution ledger。未知發送結果保留 unknown／uncertain，不自动 replay。完成安裝、普通重開機或清除暫存不是恢復舊 DB 的理由。

## 本輪暫存遺失與來源恢复

重開機後 `/private/tmp/gcake-hermes-monitor-plan-20261012` 及其私有 staging 已消失；正式 runtime、root-private 備份與 journal 均保留。從對話原始程式寫入紀錄恢復本次源碼／規格／測試，並將七個已安裝工具及實際 monitor 逐檔比對。AST-only scheduler fixture 取自已安裝的 runner；正向 patch 另以原始 hash 完整核對。没有執行歷史 shell 命令來重新部署。

舊 log／３份 combined bundles 已不在，歷史文字報告明確標示這個限制；沒有把文字恢復當作原始 log。已恢復的本機測試在持久隔離 clone 重新跑完整 gate。新來源交付基準是最新 main `179cd3953d00c39d7477027af20636b60ed213f3`，保留 Substack 等新功能；這是源碼整合基準，沒有再次覆蓋正式 Worker。

提交範圍只含監控／summary／更新入口、測試、規格、非秘密證據與文件。不提交完整 interpreter、site-packages、私有 env、通知 DB 或 root 備份。持久交付 clone 與復原資料屬本輪工作，驗收後保留至２０２６－１０－２０供核對，再僅清理確認歸屬的本機資料；正式 authority 與備份持續保留。

## Closeout 時的其他 runtime 修復

唯讀 selector 顯示目前為 `f98d49207288ae81f1cad0ece146489c1631700f946ea9146663cfab32eab66e`（`hermes-0214-telegram-repair-20261013`），mode live／gate ready。監控 library、cron kernel 及七個更新工具均與本輪已驗證程式相同。此 closeout 保留該後續 runtime；不回切、不重新部署，也不將原本 8e2856 的 owner 自然輪次結果當成這個新完整 runtime 的重新驗收。詳 `current-selection-closeout.json`。
