## Context

本案採用既有搜尋 Worker 與 DISCOVERY_DB 綁定。Cloudflare 管理 API 的 7403 是觀察路徑的失敗，尚無證據指向索引故障；本方案隔離這項依賴，不聲稱根治原認證問題。現有 fetch 另有具寫入效果的 internal/index-sync，不能充當健康查詢。現有 public manifest 沒有段落總數，不能直接拿 cursor 當完成百分比。

Decision context:
- gate_level: 2
- products: public article search and operator monitoring
- risk_tags: credentials, read-only boundary, background workflow, privacy, free-only resources
- decision_refs: ADR-001；fix-discovery-corpus-identity；本對話唯讀長期方案
- source_files: docs/decisions/index.md；docs/decisions/ADR-001-cloudflare-semantic-search.md；docs/article-discovery-runbook.md；openspec/changes/fix-discovery-corpus-identity/production-resume-20261030.md
- missing_sources: repo-local decision index absent；以正式索引與 ADR deterministic reads 取代
- constraints: 原 Cron／模型／500 額度／零付費超額／證據期限不變；不儲存查詢或 IP；不重播未知推論
- action: 只產生提案；實作時先重新確認擁有來源、Git dirty 與正式 runtime
- needs_ledger_update: implementation adoption and deployment evidence only
- needs_adr_update: 實作時在 ADR-001 加唯讀監測決策與憑證界線；本提案尚未部署
- needs_archive_backfill: none；不關閉既有 4.2／4.3 或歷史驗收
- reason: 新增受保護診斷介面，符合既有隱私與唯讀權限範圍

## 本次後台增補的決策核對

沿用admin-runtime與publication-monitor-summary的已登入owner、純讀取及失敗不冒稱最新資料原則；不改這兩份正式規格的既有發布行為。新UI與後台代理屬本次readonly-index-status capability擴充；需在實作時更新ADR-001與決策索引，這輪仍只改提案，無正式Admin／搜尋設定變更。

## Goals / Non-Goals

In scope：既有 Worker 的安全摘要、增量安全收據、純讀取客戶端、原追蹤流程的未來接線、失敗辨識與驗收分層。

Out of scope：修同步演算法、改 Cron、獨立監測 Worker、新資料表、獨立管理平台、查詢／IP記錄、公開任意 SQL、Cloudflare API Token 建立、升級方案、自動續期、額度寫入、向量清理及舊驗收結案。這輪不提交、部署、建立 secret 或恢復已暫停 heartbeat。

## Decisions

### Same Worker read-only route

GET /internal/index-status 在既有入口內獨立分流，先驗身分，再直接對 D1 執行一個具一致讀取快照的 SELECT（固定子查詢，無動態 SQL）；不經 createProductionWorker、activateFreeWindow、synchronizeIndex、D1Admission、AI 或 Vectorize。不接受 body、任意 SQL、表名、資產 URL 或同步操作參數。D1 無資料時回安全 unavailable，不初始化狀態。部署來源使用目前受驗證的搜尋版本，保留現場 bindings、flags、Cron 及既有其他 secrets，不能直接採 repo 內預設 false 覆蓋正式 true。

替代方案：Dashboard 作故障時的人工備援；專用管理 API Token 仍依賴相同管理 API；另一個 Worker 增加部署與綁定維護；公開摘要洩露操作進度。選擇在現有服務新增一個小型受保護讀取入口。

### Independent expiring monitor credential

新增 INDEX_STATUS_TOKEN（32 random bytes 的 base64url，43字元）與 INDEX_STATUS_VALID_UNTIL（UTC ISO時間）。它們與 INDEX_SYNC_TOKEN 完全獨立；既有同步 token 不能通過監測授權，監測 token 不能觸發同步。驗證採既有 SHA-256 後固定長度比較方式，單獨設計 GET 契約，不擴張舊觸發器。缺少、格式錯、過期或相同於同步 token 時停用入口。無／錯誤／過長授權一律404空回應，在 D1 前返回；不讀token內容到工具輸出。

