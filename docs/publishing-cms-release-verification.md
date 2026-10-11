# Publishing CMS 長期排程本機驗證紀錄

日期：2026-10-11。基底：`feat/publishing-cms-release-design`，`dd1b9de`。成果工作目錄：`/Users/caiyijun/project/gcake-dev-release`。主 checkout 的既有未提交變更未納入本次實作。搬移後已再次通過完整 test／check／build／build:workspaces；詳細 log 位於 `output/release-verification/`。

## 驗證範圍

Spectra change：`integrate-durable-release-queue`。先完成 requirement 與 Given／When／Then，再產生 tasks；接受交接文件既定政策。新增持久化候選／承諾、原子 Git 發布、獨立公開驗證、CMS API／介面、Actions orchestration 與外部 poller。正式發布 gate 各環境仍為 false，Actions 必須額外明確設定 true 才執行。此段為最初交付快照；最新合併前修正已移除 Pages 第 37 分鐘 hourly 與 push 部署，Worker／Pages 僅 main 人工觸發，見文末。

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

## PR #9 CI 補強

原因：Actions 已啟用，既有 workflow 僅 main 部署、schedule／workflow_dispatch，沒有 pull_request trigger，所以原 head 沒有檢查。新增 `validate-pr.yml` 對 main 目標的 PR 執行完整 gates，不限制 paths；只有 contents read，checkout 不保留認證、無 production environment／secrets／部署步驟。

既有 foundation 測試新增 PR 檢查完整性與無部署授權的回歸情境，先觀察缺少 PR workflow 的 RED，再新增流程達成 GREEN。推送前完整本機執行 frozen-lockfile 安裝、221 Node／4 Python tests、check（144 files 零 errors／warnings／hints）、build:all、release:dry-run 及 diff whitespace check 通過。線上 CI 結果以 PR Checks／Actions run 為準；不把本機通過當成線上成功。正式發布 gates 未變更。


## PR #9 合併前修正與部署隔離

依最新使用者指示修正非發文日 legacy publishedAt 錯占下一個 slot。回歸測試在修改程式前重現：週二 10/13 讓第二篇估算從 10/15 錯移到 10/19。修正後，週二、週六及 UTC 週一晚間（台北週二）不占位；UTC 週三晚間（台北週四）仍保留該週四。舊 publishedAt／source 不改。

Worker／Pages 的 push 部署與 Pages 每小時第 37 分鐘部署均移除，只接受 workflow_dispatch，所有 jobs 限 main。兩個 workflow 回歸測試各自在修改前因 push／schedule 觸發而 RED，修正後 GREEN；focused tests 26／26。PR CI 繼續自動執行，沒有部署權限。Editorial 每小時公開查核保留既有停用 gate，不是 Pages 部署。

完整本機結果：225 項 Node／4 項 Python tests；check 144 files 零 errors／warnings／hints；build:all（32 公開頁面與全部 workspaces）；release:dry-run 與 git diff --check 全通過。模擬 bodyAndOrderPreserved=true、productionEnabled=false，Telegram 為 stub，未使用遠端 migration 或部署。與此前 PR head 3364f7b 比較，src/content 沒有變更。

Spectra validate 無 errors／warnings。三個唯讀 AI review（契約、安全、預設／混淆）未發現程式阻塞；review 發現本文件殘留 hourly 保留說法，已修正並送回複查。本機 RED／GREEN 與完整 gates logs 位於 /private/tmp/gcake-premerge-{red,green,test,check,build,simulation}.log。線上 CI 以 PR #9 最新 head 的 Checks／run 為準，不能用本機結果替代。

尚未完成或授權：合併、Worker／Pages 人工部署與遠端 D1 migration、provider 真實發布／公開驗證、Hermes／Telegram、正式自動部署串接及最後發文 gates 啟用。現在人工部署不等同無人值守交付；正式自動發文啟用前必須另行設計、授權與驗證 deployment 串接。既有 Computer Use 介面驗收紀錄保留，本次未宣稱新增介面或 production 驗收。


## 2026-10-12 正式 owner 登入修正（待外部 callback 確認）

PR #9 已合併並完成 Worker／Pages 人工部署（run 38155346370／38155350826）；D1 先備份，再套用 0006。health 200 不證明 owner 登入可用。使用者實際登入遇到 RUNTIME_NOT_CONFIGURED。

