# 同步與文章排程部署紀錄（歷史證據）

## 歷史證據範圍（2026-10-13 整理）

本文保存 2026-09-27 同步工程的原始交接／部署與後續收尾紀錄。下方版本 SHA、Actions 連結、測試數量、公開查核與限制均保留原文，代表各自記錄時點的證據；本次未重查遠端 Actions 或重新驗證當時部署。

其中「19 篇」、「尚未部署」、「尚未完賽」、舊工作目錄基底或 workflow 啟用狀態，不得當作目前狀態。原始鐵人賽目前保留 30 篇 completed 完整快照；固定 revision、逐篇 SHA-256、原子替換、失敗停止部署與禁止回退舊 19 篇的現行規則，見 [外部內容文件](external-content.md)。幕後系列已完稿並開始排程連載，見 [發布文件](publishing.md)。

文章公開時間與 Pages 自動部署規則見 [文章排程文件](article-scheduling.md)。較早提及的「恢復每小時及 push main 部署」候選，僅代表其記錄時點的本機狀態；目前是否啟用須另查對應版本與實際執行證據，不能由這份歷史紀錄推定。

## 原始紀錄（歷史原文）

2026-09-27，使用者授權部署與啟用，並明確選擇只部署同步與文章排程、保留現有線上設計。

來源正式版本：58f64fb4a21810cdab030c62ecd2a83789cb65ea。
來源 Actions：https://github.com/gcake119/ithome-2026/actions/runs/36258128859，success。
部落格正式版本：1320bdf1d7133e38f26602ec9063bb52954f3da8。
部落格 Actions：https://github.com/gcake119/gcake-dev/actions/runs/36258345685，success。

在 /tmp/ithome-sync-release-20260927 與 /tmp/gcake-sync-release-20260927 的乾淨正式副本實作與發布，未提交原工作目錄的設計、搜尋、頁尾或關於頁變更。部落格發布前遇到遠端新增文章與延伸系列，已 rebase 保留 564ca9e，重新完整驗證。

部落格：pnpm test 6／6、pnpm check 0 errors／0 warnings／10 hints、pnpm build 26 pages。來源以 node 直接執行 package scripts 等效命令（避免 pnpm 11 launcher 自動下載在受限網路阻塞）：194 tests、check 0 errors／0 warnings／23 hints、20 pages、verify:public 通過。

臨時本地排程資料驗證：已到期 published 文章產生閱讀頁與 RSS；2099 日期的 published 文章不產生文章與主題路由，且不出現在首頁、文章列表、系列列表或 RSS。測試資料均移除，再次建置正式版本。

線上查核：blog-sync.json revision 為上述來源版本；公開 19 篇。部落格系列顯示 19 篇且進行中；19 篇閱讀頁皆 HTTP 200、RSS 19 項皆包含；Day 20 路由 HTTP 404。

workflow state 為 active，main 已含每小時第 37 分鐘排程。本次驗收是 push 觸發的完整部署；尚未等到下一次 schedule 事件，GitHub 定時器可能延遲或略過，不保證準點發布。日期比較為 Asia/Taipei。外部同步失敗會停止整個部署，本地新文章亦因此延後。

正式操作文件：https://github.com/gcake119/gcake-dev/blob/main/docs/article-scheduling.md。

原本兩個工作目錄仍有未提交工作且未拉回新 main，避免破壞其他對話的變更；後續提交或部署前須整合遠端版本，不可直接推送舊基底。先前 ithome-sync-handoff.md 的「未部署」描述是本機階段歷史狀態，以本紀錄為準。

## 完賽收尾修正

Codex heartbeat automation「鐵人賽完賽後停止外部同步」已刪除，改由 GitHub Actions 自動處理。

正式版本：8f5f0f613a4d105fa99db24b5d90643fd9640606。
Actions：https://github.com/gcake119/gcake-dev/actions/runs/36258859612。

每次先讀取自身 GitHub Pages 的 ithome-snapshot.json。active 才抓取來源；完整30篇 completed 成功部署後，後續只核對並恢復此快照，來源請求數為0。保留每小時本地草稿排程，不新增 GitHub 寫入權限或秘密。自身快照損壞或不可讀時停止部署，避免退回舊快照；來源完賽後不可用不影響本地建置。

驗證：8項測試通過，包含完成30篇後来源離線、不完整／損壞快照不得重抓來源；check 0 errors／0 warnings／10 hints；build 26 pages；線上目前19篇 active 快照均帶有SHA-256。完賽分支為模擬測試證據，目前尚未實際完賽。
