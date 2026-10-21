# 公開文章探索：本機候選操作手冊

本次只交付本機候選，不部署、不建立 Cloudflare 資源、不呼叫雲端模型、不修改正式排程或 Substack 設定。後續已獲使用者授權的前景 Ollama 本機比較，範圍另見下節。原始碼、測試及證據不代表 provider 品質或人工作品驗收。

## 靜態文章庫

`loadReadingCatalog` 是公開來源入口；本機 Markdown 使用 Astro 的實際標題識別，匯入文章使用釘選快照的 HTML。來源以 `local:`／`ithome:` 區分。草稿、未到公開時間的文章不進入資產；不執行互動 MDX，公開的互動文章仍可依標題搜尋，正文排除另留診斷。

每個建置程序使用相同的公開資格時間。`PUBLICATION_NOW` 只供受控建置／離線演練固定時間；正式採用前必須確認整個建置使用一致時間。儲存、合併與日期到達不等於發布成功。文章新增、修改、改名、撤回、刪除都在下一次實際建置重新產生完整文章庫、引用與關聯；失敗建置不能取代已確認公開的產物。

`discovery-manifest.json` 記錄 corpusId、基底 Git commit、資格時間、快照與設定 digest，以及每個資產的 SHA-256。未提交候選的實際公開內容另由每篇 sourceRevision 與資產 digest 識別；HEAD 本身不是整個未提交候選的身分。

`/discovery/<corpusId>/index.json` 保存文章、明確詞義、倒排資料與欄位長度；`passages.json` 保存來源段落；`connections.json` 保存引用與推薦。舊 `/search-index.json` 保持陣列格式。首次搜尋所需壓縮資產須把索引和段落一起計算，不能只報索引大小。

同樣 HTML 與完整擷取設定可以重用內容雜湊快取；推薦及倒排資料仍隨整個文章庫重算。段落最長８００個 Unicode 字元，前段重疊最多１２０字。重複或沒有穩定標題錨點時，連回文章本身，不捏造定位。

## 搜尋與閱讀

導覽列保留單一 GET 搜尋框。搜尋頁保存 `q`、`topic`、`series`、`sort`、`mode`、`page`；每頁最多１０篇。輸入超過２００字拒絕，不截斷；無效條件回到可見的預設值。篩選先於計數與分頁；無完整符合才標示部分符合。

中文分詞與漢字雙字詞、NFKC、技術符號及 BM25 欄位權重由共用模組處理。縮寫必須有明確定義及公開段落證據；無依據不展開。醒目標示只建立文字節點與 `mark`，不插入查詢 HTML。遠端結果再用本機文章與段落重新取得標題、連結和摘錄。

自動規則漏抓的明確名稱對照可放在 `src/data/discovery/terminology-reviewed.json`。每筆保存文章身分、來源修訂、原文引句、兩個名稱與審閱者；建置只套用仍公開、修訂及完整引句一致、兩個名稱都在引句內的記錄。來源改版後須重新檢視證據，不自動沿用。校正表進入設定與文章庫雜湊，避免舊資產混用。概念解釋與相鄰提及不能只因同段出現就加入校正表。

兩種文章模板依序呈現正文、延伸閱讀、既有訂閱及系列導覽、相關文章、引用／反向連結。推薦每組最多３篇，跨組去重；引用不因推薦而消失。沒有項目就不產生空區塊。原文、canonical、官方主題分類與通知政策保留。

## 本機驗證

沿用既有完整 gate：`pnpm test`、`pnpm check`、`pnpm build:all`、`pnpm release:dry-run`、`pnpm editorial:rehearse`。不另重複 aggregate 內的子檢查，不新增 CI 工作。

建置後執行 `pnpm discovery:inspect`，核對所有資產雜湊、文章修訂、段落錨點與合計 gzip 大小。先執行 `node --import tsx scripts/discovery/freeze-sample.ts`，依本次公開文章與有證據的詞義產生 `test/discovery/retrieval-judgments-current.json`；再執行 `node --import tsx scripts/discovery/evaluate.ts`。舊的中文／改寫題只在來源修訂及證據仍一致時沿用。來源或設定不合會拒絕評測；不要為得到通過而更改預期結果。