初次配置明確核准後才生成及用 Wrangler secret 安裝；有效期預設最長30天，不延長索引容量或計費證據。client 從 macOS Keychain 專用 service gcake-index-status-production、目前帳號讀取，以子程序私有 stdin/stdout 傳遞並立即放入記憶體；不放命令列、shell history、repo、automation prompt 或證據檔。使用 macOS 內建 Security framework 的小型系統工具呼叫／包裝，不新增套件依賴；若需安全安裝互動則由既有 Keychain UI完成，不把secret傳給 security add-generic-password 的命令列旗標。安裝步驟與到期核實須在實作時先證明可安全操作，再啟用監測；未具備時明確 blocked，不退回舊 API Token。輪替只保留一個當前token，先準備新本機值、更新遠端、驗證新值與舊值拒絕；中斷保留已確認階段並人工續作，不把未知 secret write 盲重送。移除／過期token只停監測，不停雲端 Cron。

### Coherent bounded status and receipts

固定一個 SELECT 產生 policy 的安全投影、sync、pending聚合、同模型／預期namespace具非空metadata proof數與收據分頁，確保每次回應內不混合不同提交。不得回傳 raw policy、raw detail、owner、reservation/client/IP、payload、向量、文章正文、mutationId、secret或例外文字。raw status 只映射列舉；未知狀態明示 unknown，不當作成功。最近收據只含 id、createdAt、corpusId、allowlisted status、固定reasonCode。

query 只允許 afterReceipt（0至 Number.MAX_SAFE_INTEGER 的十進位整數）與 limit（1至50，預設20）；重複／多餘／不合法參數400，不讀D1。單次快照包含 firstRetainedReceiptId、latestReceiptId、hasMore；所有頁依id升序且不超過其快照高水位。afterReceipt低於firstRetainedReceiptId-1時 historyGap=true；高於latestReceiptId時 historyReset=true，均不能自稱完整收據鏈。不回填或改寫收據。首次從無checkpoint開始以當前可保留歷史標 initialBaseline，不假稱歷史完整；既有4217 checkpoint可接續而不重設。

HTTP200／application/json／Cache-Control:no-store／無CORS授權，最大64KiB；不新增Workers Logs、AI Gateway、cache或console。授權後D1失敗／5秒操作預算耗盡回503固定 status_unavailable，禁止回傳 exception、SQL 或管理API資訊。response包含 schemaVersion=1、observedAt、workerVersionId（平台版本綁定）、semanticEnabled、indexSyncEnabled、targetCorpusId、activeCorpusId、namespaceMatchesModel、reportedCompleted、storedProofCount、pendingCount、pendingStages（只列允許值或unknown）、leaseActive、nextAttemptAt、lastProgressAt、capacityValidUntil、billingValidUntil、recentReceipts（全域最新兩筆安全收據，降序）及receiptPage。生產 build 新增僅讀平台版本 metadata 綁定；這不是模型或索引設定。reportedCompleted 是runtime紀錄進度；storedProofCount是本地證據筆數，兩者都不是最新實體向量驗收。

### Monitor evidence and completion candidate

新增 scripts/discovery/monitor-index.ts 由既有 runtime直接執行，不修改package工作流程。每輪只有一次摘要請求；有收據 backlog才循 hasMore 每次最多10頁，尚未追完保存本地cursor並下輪續讀，不宣稱gap-free。HTTPS URL以已釘選官方workers.dev同一搜尋服務為唯一允許位置，禁止redirect；token只用Authorization送給該固定origin。每輪30秒整體預算、單次5秒；不自動重試。錯誤、401／403／404／503／逾時／非JSON／schema不合都不移動checkpoint，不轉用管理API、不自動login。

