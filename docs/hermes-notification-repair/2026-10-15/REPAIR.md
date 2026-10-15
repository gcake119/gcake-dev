# 通知修復交接，2026-10-15

已完成本機修正：通知不明／拒絕時，正式 CLI 回傳非零；未釐清的舊通知也會維持失敗，不自動補送。保存錯誤類型與 Telegram message ID，沒有儲存例外文字或秘密。dry-run 輸出保持相容。

驗證：真實 CLI 缺陷 RED；完整 Hermes 160 tests 通過；正式 Python 3.11 執行 7 項修復測試通過。首次補送測試的缺少模組錯誤不算產品 RED。尚未存取正式 DB、套用正式 runtime 或發送 Telegram。

## 單次補送

使用者已明確授權，不需重新授權。請由持有系統密碼的人在終端機執行：

```sh
bash /private/tmp/gcake-notification-repair-20261015/handoff/owner_resend_once.sh
```

該指令先檢查候選檔案雜湊，再切換至 hermes 帳號；正式私人設定只由該程序載入，不會輸出。它驗證現行 immutable release、取得 maintenance shared lease 與既有通知 exclusive lock，只接受原 toolchain 文章同一事件、原始訊息、unknown／uncertain／human_received=0。先備份，再保存單次 operation intent，然後呼叫 Telegram 一次。成功輸出 status=sent 與 message_id；這仍不代表真人已讀。若結果未知，不得換 operation 或刪紀錄重送；需重新查核。

備份：/Users/hermes/.local/state/gcake-rss/notification-repair-backups/owner-confirmed-missing-toolchain-20261015.sqlite。此為正式修復證據，保留到修復結案，由 owner 決定刪除期限，不自動清除。

執行後請回傳不含秘密的 JSON。若 release、原文或狀態不符，工具會停止，不傳送。此腳本只做這一次補送，不安裝程式、不更改排程、不重啟 gateway。

## 正式程式修正

notification-repair.patch 是相對 4068a369 的完整候選差異；程式位於 scripts/hermes/publication_monitor.py 與 reconcile_notification.py，既有 parent checkout 未被更動。需要 owner 的系統權限，依既有 immutable release 的 hash-approved staging／qualification／selector 流程採用；不得直接覆寫 installed library，不能把本機 GREEN 當正式導入。現行 active digest 為 f98d49207288ae81f1cad0ece146489c1631700f946ea9146663cfab32eab66e；若已漂移，重新查核後再處理。既有 job 550aaf17723d 與通知歷史必須保留。

12.4 保持未完成，直到正式 runtime adoption 與 Telegram ack 皆有證據。未 commit／push。

## 補送後續：拒絕但未分類

Owner 回報 operation=owner-confirmed-missing-toolchain-20261015，status=unknown、transport_status=rejected、message_id=null。這證明沒有成功 acknowledgement；舊版 DeliveryRejected 混用了本機停用／格式檢查與 Telegram 明確拒絕，因此無法從這份回報斷定是否曾呼叫 Telegram。原 operation 已消耗，請勿重跑補送或更換 operation。

候選程式已補上 allowlisted rejection_reason（notify_disabled／invalid_bot_token／invalid_chat_id／telegram_rejected），並保存 Telegram 數字錯誤碼；不儲存回應 description 或 secret-bearing exception text。這不會回填或改寫舊事件。

下一步請執行純唯讀診斷：

```sh
bash /private/tmp/gcake-notification-repair-20261015/diagnostics/check_notification_readonly.sh
```

診斷分別載入先前補送工具的 legacy env，以及 legacy＋summary env，輸出布林有效性、有限原因代碼及這篇文章的已存狀態。兩者皆以乾淨環境執行，未觀察 gateway 繼承環境，不能宣稱等同正式排程的完整環境。無網路傳輸、不呼叫 sender、DB 以 mode=ro 開啟，不修改 outbox／journal。檔案雜湊先檢查；不輸出設定內容、token、收件者或通知文字。請回傳兩行 JSON，再決定後續處理。

