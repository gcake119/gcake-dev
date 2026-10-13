> 歷史報告，從本次對話的原始寫入紀錄恢復。`/private/tmp` 清除後，文中舊 log／臨時 bundle 不再存在；不能把本檔當作那些原始 log。最新實際 owner 結果見 README.md。

# Hermes 通用發文監控：本機驗證證據

日期：２０２６－１０－１２，台北。候選基準：`bb241cb375c9d0b05c8301eba6e0d2cae2bab409`。所有產品變更保存在隔離 clone，沒有新 commit／push／合併／部署或正式 Telegram 發送。

## 真正產品 RED／GREEN

| 證據 | 實際結果及範圍 |
| --- | --- |
| summary-red.log | 真正 `handleRequest` 的新 GET 路徑回４０４；５項驗收失敗。已排除初次測試未先檢查 response shape 所產生的 TypeError，保存的是修正後４０４對２００／４０３／５０３。 |
| summary-green.log | 同入口５項通過：全文章、最小揭露、no-store、重複純讀、憑證、分類、revision／queue version 變動及失敗關閉。SQLite adapter 拒絕所有非 SELECT，讀取前後完整資料相同。 |
| monitor-red.log | 候選最初銜接既有 RSS engine，缺少逾期／恢復策略；精確６０分鐘、兩壞兩好、晚發合併等驗收有 `0 != 1` 的產品失敗。記錄中的４項 error 是舊 seam 的不相容／尚未具備的新 durable tables／鎖等限制，不能把它們都算成新規格的產品 RED；初次 unittest fixture 覆蓋 run 的環境錯誤沒有作為 RED 使用。 |
| integration-red.log | 同一正式時刻改用等價時區表示卻重送（２對１）；明確拒絕的恢復事件未在下輪重試（０對１），兩個 genuine RED 已修正。 |
| transport-red.log | 本機 HTTP server 送回明確 ok=false／error_code=400，舊 transport 只丟 generic ValueError；候選需分類為可重試的 DeliveryRejected。沒有真實 Telegram 連線。socket 權限／缺少新 helper 的早期錯誤不算產品 RED，最終保存的是 transport 分類失敗。 |
| source-isolation-red.log | 格式錯誤的 commitment=null 導致真正 PublicationObserver 中斷，使已正常讀到的 RSS 無法保留；補齊輸入型別檢查後維持摘要 unknown、RSS 獨立有效。 |
| monitor-green.log | 新 acceptance／integration／unit 全部通過，包括真正 CLI dry-run、舊 Monitor 回復讀取、SQLite WAL、兩個同時執行的實例，以及送出 intent 後中斷的 unknown。 |

測試呼叫真正入口與產品決策路徑，資料／時間／網路替身只供應觀察與回應，不建立另一套參考演算法。既有已支援行為由完整 regression suite 保持 green；不把後來的 GREEN 倒推成歷史 RED。

## 完整本機 gate

- `pnpm test:hermes`：６１個 Python tests 通過。
- `pnpm test`：３０３次 Node test 執行與６１個 Python tests 通過；既有 public／editorial gate 有重複測試入口，３０３不是去重後案例數。新 Worker／Python discovery 確實執行。
- `pnpm check`：１５６個檔案，０ errors／warnings／hints。
- `pnpm build:all`：Astro 與所有 workspace 建置通過。
- `pnpm release:dry-run`：隔離 Git／SQLite、真實本機 Astro、回環 mock。正文／閱讀順序保持、重複通知０、productionWrites=false、telegramNetworkCalls=0；mockTelegramRequests=1 只指回環測試服務。其中 gitWrites=1 是 disposable fixture 的發文提交，不是候選或正式 repo 的 commit。
- `git diff --check`、Spectra validate／analyze：通過，analyze ０ findings。

完整測試的 provider 寫入旗標強制停用，Telegram token／chat 清空。執行工具採 pnpm １０．１７．１、Node ２４．１９．０；Python 本機版本與正式 Hermes runtime 不同，不能宣稱已完成正式 Python interpreter 驗收。新程式只使用標準函式庫；沒有新增 package 依賴或 Docker。