公開來源由固定 GitHub Pages origin下載，沿用既有manifest／digest檢查；新corpus時下載核對公開 index/passages/connections，計算合格段落總數，依corpus＋digest保存local-only快照。未變時重用已驗證檔案；每輪前後重新核對小manifest，若變動則source_changed，不判完成。total不可得時為null、百分比不產生。來源與target不同時為source_changed，保留原全域receipt cursor，只開新的corpus證據區間。

分類順序：監測失敗是 unavailable；任一flags關閉是 disabled；billing過期是 ineligible；capacity過期而未完成是 capacity_expired；未釋放的reserved推論且lease不活躍是 unknown_inference；有效lease或一般pending是 in_progress；無上述因素且nextAttemptAt在未來是 waiting（quota或provider backoff，不誤報卡死）；其餘由最新安全收據判 blocked／in_progress。15分鐘無新收據且無有效等待或lease時為stale，需要核實，不宣稱Cron停止。固定安全reason無法區分的原因為unknown，不解析自由文字猜測。完成候選另要求當期 public=target=active、namespaceMatchesModel、reportedCompleted=當期總數、pending0、無有效lease、最近狀態promoted/no_change，再取得同corpus兩筆相隔至少60秒的自然no_change；storedProofCount僅供診斷。

完成候選仍須獨立逐筆 provider audit（來源membership、模型、namespace、metadata、數值與1024維），之後才按本對話最多6次真實查詢及瀏覽器規則驗證。管理API7403只令獨立audit blocked，不能推翻已讀得的摘要或冒稱audit完成。新端點不新增Vectorize讀取權限或背後全量audit服務。人工相關性另待真人，不能自勾原4.2／4.3。

客戶端原始安全輸出與checkpoint以0600、Git-ignore的output目錄保存；固定origin、workerVersionId、response hash與時間可追溯，不保存Authorization。checkpoint採同目錄temporary file後atomic rename，只在一頁通過shape、版本與單調性驗證後更新。新失敗證據獨立追加，禁止覆寫舊失敗。版本變動、歷史gap/reset告警一次並等待核實；一般進度安靜。僅在明確授權的部署驗收後更新既有追蹤automation使用新client，仍每15分鐘，無新Cron／本機daemon。

## Implementation Contract

新增一個 readonly-index-status capability；產品程式不在提案階段撰寫。呼叫者觀察到200安全快照、400不合法查詢、404授權不可用、503讀取不可用；所有路徑都無應用資料寫入、模型或索引操作。固定SQL快照與拒絕未授權前讀資料是明確架構／隱私約束，可以以依賴spy或授權前D1呼叫計數驗證，而不是只搜尋source字串。

完整Given／When／Then先於tasks完成。先寫會失敗的endpoint與monitor acceptance：正常讀取、認證隔離、過期、錯誤、並行快照、分頁與retention gap、來源異動、等待／stale、完成候選與audit區分。再按需要拆分類純邏輯unit及真SQLite fixture integration，延伸現有測試入口，不加新測試層或CI。既有同步／搜尋回歸必須涵蓋監測密鑰不能授權同步、狀態請求不建立UTC window及搜索路由不變。

## Risks / Trade-offs

- 新憑證洩漏風險 → token只能讀安全摘要，獨立於寫入token、有期限、Keychain保存、no-store且不記log；仍須保護本機帳號。
- Worker／D1故障仍使監測失敗 → 明示 unavailable，以後台Console人工備援；不承諾任何7403永不再發生。
- 讀取發生於同步中 → 單SELECT快照；pending／lease清楚展示，不推算完整度。
- 誤把百分比當驗收 → total來自hash核對的公開資產，cursor僅reported；完成候選不等於provider audit。
- 監測增加資源用量 → 每15分鐘最多96次摘要／日，每次一個SELECT；後台可見時另每5分鐘最多一次摘要、288次／日／持續可見分頁，手動重新讀取最多每10秒一次、不自動重試；每個分頁使用單一in-flight請求，沒有全站輪詢。每頁最多50筆。追歷史每輪最多10次額外請求，規劃上界1056次／日，並非實測或官方帳單。計數proof可能掃清冊；實作以當期規模查query plan與單次rows_read，不加新index除非量測證明必要。它不扣AI／Vectorize預留，但仍消耗Worker與D1免費資源；報告實際rows_read與時間，不推估費用節省。
- 新機制維護成本 → 一個搜尋route、一個既有後台授權代理、固定schema、一個client、一組token與輪替流程及既有後台小型區塊；無新依賴／資料表／CI。簡單替代是後台人工查；持續無人監測需要跨越管理API依賴才值得新增此介面。

