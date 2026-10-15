# Design QA

## 2026-09-27 approved redesign implementation

- Implemented the approved mist-blue light and night-mist-blue dark themes, site identity, SVG navigation, independent series index, series chapters and article disclosures.
- Formal production build preview: `http://127.0.0.1:4321/gcake-dev/`. Real source content only; prototype sample series were not imported.
- Desktop at 1280 px and mobile at 390 px were visually reviewed. An additional narrow IAB viewport reported 291 px; after the header spacing fix, its document had no horizontal overflow.
- Verified keyboard theme switching and persistence after reload, series index to series to Day 7, expanded series navigation with the current article marked, navigation to Day 8 with the disclosure closed, and article TOC heading-anchor navigation.
- Homepage uses the real ongoing series and recent Day 19, 18 and 17 articles. Multi-series behavior is implemented, but formal content currently contains only one readable series.
- `pnpm test`: 3 publication-date and lifecycle tests passed. `pnpm check`: 0 errors, 0 warnings, 10 existing schema deprecation hints. `pnpm build`: series validation passed and 25 pages built. Future articles were excluded. `git diff --check` passed.
- Home screenshot: `/private/tmp/gcake-redesign-home.png`.
- Publication visibility is calculated during a static build using the Asia/Taipei calendar date. The current deployment workflow does not run daily; scheduled dates require another build to become visible. No deployment workflow or remote state was changed.
- No real standalone local post exists yet. Rich code, tables and image fixtures were not rerun in this review. This is local implementation QA, not deployment acceptance or a complete accessibility audit.

## 2026-09-24 rendered review

The production build was served locally at `http://127.0.0.1:4321/gcake-dev/` with the GitHub Pages base path. Desktop was checked at 1280 px; mobile was checked at 390 px and 320 px. This is local rendered QA, not deployment or human acceptance.

### Pages checked

- Homepage: editorial hierarchy, honest latest-post empty state, archive entry, header and footer.
- Series list and iThome series detail: title wrapping, chapter order, article links and mobile stacking.
- Archived iThome article Day 11: title, metadata, desktop margin TOC, mobile disclosure TOC, heading anchors and previous/next navigation.
- Topics and About: empty state or body copy, responsive layout and footer.
- On mobile, the navigation disclosure and article TOC open with native controls. At 320 px and 390 px, the checked pages have no document-level horizontal overflow.

### Rich-content fixture

The current 30 archived articles contain headings and prose but no fenced code blocks, Markdown tables or images. A temporary page based on the built Day 11 article was placed only in `dist/qa-rich-content/` for rendered QA. It included a deliberately long code line, a three-column table and a 320 × 180 image with alt text and caption. At mobile width, code scrolls inside its block while the page stays within the viewport; table cells display labels from their actual headers; the image retains its intrinsic width and fits the reading column. The desktop table remains tabular. The fixture is not source content and is removed after QA.

### Fixes from this review

- Added a keyboard-visible skip link to the main landmark.
- Increased mobile TOC link targets to at least 2.75 rem high.
- Kept prose images at or below intrinsic width instead of stretching small images to the wide-content measure.
- Gave local articles without a Series a single-column heading layout, including at the mobile breakpoint.

### Automated checks

- `pnpm install`: completed with the lockfile unchanged; pnpm reported an ignored `esbuild` build script.
- `pnpm check`: 0 errors, 0 warnings, 10 deprecation hints from `astro:content` schema use of `z`.
- `pnpm build`: passed; Series validation had 0 errors and 0 warnings; 36 static pages built.
- The empty local `posts` collection produces expected build notices. No published local post exists yet, so the standalone local article layout has source-level and type-check coverage only.

### Remaining limits

- Chinese font appearance depends on locally installed fonts.
- The approved ImageGen concepts were not available in this review session for pixel-level comparison.
- Local preview and fixture checks do not establish GitHub Pages deployment or human acceptance.

## 2026-09-27 search and approved About copy

