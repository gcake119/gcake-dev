# 本機驗證：２０２６－１１－０３

## 實作與範圍

本地系列須明確 completed／archived、原始篇目非空且每篇標記 published 並可公開閱讀，才依既有排程判斷完結。paused 優先；active 不因目前所有篇目公開而自動完結。loadSeriesManifests 在篩除不可見篇目前計算 publicationState，catalog 與所有閱讀介面共用。外部鐵人賽來源邏輯不變。未更動檢查規則、發布紀錄、provider、通知或部署。

## TDD

新增 test/series-completion.rendered.test.ts，沿用既有建置後 HTML 測試方式。先使用本機 completed 清單加兩篇 ready 建置，真實失敗為首頁顯示「已完結」，預期「連載中」。修正後同測試通過，包含首頁、總覽、系列頁與最新文章篇尾。publication.test.ts 新增原始完整清單、空集合、開放系列、draft／ready／missing、paused、未結束排程與台北 07：00 精確邊界案例；首次執行新 resolver 尚不存在，實作後８項全部通過。未新增測試框架或 CI 工作。

## 目前工作目錄

- pnpm test:public：１０９／１０９通過。
- Astro check：０錯誤、０警告、６６提示。
- Astro build：通過；四篇已發布、兩篇 ready，完稿系列仍顯示連載中，末篇無完結提示。
- content:validate：失敗１項。舊 checkout 的後兩篇仍為 ready，既有 validator 禁止 completed 清單有未發布篇目。保留失敗，不削弱 validator，也不改寫發文紀錄。

## 隔離主線候選

使用本輪前已保存的 origin/main 15da187 完整來源副本，加本次四個程式／測試檔與系列／章節 completed 修正。六篇發布資料與原始主線一致，沒有使用舊 checkout 的 ready 狀態覆蓋主線。建置共用現有 node_modules；GIT_DIR 指向原 checkout 僅滿足建置追溯，產物不能作正式發布證據。

- pnpm test:public：１１０／１１０通過。
- content:validate：０錯誤、０警告。
- Astro build：５４頁完成。
- SERIES_EXPECT_COMPLETED=true 的 rendered test：通過；首頁、總覽、系列頁完結與結束期間一致，６篇完整、末篇有最後一篇提示。
- Astro check：２５３錯誤。移除本次程式／測試修改，回復 origin/main 原檔後重跑，相同２５３項錯誤且逐項診斷完全一致。屬此隔離來源／共用依賴環境的基線限制，未證明乾淨安裝的主線型別檢查結果；不宣稱完整 gate 全綠。

## 證據與交付限制

原始建置、測試與型別檢查紀錄保存在 evidence/。git diff --check 通過。spectra validate 通過；analyze 僅９項具體範例建議，無 Critical。決策索引追加本次條件，不改既有髒變更。沒有 commit、push、PR、部署或人工／遠端驗收。日後提交前須以最新主線與正確依賴重新完成必要完整 gate。


## 後續根因修復（２０２６－１１－０３）

前述失敗紀錄保留作歷史；以下最終結果取代其「尚未釐清」判定。

### 發文資料落後

本機 HEAD 為 0b60f76，保存的 origin/main 為 15da187。兩篇正文逐位元相同；發布 commit c4c1a47、b30190e 已將 template-hardening、tech-blog-boundary 分別記錄於 2026-10-26T07:00:00+08:00、2026-10-29T07:00:00+08:00。確認兩檔原先無未提交變更後，僅對齊這兩檔的主線版本與系列兩個 published 參照。未拉取其他主線內容、重發、通知或修改 provider。此為 Git 來源對帳，不宣稱新取得線上發布證據。

### ２５３項型別錯誤

隔離副本根目錄原本只連結舊工作目錄 node_modules；七個 workspace 並未安裝各自依賴，造成 @gcake/admin-contract、publishing-contract、vite 等解析失敗及連鎖型別錯誤。移除僅屬本次隔離副本的根 node_modules 符號連結，以其原始鎖檔執行 pnpm install --offline --frozen-lockfile；６０１套件全部由既有快取取得，無下載或鎖檔修改。最終 pnpm check ０錯誤、０警告、１提示。沒有修補２５３處來源，也沒有排除檔案或削弱檢查。先前將其稱為基線限制不足以說明根因；實際是隔離環境準備不完整。

### 發布演練 fixture

release:dry-run 重現失敗：複製真實已完稿系列後，只把文章重設 ready，未重設系列完稿狀態，違反既有 completed validator。僅於拋棄式副本把系列／章節重設 active，移除繼承的 publication 設定，以重啟完整生命週期。兩環境的同一演練修正後通過：６個初始 ready URL 不公開、１次本機 Git 發布、失敗建置沿用同身分、１次 mock 通知／重複０次、６篇正文與順序不變、正式寫入 false。editorial:rehearse 是同一腳本的相容入口，依既有證據重用原則沿用其通過證據，不重跑相同演練。