## Migration Plan

1. 本機實作與完整既有gate後，以另行授權的Git操作提交PR；檢查後合併並確認exact main CI。
2. 另行確認正式Worker當期版本與進行中的lease／pending；此改動無migration、不清狀態。不將同步停用當成無副作用的預設動作；若部署需停排程，先提出具體過渡方案取得授權。
3. 獲secret／部署授權後配置獨立token、30日內明確到期與版本綁定，以同原flags／Cron部署，核對下載程式與設定。token不加入全域required secrets以免其他候選或環境被迫啟用；缺token入口安全404。
4. 正式GET前後核對應用表與window／預留未被監測寫入；若Cron並行造成合法變動，依其收據歸因，不以整庫hash必須不變誤判。驗證合法／非法token、cache headers、版本與安全欄位、history頁界，保存零AI／向量操作證據。
5. 人工授權下接線既有monitor並保留舊7403失敗。回復先移除監測token／停監測，搜尋與Cron保持原設定；必要code rollback只選相容0005與stable namespace的版本，不回到舊不相容Worker。

## Open Questions

無阻擋本機實作的需求問題；以下為正式啟用前的可核實條件，不以等待時間當授權：既有Keychain在無人輪次是否可安全讀取、正式host及runtime pin、實際憑證期限、額外Worker／D1讀取餘額、獨立provider audit管理存取是否可用。未通過各自列blocked，不擴權或繞過。


## 後台顯示增補（本對話追加）

本節將原來只有本機證據／本對話通知的方案擴充為既有後台可見；沿用 readonly-index-status capability，不改寫已採納發布或Substack規格。需另部署Admin前端與Admin Worker，不能只部署搜尋Worker便宣稱畫面已上線。

### Owner authenticated admin panel

放置於既有「發布管理」總覽、Substack狀態區塊之後的「搜尋索引」，不新增工作區或進入文章編輯才看得到的入口。採現有panel標題、定義清單、按鈕、台北時間與明暗主題樣式；320px畫面直向呈現、不溢位，以文字標籤加狀態色，不只用顏色表意。載入時aria-busy與中性「正在讀取」；401／403時隱藏先前敏感摘要，要求重新登入／顯示無權限；讀取錯誤保留上次安全摘要但顯示「目前無法更新」與其實際觀察時間。舊資料永不當作本輪成功。

固定欄位：進度（reportedCompleted／verifiedPublicTotal，標「已記錄驗證進度」）、pendingCount、處理狀態、下一次可續作時間、最後成功讀取、最新進度收據時間、容量／billing到期、驗收階段。總數由Admin伺服器依固定公開origin與manifest資產digest核對後計算，記錄source corpus與digest，缺資料時total=null，顯示「已記錄X段，總數待核對」，不產生百分比。分母與runtime target不同時改顯示「公開版本已變，等待對齊」。來源資產的已驗證總數可在Admin Worker記憶體按corpus＋三資產digest快取，無持久表；每次仍前後核對小manifest。冷啟動重新驗證，不以未核實大小／舊corpus數量代替。上游摘要讀取5秒、公開來源沿用既有大小／固定URL／digest與來源預算，代理整體最多25秒；瀏覽器等待27秒。全部逾時可觀察為unknown，不自動重試。

