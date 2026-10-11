# Publishing CMS 長期排程本機驗證紀錄

日期：2026-10-11。基底：`feat/publishing-cms-release-design`，`dd1b9de`。成果工作目錄：`/Users/caiyijun/project/gcake-dev-release`。主 checkout 的既有未提交變更未納入本次實作。搬移後已再次通過完整 test／check／build／build:workspaces；詳細 log 位於 `output/release-verification/`。

## 驗證範圍

Spectra change：`integrate-durable-release-queue`。先完成 requirement 與 Given／When／Then，再產生 tasks；接受交接文件既定政策。新增持久化候選／承諾、原子 Git 發布、獨立公開驗證、CMS API／介面、Actions orchestration 與外部 poller。正式發布 gate 各環境仍為 false，Actions 必須額外明確設定 true 才執行。既有 Pages 第 37 分鐘 hourly workflow 未修改。

## 本機結果

- `pnpm test`：公共網站 38、workspace foundation 10、合約／apps 172，共 220 項 Node 測試通過；另有 4 項 Python Hermes 測試通過。包括 SQLite CAS 競爭、完整／不完整系列、固定占位、未知回應、來源衝突、safe retry、日期／GUID、歷史 readiness、身分保留、owner／CSRF 與禁用 gate。
- `pnpm check`：0 errors、0 warnings、0 hints。
- `pnpm build`：成功，32 個公開頁面；ready 六篇沒有被提前公開。
- `pnpm build:workspaces`：全部 workspace build 成功。
- Wrangler local D1：在獨立 `/private/tmp/gcake-release-d1-local` 套用 0001–0006，全數成功；未使用 `--remote`。
- `wrangler deploy --env production --dry-run`：完成 Worker／assets 打包，輸出確認 RELEASE_WRITE_ENABLED=false；沒有上傳。
- Spectra validate 通過；analyze 的 coverage／consistency／ambiguity／gaps 均為 0 findings。

## TDD 與 AI review

保留本機 RED／GREEN log：最初缺少整合模組、前篇驗證未知仍跳篇、taxonomy 錯誤、固定日期與暫停邊界、解除承諾丟失身分、延遲 ingestion 破壞 FIFO，都先重現失敗再修正。沒有補造過去未曾執行的 RED。

依 spectra-audit skill 執行三個唯讀 AI review：契約／順序、安全／未知結果、預設／停用開關。修正已重現的問題後再複查，未留下確定的重要阻塞。AI review 不等同人工介面或生產驗收。

## 實際部署模擬

`pnpm release:dry-run` 產生一次性 repository，使用真實六篇與 manifests、全部 SQLite migrations、同一 release delivery、原子 Git commit 及實際 Astro build。只在 loopback 服務讀取產生的 HTML／RSS；canonical URL 保留正式格式，但沒有存取／部署正式站點。通知 transport 注入本機 stub。

最後成功模擬：`gcake-release-simulation-eulb0b`，commit `52f4dd3744a0e6210dcd188c9b6653dc96f1b444`，第一篇 `ithome-2026-chatgpt-writing-workflow`。page=true、GUID 為 matching canonical URL、六篇 body hashes 與 manifest 閱讀順序相同、重複 execute 不重發、poller 重啟後 sends=1。完整 evidence.json 位於該一次性資料夾，摘要另保存於本文件旁的 evidence 目錄。

GitHub App 真實寫入、Actions 真實執行、Cloudflare 遠端 D1／部署、正式 public URL 與 Hermes／Telegram 收件，都尚未驗證。

## 介面驗證

Playwright 操作真實 build 的 Admin，後端使用真實 ReleaseQueue／ReleaseApi 與一次性 SQLite；Git save 僅更新記憶體，沒有 provider 呼叫。已確認：

- 1440px 桌面與 390px／320px 手機；橫向 scrollWidth 等於 clientWidth（375／305，包含系統捲軸）。
- 六篇按照預計發布與 manifest 次序呈現；第一篇暫停後，後五篇顯示前篇資格阻擋；恢復後重建估算。
- 固定時段 preview／confirm／cancel，以及非週一／週四日期的中文拒絕訊息。
- 執行紀錄空狀態、系列定稿 6／6 與公開 0／6、文章明確定稿動作／只讀估算、鍵盤 Tab 焦點。
- 模擬 queue API 503 的中文錯誤，以及恢復後重新整理。

截圖保存於 `output/playwright/`，屬本機 QA 證據，未作為 provider 驗收。

## 六篇保護與必要修正

六篇正文 bytes／SHA-256 與基底相同，manifest bytes／篇序未修改。僅修正 `ithome-2026-template-hardening.md` frontmatter 的既有無效 topic `automation` → 現有 taxonomy 的 `development-automation`，以解除原分支 build 阻塞；新增 taxonomy 回歸測試。未改正文、標題、status 或閱讀順序。

## 人工邊界