`pnpm discovery:browser` 使用既有本機 Chrome 與 `/gcake-dev` 基底路徑，涵蓋 GET、篩選、返回、分頁、連線失敗重試、舊請求取消、降級、無 JavaScript 入口及雙主題／手機畫面。測試擁有自己的 localhost 伺服器，透過 finally 關閉；合成 provider 回應只透過 Playwright route 存在於記憶體，不寫入文章。截圖與伺服器紀錄在 `output/playwright/discovery/`，保留作本次人工檢視輸入；沒有 Docker 資源。

量測只代表紀錄中的裝置與本機負載；不推算節費、正式網路延遲或模型品質。冷載入５次、記憶體已有文章庫的查詢２０次，記錄 median／p95／max 與錯誤數。

## 語意服務的本機契約

`apps/search-worker` 是獨立公開服務，沒有 Admin／GitHub／發布權限。預設沒有遠端綁定、正額度或啟用設定；有效查詢回傳 `503 SERVICE_UNAVAILABLE`，不合法查詢回傳 `400 INVALID_QUERY`，瀏覽器保留關鍵字結果。`createWorker`／`createSearchService` 接受離線替身驗證契約，不代表正式 runtime 已可啟用。

只接受官方 `@cf/baai/bge-m3`，實際開發者為 BAAI，依使用者授權暫時例外；１０２４維、cosine，查詢與文章均為相容的 plain 設定，不套用 Google 前綴。其他 BGE、重排器、Qwen、未知來源及自動替代均拒絕；文章討論這些技術的正文不被過濾。沒有答案端點、生成模型或聊天歷史。

Worker 固定讀取本站 manifest，核對 schema、來源、資產 digest 與啟用 corpusId，拒絕 caller URL。取得向量後仍依本期文章／段落／修訂 allowlist 回查，再以 RRF（k＝６０）合併；最多５０篇候選，先套篩選與排序再分頁。返回前再核對 manifest；變動則丟棄遠端結果。

Vectorize 本機介面以每個公開主題的布林 metadata 欄位及 series 過濾，並使用 corpusId namespace。正式建立前須核對所需 metadata index 的數量及型別，先建 metadata indexes 再 upsert；目前沒有建立任何遠端索引。

## 免費用量與啟用邊界

付費超額授權固定為零。有效證據須涵蓋精確模型、帳戶、現行免費待遇、供應商強制零超額邊界、當期 provider window、到期時間及各服務正上限。缺少價格或 Beta 標籤都不代表免費；零費率還需要明確免收費條款。既有付費共享帳戶的其他消費者若未協調且沒有供應商硬限制，維持停用。

D1 migration 已在本機 SQLite 驗證，未套用至遠端。單一 INSERT 與 SQLite trigger 原子扣除同一 provider window 的額度及短期雜湊節流；不使用每個 isolate 的計數器保證費用。預留保守最大用量；不確定結果不退回預留額度、不自動重試。現有 BGE 介面未提供經核實的實際 token 結算，因此不能宣稱已完成 provider 級結算驗收。

IP 只用於具密鑰、逐分鐘更新的短期雜湊，應用不記錄原始查詢或 IP。正式接線前仍須查核平台紀錄與 provider 保留政策。當期 window 必須與已確認的供應商日期一致，不因本機跨日自行補額度。索引準備必須將初始、暫存及保留索引共同扣抵剩餘容量；空白設定、非有限容量及無效向量會在上傳前拒絕，快取包含模型與維度。

## 發布、啟用與回復

離線流程為：建置靜態文章庫 → 對變動內容準備相容向量 → upsert 後 read-after-write → 在既有授權部署中確認本站 manifest → 只允許相同 corpusId、文章／查詢模型設定與維度一致的索引切換。`scripts/discovery/lifecycle.ts` 只有受注入 adapter 控制的本機邏輯，未接入正式發文排程。

