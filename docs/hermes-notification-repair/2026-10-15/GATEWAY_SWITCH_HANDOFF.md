> 歷史交接文件：正式採用、唯一一次補送與人工收件登錄均已完成。message_id＝40，正式 human_received＝1。下文保留當時步驟與待執行敘述；本次操作已消耗，請勿重跑。最新結果見 REPAIR.md 與 repair-evidence.json。

# 已授權改用 Hermes Bot：正式交接

## 授權與目前證據

使用者已選擇「2」，明確同意將通知發送身分改為 Gateway／Hermes Bot，並共用憑證來源。原先「必須同一 Bot」的停止條件已由這次明確選擇取代。先前完整範圍是修正程式並補送指定文章；本次授權涵蓋保留原歷史、切換 Bot 後的一次有紀錄補送恢復。不是允許任意測試訊息、重試未知結果或清除舊操作。

Owner 已唯讀確認：live.env 的 Token getMe=401；Gateway .env 的 Token getMe/getChat=200，兩者 Bot 身分不同。publication-monitor.env 沒有覆寫 Telegram 設定。未知事件仍為 unknown／uncertain、human_received=0。原 operation=owner-confirmed-missing-toolchain-20261015，最新傳送嘗試為 rejected／DeliveryRejected；原 operation 與備份不得刪除或改寫。正式 runtime 尚未套用本機修正。

## 固定範圍

－既有 job：550aaf17723d，保留排程與原階段。
－Gateway Token 唯一來源：/Users/hermes/.hermes/.env，保持原檔不變。
－通知原設定：/Users/hermes/.config/gcake-rss/live.env，原 Token 留作歷史，sender 在選定 Gateway source 時不再使用它；不複製新 Token。
－通知 overlay：/Users/hermes/.config/gcake-rss/publication-monitor.env。
－現有收件者仍取通知設定 TELEGRAM_CHAT_ID，不更換聊天室。
－正式 DB：/Users/hermes/.local/state/gcake-rss/live.sqlite。
－文章：https://gcake119.github.io/gcake-dev/posts/ithome-2026-publishing-toolchain/。
－候選基底：4068a3695b484309bfc87c1b1ad68bee6d7eb327。主工作目錄與其他 owner 變更保留，不採用／覆蓋。

## 執行順序

1. 讀取本交接、REPAIR.md、repair-evidence.json 與 notification-repair.patch。先驗證 gateway-switch/SHA256SUMS；檢查實際 active release／來源漂移與原事件。所有 Token、完整私人設定、收件者與原始 provider 描述都不可進聊天、Git、命令列或公開紀錄。
2. 依既有 immutable approved-release／qualification／selector 流程採用修正的 publication_monitor.py。保留目前已修復的 Gateway code／Python runtime 及其他模組。不要直接覆寫已安裝的 library，也不要把本機測試當正式驗證。新 artifact 必須包含這次修正的精確 monitor bytes；用下面的 SHA 與 gate 當採用條件。若既有正式流程必須重啟 Gateway、無法在目前授權下安全採用，先回報具體限制；不要自行重啟或繞過更新保護。
3. 以 hermes 帳號先私密備份 publication-monitor.env（保留 ownership／mode，備份 0600），再以 atomic write 僅新增／更新兩個不含 Token 的設定：

   HERMES_RSS_TELEGRAM_CREDENTIAL_SOURCE=gateway
   HERMES_RSS_TELEGRAM_EXPECTED_BOT_ID=<已由 getMe 驗證的 Hermes Bot 數字身分>

   Bot ID 在本機從有效 Gateway Token／getMe 檢核取得，不必貼回。其他行、summary credential、通知開關、收件者、live.env 與 Gateway .env 都維持原值。候選 loader 每次發送只從固定 Gateway .env 讀取唯一 literal Token；支援 export、單／雙引號，不執行 .env，也不載入其他 Gateway 變數。不支援的 interpolation／重複欄位、非私密權限、符號／硬連結或 Bot 身分不符都會停止；不可改用舊 Token。
4. 確認正式現行 monitor source hash 與 gateway-switch/publication_monitor.py 完全相同、source selector／pin 已生效、原收件者未變。不要建立假的 scheduled occurrence、手動重跑整個 job 或新增測試事件。
5. 然後只執行一次：

   bash /private/tmp/gcake-notification-repair-20261015/gateway-switch/owner_continue.sh

   該工具可由 hermes 直接執行；其他帳號會經 sudo 切換。它先取得正式 live invocation lease、驗證實際 installed monitor hash，再從共享來源取得憑證，僅以 getMe／getChat 確認相同 Bot 與原目標。通過後才取得既有 exclusive sender lock、核對原訊息與事件、備份 DB，並在送出前保存 continuation intent。

   新 operation 固定為 owner-approved-hermes-bot-switch-20261015；predecessor 固定為 owner-confirmed-missing-toolchain-20261015。這是使用者此次授權的可稽核延續，不會刪除舊 operation、改寫原事件身分、鬆開舊 event 唯一限制或任意換 ID。新 table 對 event／operation／predecessor 都有唯一限制。只有原操作仍 unknown 且最新傳送確定 rejected／DeliveryRejected 時可延續；unknown／intent 的傳送不符條件。
6. 只發送原始指定通知一次，不另發測試訊息。收到 Telegram 正整數 message_id 才將原 event／outbox 更新為 sent，human_received 保留 0。新 continuation 成功、拒絕、逾時或中斷都消耗這次機會；若不成功，停止並回報，不能再執行、新增第三個 operation 或清紀錄。原 operation／backup 保持原樣。

## 回報需求

請回傳不含秘密的證據：新 active digest、monitor hash 是否吻合、共用來源／Bot pin／原收件者是否生效、來源檔 ownership／mode 是否合格、job 是否未變、getMe/getChat 結果、continuation JSON（含 status、message_id、predecessor、backup），以及舊 operation／backup 是否保存。若需要暫留更新候選或備份，列用途、路徑與清理條件。

沒有 Telegram acknowledgement 時，不得宣稱補送成功。API 成功仍不代表真人已讀。正式採用與送達證據到齊前，tasks 12.4／13.4 保持未完成。

## 本機驗證

－共享 source 驗收先重現產品 RED：原 sender 使用 retired_token 而不是 Gateway source。
－延續驗收先重現產品 RED：既有 guard 拒絕已消耗操作，即使提供明確 predecessor 仍無法延續。
－新增 5 項測試涵蓋 current-source renewal、身份／權限／格式／連結失敗封閉、成功保留舊操作、unknown predecessor 拒絕、逾時／拒絕／中斷後防止重送。
－完整 pnpm test:hermes：174 tests 通過（gateway-switch-full-green.log）。
－正式選定 Python 3.11 的 focused tests：5 tests 通過；owner helper 已通過原生語法與 shell syntax 檢查，正式執行結果仍待 owner。
－Spectra validate 通過。沒有 commit／push、正式憑證修改、runtime 選取或訊息發送。

scripts/hermes/publication_monitor.py SHA256：0301d3c3e3d16b52ddfbd5c4d27fbdd1aee7ea61601fa1a0acee12f2ff687cd5

scripts/hermes/reconcile_notification.py SHA256：9ce16c8370beb5cbdaef38308240c6d448884a4a088a066abc93384cab6bf5d5
