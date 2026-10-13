> 歷史規劃／交接紀錄。文中 `/private/tmp` staging 已清除，不能再照舊命令執行；最新狀態與正式導入紀錄見 [hermes-production-rollout.md](hermes-production-rollout.md)。

# Hermes 發文監控實作前置查核

查核日期：２０２６－１０－１２，台北。

## 已完成

- 工作副本：`/private/tmp/gcake-hermes-monitor-plan-20261012`。
- 分支：`codex/plan-hermes-publication-monitor`。
- HEAD：`c7a2fd537c85e7ff3f37eb9b9b2d468f8459e761`。
- origin 是本機 `/Users/caiyijun/project/gcake-dev`，不是 GitHub 推送位置。
- 起始工作樹僅有未追蹤的 `docs/hermes-publication-monitor-plan.md`；主要 checkout 及其他 worktree 未修改。
- 已依本輪授權 unpark 並標示 in-progress，沿用原提案。
- `spectra analyze add-hermes-publication-monitor --json`：零 findings。
- 唯讀 `git ls-remote` 確認公開 main：`bb241cb375c9d0b05c8301eba6e0d2cae2bab409`。它與本輪實作基準不同。後續依授權 fetch 至 FETCH_HEAD 並唯讀比較差異；未合併、重設或切換工作分支。
- 根 package 已核對：`pnpm test` 包含 `test:hermes`；Python gate 採 `scripts/hermes/test_*.py` discovery。Worker gate 採 `src/*.test.ts`，規劃測試路徑符合 discovery。
- 文件確認 D1 為操作狀態來源、Git 保存內容與閱讀順序，預估時間不能充當正式承諾。後續已核對公開 main 的程式保存方式，詳見下方；正式 D1 實際資料仍未讀取。

## 決策查核

Level 2：背景工作、發布權限、憑證及通知狀態。

依目前授權與既有規格，只新增觀察功能；不 ingestion、不改正式排程、不重發、不重跑 workflow、不配置憑證、不切換 gates、不重啟 gateway、不呼叫真實 Telegram。歷史文件中的停用敘述不推翻本輪交接指出的既有啟用狀態。

本基準沒有 docs/decisions 登錄。決策沿用本 change、series-scheduling、publishing-operations、integrate-durable-release-queue 及本輪交接；本輪不新增產品決策、不 archive 或 commit。

## 尚未解決的前置限制

１．Codebase Memory MCP 的 list_projects 未列出這個隔離 clone。先前此 clone 的索引遭自動審核拒絕，理由為可能向外部服務暴露未公開原始碼。沒有重試索引或使用其他副本索引。後續使用者明確授權本機唯讀 fallback，MCP search_graph 仍得到 Transport closed；接著在隔離 clone 與 FETCH_HEAD 本機探索，核對結果見下方。

２．Hermes cron 目錄、live.sqlite 及 D1 read 設定檔受作業系統權限保護。直接唯讀查核得到 Permission denied；已授權的非互動 `sudo -n -u hermes` schema 查核得到 `sudo: a password is required`。沒有讀到 schema、job phase、通知狀態或憑證，沒有建立 DB 連線、寫入正式 DB 或發送通知。不得將這個環境失敗列為產品 RED。

３．公開 main 已前進且本輪已核對相關差異；後續實作應銜接已核對的 main，不能繼續以缺少正式 monitor 的舊版本作為驗收基準。本輪僅比較，尚未整合。

## 驗證狀態

任務完成：０／１３。任務１．１僅完成部分，不勾選。

- 產品 acceptance RED／GREEN：未執行。
- integration／unit 與 SQLite WAL／並發驗證：未執行。
- 完整本機 gate：未執行。
- `release:dry-run`：尚未確認程式本身完全本機，未執行。
- 正式摘要、Telegram 系統送出、人實際收訊：未驗證。

恢復條件：提供不含秘密的 Hermes schema／job／通知狀態查核結果。程式探索已依後續授權使用本機唯讀 fallback。不要提供 token、chat ID 或 sudo 密碼到聊天。


## 後續授權：遠端差異及本機唯讀探索

使用者明確授權索引不可用時改用本機唯讀探索，以及比較遠端 main。本輪 Codebase Memory MCP search_graph 首次探索得到 Transport closed，沒有另外索引公開或私人副本。

### 遠端 main 差異

比較範圍：`c7a2fd537c85e7ff3f37eb9b9b2d468f8459e761` → `bb241cb375c9d0b05c8301eba6e0d2cae2bab409`。共６０個檔案，新增３４８９行、刪除１８８行。

與本 change 直接相關的變更：

- 新增 `scripts/hermes/rss_monitor.py`、mock delivery、RSS 及安全邊界測試；舊基準只有歷史 poller，不足以支援正式 SQLite 相容性驗收。
- 新增人工立即發布，以同一 D1 release 身分保存 `mode=manual` 與實際時間，不能假定所有承諾都是週一／四０７：００。
- Queue 增加 `startedAt`、`observedRevision`、`activeSeries` 與 eligibility floor；正式取得時段不能回填尚未成立的觀察。
- `verified-public` 的保留紀錄修正舊日期誤報；monitor 不應重新採用已完成文章或改動這個判斷。
- `package.json` 新增 editorial gate；完整 `pnpm test` 已涵蓋 editorial、Hermes、public 與 workspace tests。
- Git journal 已退役，公開 snapshot 遇到舊 journal 會停止對帳；不要讀寫它來補 monitor 正式時間。

這些是程式與版本文件證據，不代表本輪重新驗證正式啟用、發送或收訊。

### 已確認的程式接點及正式時間語意