「驗收階段」明列「同步中」或「同步完成候選，搜尋待驗證」。API／瀏覽器／人工驗收若沒有與當期source及runtime pin綁定、由既有正式驗收紀錄提供的可核實結果，預設顯示「尚無本輪驗收結果」。本次不建立新驗收資料表或將本機檔案發布到後台；因此即使對話已完成實測、但後台無權威收據來源，也維持此文案，避免虛構綠燈。

後台由recentReceipts顯示最新一筆安全收據，只有最新兩筆皆為當期corpus的自然no_change、相隔至少60秒且其餘候選條件成立時才標「同步完成候選」；不追完整歷史，也不宣稱收據鏈已獨立核實。完整歷史與checkpoint仍由原monitor負責。顯示等候、來源變更、過期、不可用各有文字原因；不提供重跑／啟用／補額／清pending／更新憑證按鈕。「重新讀取」只有GET。可見且停留發布管理時每5分鐘刷新一次，首次載入一次；切換分頁、隱藏、登出或unmount即停止並取消請求。手動刷新最短10秒間隔，pending時停用；舊請求不能覆蓋新結果。

瀏覽器只以既有same-origin session cookie請求GET /api/v1/discovery/index-status。Admin Worker先用既有session store驗證session未過期且GitHub user id在owner allowlist，未登入401、非owner403；未設定runtime503，零上游請求。不得把發布、重新驗證或queue ingestion的函式當作讀取前置。代理只呼叫已釘選搜尋host的GET /internal/index-status，監測token放Admin Worker secret INDEX_STATUS_TOKEN，與local Keychain同一唯讀資格、相同到期；不需要Cloudflare管理帳密、同步token或新D1綁定。不轉傳任意client headers、URL、SQL、參數或credentials；不redirect、不回傳上游自由錯誤、Authorization或set-cookie。

代理驗證schema、安全欄位白名單與workerVersionId，不返回token或原始policy；回應no-store、無跨站CORS。每次來源檢查失敗仍能提供已核實上游摘要，但標sourceUnavailable與total=null；上游摘要失敗回503安全代碼，畫面自行保留有時間標記的上次資料。Owner proxy本身不讀寫搜尋D1、reservations或provider；讀取既有session資料不是搜尋狀態寫入。新增成本僅既有Admin Worker請求與公開資產校驗，實作按現有來源reader重用核實邏輯，不新建監測後端或共享大套件。

驗收增加：owner／未登入／非owner／到期session隔離，缺設定零上游請求，代理不洩secret，unknown total、來源中途更換、上游503與過時畫面、可見刷新停止／取消競態，320px／鍵盤／明暗主題。先依Gherkin新增acceptance RED，再用現有Node／Vue測試路徑與既有瀏覽器驗證，避免為此新增E2E平台。正式驗收需分別核對搜尋Worker、Admin Worker與Admin前端產物及權限；任何一項未部署都如實列未完成。


## 圖形化進度條與既有設計系統（本對話追加）

### Graphical progress follows existing admin standards

視覺權威為 DESIGN.md 指定的 docs/design-system.md「後台視覺基礎規範（2026-10-19 採納）」；已核對 apps/admin/src/admin.css 實際token。規範已涵蓋字級、間距、控制、雙主題，不重新制定另一套。此後台屬product介面，保留白天／夜間使用者可切換的既有雙主題；不因根PRODUCT.md的公開站brand register而改為行銷版面。新的共用進度條規則在同份設計系統加一節，標明尚未實作／部署，避免將設計契約當驗收成果。