需要人驗收／授權的完整項目見 `publishing-cms-release-operations.md`：介面操作、PR 合併、遠端 D1 migration／Worker、GitHub App／受保護分支、Actions secrets／environment、真實非正式發布測試、Hermes 使用者／Telegram、最後 production gate。以上仍為待驗收／待授權，不是完成。

## 2026-10-11 人工驗收回饋與修正

使用者確認定稿、排程、暫停／恢復（第 1–3 項）可正確執行；指定時段預覽（第 4 項）於後續使用者回覆確認可正常執行。

原始互動的表單位於整份排程下方，按鈕只建立表單，未移動視窗或預填日期。透過真實管理介面的瀏覽器驗收斷言重現 RED：點擊測試文章「指定時段」後，日期欄位 focused=false、visible=false、value=''。

修正後以同一瀏覽器斷言驗證 GREEN：focused=true、visible=true、value='2026-10-12'。輸入 2026-10-19 並預覽，顯示影響 3 篇與各篇前後時段；沒有確認固定、沒有啟用正式發布。變更日期也會清除舊預覽，避免確認過期結果。這是本機 QA 證據，不是第 4 項人工驗收。

後續依使用者視覺回饋，沿用既有 token 與水平分隔，整理發布總覽、文章標題／時段／次要狀態、時段調整區；將每篇重複 Telegram 說明整併至清單註解。預覽以文章標題及原時段／調整後分欄，手機改為上下排列。Admin 37 tests、Astro check 142 files（0 errors／warnings／hints）、Admin build、diff whitespace check 通過。真實瀏覽器 390px 檢查 scrollWidth=clientWidth=375，預覽結果與確認按鈕可見。確認固定與取消固定尚待人工操作；正式發文持續停用。

依使用者「用 computer use 驗收」指示，代理透過本機瀏覽器實際點擊確認固定、重新整理排程、重新載入頁面及取消固定：

- 確認固定後，測試文章保留於 2026-10-19 07:00；前兩篇系列文章改為 10/12、10/15，與預覽一致。重新整理與重新載入後仍保留。
- 取消固定後，測試文章恢復 10/12，前兩篇系列恢復 10/15、10/19；再次重新整理後維持結果。
- 正式發布尚未啟用，所有操作僅本機驗收資料。

本段為 Computer Use 代理操作驗證通過，並非使用者親自操作之人工驗收或生產環境驗證。截圖：cms-fixed-confirmed.jpg、cms-fixed-cancelled.jpg（當日本機 visualization 證據目錄）。

## 最終驗證與 AI 複查（介面修正後）

完整 `pnpm test`：220 Node tests、4 Python tests 通過；`pnpm check`：144 files、0 errors／warnings／hints；`pnpm build:all`：Astro 32 頁與全部 workspace build 通過；`pnpm release:dry-run` 通過；`git diff --check` 通過。最後 logs 位於 `/private/tmp/gcake-final-{tests,check,build,dry-run}.log`，另複製至 `output/release-verification/`。

三個唯讀 Spectra Audit review 查核契約、安全、預設與交接邊界。兩個重要問題以 RED→GREEN 修正：晚回預覽跨文章／日期覆蓋，以及有 release 紀錄時單篇／系列暫停狀態混淆。新增 generation guard 與明確 scope 暫停 flags，相關 19 tests 通過；契約複查關閉兩項 findings。系列計數改稱「Git 已標記公開」，停用說明修正為 Worker 阻止寫入、Actions 僅停止排程；沒有新增啟用權限。安全 review 未發現重要問題。

最後重啟最新版 QA host 後，Computer Use 再次完成測試草稿定稿、指定 10/19 預覽、確認固定與重新整理（10/19 保留）、取消固定、暫停／恢復、再次重新整理（10/12 恢復）。正式停用訊息持續可見。截圖 `cms-final-review-acceptance.jpg`。晚回預覽與有承諾紀錄的雙 scope 暫停邊界以自動回歸測試驗證，未宣稱 Computer Use 覆蓋網路延遲競態。最終三個 reviewer 已完成；兩項程式與一項文件 finding 已複查關閉，未留下確定的重要阻塞。六篇正文與 manifest bytes 再次對 HEAD 和保存 hashes 比對一致。

本次交付已取得使用者對 atomic commits、指定分支推送及 PR 建立的明確授權；不包含合併、部署或正式發文啟用。提交分組：規格、taxonomy、持久化佇列、Worker／Actions、Admin、Hermes、本機驗證工具、交接證據。

可供 PR reviewer 查看之截圖副本：

- [手機資訊分區](publishing-cms-release-evidence/cms-hierarchy-mobile.jpg)
- [固定並重新載入後](publishing-cms-release-evidence/cms-fixed-confirmed.jpg)
- [取消固定後](publishing-cms-release-evidence/cms-fixed-cancelled.jpg)
- [最終修正後再次驗證](publishing-cms-release-evidence/cms-final-review-acceptance.jpg)