- Added independent static full-text search, navigation text retained on mobile, result title/series/summary, exact approved no-result message, retryable loading error and no-JavaScript fallback.
- Index contains the same 19 public articles as the reading catalog; article URLs retain `/gcake-dev/`. No prototype content or future local drafts were added. External canonical/body ownership remains with the source.
- Actual static preview at `http://127.0.0.1:4321/gcake-dev/`: keyboard Enter search for 驗證 returned Day 17, whose title/summary do not contain the term. Empty-result search showed the approved text and series link. Theme switched by keyboard and persisted after reload. Tab reached the visible skip link.
- Desktop 1280 px light search result reviewed. Mobile 320 px dark search/empty state and 390 px dark About reviewed; document widths stayed within viewport. About has all three approved sections and four full service links; footer SVGs expose service names.
- `pnpm test`: 6/6; `pnpm check`: 0 errors, 0 warnings, 10 existing deprecation hints; `pnpm build`: passed, 26 pages plus JSON endpoint, series validation 0 errors/warnings. Empty local collection warnings remain expected.
- Preview initially failed inside sandbox; approved local preview started successfully outside it. Playwright CLI package startup did not finish promptly, so rendered QA used the in-app browser's native controls and Playwright API.
- Limits: no standalone local article exists; no full accessibility audit, deployment, remote schedule or public endpoint validation. Multi-series/no-series conditions have not been rendered with formal source fixtures this round. Comment provider capability and hosting remain undecided.

### Follow-up: navigation search input and result-only page

- Replaced the Search nav link with a native GET search form, preserving `/gcake-dev/` and query text after navigation. Removed the duplicate form from the result page. Mobile search wraps onto a second row.
- Full local `pnpm test`, `pnpm check`, `pnpm build` and `git diff --check` passed again.
- The nav form was observed in the browser accessibility tree before the result-only follow-up. Final browser verification was blocked by debugger synchronization timeouts; the revised mobile layout and end-to-end nav submission are not claimed as rendered acceptance.

### Computer Use recheck and integrated candidate

- Completed native browser verification: homepage nav input + Enter opened the result-only page, retained query 驗證 and returned Day 17. Mobile 320 px dark layout displayed the nav input on a second row; document scroll width 305 px within 320 px viewport. A replacement query zzzz showed the approved no-result message and series entry. Keyboard Enter toggled light theme; reload preserved it. Desktop 1280 px light result page reviewed.
- Created an isolated filesystem candidate at `/private/tmp/gcake-design-candidate-20260927` from remote main `1320bdf1d7133e38f26602ec9063bb52954f3da8`, integrating local design/search changes. Original dirty checkout and the separately dirty sync-release checkout were preserved. Remote new article and extension manifest remain intact and ready/unpublished, hence excluded from public search.
- Resolved overlapping presentation changes and duplicate imports; retained remote series visibility filtering and source snapshot. Candidate full pnpm test 6/6, check 0 errors/0 warnings/10 existing hints, build 26 pages passed. Static index has 19 public entries, all article targets exist.
- Candidate preview `http://127.0.0.1:4323/gcake-dev/`: Computer Use verified nav submission, result content, and keyboard activation of Day 17 opened the article with separate series/TOC disclosures and canonical source link. Pointer activation in IAB did not navigate; keyboard activation did. This may be a browser-control limitation and is not promoted to pointer acceptance.
- No commit, push or deployment performed. Original checkout is still based on 54cf820; use the integrated candidate when preparing the next revision, not a direct push from that old base.


## 2026-10-13 訂閱入口本機驗證

