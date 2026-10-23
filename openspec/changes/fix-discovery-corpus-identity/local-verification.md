# 本機實作與驗證（２０２６－１０－２４）

本輪授權為本機實作及驗證。基線main為13f71b8584b8307e0f4bfd3bf84f3bde500dd11e，開始時工作目錄乾淨；沒有commit、push、PR、正式模型呼叫、正式資料／設定／排程寫入或部署。提案階段的「不實作」是歷史執行邊界，本輪由使用者的新指示授權實作，不代表正式操作授權。

## 變更結果

buildPublicDiscovery以discovery-content-v2的確定性內容投影產生corpusId，保留完整快照hash及建置追溯於原manifest；topics／source aliases按集合正規化，物件鍵排序，保留段落及排名順序。投影涵蓋文章、段落、詞彙、postings、connections、diagnostics與來源別名；不用刪generatedAt或偽造產製時間。site組裝不需改動，測試直接執行其實際來源並提供離線Astro／catalog／IO。

同步保留batch16、每分鐘cron、45秒期限；最多讀回一批後準備下一批，15秒後不追加工作。基本控制／讀回預留40，初次準備額外32，同輪續作額外72；讀取、模型及整批最壞儲存成本各自先預留。以原子SQL對owner／租約與policy限制讀回清冊、pending清除、游標及promotion。另以syncCapacity證據及保守整批複製計數拒絕不明容量，不預設雙整庫免費。無新服務、依賴、測試層、workflow或D1 migration。

容量證據缺少時，未來候選Worker會停止新上傳；正式舊policy尚未更新，不能直接部署後期待同步自動恢復。這是刻意維持「未知容量停止」的必要部署前置條件，不是本輪已完成provider驗收。

## Acceptance RED／GREEN

- identity-red.log：原實作26項中24過、2失敗；完結快照經實際restore與site組裝，在兩固定時間passages相同但corpus不同。錯誤為身分斷言失敗，不是fixture或import錯誤。
- effective-metadata-red.log：將build暫時還原為精確基線後，獨立驗證series label／source alias／interactive等有效資料失效缺口；執行後立即還原候選。
- configuration-order-red.log：相同設定物件只有鍵順序不同仍錯誤換身分；正規化configurationDigest後GREEN。
- continuation-red.log：原版18項中16過、2失敗；確認已讀回後仍固定退出，沒有同輪下一批。舊測試原本要求verified再下一輪promoted，依核准新契約改為當輪可promoted，並保留完整讀回斷言。
- capacity-red.log：缺少全帳戶容量證據仍上傳相容舊向量；新增保守容量檢查後通過。
- no-change-budget-red.log：若每分鐘空檢查也預留72，會單獨耗盡80000每日admission；保留基本40、只在準備時追加預留後通過。
- identity-green.log：28項通過。continuation-green.log：24項通過。runtime-green.log：17項通過；其中同corpus但最終descriptor改變仍拒絕，沿用409／keyword契約。完整gate另列，這些單項紀錄不是provider或自然排程證據。

## Gherkin 對照

| 需求／情境 | 本機驗證位置與可觀察結果 |
| --- | --- |
| Stable search content identity：兩時間還原／無關建置 | corpus.acceptance的Equivalent completed snapshot restores、Stable identity；cloud-sync的Equivalent public rebuild及Completed equivalent rebuild，確認pending與游標延續及完成後零enrichment。 |
| 無效來源或asset／同身分descriptor競態 | 既有completed-restoration的hash／pin／body tampering、assets.acceptance的digest拒絕；cloud-runtime新增Equal content identity，最終409保留keyword。 |
| Effective source changes invalidate identity：各單欄變動／資格邊界／撤回／空集合 | corpus.acceptance的Stable identity表格、Effective aliases、Configuration object、既有Article becomes public及Draft and future exclusion；cloud-sync的Changed public release與Completed equivalent rebuild，驗證新目標安全初始化。 |
| Bounded verified continuation：成功下一批／延遲讀回／時間及quota不足／最後部分批／最後來源變動 | cloud-sync的Verified continuation（33段）、Readback preserves progress、Saved output waits、Tampered provider、Final source change，分別確認最多16、游標只在完整核對後前進與拒絕過時提升。 |
| Durable safe resumption：同身分／真變更有或無pending | cloud-sync的Equivalent public rebuild、Changed public release與Completed equivalent rebuild。 |
| 租約競爭／中斷未知／保存輸出暫時錯誤／owner失效 | cloud-sync既有Disabled expired and concurrent、Unknown inference、upload acknowledgement lost，以及新增Lease lost、Owner lost during final manifest，驗證不重播、不前進或覆蓋operator。 |
| 讀者競爭／到期／停用 | cloud-sync的Reader admission competes、Shared daily quota、Disabled expired、Final source change and policy expiry；assets.acceptance既有真SQLite final-slot原子預留及cloud-runtime每日不補滿測試。 |
| Capacity-safe legacy identity transition | cloud-sync的Capacity evidence、Legacy transition（三種替身語意）、Only owned obsolete vectors，確認缺證／過期／other usage／retained資料阻擋，已證明數值可重用但讀回前不提升，不刪未知向量。 |
| Separate local and unattended acceptance evidence | equal-input-comparison.json及comparison-case.txt只證明固定時鐘下的有界續作；task4.1–4.3及舊change12.2均不勾選。正式資料、provider與人工證據本輪不存在。 |