| 接點 | 本機核對結果 |
| --- | --- |
| `apps/admin-worker/src/release-api.ts` 的 `releaseApi` | `GET /api/v1/releases` 呼叫 `queue.ingest(await git.snapshot())`，有操作狀態寫入。monitor 禁用此路徑。 |
| `apps/admin-worker/src/release-queue.ts` 的 `D1ReleaseStore.read` | 使用既定 `SELECT version, document FROM release_queue_runtime WHERE id = 1`；可作為純讀摘要的最小讀取依賴，不能納入 `write`／`ingest`。 |
| 同檔 `acquire` | 建立 release record：`id`、`slug`、`slot`、`sourceRevision`、`state=committed-slot`。`slot` 是已取得的正式時段；planner 的 `estimatedAt`／`plan.releaseAt` 仍只是估算。 |
| 同檔 `acquireManual` 及 `ReleaseRecord.mode` | 人工發布也是 D1 正式紀錄，需保留其實際時間；lease、attempt、error、events 等內容不能對 monitor 外洩。 |
| `paused`、`overrides`、`unlockedAt` | 已讀控制方式，摘要必須區分 pause、固定日期估算及可安全解除的紀錄。cancel-override 刪除 override，沒有通用 cancelled record；不能將缺少紀錄當作明確取消，未知分類仍適用。 |
| `apps/admin-worker/src/github.ts` 的 `releaseSnapshot` | 完整遞迴 Git tree，truncated 會拒絕，依 immutable blob SHA 讀取所有 local posts／manifests，回傳固定 revision。需另核對回傳前 main revision 及 queue version，不能直接宣稱現有 snapshot 已完成雙來源一致性。 |
| `apps/admin-worker/src/index.ts` | 目前將 Git read/write 與 ReleaseDelivery 一起組裝。新的唯讀路徑應獨立於 ReleaseDelivery／automation secret，不配置正式憑證。 |
| `scripts/hermes/rss_monitor.py` | SQLite `meta(key,value)`／`outbox(url,guid,status)`；歷史訊息以 canonical URL 去重。先寫 uncertain，再發送，成功改 sent。這是 main 程式行為，尚非 live schema 證據。 |

公開 main monitor SHA-256：`f4b1e2dd88e53674e30abbd73b7a8ba7874246f74c20b46a9a6745e4a30ee7ac`。需以主使用者回報的 live 程式 hash 核對，不能只引用先前版本文件。

### 供主使用者執行的唯讀查核

在本機 Terminal 執行：

```sh
sudo -u hermes /usr/bin/python3 -I -B /private/tmp/gcake-hermes-monitor-plan-20261012/docs/hermes-readonly-audit.py
```

sudo 如需密碼，只在本機 Terminal 輸入。把此命令的 JSON 輸出提供回本 chat 即可；不要另貼 jobs.json、wrapper、live.env、完整 outbox 或 D1 token 設定。

腳本不執行 Hermes CLI、monitor 或 wrapper；不讀 env／D1 憑證檔、不連網、不發 Telegram、不修改 cron。SQLite 使用 mode=ro，加 query_only 並在同一讀交易中查 schema／必要 meta／status counts；沒有 immutable。只輸出欄位結構，不輸出 SQL defaults、URL、GUID、秘密或未知錯誤文字。job 檔採固定目錄及已知兩個 id 篩選，只有白名單的排程及狀態值可輸出；格式不認得時保留未驗證標記，不猜測。

腳本以合成 SQLite WAL／job 資料驗證：已提交 WAL 可見、讀取前後資料列不變、秘密 canary 未出現在結果、interval schedule 可解析。這是查核工具驗證，不是產品 acceptance RED／GREEN。

任務１．１尚待 live 查核與基準整合，進度維持０／１３。所有正式操作、commit／push 限制維持。

## 主使用者回報及前置完成

２０２６－１０－１２，台北１８：４８：０５的唯讀查核結果由主使用者提供：live monitor hash 與 main 相符；wrapper hash 為 f3d1868862188c77ccc6c6f8bfb20c14ac9d2fd6354072943194e0bc11c60e46，符合預期 monitor／live flag／DB／private env 路徑。live job 550aaf17723d 啟用、no-agent、６０分鐘、deliver/failure_deliver=local；下一次１９：２２：１３．６５５７６０，前次１８：２２：１３．６５５７６０。既有 dry job ea3c550669f1 亦啟用，維持原狀。source package version 0.21.4，不宣稱執行態版本已驗證。

live SQLite journal_mode=delete；meta／outbox 結構符合 main，initialized 存在、mode_live=true、site_matches=true、failures=0、next_check=0、sent=1。未知結果欄位語意由相符程式 hash 核對為 uncertain，後續相容性測試保留它；沒有直接複製正式資料。此回報不證明送出那則訊息的內容或人親自收訊，也不證明未顯示的 job 欄位。

隔離分支已 fast-forward 至 bb241cb，沒有建立新 commit；原提案及兩份查核文件保留，主要 checkout 未修改。新的監控輪數將接受既有 job 的 scheduled round time 作為輸入，不能硬编码舊１０：１５相位或把手動重試當新輪。

正式 D1 資料本輪未讀；依相符 main 的實際保存方式，只採未解除 release record 的 slot 作正式承諾，override／estimatedAt 不升格。若來源沒有取消 tombstone，分類 unknown／unscheduled，不能猜測取消。任務１．１的程式、時間語意及 live 相容性前置已完成，開始 acceptance-first TDD。

## 本機候選交付

後續已完成純讀摘要、通用 monitor、正式格式的合成相容性測試及本機 gate，詳見 `docs/hermes-monitor-evidence/README.md`。前面的未執行狀態保留作為前置階段記錄，以此交付段落及 tasks 的最終狀態為準。正式讀取、新摘要部署、Telegram 送出及人收訊仍未由本輪驗證替代。