| 項目 | 已有角色與本元件使用方式 |
| --- | --- |
| 區塊標題 | --text-heading，20px等值rem，字重650至700，行高1.45 |
| 進度段數、百分比、重要錯誤 | --text-body，17px／1.8；數字字重650，tabular-nums，不以巨大數字作主視覺 |
| 狀態、最後更新與輔助說明 | --text-small，14px等值rem／1.7；警示與錯誤主句用17px |
| 內部間距 | --space-8用於同組數字／標籤，--space-12用於進度文字到橫條，--space-16用於橫條到狀態／時間，--space-24分隔資訊組 |
| 整體框架 | 原72rem、760px單欄、桌面24px與手機20px左右留白，大段落沿用48px，不新增卡片陰影 |
| 橫條 | 寬度100%、高12px（--space-12），圓角--radius-control=5px；軌道--paper-deep加1px --rule邊框，填色--accent；填充覆蓋比例以外不新增裝飾 |
| 操作與焦點 | 僅一個「重新讀取」secondary-action，44px高、5px圓角、8px／16px內距、650字重；沿用hover、disabled及3px accent焦點外框／4px offset |
| 狀態 | 一般／完成候選沿用accent；注意warning、錯誤danger皆搭配白話文字，說明仍ink，不加新綠色成功色 |

進度區上方左側顯示「已記錄驗證進度」，同列或下一列顯示 X／Y段 與百分比；下方為單一橫向進度條、狀態文字、待確認段數與最後更新。760px以下文字換行，橫條仍佔可用寬度；320px保留20px邊距且不水平捲動。不新增儀表板卡片網格、光暈、漸層、跑馬燈或平滑自增假進度。

僅當source與target對齊、total為正整數、reportedCompleted為0至total整數且資料為本輪成功時，產生定量進度。使用原生progress(value=X,max=Y)，具可見label與狀態／時間的describedby，並保留鄰近文字。百分比為floor(1000*X/Y)/10，最多一位小數，達到總數前不四捨五入顯示100%。例：304／2995顯示10.1%，2994／2995顯示99.9%；這些是設計例子而非最新正式進度。

總數未知、來源不合、無有效數字時：中性空軌道配「總數待核對」或「公開版本已變，等待對齊」，不填假比例、不填aria-valuenow。使用具名稱的progressbar語意標示未知數量，且以文字明示是否正在處理，不能用動態不定進度暗示仍在執行。已核對空集合0／0時顯示「目前沒有可建立索引的公開段落」，不計算0/0，不以100%代表搜尋可用。負數、NaN、完成段數大於總數皆視為狀態不一致，不clamp成成功或正常。

等待／停止且已有有效分母時保留最後已知比例，但主句為「等待雲端確認」「等待可用額度」「處理已停止」及最後成功時間，不動畫。重新讀取失敗時可保留同版本的舊橫條，但label改為「上次記錄進度」，清楚說明目前無法更新、暴露舊觀察時間；新版本已確定變動時不保留上一版比例，不能把它當新版本進度。401／403依原設計清除受保護摘要。

滿條只表示已記錄驗證段數到達總數，不表示promotion／完整供應商audit／搜尋正常。若仍有pending或缺兩筆自然no_change，顯示「段落已處理，等待完整確認」；候選條件全滿時顯示「同步完成候選，語意搜尋待驗證」。更新不移動焦點，aria-live=polite只宣告有意義的狀態改變；禁止每次輪詢重讀整組metadata。不做填充過渡／循環動畫，因此prefers-reduced-motion下也無持續動態。

驗證沿用現有狀態單元測試、acceptance與一次瀏覽器巡檢：0%、正常小數、未滿100、滿條但pending、未知total、0/0、錯誤數字、來源變更、讀取失敗舊值與401清除；檢查progress可及名稱與值、無顏色單一訊息。視覺量測桌面與390px各明暗兩種（既有4組），加本功能320px邊界與200%縮放；量測實際computed字級、元素邊界間距、按鈕高度與對比，不以CSS字串或變數名稱取代驗證。不新增UI套件、視覺回歸平台或CI；維護增量是共用規則與既有CSS的進度條樣式。
