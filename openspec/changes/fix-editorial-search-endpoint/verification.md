# 公開搜尋建置接線驗證

正式 HTML 的 data-semantic 為空，現有 repository variable 則為正確的正式 /v1/search；自動發布建置未傳入它，手動發布建置已有傳入。既有 Pages workflow 契約新增案例先因自動建置缺值失敗，修補後７案通過。這是造成真實故障的建置邊界檢查，沿用原測試入口，不增加測試平台或 CI 工作。

完整 pnpm test、pnpm check、pnpm build:all、pnpm release:dry-run、pnpm editorial:rehearse 通過；Spectra validate／analyze 無問題。另以實際 Astro 建置核對預設端點空白，以及設定既有端點後 HTML 正確。與當期公開資產逐篇比對，３８篇文章 ID 及 sourceRevision 完全相同。此時仍未發布網站，也未進行此候選的正式語意驗收。

原始 RED／GREEN、完整 gate、兩份實際建置 HTML 與逐篇清冊存於 ignored output/discovery/index-status-release/endpoint-*。正式查詢與來源讀回另存原工作目錄的 index-resume-20261030；不提交查詢、IP、secret 或向量值。
