# ADR-001：Cloudflare 免費語意搜尋

日期：２０２６－１０－２１。狀態：已採納；實際啟用結果另見操作與驗收證據。

## 背景與授權

文章搜尋的精簡畫面與本機 BGE-M3 已確認；PR ＃５０提供靜態搜尋，PR ＃５１整理正式驗收文件。使用者本次明確授權合併、部署、以 Computer Use 設定 Cloudflare，並確認「完成接線與驗證後啟用正式語意搜尋」及「Cloudflare 相關決策要放進專案」。

既有要求「只使用免費額度，付費超額上限為零」持續適用。使用者另確認：採免費方案硬上限，自動按 Cloudflare 每日重設時間給本站保守額度，不需每天人工重開。

## 採納的決策

１．只使用 Cloudflare 託管的 `@cf/baai/bge-m3`，開發者是 BAAI；這是使用者已授權的暫時例外。文章與問題都採 plain 格式、１０２４維、正規化及 cosine。EmbeddingGemma 的免費待遇與品質核實後，仍須整套相容索引切換；不得混用向量、自動換模型或加入重排／生成模型。

２．沿用目前帳戶 `979a3735f8dfa269e7474135f348cfdf` 的 Workers Free，不升級、不加購、不使用 AI Gateway 預付額度或付費替代。免費方案的供應商硬性上限才是零付費超額的依據；提醒通知或本站計數器不能取代它。帳戶改為允許超額付費、模型條款不適用或證據過期時，停用語意服務並重新確認。

３．目前官方 Workers AI 免費量是每日１００００ Neurons，UTC ００：００重設；本站使用至多８０００，含建索引、測試、未知結果與查詢。以 UTF-8 輸入位元組保守預留，不確定結果不退額度、不自動重試。這是應用層上限，並非供應商即時餘額。當期共享用量、來源與預留紀錄必須可追溯。

４．只在帶有明確 `verified-workers-free-utc` 決策且其餘啟用證據有效的設定中，以 Cloudflare 伺服器 UTC 日期建立當日額度。D1 以原子 `INSERT OR IGNORE` 建立一次，已消耗的當日額度不會因請求、部署或重試而補滿。其他未核實／允許付費的環境不能沿用這個例外。

５．以獨立搜尋 Worker、D1 額度資料庫與 Vectorize 索引隔離發文後台。正式名稱分別為 `gcake-public-search-production`、`gcake-search-admission-production`、`gcake-public-search-bge-m3`。搜尋服務不持有 Admin、GitHub 發文或 Substack 權限；不新增排程或通知流程。

６．Vectorize 的儲存與查詢維度各自扣抵免費額度，準備、保留與使用中版本一起計算。目前３３篇、２６３３段的單份 BGE 索引為２６９６１９２維；兩份完整副本會超過５００萬免費儲存維度，因此不得默默雙份保留。新版本準備超額時先維持當期關鍵字搜尋，不升級或恢復舊的已撤回內容。索引變動仍須核對當期帳戶用量及部署來源。

７．讀者仍只有一個搜尋框、結果數量與文章列表，必要時有分頁和失敗重試。送出查詢才呼叫模型，輸入時零模型請求。額度不足、逾時、服務故障或版本不合均保留／重新載入當期關鍵字結果，不產生回答。

８．公開文章段落與送出的查詢可由 Workers AI 處理；不保存原始查詢或原始 IP。只在額度資料庫保存短期、帶密鑰且逐分鐘變更的雜湊識別。關閉 Worker 的應用觀測記錄，不啟用 AI Gateway 記錄或快取。Cloudflare 的一般推論內容不訓練且不於處理後保留，但操作中繼資料、儲存服務與法令例外需分開說明；不宣稱平台完全零紀錄。讀者說明放在既有「關於」頁，搜尋畫面不增加說明段落。

９．只有實際 provider 輸出、公開來源與相容索引、完整本機 gate、main CI、正式資產讀回及 Computer Use 通過後，才啟用正式端點。回復方式是關閉語意開關，保留目前靜態內容；不重新部署會暴露已撤回文章的舊站。

## 證據及來源

- Spectra：`openspec/changes/build-article-discovery-knowledge/`，任務３．３／４．３；１．１的歷史先紅後綠缺口不能回補成已發生。
- 本機原始操作紀錄：`output/discovery/merge-deploy-cloud-20261021/`。免費方案截圖／DOM、全帳戶 AI GraphQL 用量、模型輸出識別、部署產物與索引計畫分別保存，不將準備檔當作供應商餘額。
- [Workers AI 計價與免費硬上限](https://developers.cloudflare.com/workers-ai/platform/pricing/)。BGE-M3 的 Neurons 換算與美元顯示精度差異，沿用既有費率查核文件，不套用到其他模型。
- [BGE-M3 官方模型](https://developers.cloudflare.com/workers-ai/models/bge-m3/)。模型頁的 context／參數敘述與既有 SDK 格式應分別實測，不能僅憑表格宣稱最大輸入已驗收；本輪以更低的４０９６ UTF-8 bytes 作單筆上限。
- [Vectorize 計價](https://developers.cloudflare.com/vectorize/platform/pricing/)與[限制](https://developers.cloudflare.com/vectorize/platform/limits/)。
- [Workers AI 資料使用政策](https://developers.cloudflare.com/workers-ai/platform/data-usage/)。

## 取捨與後續

免費方案用完即降級，接受部分讀者只得到關鍵字結果。模型品質依當期真實文章與已凍結的可用題目檢視，不設最低題數或固定品質百分比，不補造資料。網站發布不等於語意索引已就緒；未有相容版本時必須保持新版關鍵字搜尋。這份決策不宣稱所有歷史與雲端驗收已完成，實際狀態以驗收收據與操作手冊為準。
