# Publishing CMS — 長期發布佇列產品與驗收規格

狀態：設計確認後的實作交接草案。依 2026-10-11 已批准發文政策撰寫，尚未啟用正式排程。

## 產品目的及限制

一般操作為「編輯 → 確認定稿 → Git 安全儲存 → 自動取得候選發文資格 → 預計時段」。取消逐篇手動填發文日期的例行工作；例外才使用指定日期、暫停、重試。不得修改「2026 鐵人賽幕後」六篇內容或 manifest 順序。

- 台北時間星期一、四 **07:00 起**執行，每個時段最多一篇，不保證在 07:00 公開。
- 獨立文章先於尚未完成的系列；獨立文章之間按持久化首次 readyAt FIFO。
- 系列必須完整定稿、檔案全部存在、frontmatter 與 manifest 狀態一致才能排隊；順序唯一來自 manifest。系列啟動後，優先於其它候選系列完成；獨立文章可插入，系列恢復原順序。
- 發文失敗不消費時段，不丟棄任務，不重複創建公開文章。未知公開結果先驗證，禁止無條件再次寫入。
- 預計時段不是承諾時段；當期任務已鎖定後不允許被新文章插隊。完成時段不重算，晚到獨立文章排入下個尚未消費時段。
- 唯一的內容/編輯資料來源為 Git（Markdown frontmatter 與 Series manifest）。D1 只保存 readyAt、時段承諾、鎖、嘗試/驗證/通知等執行狀態。
- 未啟用時，所有 ready 文章仍維持未公開。切勿將 queue planner 結果直接寫入已公開文章 frontmatter。

## 資訊架構（保留現有主要導覽）

1. Dashboard：下一篇預計時段；有無待人工介入；最新公開驗證。無需擴充分析 KPI。
2. Content/Editor：保留既有 draft/ready/published；新增「確認定稿」顯式動作、候選資格理由、預計時段只讀欄位。預設「自動排程」；指定日期為進階操作，需展示占位衝突與後續文章變動預覽。
3. Series Editor：保留 manifest 為篇序 SSOT；顯示定稿 X/Y、公開 X/Y、待完成篇目、缺檔/狀態不一致、排隊資格、連載中/暫停、下一篇及預計日期。開始後排序鎖定；更動未公開部分需經重新驗證與衝突確認。
4. Publishing Center：新增「預計發布」、「執行紀錄」、「需處理」三種視圖；清單欄位為預計時段（Asia/Taipei，標示估算/鎖定）、標題、獨立/系列、系列序號、佇列狀態、GitHub Pages/RSS 驗證與通知狀態。
5. Publishing Detail：以事件時間線顯示 readyAt、佇列規劃版本、時段鎖定、Git 提交 SHA、部署 run、公開 URL、RSS GUID、驗證時間、Telegram 回報與重試紀錄。

## 三種互不混淆的狀態

**內容狀態（Git）：** draft | ready | published。

**本站發布操作狀態（D1）：** waiting-eligibility | queued | committed-slot | publishing | awaiting-verification | verified-public | failed | verification-unknown | paused。這是執行態，不替代 Git status。

**通知狀態（外部監控）：** unobserved | rss-detected | page-verified | sent | send-failed | unknown。未建立 Hermes 經驗證的回報管道前，只能顯示本站可確認的 RSS/URL，Telegram 顯示「外部監控／未回報」，不可偽稱送達。

**狀態名稱:** 中文介面採「草稿／已定稿／已公開」、「待排程／已排程／發布中／待公開確認／發布失敗／驗證異常」、「未通知／已通知／狀態未知」。排程時間已到+部署成功仍須頁面驗證；推播成功不是公開證據。

## 資格判定與持久化契約

輸入來自**同一次 Git commit 快照**：完整 series manifest 集合與 post frontmatter/file 清單。若有任一 planned/draft 或缺檔，系列整組不排；已 published 的部分只作序列定位，剩餘 ready 篇目依序候選。獨立文章在首次從非 ready → ready 且 Git commit 成功時記錄 immutable firstReadyAt。系列在完整驗證通過那次保存 seriesReadyAt（不得以單篇檔案的 mtime 或每次 build 時刻重建）。反覆 ingestion/部署不得改寫 readyAt。