- 沿用 `PRODUCT.md`、`DESIGN.md` 與 `docs/design-governance.md` 的霧藍明暗主題、細分隔線、44px 操作目標及鍵盤焦點。首頁最近文章後加入 `Subscription`；本地與 iThome 文章正文後使用同元件的 compact 模式。網址集中在 `src/data/site.ts`，文案集中在元件；沒有新增客戶端 JavaScript、API、資料庫或寄信服務。Paragraph 同步與保存流程未變更。
- 既有頁尾 Substack 網址是作者個人頁 `https://substack.com/@gcake119`。另從既有分發工作文件確認技術刊物 `gcakedev.substack.com`，並用瀏覽器確認標題「雞蛋糕的開發筆記」與實際訂閱頁 `https://gcakedev.substack.com/subscribe`。只唯讀確認，沒有提交訂閱或付款。RSS 由既有 `src/pages/rss.xml.ts` 產生，保留 `/gcake-dev/rss.xml`。
- 保留原 dirty checkout 的其他變更，先在 `/private/tmp/gcake-subscription-20261013` 的目前檔案副本實作驗證，再逐檔核對並套回七個訂閱相關檔案。另更新本文件與設計系統元件／頁面對照；沒有 commit、push 或部署。
- RED：對原始 build 產出的首頁與文章 HTML 執行 `test/subscription.test.ts`，兩項皆因缺少訂閱區塊而失敗。GREEN：新增元件後兩項皆通過。測試檢查兩個目的地、可見名稱、具名 section、每頁唯一入口、正文後／篇尾導覽前的位置與 RSS 產物，並拒絕訂閱區塊中的 Paragraph、script、form、iframe。
- 原 repo 最終 `pnpm test` 17／17；`pnpm check` 0 errors、0 warnings、0 hints；`pnpm test:subscriptions` 執行內容驗證、build（26 頁）及 HTML 驗收 2／2；`git diff --check` 通過。內容驗證 0 errors、0 warnings。`pnpm test:subscriptions` 可重跑完整訂閱建置驗收。
- 實際靜態產物由 `http://127.0.0.1:4337/gcake-dev/` 提供。首頁與真實 iThome Day 1 文章各檢查 1280、390、320px × 明亮／暗色共十二組。document scrollWidth 分別為 1265、375、305px，均小於 viewport；訂閱連結可由 Tab 到達，焦點輪廓為 3px，操作高度至少 44px。既有文章 canonical 仍是來源 URL；HTML 語言、meta 與正文未改。
- 沒有正式本地文章，僅在隔離副本暫建 `qa-subscription.md` 驗證本地文章模板的 1280px 明亮與 320px 暗色呈現、canonical 和鍵盤焦點；測試文章已移除，未寫入原 repo，並重新 build 清除暫時產物。
- 截圖保存於 `/private/tmp/gcake-subscription-qa/`，包含首頁桌面／手機、真實文章明暗尺寸與本地模板 fixture。已查看首頁 1280px 明亮、390px 明亮、320px 暗色，文章 1280px 明亮、390px 明亮、320px 暗色及本地模板 320px 暗色截圖。
- 限制：內建瀏覽器封鎖 RSS XML 導航，因此沒有宣稱瀏覽器 XML 顯示成功；另以唯讀本機 HTTP 查核確認 200，並由 HTML 測試確認 XML 產物存在。Astro preview 未成功啟動，呈現檢查改用唯讀靜態 HTTP server。知識圖譜索引被自動核准審查拒絕，故使用本機檔案探索。這是本機驗證，非完整 WCAG 稽核、公開部署或人工驗收。


### 訂閱 SVG 圖示補強

- 共用 `Icon.astro` 新增信封與 RSS 線條圖示，`Subscription.astro` 在兩個連結文字前引用；20px 圖示使用 currentColor、8px 間距，沿用既有主題及焦點樣式。保留文字名稱，圖示與尾端箭頭標示 aria-hidden，避免重複朗讀；沒有新增 JavaScript 或依賴。
- 重新執行 pnpm test（17／17）、pnpm check（0 errors／warnings／hints）、pnpm test:subscriptions（build 26 頁、驗收 2／2）與 git diff --check，全數通過。
- 首頁及真實 Day 1 文章重新檢查 1280／390／320px × 明亮／暗色。沒有整頁水平溢出；兩個 SVG 保持 20px，連結高度至少 44px，窄螢幕自然換行。已查看首頁 390px 明亮、文章 1280px 明亮與 320px 暗色截圖。截圖為 /private/tmp/gcake-subscription-qa/icons-*.png。
- Koboyo 圖示庫需登入或啟用方案，故沿用專案既有 SVG 元件。pnpm 初次在沙箱中因套件管理器鎖定檔權限無法啟動，取得執行權限後完成完整檢查。驗證伺服器已關閉；未提交或部署。


### 頁尾全部改用 SVG 圖示

- 頁尾 RSS 與 GitHub 改用共用 `Icon.astro`，補上 GitHub 線條圖示。六個頁尾入口全部具有 SVG、服務名稱 aria-label／title，以及 44 × 44px 操作目標；連結目的地保持既有設定。
- pnpm test 17／17、pnpm check 0 errors／warnings／hints、pnpm test:subscriptions（build 26 頁、2／2）與 git diff --check 全數通過。
- 首頁頁尾實際檢查 1280／390／320px × 明亮／暗色。全部連結具名，Tab 可到達 GitHub，沒有水平溢出；320px 自然換行。已查看 390px 明亮與 320px 暗色截圖，檔案為 `/private/tmp/gcake-subscription-qa/footer-*.png`。本機驗證伺服器已停止，未提交或部署。


### 訂閱選項使用相同視覺層級