## 證據分層及正式限制

主使用者提供的 live 程式 hash／job／SQLite 格式見前置報告。這是唯讀 inventory，不是新 monitor 已運作的證據，也不是本輪 send ack／人收訊證據。

新摘要尚未部署，專用讀取憑證沒有配置，新 monitor 沒有安裝或切換 wrapper。正式 D1 operational document 本輪未讀，時間語意由已核對 main 的寫入契約確認；只有有效 release record id／slot 提供承諾，估算不升格。

既有 queue 沒有正式取消 tombstone，解除紀錄摘要保持 unknown；monitor 的明確 cancelled 輸入已用合成觀察驗證，不宣稱正式取消 API 已存在。

CLI 要求當轮的 `--round-at`，重試必須沿用原訂時間。本機六十分鐘 logical rounds、缺席及恢復已驗證；Hermes 當輪原訂 timestamp 的取得方式、實際 interval 相位漂移／延遲行為須在後續正式切換前核對，不能拿現在時間或 last_run_at 代替。這是 rollout 接線／正式驗收限制，不是授權修改 job。

rollback 以真正舊 Monitor 讀新 outbox 的 sent／uncertain 證明 publication 不重送。正式 atomic wrapper 切換及回復仍未執行；保留新增表及 superset outbox，不恢復會遺失送出結果的舊備份。

送出成功是系統 ack，human_received=0；unknown 不會自動重送。持續一般來源故障不发起始通知，兩次正常觀察才發恢復；主機／程序死亡不能由自己即時告警，這是已確認範圍。

## 後續唯讀查核發現：正式接線仍未合格

主使用者第二版 scheduler source 確認 interval 的 next_run_at 會依 claim／傳入 now 重新計算，並非固定相位。候選目前精確相差３６００秒才視為相鄰輪，在實際 interval 漂移下會重設正常／異常 streak。因此原本固定間距本機 GREEN 不覆蓋正式漂移情境；正式導入前需補實際 dispatcher context／輪次辨識的 RED／GREEN。本輪未改動已確認验收條件或產品程式，no-agent argv／env 尚因輸出截斷而未完成查核。最新下一步見 docs/hermes-schedule-readonly-audit.md。

## ２０２６－１０－１２後續本機接線與修正

使用者已授權建議 B 的本機實作。此段取代前面「接線尚待查核」「CLI 必須 --round-at」「精確相差３６００秒」的候選現況敘述；前面歷史 RED／GREEN 原樣保留。

### 新產品 RED 與 GREEN

- cron-context-red.log：真正 owner 原始 runner 函式啟動子程序後，四項 context 驗收失敗；沒有注入 metadata，因而繼承測試設置的 stale context。這是 runner 邊界的 RED，不是完整 gateway 測試。
- interval-drift-red.log：實際原訂輪次每次漂移７６．０７７８２９秒，兩壞兩好後恢復訊息仍０而預期１。修正後 interval-drift-green.log 通過，漏輪仍不提供連續證據。
- cron-monitor-conflict-red.log：當明確 --round-at 與 scheduler 原訂時間冲突，舊 CLI 已建構來源 observer，違反在來源／狀態存取前拒絕。修正後與 missing／future／manual context、跨 job、execution 重用等一起通過。
- cron-monitor-bridge-red.log 中的 API signature 尚不支援、argparse 拒絕與 loopback socket 權限錯誤分別保留為介面／環境診斷，不宣稱全是產品 RED。真正 conflict RED 另存前項 focused log。
- cron-python39-wal-red.log：系統 Python ３．９的 SQLite 無法唯讀開啟繼承 WAL mode 的新備份副本。只在自動清理的 writable backup 轉成 DELETE 後成功，來源 WAL DB 的資料與模式保留。Transport 模擬 HTTPError 使用 None body 導致 Python ３．９ close 錯誤，是 fixture 不完整；改為真實可關閉 BytesIO，不當作產品 RED。
- cron-monitor-bridge-green.log：４０項 monitor／runner focused checks；最後完整 Python discovery 與 Python ３．９結果見下方 cron-full-* logs。shell／Python 實際子程序收到 canonical UTC 原訂時間；heartbeat、thread start failure、兩個平行 job、無 context 清除 stale metadata、真實 child→monitor CLI dry-run 皆驗證。

