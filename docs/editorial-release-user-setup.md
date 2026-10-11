# PR ＃7：需要擁有者操作的設定與步驟

目前先完成準備與人工核對，不合併 PR、不部署正式候選、不啟用正式佇列或 Telegram。此文件中的私人設定與命令尚未代你執行。視覺驗收候選為 `02756f58c0d8ea6869258e4b3dcf94a8c96799d0`；通知 mock 功能及重現命令見 [模擬驗收紀錄](editorial-release-mock-review.md)，操作前請核對 PR 最新 SHA。

## 1．先確認隔離預覽

查看 `editorial-release-preview-review.md` 與本機截圖。原始候選六篇都是 ready，路由全為 404、RSS 不包含六篇；展示副本才暫時調整 metadata，沒有改正文或正式 manifest。

請人工確認桌面、手機版的標題／正文、章序、上一篇／下一篇與返回系列總覽符合預期。代理完成的 Chromium 視覺與互動檢查，不代表你已簽署驗收；也不代表實體 iPhone／Android 或正式 Pages 已驗收。

## 2．D1／GitHub：保留已驗收保護，正式開關維持 false

2026／10／12 候選改為 D1 唯一佇列，先前 Git journal／prepare／confirm 的操作步驟已退役；不再新增 App 寫入 Secret 給 Actions。詳細接法與停止方式見 [操作交接](editorial-release-operations.md)。

