> 歷史紀錄：Paragraph 同步已於 2026／10／13 停止。本頁不得作為啟動或恢復授權。

# 同步發文腳本

正式來源只有 gcake119/gcake-dev main 的完整 Markdown。Pages 先正常公開並匿名驗證後，才執行精確版本的 Paragraph／Substack 同步。Paragraph canonical 指向 Pages 原文；Substack canonical 指向同一篇平台文章並保留原文連結。Substack 日期比對到分鐘，其他來源保留秒數。電子郵件與 Substack App 傳送均關閉。

## 一個入口跑一輪

在已釘選的 runtime 工作目錄執行。憑證只由 Node `--env-file` 載入，不讀回、列印或複製。

```sh
node --env-file='/Users/caiyijun/Library/Application Support/gcake-distribution/credentials.env' \
  --import tsx scripts/publishing/sync-distribution.ts \
  --config '<正式私人政策檔>' \
  --pin '<此版本的正式釘選檔>' \
  --acceptance '<首次正式平台驗收檔>' \
  --out '<Git 外的輪次證據目錄>' \
  --lock '<所有同步執行者共用的鎖目錄>'
```

預設只盤點與產生計畫，不執行平台文章操作。加上 `--execute` 才依計畫執行。`pnpm distribution:sync` 是相同入口，但實際憑證載入建議使用上方 Node 指令。腳本依序完成釘選與政策檢查、單一執行者鎖、全 D1 對帳、新遠端 main 快照、Pages 全文驗證、逐篇精確計畫、逐平台執行及結束對帳。任何一邊失敗只停止該平台後續操作；不自動重試同一操作。

相同版本只驗證；新版本沿用已保存 ID 更新；未知結果由 D1 原意圖決定 retry／verify／既有 metadata finalize，不重建或重新發布。prepare 未取得 prepare_ready 或 verified 時，不能繼續 publish。未發布、未到日期、MDX、互動摘要、外部聚合與來源不一致均保留具體阻擋紀錄。

每輪保存 `ownership.json`、`snapshot.json`、`preflight-d1.json`、`all-plan.json`、`final-d1.json`、`result.json` 及精確操作檔。正常或已結束失敗輪次會清理只屬本輪的 source 快照；未回覆的側邊請求會保留快照供核對，result 明確標示 retained。不得靠經過時間偷取鎖。當機鎖須先確認 owner.json 的 PID 已停止及全 D1 意圖後，由操作者精準移除該鎖，不能重放舊計畫。

## Substack 側邊瀏覽器交接

Paragraph 官方 REST 與兩平台匿名驗證可直接由程式執行。Substack 寫入仍採已核准的 Codex 側邊瀏覽器，不使用背景 Playwright、CDP、Cookie 匯出或未公開 API。腳本會印出唯一 `attendedRequest` 並等待；這是程式交接點，不要求逐篇由使用者批准。

```sh
node --env-file='<既有 credentials.env>' --import tsx \
  scripts/publishing/distribution-handoff.ts inspect \
  --request '<attendedRequest 的 request.json>' \
  --config '<該輪 scoped config.json>' \
  --source-root '<該輪 source 快照>'
```

`inspect` 會核對固定 commit、文章版本、精確授權、期限、D1 原意圖與 remote ID，並匿名重驗 Pages。每個側邊寫入動作前，以同樣參數改用 `proof`，再次確認來源。Codex 依 request 指定動作在 cua_repl 操作。保留診斷草稿 219884438；find 必須完成 draft／published／scheduled 與全部分頁；publish 僅點一次網站發布，email／App／排程必須關閉。已公開更新不得按再次發布。

從可見 DOM 取得實際完整 `title`、`text`、`links`、`images`（src、alt、loaded）及 `saved`；寫入 Git 外 0600 的 observed.json。不要用預期正文重建觀察值，也不要僅以「已儲存」當正文證據。checkPublish／publish 另需明確 `emailDisabled:true` 與 `scheduleDisabled:true`。metadata 沿用同一 public ID 與 URL。日期填入後以原生鍵盤事件確認最終值，再完成、等已儲存、重新載入與匿名讀回。

```sh
node --env-file='<既有 credentials.env>' --import tsx \
  scripts/publishing/distribution-handoff.ts reply \
  --request '<同一 request.json>' \
  --config '<同一 scoped config.json>' \
  --source-root '<同一 source 快照>' \
  --evidence '<實際 observed.json>'
```

reply 再核對來源與意圖，直接比對實際全文，獨占建立 0600 回覆；重複、過期、錯誤 ID、缺正文或寄送未關閉均拒絕。CLI 收到回覆後仍獨立匿名驗證平台全文，成功才寫 verified。登入失效或 UI 不確定時不重做動作，保留原意圖並報具體阻擋。

## 排程與驗證邊界

排程使用同一個 pages-paragraph-substack heartbeat，每 15 分鐘啟動一輪 `--execute`。Codex 只需接手 Substack 側邊請求；其餘流程不再臨時寫控制程式。同版正常驗證保持安靜，只有新增同步、失敗、未知結果或需操作時通知。

腳本化候選為 distribution-scripted-20261012；原 distribution-all-articles-20261012 和正式私人舊 pin／policy 均保留。只有完整本機檢查、新鮮真實唯讀輪次及無在途 writer 通過後，才切換同一 heartbeat。回復只改排程至舊 pin 與舊 runtime，不刪 D1 身份、文章或憑證。工程未提交／推送，不修改原文排程、部署或 PR #8。

## 正式腳本化切換

2026／10／12：377 項 Node、31 項 Python 及186 files型別檢查、所有建置、release:dry-run通過。真實新 main輪次round-SAK5LQ兩平台均verified，原文版本未改，未呼叫prepare／publish／finalize，無電子郵件或App傳送，快照已移除。最終版本的來源版本通知回歸另納入完整gate；驗證紀錄見候選 `.distribution-handoff/scripted-20261012/`。

正式使用目錄：`/Users/caiyijun/project/gcake-dev/.spectra/worktrees/distribution-scripted-20261012`。私人安裝：`/Users/caiyijun/Library/Application Support/gcake-distribution/scripted-20261012`，包含unattended.json、runtime-sha256.json、acceptance.json。共享鎖為同目錄round-lock；輪次證據在同目錄rounds。原credentials.env仍在父目錄；舊all-articles-20261012政策／pin／runtime完整保留。

完整正式命令：

```sh
node --env-file='/Users/caiyijun/Library/Application Support/gcake-distribution/credentials.env' \
  --import tsx scripts/publishing/sync-distribution.ts \
  --config '/Users/caiyijun/Library/Application Support/gcake-distribution/scripted-20261012/unattended.json' \
  --pin '/Users/caiyijun/Library/Application Support/gcake-distribution/scripted-20261012/runtime-sha256.json' \
  --acceptance '/Users/caiyijun/Library/Application Support/gcake-distribution/scripted-20261012/acceptance.json' \
  --out '/Users/caiyijun/Library/Application Support/gcake-distribution/scripted-20261012/rounds' \
  --lock '/Users/caiyijun/Library/Application Support/gcake-distribution/scripted-20261012/round-lock' \
  --execute
```

相同失敗去重與恢复通知由脚本保存的round-lock.last-result.json判断，不再靠对话记忆。新文章版本纳入去重，避免吞掉同篇更新通知。當機或未回覆請求仍需確認原執行者已停止及對帳，不能用新輪次繞過。