### Source provenance 與正式限制

cron-source-provenance.json 保存 owner 原始 scheduler／scheduler_script SHA、完整 patched source SHA，以及５個 snapshot 函式與完整候選 AST 相符的結果。原始 scheduler_script hash 與第五版 source audit 相符；git apply --check 對原始副本通過。stage_cron_context.py 只讀取 hash 相符的 `/private/tmp` 原始副本並寫入另一個 staging 路徑及 review patch，不是正式安裝工具。實際修改在隔離 core 副本，原始檔保持相同 hash。

沒有 import 完整 Hermes、啟動 gateway/provider、讀秘密檔案、修改正式 job、切換 wrapper、送真實 Telegram 或 commit／push 候選。runtime 的 in-process／external worker 端到端啟動尚未驗證，不能由 runner harness 升格宣稱正式可用。正式 summary／憑證部署也維持未執行。

連續證據使用既有６０分鐘 interval 的界線：滿３６００、未滿７２００秒才延續；長延遲或小於一小時間隔中斷 pending streak、保留 active anomaly。這是保守的「按小時觀察」判定，沒有補造漏掉的觀察；正常相位漂移不再每輪重設。job scope／execution mapping 另存新增表，sent／uncertain／baseline 與 event 身分保持。

### 最新完整本機 gate

使用固定 pnpm １０．１７．１、Node ２４．１９．０與專案 Python ３．１４，provider 寫入旗標關閉、Telegram token／chat 清空。臨時工具鏈在 finally 清理，沒有 Docker。

- cron-full-hermes.log／cron-full-test.log：７７項 Python tests、３０３次 Node test 執行通過；Node 有既有重複入口，不是去重後案例數。
- cron-full-check.log：１５６個檔案，０ errors／warnings／hints。
- cron-full-build.log：Astro 與 workspace build 通過。
- cron-full-release-dry-run.log：真正本機 Astro／SQLite／回環 mock，productionWrites=false、telegramNetworkCalls=0、repeatNotifications=0，文章正文與順序保持。fixture 的 Git 提交只發生於會清理的 disposable repo，候選／正式 repo 沒有 commit。
- cron-full-python39.log：新 monitor／runner 的４６項 tests 在系統 Python ３．９通過；不宣稱舊有整套測試支援３．９。既有測試使用新 unittest.enterContext，３．９不支援，保留 cron-python39-legacy-incompatible.log，不修改不相關的測試。
- cron-toolchain-mismatch.log：早期 PATH 混用 pnpm１２的環境失敗，已固定工具鏈後通過；不是產品 RED。

git diff --check 與 Spectra validate／analyze 在最後文件完成後再次檢查；正式查核與授權界線依最新內容保留。

## 完整隔離 gateway 啟動與接線驗證

最新結果：`gateway-full-final/gateway-summary.json` 的 success=true。使用者匯出 installed repo 的 Git source，scheduler／scheduler_script hash 均與前輪 owner source 相符。全程使用完整真實 Hermes import、`python -m gateway.run`、內建 ticker、真實 create_job／claim／execution ledger／no-agent 子程序，不再是前輪摘錄函式 harness。測试 job 在啟動前１０秒已到期；由 gateway 自己派送，不從 fixture 手動呼叫 tick 或 run_one_job。

| 案例 | 結果與證據 |
| --- | --- |
| baseline | gateway_state=running，execution completed，script 確實執行，但三個 metadata 都是 null，monitor 拒絕缺少 context；metadata_matches=false。這是真正完整派送鏈的 RED。 |
| patched-a／patched-b | 兩個獨立 HOME／HERMES_HOME，gateway 與 Unix identify PID／home 相符。子程序的 job ID、execution ID、原訂 UTC 時間與自己的 ledger 完全相符，保留啟動延遲前的原訂時間。monitor 真正 CLI dry-run 成功，fixture DB 的 bytes 不變。 |
| interrupted | 在 gateway running 時注入 KeyboardInterrupt，finally 執行 graceful stop、保存狀態與精準 child 清理，無殘留。 |
| timed-out | 故意使用極短啟動期限產生 TimeoutError；不是 gateway 產品失敗。finally 回收已啟動的程序，無殘留。 |

