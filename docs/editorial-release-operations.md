# D1 發文佇列與 Hermes 操作交接

2026／10／12：本 PR 候選已採 D1 作唯一操作佇列，Git journal 寫入路徑退役。PR ＃7 不合併、不部署正式候選、不啟用正式發文或 Telegram。Git 仍保存 Markdown、frontmatter 與 Series manifest，D1 只保存資格時間、暫停／指定時段、租約、發佈身份及公開驗證紀錄。

## 目前接法

- CMS 讀取同一 Git revision 的完整文章／manifest，D1 以版本式 CAS 保存操作狀態。歷史資料只增補 observation／active series 與預期正文 SHA，不清庫、不丟棄既有 releases。
- Worker 以既有 CMS App 原子提交文章及 manifest。Actions `editorial-release.yml` 只透過環境的 RELEASE_AUTOMATION_SECRET 請求 Worker；只有新提交的 release SHA 才交給 build／deploy。GitHub Actions 不 mint 寫入 App token。專用 editorial App 與既有保護例外不自動刪除；私鑰只保留已驗收的唯讀接法。
- 每週一／四台北 07：00 起，一時段一篇。恢復只考慮最近已到的時段，不能早於首次 durable observation，不能使用當時尚未 ready 的文章，不能補發更早時段。UI 的未來估計不是已取得時段。
- 文章 FIFO 取目前連續 ready 期間；退稿後再定稿會重排，即使两次檢查間 final blob 相同也讀新 Git revision 的 first-parent 歷史。正文編輯保留順位，合併前功能分支的較早定稿不當成 main 已可見；歷史走訪上限 1000 個 first-parent commits，不完整就停止。全系列資格另核對 manifest 完整度、暫停與固定 membership；未開始系列的變動會重新取得資格。
- 獨立文章可插隊，接續系列保持閱讀順序與優先於等待系列。多個人工開始系列缺少有效選擇、接續系列刪除／改序／前章在未來時停止取得新承諾，不能自行換系列。
- 發佈前持久保存完整轉換後 Markdown SHA-256；Git 回應遺失保留身份。公開頁 canonical、metadata、來源 SHA 與 RSS link／GUID 一致才 verified-public。Git pending 內容已改、來源消失或舊紀錄缺少 digest 時保留紀錄並要求對帳，不自動改寫證據或重新發文。
- `Deploy GitHub Pages` 仍為 main 的人工部署，沒有 prepare／confirm 或 journal writer。手動部署及 D1 自動部署均檢查 artifact revision 是否仍為 main；檢查與部署不是跨服務原子鎖，競爭窗口仍需人工接受／演練。

## Git journal 退役與舊資料

`pnpm editorial:release` 保留明確失敗的相容入口，所有 command／--write／舊旗標組合都回報 GIT_JOURNAL_RETIRED，不讀寫檔案、不呼叫 Git 或網路。`src/lib/publishing/editorial-state.ts` 已移除，沒有另一套可呼叫 publisher。

若 Git snapshot 仍有 `src/data/editorial-queue.json`，D1 ingestion／delivery 停在 LEGACY_JOURNAL_RECONCILIATION_REQUIRED。先保持三個正式開關停用、停止 active runs、保存原 journal／來源 SHA／D1 備份，逐筆核對 pending／completed 與真正公開的 RSS／HTML。沒有自動 import、覆寫、刪除或 replay 工具；有紀錄時須另行制定對帳／遷移方案並授權。此候選與目前檢查的來源沒有 journal 檔，不需要自動搬入任何承諾。

## 本機驗收

```sh
pnpm test
pnpm check
pnpm build:all
pnpm release:dry-run
pnpm editorial:rehearse
```

兩個演練入口均使用同一 D1 實作、暫存 SQLite／Git 副本、回環靜態站與 hardened Hermes monitor。原稿六篇先僅在副本設成 ready，實際 Astro build 顯示六篇未公開；D1 提交一篇、故意使 build 失敗、保留同一身份，再 build 並核對正文 SHA／canonical／RSS。獨立 dry-run 與 test-delivery DB 分別觀察一則 dry-run 及一個模擬 Telegram POST，重啟不重複；沒有正式資料庫或真實 Telegram。

## 正式設定與仍需人工驗收

GitHub RELEASE_AUTOMATION_ENABLED=false、退役的 EDITORIAL_RELEASE_ENABLED=false；Worker RELEASE_WRITE_ENABLED=false；Hermes HERMES_RSS_NOTIFY_ENABLED 保持未設／false。環境保持 main-only。本次不改 Secret、安裝範圍或 ruleset。

