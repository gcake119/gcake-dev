# 發文佇列與 Hermes 操作交接

## 交付邊界

實作基底是 feat/editorial-release-queue 的 2351b17。本候選依功能拆分 commit，交付至同名 feature branch 並建立 PR，供人工審閱。合併、部署正式候選、建立 GitHub variable/environment、安裝 Hermes job 與發送 Telegram 尚未執行；正式發文及推播維持停用，驗收完成後才可啟用。

正式站 RSS 已唯讀確認回應 200： https://gcake119.github.io/gcake-dev/rss.xml 。此次查核沒有本地 canonical 文章；六篇幕後文章未出現在 feed。這不代表新程式已部署或 Hermes 帳號已驗收。

## 設計與可觀察結果

- Git Markdown／manifest 仍是正文、frontmatter、閱讀順序的唯一來源。journal 不存文章或排序副本，只存 membership fingerprint、readyAt、startedAt、activeSeries、pending 與 completed。
- 專用 src/data/editorial-queue.json 是 Actions 佇列的持久日誌。這是原有「操作狀態使用 D1」方向的明確例外，理由是本次不得假設 Admin production D1 可用；沒有改變 CMS 既有 D1 所有權。決策載於本次 Spectra design。
- 初次匯入會從完整、first-parent Git 歷史取得連續 ready／published 的起點，並與 manifest 完成時間取較晚者；因此同一小時內先後 CMS save 的文章仍保持 FIFO，後續改正文不會改排位。不使用檔案 mtime。無歷史的本機 fixture 採首次觀測時間。Actions checkout 必須 fetch-depth: 0。
- Git 時間是提交者提供的證據；匯入採 first-parent merge 可見時間，不宣稱是編輯者按按鈕的精確時刻。全系列必須有檔案、完整 manifest、ready／published 一致，且 published 前章不可仍在未來；planned、draft、缺章、暫停都不排程。
- 每週一、四台北 07：00 起，一時段一篇；standalone FIFO 優先，已開始系列先於其他等待系列。首次啟用以前的時段不補發，恢復也只選最近已到的時段。
- prepare 將 pending、文章 published／publishedAt 與 manifest status 一起提交。此處 published 是部署意圖；completed 才是 RSS＋公開 canonical HTML＋內容 SHA-256 證據確認。失敗不標 completed，保留同一 pending，阻擋下一篇。
- pending 保存的是改完發佈 metadata 後的完整 Markdown SHA-256。CMS 改稿、刪除 pending、metadata 不一致、刪除 active series，都停止並要求人工修復。公開文章 head 的 gcake-source-revision 必須吻合，舊頁不能確認新版本。
- Actions 使用既有 pages concurrency，保留每小時 minute 37 恢復，新增 UTC 週日／三 23：00 的觸發。push 可 ingestion／recover，不能新增 reservation。寫入只在 prepare／confirm job，正常 build 僅 contents/read＋pages/read。
- 所有 Git push 為非 force。CMS 同時寫入造成 push 衝突時不 rebase／merge、不覆蓋；下次從最新 main 重做。部署前比對 artifact 與 main SHA。SHA 檢查與 Pages deploy 仍不是跨服務的原子鎖；CMS 正好在兩者之間更新時，可能短暫部署舊 artifact，下一輪最新 main build 恢復。這是正式驗收必須接受或另做 CMS 協調鎖的限制。

## 本機驗證