- 首頁電子報與 RSS 統一使用既有 primary-link 實心按鈕；文章 compact 模式維持兩個同等 text-link。視覺層級不再依訂閱方式區分，連結與圖示保持原設定。
- pnpm check（0 errors／warnings／hints）、pnpm test:subscriptions（內容驗證、build 26 頁、2／2）與 git diff --check 通過。
- 首頁實際檢查 1280／390／320px × 明亮／暗色；兩個按鈕具有相同背景、文字色及約 46.6px 高度。沒有水平溢出，手機自然換行；已查看 390px 明亮及 320px 暗色截圖。截圖為 `/private/tmp/gcake-subscription-qa/equal-*.png`。驗證伺服器已停止，未提交或部署。


### 訂閱按鈕等寬

- 首頁電子報與 RSS 按鈕統一為 240px 寬、內容置中；700px 以下單欄排列，受可用寬度限制，兩個按鈕始終等寬。文章的精簡文字連結維持既有呈現。
- pnpm check、pnpm test:subscriptions（build 26 頁、驗收 2／2）及 git diff --check 通過。實際檢查 1280／390／320px × 明暗主題，兩個按鈕皆為 240px × 約 46.6px，沒有整頁水平溢出。已查看 320px 暗色截圖；截圖為 `/private/tmp/gcake-subscription-qa/width-*.png`。
- 本機驗證伺服器已停止，未提交或部署。


### 最終訂閱樣式：首頁與文末皆為文字連結

- 依最新要求，首頁與文章篇尾統一使用 SVG 圖示＋text-link 文字連結。移除首頁實心按鈕、240px 固定寬度與專用 grid／手機單欄樣式；兩者共用同一套可換行連結排列。此決定取代前述首頁實心／等寬按鈕調整。
- pnpm check（0 errors／warnings／hints）、pnpm test:subscriptions（內容驗證、build 26 頁、2／2）與 git diff --check 通過。首頁檢查 1280／390／320px × 明暗主題，兩個連結皆為透明背景、44px 高度，沒有水平溢出。已查看 390px 明亮與 320px 暗色截圖，檔案為 `/private/tmp/gcake-subscription-qa/home-text-*.png`。
- 本機驗證伺服器已停止，未提交或部署。

### Release preparation

Integrated against latest main 8f5f0f6 in an isolated Git checkout. Preserved durable iThome snapshot endpoint, completion freeze logic, SHA-256 records and unpublished extension content. Final full checks run before push; original dirty workspace remains preserved.


## 2026-10-13 訂閱入口推送候選

- 以遠端 main `5ba6df274976d68c40ab31f6e0937a79dd1b3721` 為基底，在 `/private/tmp/gcake-subscription-push-20261013` 隔離整合。原 dirty checkout 及其他工作保留。保留遠端既有 SEO／結構化資料、內容可見性、發佈流程與 SVG 頁尾；只新增 mail 圖示與共用訂閱元件、設定、三個頁面接點、驗收及設計對照。
- 首頁最近文章後、正式本地文章與外部 iThome 文章正文後均有具名訂閱區塊。電子報與 RSS 同為 SVG＋文字連結，具相同視覺層級；文案與網址集中維護，不新增客戶端 JavaScript、API 或寄信服務。
- 電子報網址已於本次工作唯讀確認為 `https://gcakedev.substack.com/subscribe`；RSS 延續 `/gcake-dev/rss.xml`。Paragraph 同步及 Arweave 保存流程未修改。
- 完整 `pnpm test` 通過（包含 Python Hermes、公開網站、workspace 與分發測試）；`pnpm check` 188 files、0 errors／warnings／hints；`pnpm build:all` 通過，公開網站 35 頁及所有 workspace build 成功；訂閱 HTML 驗收 2／2。`pnpm release:dry-run`、`pnpm editorial:rehearse` 皆 passed、productionWrites=false，沒有 provider 寫入或實際通知。`git diff --check` 通過。
- 在本機靜態 server `http://127.0.0.1:4338/gcake-dev/` 檢查首頁、正式本地 `ithome-2026-chatgpt-writing-workflow` 與外部 Day 1，各涵蓋 1280／390／320px × 明暗主題。每頁只有一個訂閱入口，RSS 可用鍵盤到達；scrollWidth 1265／375／305px，無整頁水平溢出，canonical 保持正確來源。截圖為 `/private/tmp/gcake-subscription-qa/push-*.png`，已查看首頁 390px 明亮、本地文章 1280px 明亮及外部文章 320px 暗色。
- 這些是整合候選的本機證據，不代表完整 WCAG 稽核、公開部署或人工驗收。Pages workflow 目前為手動部署；本次 commit／push 不執行部署。
