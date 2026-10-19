# 後台操作簡化：本機交付與驗證

日期：2026-10-19（Asia／Taipei）。變更：simplify-admin-workflows。

## 交付位置與界線

- 實作副本：/private/tmp/gcake-admin-ux-20261019，分支 codex/simplify-admin-workflows，基底 57a03b6ff3adb11831509a1049d29361fb3f4734。
- 主工作區只新增本次 Spectra change；現有 Substack 同步後端、腳本及原稿未被本次覆寫。
- 已完成 proposal、design、兩份 delta specs、Given／When／Then 情境，並在 tasks 建立後才進入實作。
- 初次 spectra analyze 無 findings、validate 通過；舊循環檢視規格由本次 delta 明確取代。
- 未 commit、push、merge、archive change、部署、啟用排程、呼叫正式發布／通知 provider，也未宣稱獨立人工接受。
- 程式差異可永久取回：視覺化輸出目錄的 admin-implementation.patch，含兩個新增程式／測試檔；規格另在主工作區保留。

## 首輪實作紀錄（本輪修正見文末）

- 預設文章清單；文章、系列、發布管理為分開的工作入口，排程完整操作不再位於文章清單之前。
- 文章主操作固定為「儲存文章」「預覽文章」；每個操作群組上限兩個，設定按需展開。
- 原文／預覽／並排由選單直接選取；實際腳本測試確認原文、游標及捲動位置保留。
- 顯示白話狀態與錯誤；原始內容、實際 API payload 和 provider 名稱保持原意。
- 未儲存導航使用頁內的繼續／捨棄確認。瀏覽器驗收證實取消離開保留修改。
- 儲存衝突取回較新的版本供比較或整理；失敗保留工作內容；等待中的保存不會重複送出。
- 已連載系列顯示編號與鎖序理由，不再顯示拖曳把手、排序箭頭或可用的新增章節動作。
- 排程調整拆成查看影響／取消，以及確認調整／返回修改兩階段。系列暫停只在系列層級出現。

## 測試與檢查

