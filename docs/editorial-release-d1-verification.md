# D1 單一正式佇列驗證

日期：2026-10-12。候選分支：`feat/editorial-release-queue`，PR ＃7。D1 是唯一正式排程狀態；Git 保存文章與 manifest。此報告是本機／CI 證據，不代表正式 Worker 已部署或人工驗收完成。

## TDD 與整合結果

真實 RED→GREEN 覆蓋：連續 ready FIFO、退稿後恢復且最終 blob 相同、main first-parent 可見時間、完整系列 membership、最近已到週一／四 07:00 時段、active series 衝突及 pause/resume、寫入前來源摘要與公開版本不一致、Git journal 退役與舊 journal 阻擋、D1 開關稽核、部署前 main SHA 變更。CLI 最初的載入器錯誤不列為產品 RED；修正測試啟動方式後另行觀察舊 CLI 的 Git 存取失敗，再完成 GREEN。

完整本機驗證：

- `pnpm test`：277 個 Node 測試與 31 個 Python 測試通過。
- `pnpm check`：151 個檔案，零錯誤、警告與提示。
- `pnpm build:all`：網站、CMS、Worker 建置通過。
- `pnpm release:dry-run` 與 `pnpm editorial:rehearse`：一次性 SQLite／內容副本、真正 Astro 靜態站點與 loopback HTTP 演練通過。
- actionlint 與 ShellCheck：所有 workflow 通過；未安裝的 pyflakes 不列入驗證。
- Worker production `--dry-run`：本機打包通過，未部署；設定中的 RELEASE_WRITE_ENABLED=false。
- Spectra 兩個相關 change 驗證通過，Git diff whitespace 檢查通過。

隔離演練先確認六篇未公開／不在 RSS，再模擬一次 Git publication。建置失敗後以同一 release ID 恢復，Git 寫入仍為一次；公開頁面 digest 與 RSS 驗證通過。Hermes dry-run 首次一筆、重複零筆；測試 transport 只呼叫 loopback 模擬 API 一次，重新啟動仍不重複。真實 Telegram 呼叫零次，正式資料庫寫入零次。六篇正文與閱讀順序逐篇比對不變，儲存庫的六篇正文與 manifest 沒有 diff。

## 安全審查與限制

Git journal CLI 已成為不存取檔案／網路的退役入口；舊 state module 及 Pages prepare/confirm writer 移除。發現舊 journal 時停止並要求人工對帳，不自動搬入、刪除或重播。D1 CAS／lease 保留既有身份及承諾；未知結果阻擋新發布，缺少摘要的歷史 pending 必須人工對帳。History 查核有 1000 個 first-parent commit 上限，超限或 provider 失敗皆停止。

D1 Pages 部署前以唯讀 token 再核對 main SHA；這不能提供跨 GitHub／D1／Pages 的原子鎖，仍需部署競爭及停止／恢復驗收。測試 transport 及私人 DB 隔離維持現有防護，本次沒有真實 token、chat ID 或推播測試。

## 剩餘人工／provider 驗收

- 核對並備份正式 D1 的既有 release records、lease、pending 與 audit；若有舊 Git journal，保存證據後逐筆對帳，不重播。
- 另行核准候選 Worker 部署及正式狀態相容性驗收；無新增 SQL migration，但 optional runtime 欄位及缺摘要的 pending 仍需檢查。保持 RELEASE_WRITE_ENABLED=false。
- 核對 RELEASE_AUTOMATION_SECRET 的 Actions→Worker 身份及權限；先前唯讀 App 私鑰驗收未涵蓋這條 D1 接法，不再沿用已消耗的單次授權。
- 核對實際 CMS Worker App 與 main PR 保護例外、部署競爭、停止與未知結果恢復。
- 完成桌面／手機畫面與六篇原稿簽核；本機靜態演練不代替人工簽核。
- 查核 Hermes hourly dry-run 的自動執行紀錄、帳號／腳本權限；私人 Telegram 收訊須另外明確授權。

PR 維持未合併；EDITORIAL_RELEASE_ENABLED=false、RELEASE_AUTOMATION_ENABLED=false，editorial-release environment 維持 main-only，正式 Worker RELEASE_WRITE_ENABLED=false，Telegram 正式推播維持停用。