唯讀查核 production 三项 secrets 名稱均存在，但 OAuth client ID／owner ID 不在 runtime；前一個 production 版本也缺少，因此不宣稱本次部署清除了秘密。preview live bindings 與 GitHub 已登入 owner 身分核對一致後，將非秘密 client／owner 設定寫入 preview／production vars，避免後續部署遺失。OAuth App 目前只登記 preview callback；程式 authorization／token exchange 原本未傳 redirect_uri，需明確指定起始 CMS 的同站 callback。

先以真實 entrypoint 回歸重現兩個 RED（缺 deployment vars、缺 callback），再修正為 GREEN 16／16。完整 227 Node／4 Python tests、check 144 files 零 errors／warnings／hints、build:all、release:dry-run、diff check 通過；三面向 AI review 無重要 findings。模擬仍 productionEnabled=false、正文／篇序保留，未讀取任何秘密值。

尚待：GitHub OAuth App 新增精確 production callback（保留 preview、wildcard 關閉）。依 Computer Use 規則，新增可信憑證接收端屬安全敏感存取變更，必須在提交前取得使用者即時確認。程式與設定修正可供 PR review，但尚未部署或完成真實 owner 登入，不宣稱錯誤已解除。正式發文 gates 仍 false。

## 正式啟用延伸 — 2026-10-12

使用者明確授權条件式 Pages delivery、paired automation secret、完整驗證後合併／人工部署／啟用。runner acceptance RED 3 pass／2 fail，GREEN 5 pass；workflow safety RED 8 pass／1 fail，GREEN 9 pass；異版部署誤關聯 regression 先 RED 後 GREEN。最新完整 `pnpm test` 234 Node／4 Python 全部通過，`pnpm check` 145 files zero errors/warnings/hints，`pnpm build:all` 通過，`pnpm release:dry-run` 正文／篇序不變、page/RSS 成功、通知只為 stub、productionEnabled=false。`git diff --check` 通過。

Spectra CLI 在此 Git worktree 中解析錯誤根目錄，使用私有 `/private/tmp/gcake-release-spectra-check` 規格副本執行 instructions/analyze/validate，未改動髒 main；analysis 四維 Clean、validate valid。`.spectra.yaml` 明確指向既有 openspec。

Spectra audit 三個獨立 AI 審查完成。P2：CMS 原本附上另一 revision 的人工部署觀察，已以同 SHA 關聯檢查／回歸測試修正並兩位 reviewer 複查關閉。剩餘已明示限制：CMS 未直接追蹤 editorial workflow deployment metadata，查看該次 Actions build/deploy；公開判定由頁面／RSS獨立證據完成。

Provider 查核：editorial-release environment main-only；正式 CMS App 只選 gcake119/gcake-dev，Actions/Metadata read、Contents read/write，無新增 App 權限。Actions URL/secret 已配置；正式 Worker secret／gate、合併後 CI／部署與 controlled no-op 驗證另以後續生產查核紀錄更新，不用本機結果冒充正式上線。


## 正式啟用完成紀錄 — 2026-10-12 01：44（Asia/Taipei）

本段取代此前「正式發文尚未啟用／待授權」的狀態敘述。使用者已明確授權補齊、驗證後啟用。PR #12 於 01：41 合併，部署來源為 f2cf3a8fed1c2613bc584541e732fc29cee48ec0；最新候選 c554258 的必要 CI validate 通過（run 38160597474）。本機完整 234 Node／4 Python tests、check、build:all、release:dry-run 與三面向 AI review 證據見上方啟用延伸。

Worker 已人工部署，版本 4b93b235-0810-4891-9813-b5a2379133df；RELEASE_WRITE_ENABLED=true。Actions repository variable RELEASE_AUTOMATION_ENABLED=true；editorial-release environment 限 main，Worker／Actions 共用 secret 已配對。停用 gate 時真實請求回應 RELEASE_DISABLED，證明憑證通過但寫入仍被阻擋。OAuth／preview 設定保留，其他 providers 仍停用。

正式 controlled workflow run 38160839881 成功：release 成功，build／deploy 均 skipped；當時尚未到 07：00，沒有新增 publication commit，也沒有部署 Pages。production health 200；Computer Use reload 後 owner gcake119 仍登入，介面顯示「正式發布已啟用」、六篇 ready、首篇〈我是怎麼跟 ChatGPT 協作寫完 30 篇系列文的〉估算 10/12 週一 07：00起。接續日期為 10/15、10/19、10/22、10/26、10/29；遵守台北週一／四、一時段一篇。正文與篇序保留。