所有５個案例的 gateway_reaped=true、remaining_owned_children=[]，disposable_root_removed=true。測試執行腳本：`scripts/hermes/verify_gateway_isolated.py`。過程沒有 Docker、正式 Telegram、部署、正式 job／runtime 修改、commit 或 push。

### 隔離與可重跑方式

先用原有 uv.lock 與 Python ３．１３建立獨立 dependency environment，未改 pyproject／lock。本機快取缺少的３個套件透過正常套件來源下載；這是建置依賴的網路使用，不是測試 gateway 的 provider／Telegram 連線。依賴紀錄見 gateway-dependencies.log。

gateway 的環境只包含必要 PATH／語系、獨立 HOME／HERMES_HOME／XDG／TMPDIR，以及停用正式通知旗標；不繼承任何 provider／Telegram 憑證。macOS sandbox 封鎖 TCP／外部網路、/Users/hermes 讀取與 owned runtime 以外的檔案寫入，僅允許 Unix IPC 供本機 control socket 與 cron tick socket 使用。啟動前確認 network_denied=true、production_read_denied=true。設定沒有訊息平台，deliver／failure_deliver 都是 local；kanban／heartbeats 不執行。

前兩次結果保留於 gateway-full／gateway-full-ipc，前者刻意 deny 所有 socket，因而 control／tick Unix socket 被阻擋；真實 ticker 派送仍成功，但不能拿它作完整 IPC 啟動證據。最新 final 版本允許 Unix IPC 並主動 identify 驗證，沒有這個限制。

```sh
env -i PATH=/usr/bin:/bin \
  HOME=/private/tmp/gcake-hermes-monitor-plan-20261012 \
  PYTHONDONTWRITEBYTECODE=1 \
  /private/tmp/gcake-hermes-monitor-plan-20261012/hermes-gateway-env/bin/python \
  /private/tmp/gcake-hermes-monitor-plan-20261012/scripts/hermes/verify_gateway_isolated.py \
  --source /private/tmp/gcake-hermes-monitor-plan-20261012/hermes-gateway-source \
  --python /private/tmp/gcake-hermes-monitor-plan-20261012/hermes-gateway-env/bin/python \
  --evidence /private/tmp/gcake-hermes-monitor-plan-20261012/docs/hermes-monitor-evidence/gateway-rerun
```

匯出 source 與 dependency environment 是此工作擁有的靜態審閱／重跑材料，沒有常駐程序；保留至本機候選審閱結束，最晚２０２６－１０－１９再決定保留或精準清理。清理只針對這兩個已確認的隔離目錄，不觸碰正式安裝或全機 uv cache：

```sh
rm -rf -- /private/tmp/gcake-hermes-monitor-plan-20261012/hermes-gateway-source \
  /private/tmp/gcake-hermes-monitor-plan-20261012/hermes-gateway-env
```

### 已驗證範圍與仍未驗證

已確認 macOS、完整 Hermes ０．２１．４ source、無訊息平台、內建 in-process cron 的 gateway→store／ledger→script→monitor CLI 接線。monitor 的 source observation 使用本機資料 fixture，沒有讀正式 Worker／RSS；publisher、正式摘要憑證、正式 Telegram 收送、LLM provider、Linux managed-systemd external worker 拓撲仍未驗證。缺少 optional Slack SDK／Nous 認證的 startup warnings 已保存，未為此啟用 adapter 或登入 provider。

這段補上前輪「完整 gateway startup 尚未驗證」的本機範圍；正式安裝／job 切換與正式系統驗收仍是未執行，沒有因本機 success 升格。


## 新 wrapper 切換與回復演練（２０２６－１０－１３整理）

