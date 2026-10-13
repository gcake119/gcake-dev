> 歷史規劃／交接紀錄。文中 `/private/tmp` staging 已清除，不能再照舊命令執行；最新狀態與正式導入紀錄見 [hermes-production-rollout.md](hermes-production-rollout.md)。

# Hermes 當輪原訂時間：唯讀查核

目的：確認 installed scheduler 如何找 due job、更新 last_run_at／next_run_at、計算 interval 下一輪，以及如何傳入 no-agent script 的 argv／env。這是後續接線查核，不是修改 job 或部署授權。

在主使用者的 Terminal 執行：

```sh
sudo -u hermes /usr/bin/python3 -I -B -S /private/tmp/gcake-hermes-monitor-plan-20261012/docs/hermes-schedule-readonly-audit.py
```

只在本機 Terminal 輸入 sudo 密碼。回傳這支腳本的 JSON；不要另外貼 runtime env、jobs.json 原文、wrapper 原文或 cron output。

目前第七版腳本只讀已由第五、六版確認的 tools/environments/local.py、agent/delegation_context.py、tools/env_passthrough.py。以 AST 解析三個上下文注入入口及各自同檔案的明確 callee，不 import／執行來源。非必要字串、bytes、數值與 docstrings 會遮罩，保留原始行號、檔案 hash 及排程／env 結構名稱。這次不重讀 wrapper、job snapshot 或 live DB。

不讀憑證檔、不讀程序環境、不連網、不執行 wrapper 或 Hermes CLI、不建立／修改 job、不寫正式資料、不發 Telegram、不 restart gateway。Python -I／-B／-S 防止使用者 site hook 及 bytecode 寫入。

若 scheduler_source 含 unparsed_files，可能是系統 Python ３．９無法解析 installed code 的較新語法；保留這個結果，不能視為「沒有傳時間」。如已確認 Hermes venv Python 路徑存在，可使用以下命令重跑同一支唯讀腳本（仍不載入 Hermes）：

```sh
sudo -u hermes /Users/hermes/.hermes/hermes-agent/venv/bin/python3 -I -B -S /private/tmp/gcake-hermes-monitor-plan-20261012/docs/hermes-schedule-readonly-audit.py
```

truncated=true、unparsed_files 非空、files_scanned=0 或 error_type 都是未完成查核，不能自行推斷。AST snippets 是遮罩後的閱讀視圖，不是可以執行或套用的程式碼。

待結果回覆後，核對「原訂執行時間」「實際開始／完成時間」「下輪預約時間」的區別、更新順序與可取得性。如果 script 根本沒有收到原訂時間，不以 wall-clock／last_run_at 代替，也不先改正式 job；先提出可審閱的接線方案。

本腳本已用合成 source 驗證：未執行 source、秘密 canary 未輸出、排程計算保留、env key 名稱保留而值遮罩、symlink source 排除、parse failure 被界定。這是工具驗證，不是正式 scheduler 結論或 monitor 產品驗收。

## 第二版診斷修正

第一輪主使用者回報 scheduler_source 僅有 ValueError，沒有 source 結果；不能判定原因或 script 時間接線。第二版加入 audit_revision=2、Python 版本、候選檔案數、inventory_limited，以及逐檔／逐函式的 read／parse／redacted_ast_render 階段。限制或錯誤不再抹掉其他已完成結果，也不輸出原始 exception text。CLI 探索縮到 cron 相關檔案。

請重跑相同系統 Python 命令。若 errors 顯示 redacted_ast_render 或 unparsed_files 非空，可用上面的 Hermes venv 命令重跑；仍只讀 source、使用標準函式庫，不載入 Hermes。回傳完整的新版 JSON（含 audit_revision）。

２０２６－１０－１２台北１９：４１：１１的 owner snapshot：live wrapper hash 未變、未出現 --round-at；live last_run_at=１９：２３：２９．７３３５８９，next_run_at=２０：２３：２９．７３３５８９。相較前一輪１８：２２：１３．６５５７６０，last_run_at 相隔３６７６．０７７８２９秒。這只能證明欄位相位有所變化；不能以此推斷原訂時間、實際執行時間或 scheduler 更新語意。

## 第二版結果：已確認及尚缺

