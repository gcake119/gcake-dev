> 2026-10-12 更新：Pages 先公開，再由 Codex 排程使用側邊瀏覽器無人值守同步。下文早期逐次人工核准與專用 Chrome 指引保留為原方案紀錄；現行流程以 [distribution-unattended-runbook.md](distribution-unattended-runbook.md) 為準。提前公開文章已撤回，歷史審閱版本不可同步。

# 受控跨平台發布操作手冊

本機實作分支：`codex/cross-platform-publish-20261011`。唯一內容來源為 `src/content/posts`，GitHub Pages URL 保持原文 canonical；依 2026-10-12 已接受的方案 3，Substack 全文鏡像採平台 canonical 例外。共用 CLI 使用正式 D1；SQLite 僅用於測試及既有單篇 Paragraph 工具。未接入 Worker HTTP 路由、排程或部署流程。

## 本機驗證與 dry run

需要 Node.js 支援 `node:sqlite`、pnpm，以及已安裝的 Google Chrome。E2E 啟動本機 HTTP fixture，使用真正的 Chrome 與 SQLite D1 相容介面；不連接正式平台。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm check
pnpm build:all
pnpm distribution:run dry-run <slug> paragraph
pnpm distribution:run dry-run <slug> substack
```

dry run 從 Markdown 重新建立內容、版本及平台摘要，輸出 `.distribution-handoff/<slug>-<target>-review.json`，禁止覆寫。此步驟沒有網路寫入。審閱文章、圖片、連結、canonical 與日期後，將 approvalTemplate 複製成獨立本機檔案。只有人在明確授權後才填入 `approved: true`、對應的 `operation`（`prepare`、`publish` 或日期恢復用的 `finalize`）與 `approvedAt`。草稿授權不等於正式發布授權。任何內容或平台變更都須重新 dry run、審閱與授權。

```sh
pnpm distribution:run prepare <slug> paragraph --config /outside/git/distribution.json --receipt /outside/git/review.json --approval /outside/git/prepare-approval.json
pnpm distribution:run publish <slug> paragraph --config /outside/git/distribution.json --receipt /outside/git/review.json --approval /outside/git/publish-approval.json
pnpm distribution:run verify <slug> paragraph --config /outside/git/distribution.json
pnpm distribution:run retry <slug> paragraph --config /outside/git/distribution.json
```

Substack 使用同樣指令，target 換成 `substack`。`retry` 為讀取原操作結果並調和狀態，不會盲目重新建立或重新點擊發布。調和草稿成功後為 `pending`，須另行授權下一次操作。

## 正式設定

本機設定檔放在 Git 之外，設定範例為 `docs/distribution-config.example.json`，所有寫入預設關閉。需要：

- 正式 D1 已套用既有 migrations 及 `0006_distribution_checkpoints.sql`，詳見下方設定準備紀錄。
- 環境變數 `CLOUDFLARE_ACCOUNT_ID`、`DISTRIBUTION_D1_DATABASE_ID`、`CLOUDFLARE_API_TOKEN`（指定 D1 的查詢權限），Paragraph 另需 `PARAGRAPH_API_KEY`。
- Paragraph 刊物 slug、固定官方 OpenAPI commit，以及逐項具備實際證據的 production gate。舊單篇 controlled cohort 不構成一般發布授權。
- Substack 使用 Git 之外的專用持久瀏覽器 profile。不得使用日常 Chrome profile，也不得將 Cookie、Token、登入狀態檔加入 Git。`login substack --config ...` 開啟專用 Chrome，登入由人完成，完成後關閉視窗。In-app Browser 的登入不會移轉到這個 profile。
- Substack UI contract 必須經實際介面確認：完整草稿及已發布文章查找／分頁、儲存、canonical、日期、單次發布及匿名公開讀回。`discoveryVerified` 與 `publishingCapabilitiesVerified` 未有證據前保持 `false`。

## 狀態及恢復

每篇文章每個平台獨立儲存 remote ID、版本、狀態及錯誤代碼。建立、更新與發布前先寫入 D1 checkpoint；checkpoint 未調和前禁止新的寫入。`published` 只表示收到寫入回應，只有公開內容、標題、圖片、連結、所選政策的 canonical 及原文日期都吻合才能成為 `verified`。Paragraph 核對 Pages canonical；Substack full-mirror 核對該平台文章 canonical，並另外核對 Pages 原文連結。

`uncertain` 表示操作可能成功但證據不足。保留原 ID 與 checkpoint，使用相同 Markdown 版本執行 `retry`／`verify`；不得刪除 checkpoint 以重發。`manual_required` 表示登入、UI、能力或證據需要人工處理。另一平台的成功不會被回滾。

鎖不會因時間到期自動被接管，以免慢操作同時發布。程序意外死亡時，先證明原程序已停止，再由操作者檢查指定篇／平台的 checkpoint 及遠端狀態，才能受控解除該鎖。不可批次清除鎖或 checkpoint。

## 真實 Substack 觀察與尚未驗收項目

已獲授權建立並儲存不公開的「gcake 跨平台發布驗證」草稿，ID `219884438`。未發布、未寄信。這是 UI 診斷草稿，不是正式文章內容來源，也未宣稱由 Node Playwright 工具完成遠端發布。

觀察到 title textbox、`開始寫作……` body textbox、`已儲存`、`設定`、`繼續`，以及發布對話框內預設勾選的 `透過電子郵件和 Substack App 傳送`。取消勾選後按鈕為 `立即發佈`；並未點擊。SEO 選項只有標題、摘要與 slug，未確認外部 canonical 的設定方式。草稿編輯器未觀察到日期控制。

[Substack 官方日期說明](https://support.substack.com/hc/en-us/articles/360039017132-How-do-I-edit-a-post-that-I-ve-published-on-Substack)描述在發布後修改顯示日期。這不等於目前發布前即可符合原文日期；在需求與真實能力尚未一致前，工具會阻擋正式發布。已發布文章的更新、公開 DOM、查找／分頁及歷史日期尚未在正式平台驗收。

完整瀏覽器 fixture 已驗證內容／圖片／連結／canonical／日期、更新同一文章、重複執行、登入失效、能力阻擋、發布後驗證失敗的唯讀恢復與兩平台隔離；這些結果不等於正式平台驗收。圖片在 fixture 確認載入；真實 Paragraph 的相對資產網址與 Substack 貼上圖片是否重新託管，仍需指定受控文章驗證。失敗紀錄只輸出有限錯誤代碼，尚未加入自動擷取遠端編輯器失敗截圖，以避免保存私密內容；必要時由人審閱並去識別後留存。

正式發布仍需指定篇名／平台／確切版本及明確授權。此工作沒有合併 PR、部署、開啟排程或無人值守發布。

## 最終本機證據

`pnpm test`：199／199 通過；`pnpm check`：136 個檔案，0 errors／warnings／hints；`pnpm build:all`：網站及五個工作區全部成功；`git diff --check` 通過。完整日誌在本機 `/private/tmp/gcake-final-{test,check,build}.log`。

此分支 `src/content/posts` 的六篇文章目前全部為 `ready`，沒有符合既有 `status: published` 條件的正式來源。因此直接對現有文章執行 dry run 會拒絕；成功內容驗證使用測試建立的 Markdown。不可為了試發而自行將正式文章改為 published。下一步須由操作者選定可發布的 canonical Markdown，確認日期與 GitHub Pages 公開結果，再產生該篇正式 review。

Spectra 規格包含正常、失敗及邊界 Gherkin 情境，程式碼前先建立。CLI 在 Git worktree 中解析到原始 checkout；僅將本次新建的 change 移回此工作副本，既有 checkout 變更未處理。正式平台公開驗收任務維持未完成。規格已於搬移前通過 Spectra validate；搬移後 CLI 仍解析原始 checkout，因而回報找不到 change，屬工作副本解析限制。

CLI 額外 smoke test：兩平台均以 `/private/tmp/gcake-cli-fixture/src/content/posts/fixture.md` 成功產出 dry-run review，`externalWriteEnabled: false`。這是測試資料，不是正式來源。

## Substack 深入查核更新

詳見 [canonical 與原文日期查核](substack-capability-verification.md)。發布前日期欄位已確認為僅允許當下及未來的排程；官方支援在發布後回填顯示日期。外部 canonical 尚無可驗證的標準 UI／官方支援路徑。所有正式寫入能力仍關閉，使用者已於 2026-10-12 選擇全文鏡像例外及兩階段日期流程；現行實作與限制如下。

## 已接受的方案 3：全文鏡像與兩階段日期

Substack review 明確包含 `substackPolicy: full-mirror`、`canonicalPolicy: platform-article`、`datePolicy: after-publish-original`，授權檔另含 `substackPolicy: full-mirror`。既有 Substack review digest 已失效，須重新產生。Paragraph digest 與嚴格 canonical 政策不變。選擇政策並不授權正式發布。

發布流程：保存 D1 發布意圖 → 單次取消寄送的網站發布 → 保存日期補改意圖 → 匿名讀回同一篇文章並核對完整內容、圖片、連結、平台 canonical 與有效日期 → 更新同一篇的原文日期 → 再公開讀回全部證據。操作紀錄保存所選政策，不保存正文或憑證。

日期補改失敗保持 `uncertain` 與原 remote ID。`retry`／`verify` 僅讀回；若需要補改日期，須另提供 operation 為 `finalize` 的授權：

```sh
pnpm distribution:run finalize <slug> substack --config /outside/git/distribution.json --receipt /outside/git/review.json --approval /outside/git/finalize-approval.json
```

`finalize` 要求同一版本、同一政策及已存在的發布／日期意圖；不建立文章、不點擊發布。先驗證公開文章，再寫日期。若日期已正確，僅讀回驗證，不再儲存。即使有 finalize 授權，無法確認公開文章內容與身分時也不得寫日期。

正式 UI 設定仍缺已發布文章的 `publishedAt`、`settingsDone` 與公開文章連結 `publicLink` 控制，以及公開頁內容／標題／日期的選擇器與查找能力。範例保留 `publishingCapabilitiesVerified: false`、`discoveryVerified: false`、`writeEnabled: false`，沒有杜撰日期控制。`datetime-local` 配置採 GMT+8（offset 480），日期只能表達分鐘時，原文若含非零秒數／毫秒便拒絕，不會偷偷截斷。

`0006_distribution_checkpoints.sql` 在 2026-10-12 設定階段已套用正式 D1，包含 metadata 意圖與政策欄位。若有人已套用舊版本到別的環境，必須另作保留資料的升級，不能僅重跑檔案或刪除既有狀態。

本機瀏覽器驗證包含刻意延遲自動儲存回應：標題與正文依序儲存，同版本已準備草稿僅讀回，避免舊儲存回應讓流程誤判完成。日期寫入前另核對編輯器內容與 publicLink，必須與匿名驗證的公開 URL 完全一致。錯誤連結會停止，並保留原意圖。

方案 3 的 CLI smoke test 以本機測試 Markdown 成功產出 `/private/tmp/gcake-mirror-substack-review.json`，包含明確 canonical／日期政策，`externalWriteEnabled: false`。未替正式來源產生發布授權。

## 方案 3 最終驗證，2026-10-12

完整測試 207／207 通過；Astro／TypeScript 檢查 136 檔案，零 errors、warnings、hints；網站與五個工作區 Build 成功；diff check 通過。完整日誌：`/private/tmp/gcake-mirror-final-test.log`、`/private/tmp/gcake-mirror-final-check.log`、`/private/tmp/gcake-mirror-final-build.log`。

保留真實 RED／GREEN：mirror policy、舊審閱檔失效、公開日期必須存在、同版本草稿僅讀回、延遲 autosave 回應、日期寫入前的編輯器／公開 URL 身分核對。這些均為本機測試，不是正式平台結果。

Spectra CLI 的 worktree 根目錄限制仍存在；將本次 change 與主規格的原樣副本放到無 Git 的暫存驗證目錄後，`spectra validate` 通過，`spectra analyze` 零 findings。CLI 標記新任務完成後同步 tasks 檔；正式發布驗收任務 6.3 仍未完成。

## D1 與登入準備，2026-10-12

正式 `gcake-cms-production`（`47dad56f-334f-4941-8565-62d43cd6bbde`）已透過既有 Wrangler OAuth 套用 `0006_distribution_checkpoints.sql`。套用前保存 Time Travel 書籤；套用後查核 recovery 表與 migration 紀錄，checkpoint／lock 均為零，沒有建立發布操作。原有 `0005_cms_sessions.sql` 已套用；新增檔案改用 0006，但遠端另有 `0006_release_queue.sql`，D1 以完整檔名辨識，勿更名已套用的檔案。遠端沒有待套用的本分支 migration。

此電腦的私密設定目錄為 `/Users/caiyijun/Library/Application Support/gcake-distribution`，目錄與 profile 權限 0700，設定與 credentials.env 權限 0600。設定沿用已驗證的 Paragraph 刊物 `gcake`，正式寫入及所有未驗證能力維持 false。帳號與 D1 ID 已填入，兩個 API key／token 仍須由操作者在本機填寫。Wrangler OAuth 可完成資料庫設定，但共用 CLI 仍要求獨立的 D1 API token，不複製 OAuth 憑證。

登入現在不需要 article slug、公開文章、D1 token 或發布授權：

```sh
pnpm distribution:run login substack --config '/Users/caiyijun/Library/Application Support/gcake-distribution/distribution.json'
```

只開啟 `https://gcakedev.substack.com/publish/home`，由人登入後關閉視窗保存專用 profile。先前 `login <slug> substack` 語法已移除。專用 Chrome 已啟動，登入是否完成尚待人確認；未複製 In-app Browser Cookie。登入完成後須重新開啟 profile，唯讀確認登入持續有效與刊物身分。憑證填妥後再用共用 D1 REST client 做唯讀權限／schema 查核，這些尚未驗證。