D1 必須有原子化 slot reservation + unique release-slot（Taipei 日期）及 per-article unique public release id；重複 Webhook/GitHub Actions 不得重複取用。Slot 只有 verified-public 才算消費；進行中佔位阻止後續衝突。正式發布時先核對 Git head/revision、再確認未公開、最後寫入 Git publication status 與 publishedAt，與 manifest 同一原子 commit；Git 並行衝突停止並重算。排程觸發不可只根據 ready 日期靜態展示。

舊文章已有手動 publishedAt 的情況先**逐筆分類**：已公開保留歷史、未到期 published 為已預約且占位、ready 舊資料不自動視為已啟用。不要在無採納策略前轉換舊 publishedAt。必要時為手動「指定時段」單獨建持久承諾並納入 reserved slots。

## 預計日期和插隊規則

排程顯示為「預計 10/19（一）07:00 起」而非確定公開時間。新獨立文章加入：不得更動已完成/執行中/人工鎖定時段；在下一個空位消費優先權，未來系列後續日期自動重新預估；不得修改 manifest 篇序，也不必逐篇回寫 frontmatter。畫面在確認插隊前顯示會受影響的篇數及舊/新預計日期。

## 人工操作及防護

- 暫停/恢復候選文章或系列；人工固定時段（需驗證衝突），取消固定；安全重算預覽。
- 「檢查公開狀態」為重試前優先操作；以 canonical URL + 頁面成功回應 + 文章 slug/title/metadata 與 RSS GUID 確認公開。RSS 延遲時區分已驗證頁面、RSS 尚未出現。
- 「重試部署」僅對部署失敗有效，使用原 release id，不創新文章；「重新送 Telegram」只能在已驗證公開且確認未送達的情況單獨執行並做去重。
- 不允許「部署已完成」自動轉成「已公開」；不允許通知成功提升公開狀態。
- 需要可查看事件、錯誤原因、最後驗證時間、下一次重試時間與人工解除鎖定入口（具備安全確認）。

## 漸進落地切分

### P0 — 上線前必備

1. 以 full manifest + Git snapshot 驗證系列完整性，包含已有部分 published 的情境。
2. D1 durable queue ingestion、unique slot 鎖、首次 readyAt、累積進度、重複執行冪等、發布失敗恢復。
3. 對應 CMS API（queue listing、detail、pause/resume、reverify、safe retry、override）和顯示介面（Editor、Series、Publishing）。
4. 具 least privilege 的無人值守 GitHub 狀態寫入路徑；與 CMS/Codex 併發時 fail closed。
5. GitHub Actions 發布 orchestration：週一/四 07:00 後啟動；保留每小時第 37 分鐘的部署復原；測試單時段唯一。
6. 網站 URL 與 RSS 驗證、Hermes RSS poller 及 Telegram 去重（token 和本機 state 不進 Git）。
7. 全功能 dry run、回歸測試、操作驗收後人工啟用 production gate。

### P1 — 之後再做

日曆拖曳、跨系列人工優先級、進階統計、Hermes 驗證回報同步進 CMS、多發文頻率、多位作者。不可為 P1 阻擋 P0。

## 必測案例

1. 部分系列未完成 → 不排；完整六篇才依序安排，原稿和順序不變。
2. 系列第 2 篇後新增獨立文章 → 下一未鎖定時段先給獨立文章；系列從第 3 篇恢復。
3. 兩篇獨立文章：先定稿先排，重新 build 不改序。
4. 已消費、已鎖定、手動預約時段排除；新的文章不能插入過去時段。
5. build 失敗、Git conflict、RSS 延遲、Hermes 重啟 → 不跳篇、不重發、不重複通知。
6. push/儲存 ready 文章不能提前公開；只有 production gate 開啟才能發布。
7. 已公開但驗證逾時 → reverify 找到公開頁後修復紀錄，不能再次 publish。
8. 同一時段雙次 workflow 和兩個 concurrent publisher → 只有一位取得唯一承諾。
9. 文章/manifest 被 Codex 更動 → 重新比對 SHA 並失敗保護。
10. production gate 未啟用時六篇仍保持 ready、不被宣告公開。

## 不可省略的正式部署驗收

執行 `pnpm test`、`pnpm check`、`pnpm build`、workspaces tests；在 dry-run environment 驗證完整 Git publication commit → deploy → public URL → RSS → Hermes 去重；人工確認 Cloudflare D1 migrations、GitHub App secrets、Actions permission、Hermes 本機使用者/Telegram token 後才啟用。