原 handoff/ 內程式保留原樣作為先前實際執行版本；新診斷置於 diagnostics/，修正原始碼置於 scripts/hermes/。不得用新的原因代碼推定舊次失敗原因。正式 runtime adoption 與成功補送仍未完成。

## 設定格式通過後的唯讀 Telegram 查核

Owner 回報兩組環境皆 notify_enabled=true、bot_token_valid=true、chat_id_valid=true；這些是格式與開關檢查，不能證明 token 被 Telegram 接受或指定聊天室仍可存取。歷史補送仍 unknown，不能回推之前的拒絕碼。

下一個 owner 指令：

```sh
bash /private/tmp/gcake-notification-repair-20261015/provider-diagnostics/check_telegram_readonly.sh
```

此工具只會對 api.telegram.org 發出 getMe，若身分吻合再發 getChat；最多兩次，每次 15 秒、無重試。它不開啟通知 DB、不取訊息紀錄、不發訊息、不改設定。Token 只送 Telegram 必要認證路徑，不出現在 CLI 引數或輸出；回應只保留成功與否、數字錯誤碼、固定原因代碼，以及非個資的聊天室類型。不回傳 token、bot/chat ID、姓名、原始描述或 exception text。成功也只證明當時身分與聊天室讀取，不能宣稱送信權限或已送達。官方方法說明：https://core.telegram.org/bots/api#getme 、https://core.telegram.org/bots/api#getchat 。

原補送 operation／備份及未完成的正式 runtime adoption 全部維持。

## 已授權改由 Hermes Bot 發送

使用者已選擇 option 2；不再要求與失效 Token 屬於同一 Bot。最新正式操作順序、來源設定、immutable runtime adoption 及保留歷史的一次延續，請以 GATEWAY_SWITCH_HANDOFF.md 為準。舊 handoff/ 工具與原 operation 保留作為實際歷史，請勿重跑。正式套用、continuation acknowledgement、human receipt 仍各自待驗證。

## 已補齊 owner-side proposal／approval 入口

前一交接缺少管理員可執行的 successor approval，現已補上完整 native package、固定 manifest／control digest 及 owner_adopt.sh。請以 OWNER_SUCCESSOR_HANDOFF.md 的新順序為準：Hermes 先準備 source／pin overlay，由管理員在獨立 Mac 終端機執行 owner entry，收到 active-live receipt 後再讓 Hermes 執行 owner-successor/continue_after_adoption.sh。尚未執行正式 root 寫入、服務重啟、live policy 或補送。

## 正式採用已完成，補送延續待執行

Owner 已回傳 active-live receipt：proposal digest 為 f36ad05d1ea2fe93fe82712008904ae1cbe7cc4b9b606833fae07aa8bbaf753c。既有 job 550aaf17723d 的自然 dry-run qualification 通過，execution_id 為 47fd8ffe84414153b5ff425c06433183，exit_code=0；owner 回報 job 與通知歷史未改動，message_sends=0，沒有手動執行 job。

本機唯讀核對 active.json 與 gate.json，均指向該 digest、mode=live，gate=ready；正式 monitor SHA-256 符合 0301d3c3e3d16b52ddfbd5c4d27fbdd1aee7ea61601fa1a0acee12f2ff687cd5。未讀取私有 receipt 或直接查核設定內容，因此 owner 回報與本機核對分開記錄。

下一步為 Hermes 核對 receipt 後，執行一次 owner-successor/continue_after_adoption.sh，沿用已授權的 owner-approved-hermes-bot-switch-20261015 及原 predecessor。成功 acknowledgement 與 human receipt 尚未取得；不得據此宣稱通知已送達。凍結的 approved bundle 與 control 不變更。

## 單次補送完成，人工收件仍待確認

