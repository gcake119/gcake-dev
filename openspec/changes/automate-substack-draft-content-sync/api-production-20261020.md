# 後台唯讀 API 正式部署與驗收

台北 2026／10／20 00：14：31 部署一次成功，Worker gcake-admin-worker-production，新 version 66a6ea7d-8d71-49a7-b91a-67cd2a095f9c，deployment e30bd33f-9475-41e8-bd24-628e7e35897e，100％流量。回復基準 2b8c3127-662a-4463-925e-598925a8e8f8 保留，未執行 rollback。

## 候選與邊界

使用正式 PR38 來源 1f3e8cf413beadc687db0dbb58ad21994aa70a1c 的隔離快照，僅覆蓋 index／router／substack-schedules 的 API 型別與接線、新 substack-draft-api 及測試。不是宣稱該 API delta 已 commit 或進入 main。46 個 Worker 來源檔、contract source 與 pnpm-lock 均逐檔匹配上一輪已完成五項 gate 的 installed media candidate；因此重用相同的本機檢查，不重跑。隔離候選另外完成正確 production dry-run，正式三個 HTML／JS／CSS 與候選逐 bytes SHA256 相同。

正式 vars 與本機預設不同，隔離設定逐項保留原正式 vars，並使用 keep-vars；部署後完整 bindings、plain vars、secret 名稱與 script runtime metadata 比對一致。保留 RELEASE_WRITE_ENABLED=true、SUBSTACK_WRITE_ENABLED=false、PARAGRAPH_WRITE_ENABLED=false；未讀取 secret 值、未新增權限或 migration。持續同步 runtime 未改、allowCreate=false、scheduled.writeEnabled=false。

## 正式證據

- /health HTTP 200。
- 匿名 GET 列表與單篇均 401 UNAUTHENTICATED、no-store。
- 匿名 POST 列表／單篇與 PUT／PATCH／DELETE 單篇五項均 401，未經授權不能寫入。
- 專用 Chrome 正常 GitHub owner OAuth 登入；實際列表六筆、原 ID 221099415 單篇 verified／draft_prepared／not_armed。首頁 limit=1 offset=0 hasMore=true；末頁 offset=5 hasMore=false；無效分頁 INVALID_PAGINATION、不存在文章 ARTICLE_NOT_FOUND。
- 已登入 405、D1 讀取失敗 503 使用相同候選本機測試；本次沒有匯出 Cookie、偽造 CMS session、改正式 binding 或注入正式故障，不能把這兩項說成正式 HTTP 實測。
- 列表及單篇一致，schemaVersion=1，沒有正文、HTML、token、CSRF、intent ID 或私人 session path。
- 六篇原 ID／slug／URL／provider 狀態／時段／email／App／armed／delivered／公開歷史與 intent 逐項不變；私有同步設定 SHA256 不變。正常 OAuth 可建立 session，後台初始化可能更新既有 runtime metadata，故不宣稱全部 D1 零寫入。
- 部署前後三個既有資產 SHA256 完全一致，正式變數、D1／R2 及 secret 名稱均保留。

機器摘要 api-production-results.json；正式前端契約 docs/substack-draft-sync-api.md。私有原件 /private/tmp/gcake-draft-api-production-20261020，權限與 Cookie／secret 不納入 Git；只有遮蔽後摘要回存。部署 snapshot 與 logs 保留，沒有 commit／push／merge 或訂閱者通知。

## 保留的非通過紀錄

初次 build／dry-run 在 primary cwd 執行，未部署且使用的是本機預設 vars；原 logs 標記 superseded-primary-cwd，不作正式候選證據。其後從隔離候選完成正確 production dry-run。Python urllib 的一次 public asset 請求回 403，原失敗不改寫；標準 curl 與 Chrome 正常讀取，curl 才是上述正式 HTTP／資產證據。Chrome JSON viewer 的格式化勾選框不在頁面 DOM，定位器失敗沒有修改 API；之後由實際 AX checkbox 保存格式化截圖。
