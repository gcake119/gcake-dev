# 私密錯誤階段識別：本機驗證

本次依使用者授權，在 main `35cc2f8` 的獨立工作樹增加５０３固定診斷資訊，尚未 commit、推送或部署。這不還原或修復先前無完整證據的單次５０３，只讓後續由 Worker 產生的錯誤能定位階段。

回應新增 `diagnostic: {requestId, stage, reason}` 及相同 `X-Search-Request-Id`。stage 區分 request、configuration、policy、source_initial、admission、embedding、vector、ranking、source_final；reason 區分 failure、timeout、invalid_response、ineligible。UUID 為每個請求獨立產生，不接受客戶端識別。沒有新增 console、診斷資料持久化或第三方服務，也不回傳上游 exception 文字。既有額度的短期帶密鑰識別及來源下載／語意期限不變。

## 驗證

- 規格先補 requirement 與四組 Given／When／Then，再建立任務１４．１／１４．２。
- 十個新增 semantic/runtime 情境先因缺少診斷欄位出現真實 assertion 失敗，保存 RED；實作後同十項 GREEN。完整 Worker 測試５４項、client 測試６項通過。
- 驗證來源前／後核對、額度預留、模型、向量依賴錯誤；實際兩秒來源下載逾時與五秒語意期限，逾時後不續查向量；並行失敗各自保留階段與不同 UUID。注入查詢、IP、secret、caller ID 及 stack canary，均未出現在錯誤回應。
- 模型輸出不合回固定原因；額度不足仍４２９且零模型呼叫；既有停用／過期／未知結果不退額度測試保留。runtime 的 CORS／no-store 與無效路由／輸入契約保留。來源輸出及 timeout 的既有操作例外識別仍可供前景工具辨認，公開回應只帶固定代碼。
- diagnostic ５０３保留當期關鍵字文章、查詢及重試，不向讀者顯示診斷欄位、不自動重送；明確重試後恢復語意結果並隱藏重試。
- 完整本機 gate：`pnpm test`、`pnpm check`、`pnpm build:all`、`pnpm release:dry-run`、`pnpm editorial:rehearse` 全數通過。Node ２４．１９．０及現有 Python ３．１２環境；沒有減少測試、放寬斷言或新增 CI。
- Spectra validate 通過，analyze 只有原有 reader-search 規格第６２行的 may 用語建議，未修改既有驗收條件。

[可攜驗證摘要](private-error-diagnostics-20261022.json)保存來源與日誌 digest；原始紀錄在 `output/discovery/search-error-stages-20261022/`。本輪未呼叫雲端模型、未查改正式服務，未變更 Wrangler／migration／依賴／額度／開關；原 dirty checkout 保持原狀。整體３２／３４項完成，１．１歷史紅測試缺口及１２．２首個自然新增文章同步驗收仍保留未完成。

## 操作限制

之後另行授權部署才生效；本機成功不代表正式已更新。請保存失敗回應的 diagnostic、狀態與時間，不整包匯出包含查詢的 HAR。無新的後台日誌，UUID 不可用來反查讀者。若瀏覽器中止、Cloudflare 邊緣或平台在 Worker 回應之前失敗，可能沒有此欄位，仍須平台／網路證據。詳見[操作手冊](../../../docs/article-discovery-runbook.md)。

本次後續提交只整理上述本機候選、規劃、操作文件與驗證摘要；本文及 JSON 的尚未 commit／committed=false 是驗證當時的快照，不代表後續提交失敗。未重新執行模型、推送或部署。