1. 查看 [PR ＃7](https://github.com/gcake119/gcake-dev/pull/7) 最新 SHA 的 CI，不點 Merge，不執行正式部署。
2. GitHub Repository variables 的 RELEASE_AUTOMATION_ENABLED 與 EDITORIAL_RELEASE_ENABLED 保持小寫 false；Worker RELEASE_WRITE_ENABLED 保持 false。CI 成功不能作啟用依據。
3. `editorial-release` 維持 Selected branches 的精確 Branch main。已選擇無協作者、沒有逐次 reviewer 的方案；不為本次測試增加分支例外。main integrity／review 與 CMS／editorial App 例外保持原設定。
4. 後續成對 automation Secret 驗收需要核對 Worker 的 RELEASE_AUTOMATION_SECRET 與 editorial-release 環境同名 Secret、RELEASE_WORKER_URL。不要把值貼給代理。此次專用 App 唯讀驗收没有測試此 Secret，也未部署 D1 候選；若需要重設，由擁有者親自填入。
5. 正式 D1 部署／migration／runtime 備份與供應商驗收另行授權。既有 legacy journal 或缺少正文 digest 的 releases 必須先保留證據並對帳，不清庫，不擅自把舊 pending 匯入新身份。
6. 完成內容／畫面與停止／競爭／恢復驗收後，再分開核准合併、正式候選部署及啟用。D1 發文用 CMS Worker App；專用 editorial App 已安裝且保留唯讀驗收，不自動移除私鑰或保護例外。

## 3．Hermes：在真正的 OS 帳號先做 dry-run

用 Hermes 服務所屬帳號的終端機操作；不以 Codex 使用者代裝，不重啟或重裝目前健康的 daemon／gateway，不新增 getUpdates poller。先執行：

```sh
whoami
command -v python3
python3 --version
hermes --version
hermes cron create --help
```

確認實際 Hermes profile 與 HERMES_HOME；多 profile 不能拿另一個帳號／profile 的設定。下面 `HERMES_PROFILE_DIR` 請填已確認的完整路徑，不要假設一定是 `$HOME/.hermes`。`GC_REVIEW_REPO` 填此候選的可讀 checkout，至少包含 scripts/hermes。以下只安裝工具並手動 dry-run，沒有建立正式 job：

```sh
HERMES_PROFILE_DIR='/填入實際 Hermes profile 路徑'
GC_REVIEW_REPO='/填入已核對候選 SHA 的 checkout'
install -d -m 700 "$HOME/.local/lib/gcake-rss" "$HOME/.local/state/gcake-rss" "$HERMES_PROFILE_DIR/scripts"
install -m 700 "$GC_REVIEW_REPO/scripts/hermes/rss_monitor.py" "$HOME/.local/lib/gcake-rss/rss_monitor.py"
HERMES_RSS_NOTIFY_ENABLED=false python3 "$HOME/.local/lib/gcake-rss/rss_monitor.py" --dry-run
python3 "$HOME/.local/lib/gcake-rss/rss_monitor.py" --dry-run --status
```

記錄 Python 完整路徑、安裝程式 SHA-256、狀態 DB 路徑、退出碼即可；不要貼私人 chat 或憑證。第一次 dry-run 可能沒有輸出，代表建立歷史基線，不代表程式沒跑。

若目前版本的 `hermes cron create --help` 支援 `--no-agent`、`--script`、`--deliver`，之後可建立唯一的 dry-run script job。腳本要在該 profile 的 scripts 目錄中；內容使用已核對的 Python 絕對路徑，執行上述 poller 的 `--dry-run`，並明確設 `HERMES_RSS_NOTIFY_ENABLED=false`。job 名稱可用 gcake-editorial-rss-dry，每小時一次，**deliver 選 local**，不要選 telegram／origin／all。目前官方 Hermes 說明指出 no-agent 會傳送程式 stdout，local 則只留本機輸出；正式工具已自行 sendMessage，額外 cron delivery 可能再送一份通知。[Hermes 排程官方說明](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron/)

若需要定時 dry-run，先用 `hermes cron list` 確認沒有同名工作，再建立 wrapper；以下 Python 路徑須換成前面查到的完整路徑。確認 CLI 支援後才執行：

```sh
cat > "$HERMES_PROFILE_DIR/scripts/gcake-rss-dry.sh" <<'SH'
#!/bin/sh
export HERMES_RSS_NOTIFY_ENABLED=false
exec '/填入已核對的 Python 完整路徑' "$HOME/.local/lib/gcake-rss/rss_monitor.py" --dry-run
SH
chmod 700 "$HERMES_PROFILE_DIR/scripts/gcake-rss-dry.sh"
hermes cron create 'every 1h' --no-agent --script gcake-rss-dry.sh --deliver local --name gcake-editorial-rss-dry
hermes cron list
```

若 installed CLI 不支援這些選項，先保留手動 dry-run，把版本及 help 的非敏感部分帶回再決定接法，不直接套用最新版文件。正式 job 暫不建立／啟用。未來只保留一個正式 hourly job、一個固定 live DB，升級與重啟保留資料庫；不能用刪 DB 或改路徑來「重試」。

## 4．Telegram：私人測試與正式推播分開

1. 私人測試優先用獨立測試 bot 與普通私人 DM，避免動到 Hermes 正式 bot 的設定。在 Telegram 官方 [BotFather](https://t.me/BotFather) 用 `/newbot` 建立測試 bot，取得 token 後只放私人設定；先打開測試 bot 並按 Start。Bot 需要使用者先開啟對話，才能對該使用者發送。[Telegram 官方入門](https://core.telegram.org/bots)
2. 取得這個私人 DM 的數字 chat ID。可從既有 Hermes 私人設定／已收到的 update 查核，或用你自己控制的測試 bot 接收 `/start`；不要在正式 bot 已有 gateway 接收更新時另跑 getUpdates。普通 DM 的 chat ID 與使用者 ID 相同。[Hermes Telegram 官方說明](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram/)
3. 私人測試檔放 Hermes OS 帳號自己的 `$HOME/.config/gcake-rss/telegram-test.env`，目錄權限 700、檔案 600。用文字編輯器填 `TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`，並保持 `HERMES_RSS_NOTIFY_ENABLED=false`。不要放 Git、排程提示詞、shell 命令參數或共用 plist；不用將 token 傳給我。
4. 先核對 chat 確實只包含受控測試對象。真實 API 傳送需你另外明確授權私人測試範圍，再做獨立 sendMessage 連線測試；API 成功與你在私人 chat 看到訊息都要記錄，這仍不能當作公開文章成功的證據。
5. 已完成回環 `--test-delivery`，可將受控本機 RSS／HTML 接到本機模擬 Telegram API，不需 bot token，操作見 [模擬驗收紀錄](editorial-release-mock-review.md)。**live 仍固定正式 canonical 站點，不能拿 localhost 或其他測試域名發送真實 Telegram。** 若要做隔離站點到私人 chat 的真實供應商驗收，仍需另行授權及審查接法；另一條路是之後明確授權受控正式文章，這次不做。不要為了測試把六篇正式文章先改 published。
6. 尚未支援 Telegram `message_thread_id`；私人測試先用普通 DM，不把 topic／thread ID 填到 `TELEGRAM_CHAT_ID`。這是工具介面限制，Bot API 把 chat_id 與 message_thread_id 分成兩個參數。[Telegram sendMessage 官方介面](https://core.telegram.org/bots/api#sendmessage)

未來私人 live 驗收須確認：首次基線不發歷史文章、新文章驗證後只送一次、重啟／GUID 改變不重送、回應遺失保留 uncertain，並由私人 chat 與 `--status` 對帳。正式旗標與正式排程仍維持停用，直到所有驗收完成且你另外授權。

## 5．現在可以回覆的驗收資訊

你可以先回覆畫面是否接受、GitHub reviewer／分支保護策略、Hermes 帳號的版本與 dry-run 結果，以及是否有可用的私人測試 bot／普通 DM。不要提供 token；未完成項目直接標示未完成。

合併、正式 Pages 部署、GitHub 寫入試跑、真實私人 Telegram 發送與正式啟用都是後續分開的授權步驟。CI、隔離預覽或安裝成功不會自動通過這些項目。


D1 整合不改變 Hermes／Telegram 的私人驗收與啟用授權界線；目前僅模擬 API、正式推播停用。