之後 CLI 可使用 Node 的 `--env-file` 載入本機 credentials，避免 token 出現在命令參數：

```sh
node --env-file='/Users/caiyijun/Library/Application Support/gcake-distribution/credentials.env' --import tsx scripts/publishing/run-distribution.ts verify <slug> paragraph --config '/Users/caiyijun/Library/Application Support/gcake-distribution/distribution.json'
```

這只是設定載入範例，不應使用不存在或尚未公開的 slug 執行。文章選定、真實日期／公開 DOM 控制驗證、production gate 及每篇明確授權仍是受控試發的前提。本次沒有正式發布、寄信、部署 Worker、合併或啟用排程。

設定階段修正後的完整驗證：208／208 測試通過，137 檔案 TypeScript／Astro 檢查零 errors／warnings／hints，網站及所有工作區 Build 成功，diff check 通過。日誌為 `/private/tmp/gcake-setup-final-{test,check,build}.log`。本機 E2E 曾發現发布後跳轉時控制讀取可能失效，現在在點擊前保留既有編輯器公開連結作為待驗證候選，仍須匿名讀回完整證據，不能只憑連結標記 verified；單次發布與失敗恢復 fixture 通過。Spectra validate 通過、analyze 零 findings。專用登入與兩個憑證填寫仍待人完成，並未宣稱完整遠端設定驗收通過。

