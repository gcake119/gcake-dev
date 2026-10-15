> 歷史交接文件：正式採用、唯一一次補送與人工收件登錄均已完成。message_id＝40，正式 human_received＝1。下文保留當時步驟與待執行敘述；本次操作已消耗，請勿重跑。最新結果見 REPAIR.md 與 repair-evidence.json。

# 完整 owner-side successor proposal／approval 交付

## 授權與限制

使用者已明確授權改用 Hermes Bot、既有流程的受控重啟、正式採用及指定文章的一次補送延續。這份交付補齊先前缺少的 proposal／approval owner entry；不是新增特權服務、sudo 規則或另一套 updater。所有 Gateway 停止、啟動、自然排程 qualification、selector 與 rollback 都交給已安裝的 production_owner.manage／UpdateEntry。此 entry 本身不發 Telegram 訊息，也不建立或手動執行 job。

本機已完成完整 native bundle 與固定控制碼；正式 proposal／approval／next-candidate 尚未建立。只有管理員在自己的 Mac 終端機執行 entry 後，這些 root-owned 狀態才會建立。不要讓 Hermes 在自己的 Gateway 子程序中執行重啟自己的流程；也不要把管理員密碼交給 Hermes 或貼進聊天。

## 固定套件

本機目錄：/private/tmp/gcake-notification-repair-20261015/owner-successor。

prepared.json 列出完整 bundle_digest、manifest_path、proposal_path、control_sha256、owner_command 及 receipt_path。manifest 本身位於 owner-successor/bundle/manifest.json；controls.json 綁定 owner adapter 與目前所有已安裝 root 控制模組的雜湊。owner_adopt.sh 的最小 sudo bootstrap 固定綁定 controls.json 雜湊，使用 O_NOFOLLOW、檔案擁有者／權限／大小／link 檢查，將驗證過的 adapter 複製到 root-private 臨時目錄後才執行。它不接受可更換的 root、service、job 或 manifest 指令。

套件直接沿用 active approved release 的全部 Gateway code、Python runtime、lock 與 cron context patch，未改動任何 code/ 或 runtime/ 內容。僅新增／更新 notification library、通知恢復工具、SDK proof 與通知測試證據，共七個 library 檔案。新的 Telegram proof 以實際候選 Python 3.11 執行已安裝 offline_probe，通過依賴、來源與 synthetic health guard，零模型呼叫、零實際 Telegram API 請求、沒有啟動完整 Gateway。已通過已安裝 packaging_contract.verify_candidate，不是任意填寫 verification.passed。

## 第一步：Hermes 準備既已授權的 source overlay

這次將原先「runtime 先採用才改設定」的順序調整為「設定先準備，再讓 owner entry 驗證後採用」。理由：entry 在發布 next-candidate／停止 Gateway 前，必須能以候選 module 檢查共用來源已準備好。舊正式 monitor 不支援這兩個新旗標，會忽略它們，故這一步不會自行切換發送 Bot 或執行補送。

由 hermes 帳號先把 /Users/hermes/.config/gcake-rss/publication-monitor.env 私密備份，保留原 owner／mode；再 atomic write 僅設定兩個不含 Token 的鍵：

HERMES_RSS_TELEGRAM_CREDENTIAL_SOURCE=gateway
HERMES_RSS_TELEGRAM_EXPECTED_BOT_ID=<本機 getMe 已驗證之 Gateway／Hermes Bot 身分>

使用候選 gateway_token() 或既有安全的 dotenv 讀取方式，只在本機取得並核對身分。不要用 shell source Gateway .env，不要複製 Token，不要更換 TELEGRAM_CHAT_ID，不要更改 live.env 或 Gateway .env，不要新增測試訊息。保留舊 unknown／uncertain、失敗 operation 與所有備份。

Hermes 回報：source selector／pin 已準備，原收件者／通知開關／summary credential 未變、備份位置與私密權限。若目前不願先準備，owner entry 可先執行，但只會 stage／approve 後以 staged-awaiting-shared-source 停止，不會發布 next-candidate 或重啟 Gateway。

## 第二步：管理員在 Mac 終端機執行

```sh
bash /private/tmp/gcake-notification-repair-20261015/owner-successor/owner_adopt.sh
```

只在正常 sudo 提示輸入電腦密碼。已取得業務授權，不需要重新授權重啟；這是作業系統要求的管理員驗證。

entry 的順序：