### 保留與環境

開始修復前記錄既有 dirty tracked 檔雜湊；除明確屬本工作的系列檔外，其餘原有未提交內容皆一致。保留所有其他 untracked 資料，沒有 stash、reset、checkout 或提交。隔離副本位於 /private/var/folders/93/84jn38xx69xfdnzsrq4xhxgw0000gn/T/gcake-series-completion-n711jnog，約９１９MB，無常駐服務；保留供本次候選複查。演練自行以 finally 移除其臨時資料夾及關閉 server/database。未啟動 Docker。


### 最終完整本機驗證結果

| 既有 gate | 原工作目錄 | 隔離主線候選 |
| --- | --- | --- |
| pnpm test | 整體 exit 0；Node 821、Python 309 通過 | 已執行所有組；先前 distribution 363／364，修復 Git 環境後同組364／364；補跑 observability 通過，其餘未受影響通過證據重用 |
| pnpm check | ０錯誤、０警告、６６提示 | ０錯誤、０警告、１提示 |
| pnpm build:all | 通過，含 content:validate | 通過，含 content:validate 與 diagrams:check:built |
| release:dry-run／editorial:rehearse 共用腳本 | 修復 fixture 後通過 | 修復 fixture 後通過 |
| 完結閱讀旅程 HTML | 首頁、總覽、系列頁、末篇通過 | 相同四介面通過 |
| git diff --check | 通過 | 來源修正套用於候選，未提交 |

隔離主線全套測試還發現缺少自己的 .git：distribution-attended 的真實 worktree 邊界案例因無法建立 worktree 而未拒絕錯誤位置。未修改安全邏輯或測試斷言；在隔離資料夾 git init，透過只讀 objects alternate 參照原 repo 物件，於隔離 repo 設定既有15da187來源與 index，不建立新 commit、不寫入原 repo refs。之後 distribution 全組364通過。最後以隔離 repo 自己的 Git 追溯重跑 build:all 通過，取代前次指向原 checkout GIT_DIR 的建置證據。沒有為階段轉換重跑未變更且已通過的其他測試組。

兩環境 Python 測試皆有既有 SQLite ResourceWarning，但309項均通過；不隱藏訊息，也不將警告稱為新的程式錯誤。型別提示同樣保留。原始失敗及修復後 logs 均保存於 evidence/，preservation.json 記錄其他既有未提交檔雜湊核對通過。

目前僅本機來源／環境修復與驗證，無新提交、推送、部署、訂閱者寄送或遠端驗收。隔離資料夾無常駐服務，保留至本次候選人工複查或交付結束；確認不再需要時可僅移除此精確資料夾，勿清理原 repo 物件庫。未刪除其他資料、備份或工作目錄。


## PR 候選審查與主線整合

基底更新至 ec0fe30fd59e941e9a21e194d6f7e87dd6304509（２０２６－１１－０３讀取遠端）。獨立 worktree／分支 codex/series-public-completion 僅套入本變更。兩篇發文資料早已在 main，PR 不重複提交；主線既有 releaseAuthorized 防護與系列內容保留。決策索引只追加本次一個段落，不攜入原工作目錄其他未提交段落。

此次 PR 不提交約５MB原始歷史 logs；原始檔仍保留原工作目錄，evidence/local-log-manifest.json 提供檔名、大小及 SHA-256，evidence/preservation.json 記錄前輪保留核對。本文前段的原始 evidence/檔案位置描述是當時本機紀錄，不表示所有 logs 都隨 PR 上傳。

候選審查涵蓋完整未篩選清單、暫停／排程優先、外部來源不變、首頁與篇尾共用狀態及演練副本範圍。未發現阻擋提交的程式問題。建置後 HTML 測試預設改為目前真實的六篇完結資料；四篇 fixture 仍可用 SERIES_EXPECT_COMPLETED=false 明確指定。


最新 ec0fe30 候選已完成完整 pnpm test（整體 exit 0，含 Python309項）、pnpm check（０錯誤／０警告／１提示）、pnpm build:all、pnpm release:dry-run（共用 editorial:rehearse 腳本）及預設完結 HTML 測試，全部通過。Spectra validate 通過，analyze 無 Critical。逐檔檢查 staged allowlist 為１５檔，apps／packages／工作流程與文章正文均無差異。原工作目錄１，１０８個變更檔案在 PR 準備前後雜湊一致。原始新驗證 logs 位於本機 /tmp/gcake-pr-*.log，其雜湊補入 manifest，未上傳原始內容。