## 離線效率比較與成本

固定33段、batch16、同policy、同provider可讀時序，每個延遲／版本各1個確定性樣本。原版來自釘選基線的sync.ts，候選及原版使用相同真SQLite fixture、來源及模型替身。comparison-case.txt保存一次性可重現case；comparison.log及equal-input-comparison.json保存結果。

| 最早可讀延遲 | 原版→候選輪次 | 固定時鐘模擬經過時間 | D1 statement數 | admission保守預留 |
| --- | --- | --- | --- | --- |
| 上傳後1分鐘 | 7→4 | 360000→180000ms | 229→235 | 292→438 |
| 上傳後2分鐘 | 10→7 | 540000→360000ms | 265→280 | 412→567 |

每種情況推論均3批、上傳3批；tokensReserved均1386、unitsReserved均1.48995、storageReserved均33792。候選減少固定等待輪次，但增加守衛與保守預留；這些不是供應商實際用量、正式延遲分布或帳單節省。測試另確認總admission預留涵蓋實際statement數，以及空檢查本身的1440次基本預留不超出日上限。

## 本機 gate 與環境界線

Node v22.23.4、pnpm 10.17.1（專案釘選）、Python3.15，本機macOS；PR CI的Node24／Linux結果不在本輪範圍。全域pnpm12自動工具解析遇sandbox寫入限制，改直接使用已存在的釘選10.17.1，沒有改依賴或lockfile。

原目錄pnpm check在既有忽略的output/discovery/merge-deploy-cloud-20261021/cloud-evaluate.ts出現2個implicit-any錯誤，另有舊local-source-smoke未用import提示。這些檔案保留且未修改；check.log保留原失敗。另在本次擁有的/private/tmp/gcake-discovery-identity-validation/check-workspace，以精確基線tracked檔加本輪diff複製候選，沿用相同node_modules執行完全相同pnpm check，278檔0 errors／warnings／hints；不改原tsconfig排除規則。這證明候選程式型別檢查，不宣稱原目錄gate已轉為綠燈。

sandbox禁止127.0.0.1 fixtures，初次完整測試與release:dry-run失敗；hermes-sandbox-reproduction.log獨立重現PermissionError。已保存失敗／中斷收據，使用允許本機socket的權限重跑既有gate；不改測試斷言、不跳過Hermes、無真實通知或provider。

完整gate的最終結果及候選hash見evidence/local-gate-summary.json。沒有Docker或本次新增Chrome分頁；隔離check工作目錄及pnpm wrapper均屬本次工作，完成後精準清理，收據留在change內。

## 最終狀態與未完成 gate

本輪９／１３項任務完成；3.2完整本機gate仍未完成，4.1–4.3正式操作維持未授權。pnpm test先有24項editorial通過，Hermes286項中同一test_every_crash_boundary_recovers_in_fresh_controller_process的兩個subtest超過原10秒期限，另一subtest預期exit79實得1，因此aggregate失敗。Hermes來源與基線逐位元一致，未改逾時或斷言。另用Python3.13隔離執行該單一案例109.861秒後通過；因直譯器及執行情境不同，僅證明這個環境下可通過，不宣稱已定位或修復原3.15失敗，不把它改稱全套綠燈。

aggregate停止後，以原有命令完成剩餘檢查：public107、workspaces357（含search-worker75）、foundation／public-visibility18、distribution299、observability1，共782項Node測試通過；加前述editorial24，Node共806項通過。build:all、release:dry-run、editorial:rehearse均exit0，兩項演練輸出productionWrites=false且未呼叫正式通知。原目錄check仍失敗；隔離候選check278檔全綠。Spectra validate通過，analyze零findings，git diff --check通過；這些均不取代尚未通過的完整gate。

本次隔離check的６份TypeScript候選與原工作目錄SHA-256完全相同。已精準移除本次/private/tmp/gcake-discovery-identity-validation（含隔離tracked副本、建置／型別衍生資料及pnpm wrapper），不跟隨node_modules symlink、不移除原依賴或舊output。本機未啟動Docker、未新增瀏覽器分頁或常駐服務。未提交、未推送、未建立PR、未呼叫正式模型、未改正式資料／設定／排程或部署；原搜尋change的歷史1.1及自然12.2完全未修改。

## 完整 gate 阻礙的根因與修復（本輪追加授權）