1. 驗證固定控制碼、目前 root tools、active digest、完整 manifest／payload 及 existing pending/recovery。若有 foreign next-candidate、baseline drift 或未完成 transaction，停止並保留現狀。
2. 使用既有 ProductionStore，將 exact bundle 複製成 root-owned proposal，核准 exact digest。重複相同 stage 會沿用同一 proposal；不自動新建其他 identity。
3. 以 hermes UID 重跑離線 SDK proof，並以私密 source overlay 執行候選 getMe／getChat preflight。這一步無送信、無 DB write；若未準備或網路失敗，保留 approved proposal 並停止，Gateway 不重啟。
4. 準備好後建立 root/private/next-candidate.json，立即呼叫現有 production_owner.manage('update')。這正是 /usr/local/libexec/hermes-auto-update 所呼叫的受控更新 handler。唯有 pointer／approval 完整後才呼叫，不再是空跑 updater。
5. 現有 updater 取得 maintenance、seal、停止 Gateway、選取 dry-run successor、啟動及 runner qualification。它會等待既有每小時 job 的下一次自然執行，最長約 65 分鐘，期間每 30 秒輸出等待狀態。不要關閉終端機、重複執行、手動跑 job 或改 schedule。成功或 rollback 都保留既有 journal／receipt 語意；rolled_back 是 dry-run，不宣稱已回復原本 live。
6. 成功後核對 exact natural execution／scheduled instant／UID／digest 與 completed ledger，再檢查目前 Gateway Telegram health、summary 與共用 source。符合後才用既有 maintenance／select／gate 介面恢復同一 qualified digest 的 live policy，確認 job 契約與通知歷史沒有因 policy switch 改變。這一步沒有額外 Gateway restart、訊息發送或 job mutation。
7. 保存 durable per-digest owner receipt，清除本次已完成的 next-candidate pointer，回報 active-live。原 no-approved-successor.json 是舊 skipped 記錄，不當成目前 successor 狀態依據。

若結果是 staged-awaiting-shared-source，可以先完成 source 準備後，重跑相同 entry；同一 digest 不會換 identity。若已完成 qualified-dry-run 但 source 暫時失敗，重跑會從同一資格／policy 階段恢復，不重新重啟。若 receipt 為 updating、rolled_back、recovery_failed、activation-failed 或來源／歷史漂移，停止並回報；不要重跑去猜測未知結果，先由 owner 核對該 receipt 與現有 updater journal。

## 第三步：Hermes 在 active-live receipt 確認後才補送一次

```sh
bash /private/tmp/gcake-notification-repair-20261015/owner-successor/continue_after_adoption.sh
```

可由 hermes 自己執行，不需 root；其他帳號會切換到 hermes。這個入口只使用 exact root-approved release 裡的 runtime／library，不依賴本機可變候選程式。它持有現有 live invocation lease，核對 exact selected digest，然後執行同一已驗證的 owner_continue。

operation 固定為 owner-approved-hermes-bot-switch-20261015，predecessor 固定為 owner-confirmed-missing-toolchain-20261015。保留原 event、old operation、DB backup 與 immutable history；只允許最新傳送確定 rejected 的原操作延續。先核對原訊息，取得原 exclusive sender lock、備份，再記錄單次 continuation intent。成功才更新原 event／outbox=sent，human_received 仍為 0。任何拒絕、逾時、未知結果或中斷都停止，不能換 ID、刪 table 或再次傳送。

請回傳 owner entry 的 JSON、receipt 路徑以及 continuation JSON。成功 acknowledgement 與真人收件仍分開；本機測試、proposal approved、active-live 都不能單獨當成通知已送達。

## 驗證與保留

完整 pnpm test:hermes 共 183 tests 通過；新增九項隔離 owner approval／policy tests，涵蓋 tamper、foreign pointer、pending recovery、baseline drift、same-ID stage、資格／歷史 drift、private destination 不外洩及 exact occurrence。正式 Python 3.11 的九項 owner tests 通過。這些是本機、同 UID／synthetic profile 證據，不是 root／launchd 採用證據。

本機套件約 350 MiB，保留至正式採用與通知 closeout。請勿在 owner entry 執行中刪除。root-owned proposal、release、receipt、rollback 與私人設定／DB 備份保持現有保留政策；不能批次 prune。本次沒有 Docker 或背景服務。結案後若確認 owner 作業已結束且不再需要本機套件，可只清理以下精準目錄，保留原始修正與證據：

rm -rf -- /private/tmp/gcake-notification-repair-20261015/owner-successor

## 本次固定識別

bundle_digest：f36ad05d1ea2fe93fe82712008904ae1cbe7cc4b9b606833fae07aa8bbaf753c

control_sha256：16ecd97d7d4089bfe431b1bb0edc46e3d7528363c1ae1074b19083a110c2c66a

manifest_path：/private/tmp/gcake-notification-repair-20261015/owner-successor/bundle/manifest.json

proposal_path：/usr/local/share/gcake-hermes-runtime/proposals/f36ad05d1ea2fe93fe82712008904ae1cbe7cc4b9b606833fae07aa8bbaf753c

owner_command：bash /private/tmp/gcake-notification-repair-20261015/owner-successor/owner_adopt.sh

receipt_path：/usr/local/share/gcake-hermes-runtime/private/notification-successor-f36ad05d1ea2fe93fe82712008904ae1cbe7cc4b9b606833fae07aa8bbaf753c.json

Approval catalog：/usr/local/share/gcake-hermes-runtime/approvals.json；next-candidate：/usr/local/share/gcake-hermes-runtime/private/next-candidate.json。這些正式寫入尚待 owner entry 執行，不能把本機 prepared.json 當作已核准或已採用。