使用者轉回 Hermes 執行結果：唯一一次 continuation 以 exit code 0 結束，Telegram acknowledgement 為 sent，message_id=40，credential_source=gateway，sender_identity_pinned=true。Hermes 以正式 selected digest 的 live lease 執行，並回報 event／outbox／continuation 持久狀態皆為 sent。這是 owner 提供的實際執行與 DB 讀回證據；本次 Codex 未另發送 Telegram 或讀取正式 DB。

原 owner-confirmed-missing-toolchain-20261015 仍 unknown；原備份與新 continuation 備份均存在，未刪除或覆寫。既有 job 550aaf17723d 保持啟用、every 60m，其餘設定不變。補送未重跑，未建立額外 operation。

正式修復與單次補送驗收已完成。人工確認仍未取得，human_received=0／false；Telegram API 接受不等於真人已收到或已讀。保留全部稽核與備份，不再執行 continuation。

## 人工收件已確認（2026-10-15）

使用者在本對話明確確認：「我已確認收到 Telegram 通知，請把人工收件確認補進修復紀錄。」此確認對應本次補送 operation owner-approved-hermes-bot-switch-20261015、Telegram message_id=40。人工收件驗收已完成。

先前工具回報 human_received=false 與正式 DB 讀回 human_received=0 保留為當時的歷史證據。本次只更新本機修復紀錄與驗收摘要，未修改正式 DB、重送訊息或變更排程；不將人工確認收到延伸為已讀證明。

## 正式人工收件登錄已同步，完整結案（2026-10-15）

依使用者轉回的 Hermes 交易結果與讀回，正式事件 human_received 已由 0 更新為 1，對應 message_id=40 與 operation=owner-approved-hermes-bot-switch-20261015。正式登錄時間為 2026-10-15T13:33:58.880Z，證據來源為 user_explicit_confirmation_current_conversation；該時間只表示登錄時間，不推定實際收件時間，也不宣稱已讀。

異動前備份：

`/Users/hermes/.local/state/gcake-rss/notification-repair-backups/human-received-owner-approved-hermes-bot-switch-20261015.sqlite`

Hermes 回報備份為 hermes 擁有的普通檔案，mode=0600、links=1。正式稽核紀錄位於 `/Users/hermes/.local/state/gcake-rss/live.sqlite` 的 `monitor_human_receipts`，包含 event、operation、predecessor、message_id、登錄時間、證據來源與備份位置。

Event、outbox、continuation 與 transport 均維持 sent；原 predecessor 仍 unknown，原傳送紀錄、原備份與 continuation 備份完整保留。此次正式登錄 message_sends=0，未重跑 continuation、未建立傳送 operation、未手動執行 job；正式版本、憑證與每小時排程未變更。

修復、正式採用、單次補送、使用者確認與正式人工收件登錄均已完成，結案狀態為 complete。較早的 human_received=0／false 為歷史查核快照，並非目前正式狀態。本次 Codex 僅同步本機文件與證據摘要，未重新查詢或修改正式 DB、未發送通知。

## 原始碼與證據回存（2026-10-15）

修復來源與結案證據已整理至 gcake-dev；此次使用隔離工作樹，以目前 main／20b6578 為基準，未改動既有正式版本。共保存 58 份原始檔案的雜湊對照，完整 runtime bundle、SQLite 及憑證均未納入 repo。歷史工具保留為已消耗的交付證據。

準備工具的來源讀取已改為 repo 相對位置，既有固定輸出、歷史 baseline 與 approval policy 不變。原版搬移失敗 RED 已保留，完整 Hermes 185 tests 通過，新增兩項搬移驗證在 Python 3.11 通過；六份歷史 shell 僅語法檢查，未執行。

回存與工作樹清理的最終狀態見 saveback-result.json。所有正式備份與原暫存目錄繼續保留；人工收件交易的實際執行腳本未取得，只有 owner 回報與正式稽核位置，不能宣稱其完整可重現。