1. RED：workflow-acceptance 初次八項全數失敗。先修正測試載入器的 TypeScript 轉譯與 DOM 文字讀取問題，再以缺少工作區導覽、兩按鈕操作群、鎖序呈現、直接檢視 API 等真實差異確認 RED。
2. 最終 Admin 完整測試：node --import tsx --test apps/admin/src/*.test.ts，56／56 通過。
3. 測試包含真實 Vue 模板的 SSR 渲染，以及實際 script setup 的導航、版本衝突、系列保存失敗、重複保存與游標／閱讀位置行為。未以假造狀態模型代替實際保存程式。
4. 原 foundation 中綁死舊文案／原始碼位置的斷言由上述可觀察驗收取代。既有領域測試、公開／發布／刪除確認、媒體引用保護等仍保留。
5. pnpm test：既有完整回歸成功結束，包含 editorial、Hermes、public、workspace、distribution、observability。Hermes 測試有既有 SQLite ResourceWarning，命令仍以 0 結束，沒有隱藏失敗。
6. pnpm check：最終 0 errors、0 warnings、0 hints。另用現有 Vue compiler 暫時產生兩個可檢查的腳本，納入同一檢查工具，218 files、0 errors／warnings／hints；暫存檔已刪除。這是本機補充證據，不新增依賴或強制檢查流程。
7. pnpm build:all：公開網站、Admin 與 Worker 建置通過。其後的前端修整以完整 Admin 測試、pnpm check 與 Admin build 重驗；未改動的 public／Worker 回歸沿用相同來源與鎖檔證據。
8. git diff --check 通過；最終來源雜湊保存在 source-sha256.json；未變更套件鎖檔、CI 或後端。

## 本機瀏覽器證據

既有 scripts/qa/release-admin-host.ts 供給一次性的記憶體測試資料；本次 local 副本增加一次版本衝突與 POST 保存模擬。所有寫入只在記憶體，並未觸及 Git、D1 remote 或外部發布。

- 桌面暗色：正文優先，主操作兩個。
- 桌面明亮：分開的工作入口與相同視覺語言。
- 390px 明亮：按鈕單列、設定可達、沒有頁面水平溢出；實測 viewport 390px、document scrollWidth 375px（扣除捲軸）。
- 從原文切到並排、預覽再返回：未儲存內容不變。
- 選擇其他工作入口：出現頁內離開確認；選繼續編輯後文字仍在。
- 記憶體保存：顯示「文章已儲存。公開結果仍需另外確認。」內容狀態仍為草稿。
- 注入一次 409：畫面保留原修改，較新版本可取回；合併後包含雙方內容，後續保存成功。
- 系列：實測 dragHandles 0、movementControls 0；未儲存狀態清楚。
- 篩選：從指定系列開啟文章再返回後，原篩選仍保留。
- 390px 以 Tab 從原文移到文章設定：焦點 top 795.875／bottom 842.469，固定工具列 bottom 216.281，焦點仍可見。
- 最終編輯器截圖已在最終建置後重新擷取。未量測完整 WCAG 對比、200％縮放、完整螢幕閱讀器、每個發布／媒體寫入流程；不將本機代理操作稱作獨立人工驗收。

截圖、完整命令輸出與 patch：/Users/caiyijun/.codex/visualizations/2026/10/19/01a153ab-2054-7613-8fb6-a0e9e54085b6/admin-improvement/。

## 已知限制

QueueView 沒有完整的固定時段欄位。只有本次成功操作、仍屬未來且尚未重新查詢的固定安排，會提供「恢復自動安排」。其餘情形明示無法確認，不推測取消；若要跨工作階段完整展示，須另行擴充後端契約。本次沒有修改正在開發中的後端。

## 預覽保留與清理

- 用途／擁有者：本次 simplify-admin-workflows 人工檢視用本機 QA，PID 41372，127.0.0.1:4326；所有資料只存在記憶體。
- 保留期間：供這次交付檢視，預計至 2026-10-20；此期限不是已安裝的自動排程。
- 精準清理：結束本次 exec session 48700，或確認仍為同一 QA 行程後執行 kill 41372。重啟即清空示範操作。無 Docker 容器、網路或資料卷。
- 副本使用與基底完全相同鎖檔的現有 node_modules 唯讀連結；最初離線安裝缺少 tarball 後改為重用，未新增或變更套件。

## 本輪修正：SVG 工具與文章設定階層

使用者本輪要求取代首輪直接選單與雙主按鈕方案；先更新 requirement 與 Gherkin，再新增 tasks，並保留首輪已完成任務及歷史證據。

- 文章主操作只有「儲存文章」。正文工具僅兩個 SVG 圖示：原文 → 預覽 → 並排 → 原文循環、直接開啟媒體庫。圖示有目前／下一個模式輔助名稱與提示。
- 媒體庫提示可貼上、拖入圖片，實際綁定既有上傳／插入流程；開啟焦點進入對話框，Tab／Shift+Tab 留在可見控制，Escape 關閉後回到圖片圖示。
- 文章設定分為「基本資料」「文章網址」，欄位說明就近；暫存與刪除移至獨立「其他管理」，網站預覽與發布設定各自保留。
- RED：初次缺少新 helper 的模組錯誤不列為行為證據；修正測試載入後，20 項驗收中 4 項因舊工具、缺少設定分組、缺少循環及焦點功能失敗，其餘 16 項通過。媒體貼上／拖入原有 handler 已可重用。
- GREEN：node --import tsx --test apps/admin/src/*.test.ts，59／59 通過。測試涵蓋真實 Vue 模板、實際 script setup、完整循環後游標／捲動位置，以及圖片貼上／拖入成功、失敗、非圖片輸入。上傳使用本機假回應，沒有呼叫正式媒體儲存服務。
- pnpm check：含暫時抽出的實際 Vue script，218 files，0 errors／warnings／hints。三個暫時型別檔已精準移除。pnpm --filter @gcake/admin build 通過。既有完整回歸及 public／Worker 建置沿用首輪相同輸入證據，未新增 CI 或依賴。
- 瀏覽器實測：滑鼠切到預覽、Enter 切並排、再返回原文，文字逐字一致；主操作只剩儲存。媒體圖示直接開啟，焦點進入 dialog，Shift+Tab 到搜尋、Tab 回上傳，Escape 返回圖片圖示。未執行真實 provider 上傳或發布。
- 桌面明亮與 390px 明亮／暗色：設定分組、媒體提示與操作皆可達；390px 時 document scrollWidth 375px，沒有頁面水平溢出；固定儲存列未遮住網址建議焦點。
- spectra analyze 最終無 findings（Localization 因 artifacts 不足略過）；spectra validate 通過。git diff --check 通過。
- 本輪截圖：editor-tools-refined.jpg、settings-refined-desktop.jpg、settings-refined-mobile.jpg、media-refined-desktop.jpg、media-refined-mobile-dark.jpg。RED／GREEN 命令輸出保存在相同交付資料夾。
- Koboyo 圖示庫缺連線金鑰，沿用專案 stroke SVG 風格，沒有新增圖示依賴。
- 本輪保留服務取代前述舊 PID／session：PID 18563、exec session 63155，127.0.0.1:4326，記憶體資料、正式發布停用；保留至 2026-10-20 供本次檢視（非自動到期）。清理時結束該 session，或核對仍是本次 QA 行程後執行 kill 18563。
- 本輪同樣未 commit、push、部署或變更主工作區既有後端工作；程式仍在專屬副本，只有本 change 文件同步到主工作區。

## 已採納設計規範：文件、實作與四組驗證

本輪來源：使用者採納 design-conformance-report.html，要求文件與 Spectra／Gherkin 先於實作，桌面、手機、明暗驗證且不部署。已更新 DESIGN.md 與 docs/design-system.md；將公開站／後台適用範圍分開，後台字級、間距、圓角、控制尺寸、狀態色、遮罩與跨框架 SVG 已成正式規範。

### 規格與開發順序

- 已新增 Adopted Admin visual foundations、Shared theme and SVG contracts 需求及 4 個 Gherkin 情境，完成後才新增 tasks 第 6 組；既有 13 個完成項目保留。
- 實作前 analyze 無 findings、validate 通過。瀏覽器 computed-style RED 的 5 個角色實測皆不符新值：標題 26.35→26、小節 16.15→16、標籤 14.45→14、輸入 14.45→17、說明 13.6→14（px）。前一次 evaluate 的 parseFloat 不可用是工具範圍問題，不計作 RED 證據；正式 RED JSON 使用瀏覽器回傳的尺寸字串。
- CSS 視覺行為以既有本機瀏覽器為最便宜且足夠的驗收入口，SSR 不可證明排版。保留既有 node:test 行為測試，未新增套件、測試層或 CI。

### 實作

- 後台使用 26／20／16／17／14px 語意字級，以 rem 表達；手機標題 20px。輸入內容不再跟隨標籤縮小；重要錯誤文字維持 17px。
- 間距角色使用 4／8／12／16／20／24／32／48px 變數。設定上下內距 24px、桌面欄距 32px、欄位標籤間隔 8px；桌面側邊 24px、手機 20px。
- 控制至少 44px，方形圖示按鈕 44px、SVG 22px、圓角 5px；排程區也引用相同角色。後台 72rem／760px，公開站仍為 62rem／700px。
- 遮罩以 --overlay 共用，雙主題既有品牌色保持原值；warning／danger 正式文件化。預覽正文 17px／1.9，最大 44rem，手機依欄寬縮小。
- 共用 icon-paths.ts，Astro／Vue 各自渲染；12 個既有公開站 path 與原始 Git 版本逐字一致，輔助 circle／path 保留。沒有新增圖示套件。

### 本輪驗證結果

| 情境 | 桌面明亮 | 桌面暗色 | 手機明亮 | 手機暗色 |
| --- | --- | --- | --- | --- |
| 視窗 | 1280×900 | 1280×900 | 390×844 | 390×844 |
| 頁面標題 | 26px | 26px | 20px | 20px |
| 小節／標籤／輸入／說明 | 16／14／17／14px | 同左 | 同左 | 同左 |
| 設定 | 24px 上下內距、32px 欄距 | 同左 | 單欄、16px 間距 | 同左 |
| 圖示／圖形／圓角 | 44／22／5px | 同左 | 同左 | 同左 |
| 草稿內容 | 不變 | 不變 | 不變 | 不變 |
| 水平寬度 | scrollWidth 1265≤1280 | 同左 | 375≤390 | 同左 |
| 媒體庫 | 20px 標題、5px 圓角、共用遮罩 | 通過 | 通過 | 通過 |

- 四組皆使用長標題與 35 段長文，Tab 到網址建議後焦點在工具列下方可見。手機固定工具列高約 200.6px，焦點約 top 537.5／bottom 586.1px。長標題使用既有兩行捲動區，未擠掉儲存。
- 手機實際切到預覽：35 段顯示、寬 333px、17px 字、行高 32.3px（1.9）；完整循環後原文逐字相同。
- 最終版注入一次記憶體 409：兩種主題皆有白話衝突說明，訊息／衝突正文 17px、處理方式標籤 14px，工作內容逐字保留；沒有成功、發布或通知完成的假訊息。
- node --import tsx --test apps/admin/src/*.test.ts：59／59 通過。原 foundation 綁死 preview shorthand 的字串斷言移除；系統字體架構限制保留，實際尺寸改由本輪 computed-style 驗收。
- pnpm check：暫時抽出實際兩個 Vue script，219 files，0 errors／warnings／hints。三個暫時型別檔已移除。其後僅調整 CSS，無 script／型別變動。
- pnpm --filter @gcake/admin build：通過。最終去除重複同值行高宣告後，產物 hash 完全相同，仍為 index-nO7HCHT3.css／index-VD2CY6zd.js，故四組瀏覽器證據與最終產物一致。
- pnpm build：內容驗證 0 errors／warnings，公開站 48 頁本機建置通過。此建置驗證共用圖示 extraction，沒有部署。
- spectra analyze 無 findings（Localization 因 artifacts 不足略過）；validate、git diff --check 通過。

### 交付與限制

- 字級 RED／GREEN、四組媒體庫、長文及衝突原始讀值：adopted-design-red.json、adopted-design-green.json、adopted-media-green.json、adopted-long-preview.json、adopted-failure-feedback.json。四組設定／媒體庫與衝突截圖皆在 admin-improvement 交付目錄。
- 主工作區已同步本次 DESIGN.md、docs/design-system.md 及本 change。程式及共用圖示仍保留 /private/tmp/gcake-admin-ux-20261019，未混入其他 Substack 工作。
- admin-implementation.patch 本輪改為「僅程式差異」（含新增共用圖示），因設計／Spectra 文件已同步主工作區；可用 git apply --check 驗證，尚未 apply。source-sha256.json 包含程式與設計文件，供候選核對。
- 本機預覽保留原 owned QA PID 18563／exec session 63155，127.0.0.1:4326，至 2026-10-20 供這次檢視；停止方式沿前述精準清理。測試只寫記憶體，沒有 Docker 或外部 provider 寫入。
- 未 commit、push、merge、archive 或部署；沒有正式上傳、公開／通知、CI 或獨立人工接受證據。未宣稱完整無障礙認證。

## 媒體庫間距漏項修正

使用者截圖指出按鈕緊貼下方提示區。上一輪雖檢查字級／控制尺寸及部分間距，漏掉相鄰區塊的實際距離；原提交 9ccfd3f 保留，另作後續修正。

- RED：桌面按鈕彼此 8px，但操作列到提示區 0px；手機 space-between 造成按鈕彼此相距 147px。記錄為真實 rendered boundary，而非只看宣告的 gap。
- 修正：media-header 下方使用既有 16px token；手機將同列兩按鈕靠右成組，維持既有 8px gap。沒有改寫上傳、插入、保存或其他 provider 行為。
- 規格先新增 Media action section spacing 的 Given／When／Then，再新增第 7 組 tasks；設計文件同步明示 16px 區塊間距與 8px 按鈕間距。
- GREEN：1280px 明亮／暗色、390px 明亮／暗色，四組皆實測操作列到提示區 16px、按鈕彼此 8px；沒有頁面水平溢出，Escape 回圖片按鈕，原文逐字不變。原始讀值在 media-spacing-red.json／media-spacing-green.json，截圖為 media-spacing-{1280,390}-{light,dark}.jpg。
- 完整 Admin 59／59 測試通過；Admin build、Spectra analyze／validate、diff check 通過。此輪只有 CSS 與文件變更，未重跑無關的公開站／Worker gate，也未新增 CI。
- 中途原 QA 服務停止，已重新啟動。部分讀取誤用舊分頁 helper，造成錯誤頁的 URL policy 訊息；改為有效分頁的讀取後完成四組驗收，未將錯誤頁算為產品或規範通過證據。
- QA 服務為本次記憶體模式，exec session 24776，服務回報 PID 295；保留至 2026-10-20 供檢視。優先結束該 session 精準清理；若用 PID，須先確認仍是本次 QA 程序。舊 PID／session 已失效。無正式寫入、推送或部署。


## 全後台實際間距稽核（2026-10-19）

本輪依使用者要求延伸至其他頁面與 modal，先在設計文件及 Consistent spacing across Admin surfaces 規格補上 Gherkin，才建立第 8 組 tasks 與修正 CSS。僅後台 CSS、queue scoped CSS、設計與本 change 文件變更；沒有修改 API、排程、上傳、刪除或通知流程。

### 實際發現與修正

- 新增文章／系列欄位垂直距離 16px → 12px；完成欄位／說明到操作列維持 16px。
- 章節與篇序的普通按鈕 4px → 8px；正文 SVG 工具群組保留 4px。
- 一般收合入口約 30.6px → 至少 44px；展開後標題到首個內容由 0px／不固定 margin 改為 12px。長標題自然增高，不裁切。
- queue 欄位到執行按鈕 0px → 16px；日期調整表單、影響預覽與空清單使用一致節奏。
- 發布紀錄欄位到說明 0px → 8px，說明到執行按鈕 28px → 16px。
- 媒體卡片到管理區原先 grid gap 與 margin 疊加為 16px，改為 8px；展開入口到欄位 12px，欄位到執行列 16px。原 media header 到拖放提示 16px 保留。
- 登入說明到按鈕原先段落 margin 加按鈕 margin 為 24px，改為 16px；載入失敗頁同樣驗收。
- 原生段落與清單 margin 會引入 17px 等未定義距離，已依角色重設。舊日期欄位改為寬度受限單欄，欄位 12px、操作列 16px。

### 四組驗收與範圍

1280×900 與 390×844，各自明亮／暗色，共 64 組唯一畫面狀態（16 種 × 4）。包含：新增文章、文章全部設定（含舊日期）、有圖片媒體庫／圖片管理、搜尋無結果、新增系列、未開始系列全部巢狀設定、日期調整、影響預覽、需處理空白結果、發布紀錄與時間線、已開始系列、已定稿文章／人工發布設定、未儲存離開確認、儲存衝突、登入、載入失敗。

- 每組實際 DOM 邊界量測：標籤到控制 8px；可比較的垂直欄位 12px；普通按鈕 8px、SVG 工具 4px；展開內容 12px；任務操作列 16px；所有受檢控制至少 44px，沒有頁面水平溢出。
- 媒體卡片資訊各段 8px、操作列到提示區 16px；dialog 本身沒有水平溢出。四組關閉回圖片按鈕，原文逐字相同。
- 四組取消離開後，工作原文保留。一次記憶體 409 衝突在四種版面皆可讀，處理欄位到按鈕 16px，切換主題／寬度沒有改寫原文。
- 最終彙整 spacing-final-matrix.json：64 組、0 個間距／高度／水平溢出失敗；spacing-extra-behavior.json 保留取消與紀錄說明的讀值。早期 spacing-audit-red.json 保留原始失敗。過程中 selector 的 textbox/searchbox 不同及 DOM 工具不支援 checkVisibility 等錯誤，修正量測方式後重做，不計作產品失敗或通過。
- 發布紀錄與圖片為本機合成 fixture；其他文章／系列來自隔離副本。這些證據證明前端版面，不能替代正式 provider、CI、部署或獨立人工驗收。
- 瀏覽器原生刪除確認嘗試觸發後工具 mouse dispatch 逾時，沒有可取得的 dialog，因此不宣稱本輪完成原生確認框的視覺或取消驗收；原生 chrome 本來也不受專案 CSS 控制。既有取消／確認行為由原 Admin 行為測試保護。未執行任何正式刪除或發布。

### 驗證及交付

- Admin node:test：59／59 通過。Admin Vite build 通過，最終產物 index-fVLqfW1i.css／index-BqIwbBeZ.js。沒有 Vue script／型別或公開站變更，因此不重跑不受影響的全站／Worker gate；沒有新增套件、測試層、CI 或 Docker。
- 最後兩項 scoped 修正僅影響發布紀錄 label 後說明及 center-card 按鈕，各自已重新完成四組驗收；其他未受影響狀態沿用同一輪通過讀值。
- Spectra analyze／validate 與 git diff --check 通過。設計權威為 DESIGN.md、docs/design-system.md 及本 change；本輪是既有規則補齊，不建立新的 ADR／ledger 系統。
- 程式保留 /private/tmp/gcake-admin-ux-20261019（codex/simplify-admin-workflows）的後續 diff；本輪沒有新增 commit、推送或部署。原兩個已完成 commit 不改寫。主工作區僅同步已核對歸屬的設計與本 change 文件，其他 Substack 變更保持原樣。
- 最新本機服務 exec session 54828、PID 34730，loopback 127.0.0.1:4326，記憶體資料、正式發布停用，保留到 2026-10-20 供檢視（非自動到期）。清理優先結束該 session；若使用 kill 34730，須先核對仍為本次 QA 程序。先前服務皆已結束。


### 本輪獨立提交整理

使用者後續明確授權將本輪間距、設計文件與 Spectra 驗收紀錄整理為獨立 commit。僅選取兩個後台樣式檔、設計規範與本 change 的 design／spec／tasks／verification，共 7 個檔案；不納入本機 QA host、其他 Substack change 或後端變更。提交前逐檔 SHA-256 與上一輪驗證清單完全相符，因此沿用 59 項測試、建置與 64 組版面驗收，不重跑未改動的程式。另確認 Spectra 與 staged diff，主工作區內容保持不變；只將完成的 commit 匯入本機既有後台分支，不切換 main，不推送、不部署。


## PR #38 CI 與審查修正

- 原候選 fed0adb 的 [CI 39261671313](https://github.com/gcake119/gcake-dev/actions/runs/39261671313) 全部通過：完整測試、Astro／TypeScript、全部建置、發布模擬與本機演練；無正式部署。
- Codex 審查完成並提出兩個 P2：[舊暫存合併狀態](https://github.com/gcake119/gcake-dev/pull/38#discussion_r4314500787)、[正文貼圖焦點](https://github.com/gcake119/gcake-dev/pull/38#discussion_r4314500792)。不是無問題通過。
- 先補 Article-scoped recovery and uninterrupted image editing 的 Gherkin，再以既有 actual-workspace harness 重現：第一次舊暫存合併缺少草稿、跨文章合併後 POST 錯送到前一篇、正文貼圖後 focus 變成圖片按鈕；三項真實 RED。另測得新增文章殘留前一篇 recovery conflict，第四項 RED。沒有新增測試層、套件或 CI。
- 修正根因：成功開啟文章時，復原版本和預設選擇重新依當前文章初始化；新增文章清空前一篇復原狀態。關閉已關閉的媒體庫不再移動焦點，開啟中的 dialog 插圖仍正常關閉並回到入口。
- GREEN：完整 Admin 63／63 通過，測到後續儲存仍送往目前文章及其載入版本；直接正文貼上／拖入保持焦點，從 dialog 插入仍回入口；既有失敗／非圖片保留內容情境也通過。
- 推送前完整本機 gate 全部通過：pnpm test、pnpm check（暫時抽出實際 Vue script，219 files，0 errors／warnings／hints）、pnpm build:all、pnpm release:dry-run、pnpm editorial:rehearse、Spectra analyze／validate、diff check。型別暫存檔已精準移除。Hermes 仍有既有 SQLite ResourceWarning，完整測試 exit 0，沒有忽略失敗。
- App.vue 僅 6 行實作增補，CSS／模板幾何未變；原 64 組視覺驗收沿用，這次以實際 Vue script 的行為驗收補足。沒有任何 Substack 後端、腳本、原稿、依賴或 workflow 變更。
- 本輪作為後續獨立修正 commit 更新同一 PR。原始 CI 通過與本機 GREEN 不代表新候選 CI 或重新審查已完成；新候選結果另存 PR 交付收據。未合併、未啟用自動合併、未部署。