在交付 clone 執行：

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm build
actionlint -shellcheck= .github/workflows/deploy-pages.yml
pnpm editorial:rehearse
pnpm editorial:release plan
```

rehearse 只在暫存目錄建站，監聽 127.0.0.1，產生 dry-run SQLite；不推 Git、不連 Telegram。它會驗證六篇 ready 路由不存在、故意讓建置失敗、保留同篇重試、成功後 RSS 僅新增一篇、canonical／source revision、五篇仍隱藏、通知去重及六篇正文／順序不變。

正文保留測試以 Markdown content 逐字比較。第五篇 frontmatter 的錯誤 topic automation 改為既有 development-automation，使原先被阻擋的 content validation 通過；正文未改。

## 正式啟用前的人工設定與驗收

逐項勾選並留存版本／執行人／證據，使用 [PR ＃7 人工驗收清單](editorial-release-acceptance.md)。新增的 Validate editorial release CI 只跑測試、建置與隔離演練，顯式停用兩個正式旗標；CI 成功不等於已完成下列人工設定或供應商驗收。

1. 審閱 PR 並完成驗收，另行授權合併本候選至 main。GitHub 排程只使用 default branch，feature branch 不會啟動正式排程。
2. 建立 GitHub environment editorial-release，限制 main，先保持人工 reviewer 保護。確認 repository ruleset／branch protection 允許所選 unattended GitHub token 的 contents write；若 GITHUB_TOKEN 無法直接推 main，須改用僅安裝此 repo、僅需 contents write 的 GitHub App 路徑，另做權限驗收，不能 force push、關掉保護或使用廣權限 PAT 繞過。當前程式使用 checkout 的短效 GITHUB_TOKEN，不依赖 Admin App secrets。
3. 保持 repository variable EDITORIAL_RELEASE_ENABLED 未設或 false，先確認 feature CI、本機演練、實際候選預覽／部署與競爭情境。環境 reviewer 保護要如何在啟用後提供無人值守排程，須由擁有者決定。
4. 人工確認候選版本、journal 儲存例外、發佈 metadata 意圖與公開確認區別、部署競爭限制，以及延遲無精確分鐘保證。接受後才設定 EDITORIAL_RELEASE_ENABLED=true。初次 ingestion 必須在要使用的 07：00 時段之前成功持久化；若錯過則使用下一個時段。
5. 在 Hermes 所屬的獨立 OS 帳號安裝下節工具與唯一 hourly job。repo 存取不等於 Hermes runtime 存取。本次沒有改動現有 Hermes daemon／Telegram poller。
6. 在私人測試 chat 驗收真實 Telegram：新 feed＋200 canonical page 才成功；重新啟動仍不重送；失敗應顯示 outbox uncertain。此測試需擁有者提供並授權私人帳號／測試 chat，dry-run 不等同 Telegram provider 成功。
7. 驗收後才為正式 Hermes job 啟用 live，避免多個資料庫或多個 job 各送一份。既有 Hermes Telegram 通道若共用同 bot，允許 sendMessage，不另建立 getUpdates poller。

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

- 失敗 build／deploy／RSS verification：保留 journal pending，下次原時段原文章重試；不要手動把它標 completed。
- CMS 改稿：系統會明確拒絕不同 digest。由擁有者確認新的正文及 publication metadata，計算完整 Markdown SHA-256，僅更新同一 pending.revision 後提交；重新 build、公開驗證。不得清除 pending 後重排已公開內容。
- 刪除 pending 或 active manifest：恢復原檔／manifest，或由擁有者審閱取消／遷移狀態；系統不擅自放行另一個系列。
- Git conflict：保持遠端 CMS 內容，從最新 main 重試；不 force push。
- Telegram uncertain：用 --status 及私人 chat 查核。如果已收到，人工將該 URL 狀態核對為 sent；若無法判斷，保持 uncertain，不自動重送。真的確定未送達且批准重送時，先停 hourly job，人工處理該筆後再恢復；程式不提供會大量重播的清庫開關。
- 停止新發文：將 EDITORIAL_RELEASE_ENABLED=false。已有 published 意圖仍可能被普通 Pages build 部署；要取消尚未公開的 pending，必須由擁有者確認公開證據後，原子恢復 post／manifest／journal，或暫停整個 Pages workflow。不要把關掉 queue flag 當成已發布內容的回滾。
- 停止通知：停用 Hermes hourly job 或取消 HERMES_RSS_NOTIFY_ENABLED；保留 live SQLite，避免再次建立基線改變去重證據。

六篇原先的 10／12、15、19、22、26、29 只是未受 standalone 插隊且及時啟用的可能時段，本交付沒有承諾或宣稱任何一篇已在正式環境發佈。