操作者改用側邊瀏覽器：2026-10-12 已唯讀確認 In-app Browser 的登入有效，既有測試草稿已儲存。現階段真實 UI 查核沿用該分頁與 Computer Use，不要求操作者再次登入專用 Chrome。這是有人在場的替代操作流程；Node Playwright CLI 仍無法使用該分頁的登入狀態，專用 profile 的驗收保持未完成。禁止匯出／複製 Cookie 來繞過登入問題。正式發布仍須之後針對具體文章與版本另外核准。

2026-10-12 操作者填妥憑證後，正式 D1 REST 唯讀查核成功，必要發布／恢復表、migration 與 checkpoint 欄位完整；Paragraph GET /api/v1/me 確認 API key 屬於 gcake 刊物。這是憑證與讀取能力驗證，沒有測試實際資料寫入或文章发布。兩平台寫入仍關閉；未建立任何草稿、發布或寄信。去除憑證的報告：/private/tmp/gcake-credentials-verification-20261012.json。

## Pages 上線後的最新試發準備，2026-10-12

上述「來源六篇 ready／尚無正式 review」等早期紀錄已被 [同版受控試發審閱](distribution-controlled-trial-review.md) 取代；目前指定文章已在 Pages 公開，sourceRevision f9b96479…，日期 2026-10-12。D1 與 Paragraph 憑證再次唯讀查核成功，不需補新憑證。Substack 側邊登入可用，專用 CLI／D1 銜接仍未就緒，寫入 gate 未開。先完成安全的單篇受控驗證入口與最新 main 整合，再另行取得 prepare／publish 授權。

Paragraph 唯讀 discovery 現明確掃描 published、draft、scheduled、archived 各自的所有分頁，任一未完成則停止。官方清單預設 published，不能只掃預設清單後建立文章。本次修復有實際 RED／GREEN，完整 209 tests、137-file check、全部 Build 通過，但不是平台寫入驗收。
