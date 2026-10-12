> 本 checkout 的最新範圍已改為所有正式 Markdown。請先讀 [通用同步交接](distribution-all-articles-handoff.md)；下方單篇敘述保留為先前執行版本紀錄。舊釘選 runtime 位於另一份 checkout，沒有改動。

# 跨平台發布接手紀錄：2026-10-12 最終狀態

現行執行 worktree：`/Users/caiyijun/project/gcake-dev/.spectra/worktrees/distribution-integration-20261012`，branch `codex/distribution-integration-20261012`，整合 baseline main `c7a2fd5`。沿用 PR #8 的 portable publication／Paragraph service／D1 architecture，搬入未完成跨平台 runtime，不重建已完成部分。原 dirty main 與原 continuation worktree 保留；本次所有工程修改未提交／推送。PR #8 現為 Draft／Open，mergedAt=null。

## 使用者最終決定

先前 Pages 文章是誤提早公開；最新 main 改回 ready 並移除日期，公开網址 HTTP 404，保留撤回。使用者將流程改成「站上正式公開並驗證後，再無人值守同步 Paragraph 與 Substack」，選擇 Codex 排程操作已登入側邊瀏覽器。不逐篇再問核准，不發電子郵件／App 通知，不使用歷史誤發版本／日期。其他文章、原文部署、合併 PR #8 不在本次自動化範圍。

## 已完成

- Paragraph trial 綁定刊物、文章／revision 與操作；刊物 GET me 身分核對，四種狀態完整分頁查找；prepare 完整儲存內容／canonical／日期讀回；publish 必須已準備同版本，重讀避免覆寫或重發已公開文章。未知結果保留 ID／checkpoint。
- Side-browser file handoff：D1 先有鎖與操作意圖，request/reply 綁定 ID／revision／operation／期限；完整 draft 證據与独立匿名 public reader，日期恢復沿用同篇；逾時／假回覆／錯版本不重建。
- Pages 公開 gate：正文、title、canonical、原文日期、links／images 全對才允許 provider write；404／ready／未到日期／過期版本停止。每個操作重新確認，寫入前額外再讀來源。
- 排程規劃入口：`distribution:schedule-plan`，只在本機已明確允許的單篇政策且 Pages 當前一致時產生單輪精確授权；一般能力旗標維持未驗收。`--source-root` 支援遠端 main 固定 commit 的 Markdown 快照，執行工作目錄仍是已驗證 runtime。
- 已建立 active heartbeat `pages-paragraph-substack`，每 15 分鐘在本對話檢查本篇；未公開時安靜，符合 gate 後才透過既有 CLI／D1／側邊同步。政策與已釘選 runtime hash 在 Git 外 Application Support/gcake-distribution。不得將一般 gate 改 true 或自行更新釘選。

操作協定、命令、資料格式、匿名查核及恢復詳見 [distribution-unattended-runbook.md](distribution-unattended-runbook.md)。

## 驗證

最終完整測試：282 Node、4 Python 全通過；168-file TypeScript／Astro 0 errors／warnings／hints；網站＋五工作區 Build、完整 release:dry-run、diff check、Spectra validate/analyze 全通過。Chrome E2E 是 localhost fixture，不能稱為正式平台驗收。

審查修復：Paragraph 預設清單漏草稿、發布前不重讀、已公開狀態重入；來源 ready 的 CLI 診斷錯被分類為 provider failure；發布模擬用整條絕對路徑搜尋 /dist，錯誤排除 distribution 開頭 worktree，改為僅檢查實際相對路徑目錄名稱。

正式唯讀查核：D1 schema／migration 正確、本篇 state／lock／checkpoint 皆空；Paragraph API 身分 gcake，四種狀態完整查找無本篇；側邊登入有效，原診斷草稿 219884438 已儲存且內容未改。本次無 provider 寫入、候選草稿、正式發布、寄信、內容 Markdown 修改、commit／push／merge。

目前遠端 main 本篇為 ready；兩平台 dry-run 与 scheduled-plan 都以 DISTRIBUTION_SOURCE_NOT_PUBLISHED 拒絕，未生成可執行 review／approval。歷史 2026-10-12 dry run 不可再用。正式寫入權限、Substack 真實公開 DOM／日期控制、圖片重新託管與公開正文讀回仍未完成驗收；需原文正常公開後第一次受控同步取得實證。任何不確定結果保留原 ID 並停止。

完整非秘密結果：`/private/tmp/gcake-unattended-readiness-20261012/validation.json`；當前來源狀態／阻擋與正式唯讀查核在同目錄。完整測試日志：`/private/tmp/gcake-integration-{test,check,build,release-dry-run}.log`。Spectra task 6.3 保持未完成，未 archive；其餘準備與排程任務已完成。