新版網站先上線但向量未就緒時，服務回到新版關鍵字搜尋。撤回文章不能透過舊 namespace 恢復。回復方式是停用語意、保留目前靜態來源；不得回部署會重新暴露撤回文章的舊產物。舊 namespace 的刪除要等正式啟用與在途請求過期確認，另在獲授權的前景操作執行；本次沒有可刪除的遠端資源。

未來 EmbeddingGemma 須重新核實免費待遇、輸入格式／上限、７６８維輸出與品質，重建整套相容索引，再同時切換文章與查詢模型。不混用１０２４／７６８維，也不因查到價格直接更換 runtime。

## 尚未達成的驗收

實作紀錄及逐情境對照位於 `openspec/changes/build-article-discovery-knowledge/`。依使用者最新決策，評測資料隨公開文章增加，不設固定題數、分類配額、樣本比例或品質百分比門檻；沒有某類資料只記錄現況，不視為待補名額或發布阻擋。每次明確凍結當期資料後才評分，歷史已觀察題目標示為回歸證據，不冒稱全新 held-out。零題時顯示無資料與 null 指標，不捏造通過率。舊 v1 至 v5 及萃取報告保留為歷史紀錄。

目前保存的１０筆原文中，１筆是可用的中英名稱對照，９筆屬於概念解釋；概念解釋不會因取消題數門檻就變成同義詞。資料不足不阻擋，但沒有來源、歧義、非公開文章混入及實際功能錯誤仍須處理。

當期全部３３篇推薦面板的證據與來源已輸出，機械證據有效不等於「延伸理由有用」或人工作品接受。檢索／推薦的實際問題仍須檢視與修正，不以樣本數或百分比宣稱人工作品接受。真實 BGE 品質、輸入限制、免費與無超額證明、provider 隱私、實際 D1／Vectorize 接線、正式版本讀回、啟用與人工驗收均未完成。


## 本機完成範圍與保留事項

本輪補上英文縮寫邊界、敘事詞排除、無來源理由不推薦、載入取消競態、遠端結果總數／頁碼／重複身分驗證、未完成請求本文的逾時取消、完整額度欄位與 D1 授權上限對照，以及模型／維度一致才可切換索引。成功語意結果、分頁、篩選、返回、輸入時零請求、４０９／４２９／５０３降級與手機雙主題均以本機替身驗證。

語意模式的測試畫面使用離線攔截，不代表正式入口已開啟。正式頁面的 endpoint 仍為空，Worker 預設停用、零額度、沒有 bindings。首次啟用前，仍須完成真實模型輸入／輸出、帳戶免費與零超額、平台隱私、資源接線及正式 manifest 讀回；本機演練不是這些項目的替代品。早期情境未全部保有實作前的獨立紅測試，歷史限制照實保留，不補寫成已發生。


## 已授權的 Ollama 本機模型比較

`node --import tsx scripts/discovery/ollama-compare.ts` 只讀取既有 loopback Ollama metadata、凍結文章／題目與模型計畫，不進行推論；`--run --resume` 必須與已凍結的完整來源、模型及資料 digest 一致才執行／延續。既有比較輸出需保留，不以改寫 plan.json 繞過 pin；若程式或資料改變，應建立另一次明確區分的計畫，不能把新結果覆蓋成同一輪。

僅允許安裝中的 `bge-m3:latest`／`embeddinggemma-2:latest`，不下載或替換模型，拒絕 redirect 與非 loopback endpoint。這是獨立研究 CLI，不被網站、Worker、發布流程或 CI 自動呼叫。兩模型的格式／維度／快取隔離；沒有改動正式 BGE-only allowlist 或零額度預設。

本次實測比較見 `openspec/changes/build-article-discovery-knowledge/ollama-comparison-20261021.md`。Gemma 2 是本機安裝的較新模型，不等同原先 Cloudflare `embeddinggemma-300m` 候選，不能直接沿用價格、免費、維度或 provider 品質結論。本機觀察不會把３．３／４．３的雲端與正式接線驗收改標完成。