仍需核對 Worker／Actions automation secret 成對、實際 CMS App 身份及 D1 migration／備份、舊 release 的 digest 對帳、停止／競爭／失敗 delivery 恢復演練、正式候選 SHA 的部署／RSS，以及原稿與桌面／手機簽核。專用 App 的唯讀 Secret 驗收成功不代表 RELEASE_AUTOMATION_SECRET 或整個 D1 pipeline 已驗收。需要輸入憑證時由擁有者親自操作，不貼出憑證。

## Hermes 安裝與 job

合併前可先跑本機 mock 整合，不安裝 Hermes 或提供真實憑證：`pnpm test:hermes`。`--test-delivery` 只允許回環 RSS 站點與本機模擬 Telegram API，必須指定獨立 DB；詳見 [模擬驗收紀錄與命令](editorial-release-mock-review.md)。它不啟用正式 live，test DB 的 sent 只代表模擬 API 確認。production、dry-run、test-delivery 及不同 canonical 站點不得共用 DB。

程式只需 Python 3 標準函式庫，Linux／macOS 的 fcntl 鎖。以下由 Hermes 帳號本人執行；不要用 Codex 的 HOME 或替服務帳號啟動 GUI agent。

```sh
install -d -m 700 "$HOME/.local/lib/gcake-rss" "$HOME/.local/state/gcake-rss"
install -m 700 scripts/hermes/rss_monitor.py "$HOME/.local/lib/gcake-rss/rss_monitor.py"
python3 "$HOME/.local/lib/gcake-rss/rss_monitor.py" --dry-run
```

可將 scripts/hermes/SKILL.md 放入該帳號自己的 Hermes skill 目錄，並由既有 Hermes 排程器建立每小時執行一次的工作，呼叫上述 deterministic poller。應建立一個 job，沒有變化時不發額外訊息。安裝目錄與 Python executable 應以該帳號實際環境解析，不能複製另一個使用者的路徑。

正式程序需要私人環境變數 TELEGRAM_BOT_TOKEN、TELEGRAM_CHAT_ID；憑證只放該 OS 帳號的 secrets／權限 600 私人檔案，不放 Git、job 提示詞、log 或共用 plist。先保持 HERMES_RSS_NOTIFY_ENABLED 未設。驗收後在私人 runtime 設為 true，工作命令改為：

```sh
python3 "$HOME/.local/lib/gcake-rss/rss_monitor.py" --live
```

預設 dry-run 與 live 各用不同 SQLite。live 第一次成功讀 feed 僅建立 historic baseline，完全不推播；需在預期新文章前建立 baseline。不得為了補推舊文章刪除 live DB 或重新建立另一份 DB。--status 列出私人 outbox 狀態。

canonical URL 是去重主鍵，GUID 留作證據；RSS 外部 iThome entry 不觸發本地發文成功通知。失敗採 5 分鐘起的指數退避，上限 24 小時，hourly job 自然限制實際 retry 頻率。feed outage 只報監控失敗，不宣稱文章發文失敗；沒有加入非必要的 missed-publication 警報。

## 故障修復與停止

- 先關 Worker RELEASE_WRITE_ENABLED，再關 GitHub RELEASE_AUTOMATION_ENABLED；停用／取消正在執行的 delivery workflow，觀察 Pages 已開始的部署。只關旗標不是瞬時停止，也不是撤回已公開文章。
- build／deploy 失敗：保留 D1 原 release ID／slot／SHA，核對匹配的失敗 run 後僅重跑原失敗 delivery jobs，或另行授權同版本人工 Pages 部署。一般 hourly run 不自動重發舊文章／重部署未知結果。
- Git 寫入回應未知：只核對原身份與正文、公開頁及 RSS，不刪紀錄、不換新身份重發。missing digest 或 pending 正文改動須人工對帳，不將目前內容直接當作已驗收版本。
- 已知寫入前衝突可由 CMS 的受控 retry 沿用身份；解除承諾只限確認未寫入的安全失敗。正文、manifest、D1 狀態要一致，不能清庫或 force push。
- Telegram uncertain：保持私人 SQLite，人工核對 chat 與 outbox；不刪 DB 或自動重送。停止 live job／旗標並保留去重資料。

原先六篇可能日期不是正式承諾。本次沒有授權合併、正式部署、發文或真實收訊。