最新證據：`wrapper-rollover-final/wrapper-summary.json`，六個案例全部通過。`scripts/hermes/verify_wrapper_rollover.py` 使用完整 Hermes gateway／內建 ticker、同一個測試 job、同一份 fixture DB；每次 invocation 由真實 gateway 派送。沒有呼叫正式 Telegram；macOS sandbox 封鎖 TCP／正式 Hermes 讀取，只允許本機 Unix IPC。

| 階段 | 模擬發送請求數 | 核對結果 |
| --- | --- | --- |
| 新 wrapper dry-run | ０ | 真實系統 Python ３．９可 import helper；DB bytes 不變。 |
| 新 wrapper live | ２ | 新文章保存 sent；遺失回應保存 uncertain／unknown。 |
| 新 wrapper 重試 | ０ | 不重送舊紀錄或本次已送／未知文章。 |
| 回復原 wrapper 及原 core | ０ | 保留最新 DB，不還原舊備份；新舊 sent／uncertain／baseline 均不重送。 |
| 回復後新增測試文章 | １ | 舊 sender 仍能正常發送，排除「程式沒運作所以零發送」的假通過。 |
| 舊 wrapper 再次執行 | ０ | 回復後新增文章亦不重送。 |

所有階段 initialized 與原三筆 outbox 保留；新增 sent／uncertain 與 unknown event 在回復後仍保留。每階段 gateway_reaped=true、remaining_owned_children=[]；disposable_root_removed=true。JSON 狀態快照、HTTP fixture 請求、發送 slug 與 gateway logs 已保存。原 wrapper SHA 與 owner 先前提供的 SHA 完全相同；只將其中的 HOME／library／DB／env 路徑映射到隔離目錄，不載入正式私有 env。HTTP／Telegram acknowledgement 由嵌入隔離 helper 的 transport fixture 替代，原業務函式與原 wrapper 啟動參數保留。這是本機相容性證據，不能當作正式送達或人實際收訊。

`wrapper-import-red.log` 保留真實 Python 隔離模式無法 import 同目錄 helper 的產品 RED，`wrapper-import-green.log` 為修正後兩項 shell 驗收 GREEN。新候選使用明確 library 路徑的 runpy bootstrap，且在讀 env 前保存 metadata；缺少／錯 job／env 覆寫均拒絕並保持狀態。第一輪 `wrapper-rollover` 回復失敗是 transport fixture 的 import 錯誤，已清理，不能算產品 RED；修正為嵌入 transport 後六階段通過。

完整 gate 的 `wrapper-full-test.log`：７９項 Python、３０３次 Node test 執行通過。`wrapper-full-check.log` 誤掃暫存的完整 Hermes 原始碼與 dependency environment，造成不屬於 gcake 的缺依賴錯誤與記憶體耗盡，不能算產品失敗。後續 gate 暫時移出這三份本次擁有的材料，finally 放回原位，不修改專案型別檢查範圍；以 `wrapper-gates.json` 與 `wrapper-final-*.log` 作最後結果。

正式部署、正式 job、正式 Telegram、候選 commit／push 都未執行。匯出 source／env 的保留期限沿用上節；測試 runtime 已清除。

## 更新入口、權限分工與 launchd 隔離驗證（２０２６－１０－１３）

本次使用 `hermes-update-entry-integration` 規格；先完成 Given／When／Then，再新增 tasks 第９組。`update-entry-red.log` 記錄缺少 authority／runner 入口功能的實際失敗；同一個入口實作後的驗收涵蓋未知新版去重、唯讀租約、權限／完整性拒絕、固定 supervisor mapping、首次設定備份、１１個切換邊界的強制中斷及 fresh-process recovery、回復失敗、commit 後 receipt 失敗。初始備份與本次 transaction 備份分開保留，軟體回復不覆蓋最新外部通知歷史。

`update_entry.py` 為正式整合契約的**隔離 adapter**：只接受標記的 `/private/tmp/gcake-entry-*/authority` 與唯一的 `system/local.gcake.hermes-test.<32hex>`，不存在可開啟正式目標的旗標。原同一 UID updater guard 的保護不放寬。程式碼／runtime 使用 immutable digest 目錄；root authority 管理 selector、核准資料與私有 journal，runner 只以 O_RDONLY 取得共享 lease。macOS 除 mode／UID 外也檢查 ACL 寫入授權。封存時去除 candidate ACL；root 不執行 candidate 任意 hook 或 source 私有 env。

