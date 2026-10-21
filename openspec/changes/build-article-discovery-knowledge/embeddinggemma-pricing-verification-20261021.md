# EmbeddingGemma／Cloudflare 費率查核

查核日期：2026-10-21，Asia／Taipei。範圍為官方文件、官方文件庫問題紀錄，以及使用者既有 Cloudflare 帳戶登入後的可見模型目錄。沒有執行模型推論、建立向量索引、更動方案或發送支援訊息。

## 查核結論

`@cf/google/embeddinggemma-300m` 已由 Cloudflare 提供，開發者為 Google，模型頁與登入後模型目錄均標示為 Beta。但是，目前取得的官方資訊仍沒有本模型的單獨費率、每百萬 tokens 的 Neurons 換算，或適用於本模型的明確免費計費待遇。

因此，本次能確認的是「官方計價資料仍有缺漏」，不能確認精準美元費率、免費 token 數或每天免費查詢次數。`billingVerified=false`，`activationReady=false`。不以缺少價格推定零元，不套用 BGE-M3 的價格，也不將平台免費額度當成模型專屬免費保證。

## 證據與限制

| 項目 | 查到的內容 | 可以證明的範圍 |
| --- | --- | --- |
| [Cloudflare 模型頁](https://developers.cloudflare.com/workers-ai/models/embeddinggemma-300m/) | Google、Cloudflare-hosted、Beta；未列獨立單價 | 模型來源與供應情況；不能證明免費 |
| [Workers AI 計價](https://developers.cloudflare.com/workers-ai/platform/pricing/) | 每日 10,000 Neurons 免費；付費方案超額 US$0.011／1,000 Neurons；未列 EmbeddingGemma 換算 | 平台層額度及一般超額價格；不能換成本模型 tokens |
| [官方文件庫問題 31744](https://github.com/cloudflare/cloudflare-docs/issues/31744) | 本次查閱仍為 Open，指出本模型缺少價格 | 支持公開文件缺漏仍未解決；使用者留言不是費率承諾 |
| [舊問題 25728](https://github.com/cloudflare/cloudflare-docs/issues/25728) | 曾關閉，但未提供可核對價格；之後又有問題 31744 | 關閉問題不等於本模型費率已公布 |
| [2024 年 Cloudflare 公告](https://blog.cloudflare.com/workers-ai-ga-huggingface-loras-python-support/) | 當時稱 Beta 模型免費 | 歷史政策；早於 EmbeddingGemma 上架，不能當成 2026 年專屬保證 |
| 登入後的 Cloudflare 模型目錄 | 篩選 embeddinggemma 後顯示一個 Google、Cloudflare 託管、Beta 模型，連結至官方模型文件，沒有顯示價格 | 帳戶可見的目錄供應與標籤；沒有取得費率或方案餘額 |
| 舊 Workers AI 模型目錄入口 | 重新導向目前通用模型目錄 | 沒有找回舊介面曾出現的 Neurons 欄位 |
| Wrangler 唯讀目錄查詢 | 現有 CLI 缺少非互動查詢所需認證，沒有取得目錄 API 結果 | 查核限制；不是模型免費或不支援的證據 |

平台每日免費額度於 UTC 00:00 重設，即台灣時間 08:00，不是台灣午夜。帳戶方案、其他模型共用用量及 EmbeddingGemma 實際扣抵方式尚未核實。

## 向量規格與檢索設定

- [Google 模型卡](https://ai.google.dev/gemma/docs/embeddinggemma/model_card)列出 768 維輸出與搜尋問題／文件的不同前綴。
- [Cloudflare AI Search 支援模型表](https://developers.cloudflare.com/ai-search/configuration/models/supported-models/)列出 768 維、512 輸入 tokens 及 cosine。這是 AI Search 的整合表，不直接證明 Workers AI 直呼端點的完整輸入上限。
- 現有規劃採直接 Workers AI＋Vectorize，不採用 AI Search 預設的其他向量模型或重排模型。
- 768 維是預定設定，正式測試仍須核對實際 API 輸出、正規化、tokenizer 及前綴是否由平台代加。未變動文章沿用結果的前提是整個模型設定版本相容。

## 可獨立確認的 Vectorize 容量

[Vectorize 官方計價](https://developers.cloudflare.com/vectorize/platform/pricing/)目前列出免費儲存五百萬維度、每月三千萬查詢維度。假設只有一份三百段的 768 維索引：

- 儲存：300 × 768＝230,400 維度，約占免費儲存額度 4.608％。
- 五百萬儲存維度約能容納 6,510 個 768 維向量。
- 依官方現行範例公式，且每次只查一次索引，約可容納 38,762 次每月向量查詢；測試、其他索引與保留版本會改變帳戶餘裕。

以上是容量模型，不是實際帳戶餘額或整套語意搜尋免費承諾。EmbeddingGemma 推論、Worker CPU／請求及 D1 各有獨立條件；尚未核實的推論費率不能從向量儲存容量推算。

## 遠端啟用前還需要的確切證據

取得適用於這個模型與帳戶方案的官方計價條款或認證後模型計價資料，明確包含下列任一可計算路徑：

1. 本模型每單位輸入的 Neurons 換算、當前價格及每日免費扣抵方式。
2. 本模型明確的現行免收費條款，包含免費量、期間與限制。

另外記錄帳戶方案、其他模型共享用量、證據日期及已授權的請求／token／金額上限。取得證據不等於授權推論測試、建立資源或正式部署；那些依原有交付流程分別處理。

費率未明確前，第一階段的文章庫、關鍵字搜尋與自動關聯可以照規格實作，第二階段的遠端語意功能保持停用。不得自動改用中國背景模型或新增回答模型來繞過限制。

## 後續使用量決策：只用免費額度

依使用者本次指示，付費超額授權固定為零。未來即使取得一般付費單價，也不構成付費啟用授權；必須另外確認模型實際可用免費待遇及供應商強制的無超額環境。保留至少兩成應用層餘裕，不能取代帳戶共用額度控制。當計費或剩餘額度未核實時，遠端功能仍維持停用，第一階段靜態搜尋繼續可實作。

## 最新決策：暫時使用 BGE-M3

使用者後續明確授權：無法確認 EmbeddingGemma 免費額度前，暫時繼續使用 BGE-M3。此例外只限官方 @cf/baai/bge-m3，不改變其他模型的來源限制、免費用量限制或 AI 問答暫緩。

本次重新查閱 [Workers AI 官方計價](https://developers.cloudflare.com/workers-ai/platform/pricing/)：BGE-M3 為每百萬輸入 tokens 消耗 1,075 Neurons，等值美元欄四捨五入為 US$0.012；[模型頁](https://developers.cloudflare.com/workers-ai/models/bge-m3/)列 US$0.0118。保留這個顯示精度差異，不把模型價格轉用到 EmbeddingGemma。

平台每日一萬 Neurons 免費仍須扣除同帳戶其他用量、建立／更新文章向量、測試與重試，不能當成本功能獨占額度。BGE 的價格已公開，只解除「模型單價未知」這一項；未解除帳戶免費環境、禁止付費超額、品質、建立資源、推論及正式啟用等既有條件。

目前暫用索引按 BGE 的 1,024 維估算；前文 768 維的容量算式保留為未來 EmbeddingGemma 情境，不是本次 BGE 配置。替換模型時需重建相容索引，不能混用向量。
