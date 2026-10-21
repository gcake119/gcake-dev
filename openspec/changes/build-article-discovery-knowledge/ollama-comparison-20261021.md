# 本機 Ollama 模型比較（２０２６－１０－２１）

這批公開文章的測試，BGE-M3 混合搜尋多找回１題；兩者的同題暖查詢時間接近，無法從本次樣本判定速度優劣。這是目前安裝配置的觀察，不是模型普遍優劣、Cloudflare 驗收或正式替換決策。

| 比較項目 | BGE-M3 | EmbeddingGemma 2 |
| --- | --- | --- |
| 釘選名稱 | `bge-m3:latest` | `embeddinggemma-2:latest` |
| 本機配置 | GGUF／F16，ggml runner | safetensors／NVFP4，MLX runner |
| 實際輸出維度 | １，０２４ | ７６８ |
| 關鍵字基準：前５名找回預期文章 | ５３／５４ | ５３／５４ |
| 純向量搜尋：前５名找回預期文章 | ５４／５４ | ５２／５４ |
| 混合搜尋：前５名找回預期文章 | ５４／５４ | ５３／５４ |
| 混合排序 nDCG@5（限現有標註） | ０．９８３９ | ０．９８１５ |
| １０題改寫問法：混合前５名找回 | １０／１０ | １０／１０ |
| ３３題精確標題：混合第一名 | ３３／３３ | ３３／３３ |
| 同題交錯暖查詢：中位數 | 約３７．４ms | 約３８．０ms |
| 同題交錯暖查詢：範圍／樣本 | ３３．７～４４．９ms／５次 | ３２．９～４２．２ms／５次 |
| 本次完整索引建立觀察（含初載入） | 約５３．３秒 | 約６４．７秒 |
| 純 float32 向量資料量 | １０，７８４，７６８ bytes | ８，０８８，５７６ bytes |
| １０題無關亂碼仍有向量近鄰 | １０／１０ | １０／１０ |

nDCG 是「已標記預期文章排得多前面」的觀察；沒有把所有其他文章逐篇標記成相關或無關，所以這些數字不是完整準確率。暖查詢包含本機 HTTP／embedding、暴力 cosine、BM25 與 RRF，沒有瀏覽器或網路延遲。兩個執行器與量化不同，不能將時間差歸因為模型權重；冷索引只做一輪，也不宣稱統計速度改善或計費節省。

## 實際差異

- 「現場工作 工程問題」：預期 Day 12〈原來我在做翻譯〉。關鍵字沒有找回；BGE-M3 的純語意／混合均排第３，Gemma 2 均排第９，是混合前５名差１題的來源。
- 「自動化 狀態管理」：純向量的預期 Day 11 在 BGE-M3 排第５、Gemma 2 排第６；關鍵字加回後，兩者混合都排第１。
- 「知道系統組成仍然找不到程式的錯誤」：預期 Day 23，BGE-M3 混合排第２，Gemma 2 排第１。不能只憑總命中題數說 Gemma 2 每題都較差。
- `system-level understanding`：BGE-M3 純向量把 Day 30 排第１，Gemma 2 排第２；兩者混合都排第１。

向量搜尋會找「最接近」的文章，對沒有意義的查詢也會回傳現有文章。本次１０個亂碼測試兩者均如此；結果沒有捏造文章，但不能當成已能判斷「沒有任何相關內容」。本次不因這項觀察偷偷加相似度門檻，也不啟用正式語意入口。

## 方法與範圍

同一個已建置 corpus：３３篇公開文章、２，６３３段。５４題是３３標題、１０中文組合、１０改寫、１有原文依據的名稱對照；另１０題無關查詢不混入正向命中分母。題目在推論前凍結，沿用既有已觀察的來源標註，不稱新 held-out；沒有補造題目或固定題數／百分比驗收門檻。

兩者都使用相同文章標題與段落資訊，依各自官方格式輸入。BGE-M3 是一般文字；Gemma 2 的文件與查詢使用各自的搜尋前綴。`truncate:false`，１６筆內批次、最多１２０秒／請求、零自動重試，向量有限／非零及實際維度通過才存檔。２份索引以模型 digest、格式、維度及 corpus 隔離，先取５０個段落近鄰、依文章去重，混合採與既有服務相同的 RRF k＝６０。

完整計算兩個索引，沒有使用已存在向量快取。先建立各模型索引，再逐題交錯兩模型順序；另以同一題做５次／模型的交錯暖查詢。４６８次有效 embedding 推論請求、０次失敗、１２８筆查詢結果，另２次只用於釋放模型的空輸入 embedding 請求。沒有 chat、generate、pull、雲端端點或正式 runtime 變更。服務版本０．４０．６；CLI 版本不同，推論版本以實際 HTTP 服務為準。主機與負載記錄在 plan.json，無法視為隔離硬體實驗。

## 證據與清理

- 原始計畫、釘選模型／來源、逐批計數、全部排名、原始指標、快取、結果與核驗收據：`output/discovery/ollama/comparison-20261021/`（忽略的本機輸出，未提交）。
- `verification.json` 另用 Python 重新計算前５名命中，逐筆核對文章／段落修訂，檢查全部５，２６６個向量檔案的長度、有限值與單位長度；不是只相信測試工具自己的摘要。
- 推論開始前的 runner 與 adapter 原文已保存在 `evaluated-runner.ts.txt`／`evaluated-adapter.ts.txt`，對應 plan.json 的 digest。推論後只修正一個 TypeScript readonly tuple 註記，`type-only-fix.json` 驗證產生的 JavaScript 完全相同，沒有為型別修正重複推論或改寫原計畫。
- 進行測試前沒有已載入模型；只釋放本次載入的兩個模型，確認 `/api/ps` 回到空清單。既有 Ollama 程序保留，沒有啟動／停止其他服務或刪除模型。
- 原始稿、公開站資產與 Cloudflare 模型政策保持原狀；本機 GGUF／MLX 輸出不能代替 Cloudflare 上的模型與帳戶驗收。

## 官方格式依據

[Ollama embedding API](https://docs.ollama.com/api/embed)、[Ollama embeddings](https://docs.ollama.com/capabilities/embeddings)、[BAAI BGE-M3](https://huggingface.co/BAAI/bge-m3)、[Google EmbeddingGemma 2 檢索格式](https://ai.google.dev/gemma/docs/embeddinggemma/inference-embeddinggemma-with-sentence-transformers)。這些是使用方式依據；模型成績來自本次本機資料，不引用官網榜單當成本站品質。
