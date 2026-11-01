# Mermaid 工作流程驗證與審查

日期：２０２６－１１－０１。基線為已包含 PR ＃９１的 main 70aa4ac，隔離分支 codex/mermaid-diagram-workflow；原工作目錄的既有變更未納入。

## Audit 與設計判斷

- Astro 設定為 MDX＋Vue、雙主題 Shiki，未配置 Mermaid remark／rehype renderer；既有 `.mermaid` CSS 只控制寬度。
- 原來源 docs/diagrams/blog-system-architecture.mmd，原手工 SVG 的 viewBox 為１１６０×８５０；第五篇以帶有詳細 alt 的 `/gcake-dev/diagrams/blog-system-architecture.svg` 引用，Git 中狀態是 draft。本次 src/content 全部維持基線位元，不改正文、論點、日期或狀態。
- 未發現可重用的 Mermaid 轉檔工具；重用現有 Node test runner、marked、linkedom、pnpm workspace、content validation、Astro build 與 PR validate job。
- CMS media-library 規格與 media.ts 的 uploadMedia／createMediaKey 維持 R2 不可變物件、D1 索引與文章 alt 權威；本次只管理 repository 技術圖表，不新增 CMS 制度。
- 沿用 DESIGN.md → docs/design-system.md 的閱讀寬度／雙主題。決策索引補一筆技術工作流程；不改 ADR-001 的搜尋、模型、額度或排程政策，不另建 ADR。

## 驗證證據

- 驗收測試先於工具建立，初始為缺少工具模組而失敗。四組驗收後續通過：單圖／子目錄轉換與失敗保留、來源／SVG／設定／lock 漂移及遺失／額外輸出、Markdown／MDX 引用／alt／fence 與建置位元、空批次不呼叫 renderer。
- 自我審查額外重現合法標籤「Mermaid version」遭錯誤文字比對拒絕，先觀察 RED，再改為檢查真正的 SVG error 元素，四組 GREEN。避免用任意來源文字當錯誤訊號。另以 RED／GREEN 補強刪除最後一張來源後的空批次對帳，清除舊 manifest entry 且不呼叫瀏覽器。
- 真正 mmdc＋已安裝 Chrome 在可清理臨時目錄完成有效來源轉換，再用無效 Mermaid 驗證失敗後 SVG 與 manifest 位元不變。
- 相同來源／設定／工具／Chrome 在同一 macOS 環境重轉，cmp 逐位元相同；不推論不同 OS／中文字型／Chrome 版本完全相同。
- pnpm build 成功產生５４頁，diagrams:check:built 確認 dist/diagrams 的 SVG 位元與已驗證產物相同；pnpm check 為０ errors／０ warnings，保留既有１ hint；workspace builds、release:dry-run 與 editorial:rehearse 均通過。
- 發布模擬僅擴充其臨時複本的圖表／public／lockfile 輸入；兩個模擬仍為 productionWrites:false、telegramNetworkCalls:0、sixBodiesUnchanged:true。未觸發公開發布、正式資料或 provider 寫入。
- 最終候選使用官方 SHA-256 核對的 Node２４．２２．１，連續完成 pnpm test、pnpm check、pnpm build:all、pnpm release:dry-run、pnpm editorial:rehearse，全部 exit０。完整測試包含最終４組圖表驗收、Hermes３０９項與 distribution３６４項。PR CI 另以 PR checks 為準，本文件不預先宣稱遠端通過。

## 保留的失敗與修正

１．首次依賴安裝曾 registry 逾時，後續鎖定安裝成功；隔離目錄只做 root add 時未連結 workspace 相依套件，造成型別／workspace build 缺少模組。完整 frozen install 後原檢查通過，沒有排除檔案或弱化 gate。
２．既有 foundation 測試釘選舊 build:astro 指令，更新為含建置後圖片驗證的新契約；release simulation 的複本原缺圖表與 lockfile，補齊後兩項模擬通過。
３．畫面檢視臨時 HTML 放在 public，與並行 observability 建置互相影響，產生 Missing analytics on .diagram-qa.html。移除本次檢視檔後 observability 通過，再執行乾淨完整測試；未改 observability 測試、未跳過 analytics。臨時 HTTP server 與隔離瀏覽器均已關閉。原失敗與最終本機日誌留在 /private/tmp/gcake-mermaid-*.log，不把舊失敗改稱成功。

４．乾淨完整測試曾在既有 distribution executor「stalled handler false」案例出現 pid 檔缺失；先前同環境完整 distribution ３６４項曾全通過，單項兩種 handler 再現檢查也通過。執行路徑是固定１５００ms後 TERM、１０００ms後 KILL，沒有調寬期限或改斷言；根因未確立，不能將後續通過稱為修復此偶發問題。原失敗留於 gcake-mermaid-gate-final.log，其後獨立完整 distribution３６４項通過；使用 CI 同版 Node２４．２２．１對最終候選執行整套五項 gate 全通過。這是不同 runtime 的驗證證據，未修正或宣稱定位 Node２２偶發根因。