## 本機 BGE-M3 搜尋頁驗收

執行 `node --import tsx scripts/discovery/local-preview.ts --run`，以前景方式啟動只綁定 `127.0.0.1` 隨機連接埠的預覽。無 `--run` 會拒絕啟動。需已有相容的 `dist`、本輪 Ollama 比較的 BGE-M3 向量快取與既有本機 Ollama；版本、模型 digest、文章庫或快取不符就停止，不下載模型或重新計算文章。若文章庫更新，須先完成另一次相容索引準備，不能沿用舊索引冒充新版。

程式輸出搜尋頁網址，直接使用導覽列唯一的搜尋表單查詢本機 BGE-M3，不再選擇模式。預覽只改寫回應中的本機 endpoint 與 local flag，不加入說明文字；磁碟上的公開 HTML 與 Worker 預設均不變。尚未送出的輸入不呼叫模型；本機查詢以四秒為限，失敗時原有頁面保留關鍵字結果。可在同一前景終端輸入 `pause`／`resume` 驗證降級與重試，`status` 查看不含原始查詢的呼叫次數，`stop` 結束。沒有 HTTP 管理入口。

結束、一般中斷或三十分鐘期限到達時，關閉本次 listener、取消在途請求，只釋放本次新載入的 BGE-M3，不停止既有 Ollama daemon。`output/discovery/local-preview-20261021/` 保存模型／來源識別、畫面與清理證據；本輪 Computer Use 驗收見 active change 的 `local-search-cua-20261021.md`。實際本機模型成功仍不能代替 Cloudflare 帳戶費用、免費額度、資源接線、部署讀回或正式啟用驗收。


### 搜尋頁最新簡化

使用者已取消讀者篩選與模式選擇。最新本機預覽送出同一導覽列搜尋表單，就直接使用已授權 BGE-M3；打字不推論、失敗保留關鍵字結果、成功後不顯示重試。主題／系列／排序的舊參數不再限制頁面結果。公開 endpoint 仍空白，未啟用遠端。每次預覽會輸出獨立的 `output/discovery/local-preview/run-*` 證據目錄，保存各自的 started／status／finished 收據，不覆寫前次資料。`output/discovery/local-preview-simple-20261021/` 與先前四個下拉選單畫面保留為歷史紀錄。文件向量仍以同一 corpus/config/model pin 驗證，純 UI 重建的 manifest 不必與舊 HTML 建置完全相同；每個實際資產 digest 及向量空間仍必須一致。


## 已確認的本機交付範圍

搜尋區採使用者已確認的緊湊版面：單一導覽列搜尋框、結果數量與文章列表，沒有篩選、模式選擇、建議用詞、額外說明或重複標題；必要時保留分頁與錯誤重試。靜態站提供關鍵字搜尋，本機前景預覽直接沿用已安裝的 BGE-M3。公開文章萃取及評測持續依實際來源累積，不設題數門檻、不補造資料。

剩餘未勾選項目不是尚缺的本機畫面功能：１．１保留無法回補的歷史先紅後綠紀錄；３．３的本機取消／降級／版本一致性與頁面接線已由後續本機任務涵蓋，尚缺實際 Cloudflare 帳戶、計費／免費、接線及啟用；４．３尚缺正式環境讀回與 release 驗收。兩者仍須另外授權，不能因本機完成而勾選。


### 版本衝突與預覽清理

遇到４０９或回應期間文章庫版本改變，頁面會清除舊結果、重新載入當期靜態索引，再顯示關鍵字結果；不會自動重送模型請求。當期資產無法讀取時，清空舊文章與分頁，保留查詢及重試。一般５０３／４２９或逾時且未確認版本衝突時，仍使用已載入的關鍵字結果。

預覽的 stop 同時關閉標準輸入；即使以管線啟動，也會在保存完成收據後退出，不只關閉 HTTP listener。既有 Ollama daemon 及非本次載入的模型維持原狀。