主使用者提供 audit_revision=2、台北２０２６－１０－１２１９：４４：４７結果。cron/jobs.py hash：9d27d9eb4d7cad4ce94a0d2f75b8f9ff4f2782d9e96c9a980710baf2f9251b68。沒有 parse／render errors，但 truncated=true，未讀到 no-agent 執行器。

已確認的 source：

- compute_next_run 對 interval 以傳入的 base time＋minutes 計算，不保留固定日曆相位。
- claim_job_for_fire 先從原 next_run_at 取得 scheduled instant，再以 claim 當下 now 計算新 next_run_at；return_job=True 時回傳的 copy 帶 _scheduled_instant。
- _evaluate_due_job 保存 last_dispatch 的 scheduled_at 與 pending_slot。next_run_at 因而不能在 wrapper 中直接被當作「本輪」時間。
- _advance_after_run 也以傳入 now 計算 next_run_at；呼叫者如何取得 now、如何傳遞 job copy／env／argv，仍需 no-agent runner 的 source。

本機候選目前用 round_at 精確相差３６００秒判斷相鄰輪。這個假設不能直接套到已觀察到相位漂移的 Hermes interval；即使取得原訂時間，仍需修正／驗證輪次辨識，保持已確認的「連續兩輪」驗收條件。原本固定間距本機 GREEN 不證明這個正式接線情境。本輪只做查核及工具／文件修正，未修改產品行為或正式 job。

第三版優先 cron/scheduler.py／cron/occurrences.py，刪除一般 job CRUD 與重複內嵌函式的輸出，只讀必要 timing markers，避免被早期 jobs.py 片段用盡輸出預算。請以同一命令重跑並提供 audit_revision=3 的 JSON。

## 第三版結果與最後執行邊界

主使用者回報 audit_revision=3，台北２０２６－１０－１２１９：５５：５５。cron/scheduler.py hash：f59d641fcc5182a83275da4b45340dd6d7d96f3ab7af6cecf801376def6cc426。source 仍 truncated=true，但讀到 _run_no_agent_job 呼叫 _run_job_script_with_claim_heartbeat，以及 _process_due_job／run_one_job 保留 _scheduled_instant。尚未讀到 script helper 的 argv／env 實際組裝；第三版僅依函式內出現關鍵字篩選，漏掉這個 helper，不能推斷有／沒有傳入時間。

第四版只以 _run_job_script_with_claim_heartbeat 為入口，讀取完整函式及明確 local/imported callee；不再輸出失敗通知、agent prompt、job 管理等不相關函式。若 unresolved_calls 非空，保留其模組／符號資訊，不猜測實作。全程仍只解析 source，不 import Hermes、讀 secrets 或執行 job。

snapshot 的 last_dispatch.scheduled_at=１９：２２：１３．６５５７６０、dispatched_at=１９：２３：１３．５７３４３４、last_run_at=１９：２３：２９．７３３５８９；最後一項的精確語意須結合 mark_job_run 呼叫者，不能直接當作原訂時間。next_run_at=２０：２３：２９．７３３５８９。

請重跑同一命令，提供 audit_revision=4 的 JSON。這輪未修改產品程式、job、通知狀態或正式系統。

## 第四版結果與第五版修正

主使用者回報 audit_revision=4，UTC ２０２６－１０－１２１２：１２：５６。３２個 cron source 全部解析成功，沒有截斷；但入口定位錯誤，matches 為空。function_inventory 證明 _run_job_script_with_claim_heartbeat 實際定義在 cron/scheduler_script.py，而非工具原先限定的 cron/scheduler.py。這是查核工具的錯誤，不能解讀為 Hermes 沒有 script 執行器。

第五版從已解析的 cron source 定位唯一的入口定義，回報 root_file；若缺少或多個定義，明確回報錯誤而不猜測。優先輸出同模組的 _run_job_script、_script_argv、_resolve_script_path，再沿明確 callee 探索，避免 heartbeat helper 用完預算。已用拆分模組／重匯入的合成 source 驗證唯一定位、完整函式、缺少／重複入口與秘密遮罩；沒有 import 或執行 Hermes。