`verify_update_entry_privileged.py` 是需主使用者執行的 hash-bound root／hermes 驗證腳本。它複製摘要相符的工具到 root-owned 測試目錄，再以現有 hermes UID 跑只讀／拒寫／共享鎖探針，建立唯一的測試 LaunchDaemon，使用阻擋網路與正式 home 的 sandbox。其 fixture 為 supervisor 探針，**不是完整 Hermes 或 Python 3.11 的證據**。它另外測試實際 launchd 的 SIGKILL／fresh-process recovery 與 ACL 回復；最後移除指定 test service 與 owned 目錄。若 cleanup 失敗，輸出保留目錄及 label，不能宣稱清理完成。沒有 owner 的有效 JSON 結果前，task 9.5 保持未完成。

完整 Hermes CLI 重演另由 `verify_runtime_update.py --cli-entry` 執行，使用已匯出的 source、自包含 CPython 3.11.15、鎖定依賴、synthetic state／job 與 transport fixtures；不使用正式 Telegram。來源快照及上一轮 `gateway.run` 證據保留，新的 CLI 結果另置 `update-entry-cli-runtime`。這個完整 CLI 重演與 root／hermes launchd 探針是兩組證據；不能合稱已驗收正式 gateway、正式依賴或正式平台重連。

### 最終結果與診斷紀錄

- `update-entry-owner-passed.json`：owner 提供的真正 root／hermes 與 system launchd 探針結果，passed＝true。UID＝５０２，唯讀版本／共享 lease 成功；核准檔、active、lock、release 與 writer API 拒寫；寫入 ACL 被拒；共享 lease 擋住 root 更新。１１個 SIGKILL 邊界均由 fresh controller 回復；ACL 恢復；選擇新版成功。owner 回報 test service 與 owned root 都移除，無 cleanup errors。
- `update-entry-owner-failed-setup.json` 保留先前 setup 失敗。已本機重現 default-deny sandbox 下最小系統 Python 啟動以 SIGABRT（－６）退出；不是 Hermes patch／權限功能的產品失敗。改用允許必要 OS 執行環境、明確拒絕 network、私有 `/Users`／正式 libexec 讀取與測試 home 以外寫入的 profile。`update-entry-profile-repro.json` 證明修正後可取得 lease，TCP 與控制檔寫入被拒。Apple shim 的 cache 寫入警告仍被隔離擋住，探針退出０，不放寬 cache 寫入範圍。
- `update-entry-cli-runtime/runtime-summary.json`：完整 `hermes_cli.main gateway run`、自包含 Python 3.11.15、實際 ticker／no-agent job／metadata／ledger／wrapper 通過。１５次完整 gateway 驗證，１６份程序清理收據；損壞 interpreter／原生依賴均回復；沿用最新 synthetic history，fixture 發送數２、０、１、０。所有 owned 子程序已回收，disposable root 已移除。
- `update-entry-full-test.log`：１２３個 Python 測試與３０３個 Node test executions 通過（既有入口有重複執行）。profile 修正後又以 `update-entry-python-final.log` 重跑１２３個 Python 測試通過；系統 Python 3.9 的１８個入口測試亦通過。Spectra validate／analyze 與 git diff --check 通過，沒有正式操作、commit 或 push。

root／hermes launchd 探針不是完整 Hermes 在 LaunchDaemon 下的驗收；完整 Hermes CLI 證據是獨立同一 UID 的隔離測試。未執行實際機器重開機；volatile lock 重建與維護等待有本機覆蓋。正式 supervisor／依賴／migration／平台重連及第一次 live 仍需正式導入前另行驗證與授權，不因本輪綠燈取消這些界線。