這是「已啟用與正式空巡查通過」，不是「首篇已公開」。啟用前六篇頁面 404、RSS 未包含六篇；首次真實 publication → Pages build/deploy → public page/RSS 的完整生產證據仍待到時觀察。一般合併不部署；每小時巡查只在新發文提交時觸發 Pages。若建置失敗，重跑原 run 的 failed jobs，未知 Git 寫入結果先查核原身分，不重新發布。

剩餘人工／授權界線：首篇實際頁面與 RSS 可讀性驗收；需要時人工處理未知寫入或失敗部署；Hermes 安裝、Telegram 收件驗證及外部 provider 發布仍未啟用、未包含本次授權。公開驗證由 CMS 與頁面／RSS 判定，editorial 部署紀錄查看 Actions，CMS 不宣稱舊人工部署證明新 editorial 部署。

證據：PR https://github.com/gcake119/gcake-dev/pull/12；CI https://github.com/gcake119/gcake-dev/actions/runs/38160597474；正式空巡查 https://github.com/gcake119/gcake-dev/actions/runs/38160839881。啟用 UI 截圖保存在本次 Codex visualization 的 production-release-enabled-20261012.png。隨後 main 的 PR #13 僅修正本機 dry-run fixture，Worker／editorial workflow 無差異，不需再次部署。


### 最終複查更正：啟用尚未完成

上方 01：44 紀錄只代表當時快照，不能當成持續啟用或目前排程正常的結論。最後複查發現 repository RELEASE_AUTOMATION_ENABLED=false（updated_at 2026-10-11T17:43:59Z）；Worker RELEASE_WRITE_ENABLED 仍 true，因此正式 Actions 自動排程目前停用。run 38160839881 的成功空巡查證據仍有效，不代表開關持續保持 true。

後續 main 26b304c（PR #11，2026-10-12 01：47 合併）將系列第４篇〈正式開賽後，我怎麼知道自動發文真的完成了？〉與 manifest 同篇狀態改為 published，人工 Pages run 38161118291 成功。這是另案內容發布，不是本次自動流程發文，也不是本次改動正文／篇序。Computer Use reload 看見五篇 ready、一篇 published，系列不完整／檔案與狀態不一致，尚無候選／預計時段；既定中途發文防護正常阻擋自動排程。

原本的六個估算日期目前已失效。7.3 重新標為未完成；交接 PR #14 保持未合併。已向使用者提出政策決定：是否保留已公開第４篇，依原篇序排其餘五篇，並授權協調另一對話仍要求停用的指示。未取得決定前，不重啟 Actions、不撤回已公開文章、不修改系列排程政策。Worker／Actions 尚未形成可正式啟用的一致狀態；需完成此阻塞後重新驗證並更新結論。


### 第４篇撤下及原序正式啟用完成（2026-10-12）

使用者選擇「將第四篇隱藏，恢復原有排序」。PR #14 已合併為 d29466ce4c2a55d9fa29e92e04aefa26e198e05a；本機完整 234 Node／4 Python tests、check 145files零診斷、build:all、release:dry-run、diff check及三面向Spectra audit通過，必要CI 38161803064成功。正文六篇SHA-256与原manifest完全一致，未改閱讀順序。

人工Pages run 38161908028成功且head為d29466c；真實第４篇網址HTTP404、RSS HTTP200且不含該篇。Computer Use確認六篇ready、0篇需處理，原序估算10/12、10/15、10/19、10/22、10/26、10/29，每週一／四07：00起，Asia/Taipei；第４篇仍在第四順位。未放寬中途發文防護。

重新人工部署Worker，版本8a499d11-7bd3-4d73-b36f-6d2aa0466e5d，保留正式OAuth／preview設定及其他provider停用狀態；UI確認RELEASE_WRITE_ENABLED已啟用。Repository RELEASE_AUTOMATION_ENABLED=true；正式巡查38162097114成功，release成功、build/deploy skipped，結束後再次API確認Actions gate仍true，沒有巡查後自動關閉。此段取代上方最終阻塞狀態，Spectra7.3已完成。

首次到時publication→Pages→公開page/RSS的完整生產結果仍待實際執行；空巡查成功不代表首篇已公開。Hermes／Telegram未啟用，仍須另行授權。既有CMS部署banner可能延遲，不以其顯示取代Actions run及公開頁面/RSS證據。證據截圖：production-original-order-enabled-20261012.png（本次Codex visualization）。