使用者另授權修復兩項本機阻礙，保留全部既有修改，仍不提交或操作正式環境。前節未完成狀態與失敗收據保留為當時結果，後續結果另存gate-repaired-results.json，不改寫舊收據。

### 舊 output 型別

cloud-evaluate.ts的results由動態JSON迴圈逐筆push，在嚴格型別模式下跨avg closure使用時無法推斷空陣列的元素型別；avg還接受任意string索引，使數值欄位契約不明。保留檔案，加入明確QueryResult及三種數值key的聯集型別，沒有any斷言／忽略規則或tsconfig排除。local-source-smoke.ts另移除未使用manifestUrl import，未執行任一歷史腳本，沒有模型／正式來源呼叫。兩份原始位元組與前後SHA保存於output-type-repair.json及對應before-gate-repair.txt。原工作目錄pnpm check已294檔零診斷，無需隔離目錄替代。

### Hermes 復原

以原Python3.15、原fresh controller與10秒期限執行相同replaced:updater崩潰階段。profile-before顯示83次ACL子程序呼叫、總4.807秒，其中4.651秒位於ACL檢查；stack固定落在validate重複啟動原生ACL子程序的subprocess.run，沒有證據指向新的搜尋索引或配額程式。完整測試原10秒截止因此對程序啟動成本敏感。這不是單純換Python就已解決的問題。

新增acceptance在每次真實ACL子程序啟動前注入固定150ms成本，仍用原10秒deadline；原版確實TimeoutExpired（recovery-startup-red.log），修正後同一情境4.393秒內完成整個測試（含fixture初始化、崩潰與核對），還原原slots／selection並保留history。未增加重試、放寬timeout、降低斷言或跳過ACL。

修正把單次EntryStore.validate的必查節點合併成一個native子程序，仍逐節點完整檢查，每次validate都重新執行；單節點safe與recursive payload檢查也保留原有界執行方式。native child核對每個authority節點的ACL、owner、mode與symlink，拒絕parent初查後的unsafe metadata；不跨次快取、不沿用上輪安全結果。整批共用原30秒native budget，parent仍限時並回收child；root-user例外及所有既有寫權拒絕規則不變。

相同單phase各一次profile-after：ACL子程序由83降為12，總耗時4.807→0.716秒，profile只是本機單樣本，不宣稱正式SLA、付費節省或原正式PermissionError根因。控制流程沒有增減復原階段或service動作。21項真實Darwin ACL與新增authority批次測試通過，涵蓋後段write ACL、權限變動、變動時序及逾時child回收；其他崩潰邊界由完整gate再次驗證。

### 本輪最終完整驗證

[gate-repaired-results.json](evidence/gate-repaired-results.json)的五個原命令全部exit0：pnpm test（178.943秒）、pnpm check（9.080秒）、pnpm build:all（7.427秒）、pnpm release:dry-run（13.550秒）、pnpm editorial:rehearse（13.526秒）。完整測試包含Node806項與Hermes290項，共1096項，全部通過；原崩潰復原迴圈沒有改動期限／斷言，新增受控啟動成本情境也一起通過。原工作目錄check含保留的output腳本，共294檔零errors／warnings／hints；不再依賴隔離目錄替代證據。

完整候選SHA、環境與保留／清理收據見[gate-repair-summary.json](evidence/gate-repair-summary.json)。原失敗紀錄及前次local-gate-summary.json逐份保留，本節只更新目前候選狀態。Spectra validate通過、analyze零findings，git diff --check通過；11／14項完成，僅另待正式授權的4.1–4.3維持未完成，原搜尋change歷史1.1／自然12.2未改。未執行commit／push／PR、正式模型／資料／ACL／服務操作或部署。

本次診斷腳本與pnpm wrapper所在/private/tmp/gcake-full-gate-debug-20261024已精準清理；profile重現配方及原始輸出留在本change evidence。沒有本次Docker、瀏覽器或常駐服務殘留，先前六份TypeScript候選逐位元保留；兩份output舊檔仍在原位置，修復前位元組另存備份。這些是macOS／Node22／Python3.15的本機結果，未宣稱Node24／Linux CI、正式安裝、provider或人工搜尋驗收。

## 本輪提交前核對

本輪新增明確commit／push／PR授權，不包含合併、部署或正式provider資料。受測來源hash及依賴／設定未變，沿用完整gate；範圍與排除檔案見commit-scope.md及evidence/pre-pr-review.json。舊output原檔修復保留在本機，不加入忽略目錄；不封存，也不改正式驗收任務狀態。PR CI是後續獨立證據，不以本機結果冒稱遠端通過。

提交前staged檢查另涵蓋新加入的工具log，發現原始行尾空白；已將全部raw logs逐位元封存至evidence/raw-log-bytes.tar.gz，文字版只正規化空白，hash對照見evidence/log-formatting.json。沒有改動舊失敗結果、驗收條件或檢查規則。
