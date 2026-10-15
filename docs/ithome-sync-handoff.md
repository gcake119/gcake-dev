# 鐵人賽文章站同步交接（歷史證據）

## 歷史證據範圍（2026-10-13 整理）

本文保存 2026-09-27 同步工程的原始交接／部署與後續收尾紀錄。下方版本 SHA、Actions 連結、測試數量、公開查核與限制均保留原文，代表各自記錄時點的證據；本次未重查遠端 Actions 或重新驗證當時部署。

其中「19 篇」、「尚未部署」、「尚未完賽」、舊工作目錄基底或 workflow 啟用狀態，不得當作目前狀態。原始鐵人賽目前保留 30 篇 completed 完整快照；固定 revision、逐篇 SHA-256、原子替換、失敗停止部署與禁止回退舊 19 篇的現行規則，見 [外部內容文件](external-content.md)。幕後系列已完稿並開始排程連載，見 [發布文件](publishing.md)。

文章公開時間與 Pages 自動部署規則見 [文章排程文件](article-scheduling.md)。較早提及的「恢復每小時及 push main 部署」候選，僅代表其記錄時點的本機狀態；目前是否啟用須另查對應版本與實際執行證據，不能由這份歷史紀錄推定。

## 原始紀錄（歷史原文）

範圍：本機工程實作，無提交、推送、部署。保留部落格既有重設計，未調整視覺及關於文案。

既有決策文件為 docs/architecture.md、docs/external-content.md，兩專案未找到 AGENTS.md 或 docs/decisions ledger。沿用外部正文與 canonical 由來源擁有的規則。新決策為「讀取部署後清單並按指定 revision 同步、每小時輪詢」，記錄於 external-content.md；不擴大 repository 權限。

來源基底：94e581ca0e4fca29d08f88989a0c2adbb6383621，新增 src/pages/blog-sync.json.ts。
部落格基底：54cf82058e64229be6b0dcd784ea47b92cbab24b，原已有大量未提交設計工作。

本次部落格範圍：.github/workflows/deploy-pages.yml、scripts/external/*、src/data/external/ithome-2026.generated.json、src/lib/content/external.ts、src/lib/content/catalog.ts 的來源狀態接線、src/content/series/ithome-2026.yaml 移除本地 publication 日期，以及 package.json 擴充 test 命令、相關文件。catalog.ts、YAML、package.json 都含原有工作，提交時不可把整個檔案視為只屬於本次同步。

本機驗證使用來源建置輸出的清單與本地正文，核對公開 19 篇皆有來源閱讀路由。公開 HTTP 端點與 GitHub 排程尚未驗收。啟用順序與失敗處理見 external-content.md。

驗證結果（2026-09-27，台北）：

- 來源：pnpm build 通過（20 頁）；pnpm check 為 0 errors、0 warnings、23 hints；pnpm test:ithome 188／188；pnpm verify:public 通過。
- 部落格：pnpm test 6／6；pnpm check 為 0 errors、0 warnings、10 既有 hints；pnpm build 通過（25 頁）。空本地 posts 集合仍有既有建置提示。
- 本機來源 manifest、部落格 19 個 Day 路由與 RSS 19 個項目完全一致；未來 Day 不產生閱讀頁。
- 模擬同步 CLI 收到正文 HTTP 503：拋出錯誤，既有快照內容維持不變。
- 兩 repo 的 git diff --check 通過。

補齊 src/pages/rss.xml.ts：改讀同一 reading catalog，原本 RSS 只含本地文章，現納入公開外部篇目。src/pages/series/ithome-2026/[post].astro 僅移除第二次日期判斷，以來源部署清單決定路由，保留原設計。