`docs/hermes-update-entry-readonly-handoff.md` 是使用者可自行轉貼給 Hermes 的唯讀覆核訊息。Codex 沒有發送 Telegram。隔離輸入 source／依賴仍依原紀錄保留至２０２６－１０－１９；沒有背景 gateway 或本輪 test service 需保留。

## 合併 root／hermes／完整 gateway 驗證（已完成）

新增第１０組 tasks，先補 `Combined privileged full gateway qualification` 與 Gherkin，再實作。`prepare_combined_gateway.py` 由主使用者準備完整 old／new／bad 自包含 CPython 3.11.15、鎖定依賴與 hash-bound fixture library，３份共約１．０９ GB；root 只驗證／封存，候選程式只以 hermes 執行。prepared input 位於 `combined-gateway-inputs`，不含正式 env／job／DB／憑證，保留至２０２６－１０－１９或本輪驗收完成後另行精準清理，沒有背景 gateway。

接線新增：完整 gateway 在 hermes UID 下透過唯一 test LaunchDaemon 執行；真實 cron wrapper 讀取 root-owned wrapper slot，EntryStore 對 selected release 持有整輪 shared lease，使用該版 Python 3.11.15／library。root EX 維護中的 dry-run 由受保護 Unix endpoint 核對 kernel peer UID／PID 和 generation nonce，拒絕 live、版本不符或死掉的 controller。一般 release 不使用例外。Root controls／nonce 不能由 hermes 改寫，IPC 只回覆非秘密身分資料、不接受命令。

前置診斷與證據：`combined-lease-red.log` 記錄原本不支援 EX 下 dry-run 的產品失敗；`combined-identity-red.log` 記錄 sandbox 拒絕 setuid ps 的失敗。Darwin 的程序身分改用本機 SDK 定義的 proc_pidinfo API，root owner 的跨 UID 存活驗證改用 socket peer credentials，不依賴受限程序讀取 root 程序資訊。`combined-local-smoke.json` 已通過完整 Hermes CLI／ticker／wrapper、context 對上 occurrence 與 dry DB 不變；但 actual_root_hermes＝false、actual_launchd＝false，不算合併驗收。１２７個 Python 回歸通過。

主使用者執行：

```sh
/bin/bash /private/tmp/gcake-hermes-monitor-plan-20261012/scripts/hermes/run-combined-gateway-owner.sh
```

命令檔會先核對 driver／inventory／工具／bundle 的精確摘要，再建立 root-owned `/private/tmp/gcake-entry-combined-*` 與唯一 `system/local.gcake.hermes-test.<32hex>`。只用 synthetic history、test job／fixture HTTP transport；允許所需 Unix IPC，拒絕 TCP、正式 user homes 與 libexec 讀取、home 外寫入。預期需１５至２５分鐘；stderr 顯示每輪準備／驗證進度，stdout 最後輸出 sanitized JSON。原正式 service／plist／job 都不動。

`verify_combined_gateway.py` 會驗證初始 dry-run、fixture live、新版切換、candidate 真實派送後故意驗證失敗回復、stopped／selected／verified 三個 SIGKILL 邊界的 fresh controller 回復、舊 sent／uncertain／baseline／unknown 不重送、後續新文章一次、回復失敗停 sender。所有角色使用同一個隔離 HOME／job／ledger／DB。direct controller sessions 先停止／reap，再 bootout owned daemon，核對已記錄 UID／啟動身分的 daemon PID 已退出，最後刪 owned root；失敗清理會明列精確目錄／label。未實際重開機。

第一次 owner 結果保存在 `combined-owner-failed-db.json`：測試 daemon 已啟動，但讀取 execution 資料庫失敗，尚未取得任何合併驗收輪次；owner 回報 PID 已退出、服務及 owned root 已清理。該結果未包含 traceback，不能確認失敗的精確原因。後續將 execution／history 的唯讀查核統一交給 hermes 身分與 selected Python 3.11.15，避免 root 的系統 Python 3.9 與 runner 交叉讀取，並加入失敗 traceback。修正後同一 UID 的完整 gateway smoke 再次通過，仍不算 root／hermes／launchd 合併通過。