## 版面比較與替換決定

生成版 viewBox 約８６２×１５７０，較原手工版窄且長，Cloudflare 分組移到下方，長標籤自動換行，連線由工具排布。檢視後採用生成版：保留來源的全部服務節點與資料流，中文字正常、無裁切／標籤重疊；來源只新增 accTitle／accDescr，未刪改邊或服務關係。

以下為以既有 global.css 嵌入真正 SVG 的本機檢視頁，並非發布第五篇，也不是使用者人工接受證據：

- [桌面明亮](evidence/1280-light.png)／[桌面深色](evidence/1280-dark.png)。
- [３９０px 明亮](evidence/390-light.png)／[３９０px 深色](evidence/390-dark.png)。

圖片保持白底與深色文字，深色頁面仍清楚；等比例縮放沒有頁面橫向溢出。手機縮圖無法直接閱讀所有小字，需長按／右鍵開啟 SVG 放大；詳細 alt 與既有正文仍是輔助說明。本次不為改善縮圖而修改定稿正文、不新增燈箱或網站腳本；不宣稱完成真實手機人工驗收。

## 依賴與 CI 成本

npm registry 查核 CLI 最新版１２．０．０要求 Node ≥２２．１３，本機２２．２３．４、CI２４符合；Puppeteer peer 需求為２５，固定使用２５．１６．０。原 lockfile ５５０筆 package entry，新版７３３筆，新增１８３筆；原有 importer 的既有依賴解析版本未改。安裝空間與瀏覽器相容性是實際維護負擔，不把開發依賴稱為零成本。

pnpm audit 最終全專案為１４ high／２０ moderate／７ low／０ critical；其中新增工具鏈路徑只有 CLI → KaTeX 的１筆 low（GHSA-238p-pmpm-9mq7，已存在 prototype pollution 時可繞過 trust）。舊 Puppeteer２５．１０的 Chromium BiDi → Zod３高風險路徑，已藉相容範圍內更新至２５．１６移除。其餘公告是既有依賴路徑，不在本次任意升級；不宣稱 audit 全綠。KaTeX 修補需跨０．１６到０．１８，未做未驗證 override；來源限 Git 審查的本機圖表、strict 模式，沒有公開輸入的渲染服務。

CI 使用既有 validate job，新增 Node 檔案／文章檢查與４組輕量測試，不啟動 Chromium 轉圖，明確略過 Puppeteer 下載；不新增 runner、服務或安全掃描 pipeline。hash manifest 防止意外漏轉／改圖，不能證明視覺正確或抵抗同時偽造來源與 manifest。lockfile／工具／package.json／設定更新會保守要求全部重產；實際轉檔與視覺檢視只在作者更新圖表或工具時執行。未估算官方計費或宣稱節省金額。


## PR CI 後續修補

PR ＃９２首版 81f105b 的第一次 CI 在既有部署條件 VM 的１００ms期限失敗；同版 Node２４本機單項與２０次樣本（５６０次原有條件斷言）通過，未改該期限或測試。相同 SHA 的一次重跑通過此案例，卻在 executor stalled handler true 缺少 term-seen。原始兩次失敗保留於 Actions run４１２７７６８１１６７的 attempts１／２，不將重跑當成根因修復。

本機現有 shell 空轉 fixture 與 FIFO 閒置 fixture 各３樣本，macOS／Node２４、同１５００ms執行＋１０００ms grace，以子程序 ps %CPU 觀察：空轉９１．３／９２．９／９２．１％；FIFO０．１／０／０．１％。６次都留下 TERM 紀錄，回傳相同 timeout，約２５０３～２５０５ms結束。這只量測該 fixture 的單程序 CPU，不是 CI 整體負載、官方計費或金額節省，也不證明所有遠端逾時都來自同一原因。

因此僅將既有 signal fixture 改成 FIFO＋shell builtin read：mkfifo 在期限開始前準備，兩種 handler 仍等待 KILL；全部執行／grace／外層期限與 TERM、timeout、process-group 回收斷言保持原值。原 finally 清除本次 FIFO 與臨時目錄。沒有新增套件、測試層、job、重試機制或調寬限制。已知 CPU 競爭來源被移除；此前 Node２２ pid 缺失與 VM１００ms的完整根因仍未確立。

修補候選在 Node２４．２２．１再次連續通過完整 pnpm test、pnpm check、pnpm build:all、pnpm release:dry-run、pnpm editorial:rehearse，全部 exit０；原有兩個 signal 斷言案例與 distribution３６４項皆通過。原始 CPU 樣本見 [fixture-cpu.json](evidence/fixture-cpu.json)。尚待新提交的 PR CI；不預先宣稱遠端通過。
