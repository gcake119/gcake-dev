# External content

## iThome 2026

The 30-day iThome series remains owned by:

`gcake119/ithome-2026`

Rules:

- Do not edit old article bodies in `gcake-dev`.
- The old GitHub Pages URL remains canonical for each Day.
- `gcake-dev` may render the old content as part of a unified reading experience.
- The Series manifest in this repo controls only how the external series is presented here.
- The old site should link readers forward to `gcake-dev`.

Run:

```bash
pnpm content:sync:ithome
```

目前此命令用於核對並恢復已部署的完賽快照，不重新取得來源清單或正文。快照仍是來源內容的保存副本，不改變正文所有權。

## 完賽後的完整快照（2026-10-13 已確認）

原始鐵人賽 30 篇已完成同步渲染，現行政策保留 `completed` 的完整 30 篇快照。每次相關建置核對並使用部落格自身成功部署保存的 `ithome-snapshot.json`，不再讀取來源 `blog-sync.json` 或逐篇抓取來源 Markdown。

核對必須包含來源身分、revision、完成狀態、30 篇完整集合、Day／slug 唯一性及逐篇正文 SHA-256。快照不可讀、格式錯誤、篇數不完整或雜湊不符時，停止部署並保留既有線上版本；不得退回 Git 中較舊的 19 篇資料、發布部分內容，或改抓來源來繞過錯誤。

### 固定版本與原子替換規則（2026-10-13 已確認）

一次核對與恢復使用同一份完整快照及固定 revision；不能把不同 revision 的正文、metadata 或雜湊混成一份結果。逐篇正文 SHA-256 通過且 30 篇完整集合有效後，才能用原子替換方式更新本機建置使用的快照：先準備完整暫存結果，再一次替換，不逐篇覆寫或發布部分資料。

讀取、驗證或替換任一步失敗就停止後續部署，不以部分成功繼續建置發布，也不回退舊 19 篇或重新抓取來源。失敗時保留可用的既有快照與線上版本，問題釐清後再使用同一份已驗證的完整資料處理。

此規則保留完賽前同步設計中的完整性要求，但現行處理對象是 completed 的已部署快照；完賽前取得來源清單與 Markdown 的步驟僅保留在下方歷史段落。本次只整理文件，未執行快照替換、來源請求或部署。

回滾也必須保留已驗證的 completed 快照，不以刪除或替換快照重新啟動來源同步。快照來自成功的 Pages 部署，不依賴短期 Actions cache 或有期限的 artifact。Canonical 與正文所有權仍屬 ithome-2026；網站渲染完成不等於其他平台分發或永久保存驗收。

本次唯讀核對本機快照：30 篇、completed、revision `bad9d573e90b068abbd87e63e58969694dee2053`，逐篇正文 SHA-256 符合保存的雜湊。未在本次抓取來源或執行部署。先前 push main＋每小時第 37 分鐘候選已撤回為 legacy，不再使用。既有連載排程保留，普通 Pages 維持手動；本機修補讓兩條部署入口先以獨立 completed manifest 核對並原子恢復 30 篇快照，失敗即停止。尚未提交／推送或部署修補，線上新版結果仍待取得證據。文章到期後須等待下一次成功部署，不保證準點公開。細節見 [文章排程文件](article-scheduling.md)。

## 完賽前來源同步與初次啟用（歷史）

以下保留初次啟用及 active 階段的規則與查核說明。當中的每小時部署、來源請求、本機 19 篇或尚未部署描述屬當時階段，不是目前 completed 快照的操作方式。

部落格每小時第 37 分鐘重新建置，推送 main 與手動執行也會同步。不使用跨 repository token，不新增權限。GitHub 排程可能延遲或略過，故這是最終一致的同步，不保證一小時內完成；公開 repo 長期無活動亦可能停用排程。來源每日排程時間仍由來源 workflow 管理。

資料流程：來源 Pages 的 `blog-sync.json` → 清單中的 Git revision → 該 revision 的公開 Markdown → 核對 SHA-256 → 原子替換快照 → 部落格建置、部署。清單只包含使用來源 `isPublished` 規則通過的篇目（非草稿、台北日期已到），不因部落格跨日自行開放下一篇。來源 deployment 失敗時，線上清單維持舊版，因此部落格也維持來源的公開集合。HTTP 錯誤、30 秒逾時、格式錯誤、重複 Day、正文雜湊不符都會停止同步，不發布部分結果。下一次排程可再次嘗試。

來源公開 30 篇才標記 completed，否則 active。來源沒有暫停連載的正式欄位，不能由更新停滯推斷 paused。部落格 YAML 的 archived 仍表示編輯整理狀態；章節與導讀維持本地管理，公開篇目與連載狀態由來源衍生。Canonical 仍指向原文章站；此清單不代表 iThome 平台實際發文結果。

啟用時必須先發布來源 `src/pages/blog-sync.json.ts`，確認線上清單可讀，再發布部落格。端點尚未上線時，`pnpm content:sync:ithome` 應失敗，不可改回讀 main 或沿用快照後繼續部署。這次未提交、推送、部署或新增秘密金鑰。本機 generated.json 來自本機來源 dist 清單及正文，只供本機整合驗證，不能當作線上同步證據。

正式查核：核對線上清單 revision、sourceBuiltAt、公開篇數與連載狀態；手動執行部落格部署，核對首頁、系列列表、RSS、文章路由與來源的公開集合。來源若在同步途中再次更新，部落格這次仍用完整舊 revision，下次排程追上。短暫漂移與來源回滾時的短暫差異是兩個獨立靜態部署的限制。

參考：[GitHub schedule 限制](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)。