前兩次未取得通過 JSON 時，task 10.4 保持未完成。最終 owner 通過結果已收到，見下方。給 Hermes 的轉貼訊息為 `docs/hermes-combined-gateway-telegram-message.md`；沒有發送 Telegram，無法 sudo 時交回主使用者，不擴權或替代成 mock 通過。

第二次 owner 結果摘要保存為 `combined-owner-failed-history.json`：真正 UID 502、Python 3.11.15 下 old／new 各一輪 dry 與 fixture live，接線全部成功，dry 狀態不變；新版重跑的複合斷言失敗，當時未輸出發送次數，不能單靠 owner JSON 判定有無重送。兩個已記錄 daemon PID 均退出，服務與目錄已清理。`combined-history-red.log` 在真正 monitor 下一輪不重送時重現比較失敗：只有 `monitor_last_round` 變動。history snapshot 現在只排除此正常前進的輪次記錄，其餘 meta、outbox、event identity／status 仍嚴格比較；每次 live 額外核對持久化輪次等於 ledger 的原訂時間，dry 仍比較 DB 原始摘要。發送次數與歷史比較已拆成具名診斷，不會以放寬通知歷史掩蓋重送。

修正後 `combined-local-replay.log` 與 `combined-local-smoke.json` 記錄完整 gateway 四輪實際派送：old dry／fixture live、new dry／fixture live，測試發送次數２、０，通知歷史保持一致，live 原訂輪次持久化正確。兩個本輪 owned gateway 與子程序已回收，owned root 已刪除。這組仍為 UID 501、非 launchd，不能代替 owner 合併結果。`combined-history-green.log` 的１２９項 Python 測試通過；Spectra validate／analyze、git diff --check 及 owner shell syntax 通過。Owner command 已核對更新後 inventory 摘要 `1a2a63d33f8b8ff7d77c6f5207fd4d2683673ba93ee904c42b6452c4ba923ed3`。

### Owner 合併通過結果（２０２６－１０－１３）

`combined-owner-passed.json` 保存主使用者回傳的 JSON 資料，僅重新排版鍵順序；不是 Codex 自行執行 sudo 或獨立查核正式服務的結果。資料來源是本對話的 owner Terminal 回覆。Hash-bound driver／inventory 與上方最終修正版一致。

- 真正 root authority／UID 502 hermes、唯一測試 LaunchDaemon、完整 Python 3.11.15 Hermes CLI／scheduler／wrapper：１１個主流程與３個 fresh recovery 的完整驗證輪次均有正確 release runtime prefix、UID、原訂 occurrence context。所有 dry 輪次狀態原始摘要不變。
- 新版切換後重跑：發送０次、通知歷史不變。candidate 真實派送後驗證故意失敗，成功回復完整 prior runtime。
- stopped／selected／verified 三個強制中斷點：fresh controller 全部 rolled_back 到核准 new digest，dry-run 驗證成功。這是程序 SIGKILL／launchd 重啟的證據，未實際重開機。
- fixture transport 發送數為２、０、０、１、０。舊 sent／uncertain／baseline 與新 lost 的 unknown 未重送，後續 after-rollback 文章只送一次。既有 initialized、job binding、outbox 與 event identity／status 維持；只允許每輪原訂时间記錄正常前進。
- candidate 與 prior runtime 都故意驗證失敗時，recovery_failed 停止 sender，下一次更新 blocked；最新外部歷史不倒退。
- owner 回傳 daemon_stops 全為 exited、owned test service／root removed＝true、cleanup errors 為空。正式操作、憑證讀取、Telegram 連線、帳號變更、TCP 都為 false。prepared inputs 約１．０９ GB 仍依紀錄保留至２０２６－１０－１９，沒有背景 gateway 需保留。

第１０組已完成，全部４０項本機隔離任務完成。既有正式服務、自動更新入口、job、wrapper、設定與通知狀態沒有導入本機候選變更；未部署、未 commit／push。這些測試版本同源於已匯出的 Hermes 快照，不能推論未知 upstream 新版相容；未知新版仍先跳過並保留審閱。正式安裝、平台重連與實際 live 仍需後續授權。