第四版 snapshot 的 last_dispatch 原訂與派送時間仍為１９：２２：１３．６５５７６０及１９：２３：１３．５７３４３４。這證明歷史原訂時間有被保存；尚不證明 script 取得該時間，也不保證執行中的本輪可以靠 last_dispatch 安全識別。

請使用上方相同系統 Python 命令，提供 audit_revision=5 的完整 JSON。本次僅修正本機查核工具與文件；不部署、不修改正式 job、不發 Telegram、不 commit／push。

## 第五版結果：命令參數已確認，環境建立仍待查核

主使用者回报 audit_revision=5，UTC ２０２６－１０－１２１２：１９：４６。cron/scheduler_script.py hash：dfc96fea523334f1cc972be6e84336c3e69e3ebe1307a3a9215b3afe97928f99。雖然整體 callee 探索因十函式限制 truncated=true，入口、_run_job_script、_script_argv 均標示 full_function=true，可對這些完整函式作局部結論，不能宣稱整條呼叫鏈完成。

- _run_job_script_with_claim_heartbeat 接收 job，但呼叫 _run_job_script 時僅傳 script_path、workdir、cancel_event；沒有傳 job 或 _scheduled_instant。
- _script_argv 的 shell 分支回傳直譯器＋script 路徑，env_overlay 是空 dict；沒有當輪原訂時間參數。現有 wrapper hash 未變，仍沒有 --round-at 或 shell 變數引用。
- _run_job_script 的 subprocess.Popen 使用 build_subprocess_env(strip_launch_profile=True) 的結果，再合併 env_overlay。build_subprocess_env 來源在 tools/environments/local.py，尚未包含於第五版來源範圍。因此還不能排除環境建立器從繼承環境或其他上下文提供時間。
- 第五版 unresolved_calls 把已排入佇列的 local callee 誤列為未解析；這是報告工具的判斷缺陷，不是 Hermes 呼叫鏈缺失。第六版已修正；真正未讀的 imported callee 仍明確列出。

第六版只查核 tools/environments/local.py 的 build_subprocess_env 及同檔案必要 callee，不再輸出 heartbeat、終止程序、Windows runner、job snapshot 等已讀或不相關內容。跨模組 callee 只列出精確 import 位置，不猜測或執行。合成 source 驗證目標限制、完整函式、local callee 去重、import 缺口保留、秘密值遮罩與臨時資料清理。

請重跑同一系統 Python 命令並回傳 audit_revision=6 的 JSON。不以 last_dispatch、last_run_at、next_run_at 或目前時間替代 script 尚未確認的本輪時間介面。本次未修改產品行為或正式系統。

## 第六版結果：上下文注入尚未讀完

主使用者回報 audit_revision=6，UTC ２０２６－１０－１２１２：２４：０１。tools/environments/local.py hash：cfb8e337d762648a16c12ef81f35793fb164f1007ba0ec20cf2e43c909bc1ed8。檔案解析成功，完整 build_subprocess_env 顯示使用 os.environ.copy()，預設 scrub_secrets=True，進入 _sanitize_subprocess_env → _scrubbed_env → _finalize_child_env。沒有在這些已讀函式看到直接讀取 job／_scheduled_instant；但整體探索仍因十函式界線截斷，不能判定最終環境沒有時間介面。

待確認的是 _inject_session_context_env（同檔案、尚未輸出）、delegated_child_subprocess_env（agent/delegation_context.py）及 scoped_passthrough_additions（tools/env_passthrough.py）。這些來源可能提供 session／execution context，不能只憑 build_subprocess_env 沒有 job 參數就排除。繼承環境也不能單憑名稱視為本輪正確時間；仍需與不可變的本輪執行身分關聯。

第七版直接以這三個函式為入口，只讀三個已確認的 Python source；不沿秘密檔案、過濾政策或其他 imported module 擴大探索。完整函式與各自同檔案 callee 會遮罩輸出，未讀 import 明確列出。補上 env.setdefault／env.pop 的環境鍵名稱保留，值仍遮罩。合成案例驗證三個入口、讀取檔案範圍、source 不執行、秘密值遮罩、未讀 import 缺口保留及臨時資料清理。

請使用上方相同命令，提供 audit_revision=7 的完整 JSON。本次只修正本機查核工具與紀錄，未部署、修改正式 job、發 Telegram 或 commit／push。
