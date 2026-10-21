# 驗收情境對照與尚未完成的部分

共５５個規格情境（原４８個、來源成長３個、本機模型比較４個）。這份索引保留原 Given／When／Then，不改寫驗收條件；不是全部情境都已有獨立測試先紅後綠的宣告。真正可執行的驗收在 Node suites 與瀏覽器腳本。任務１．１因早期未全部保有實作前紅測試的歷史證據而保留未勾選；當期本機功能的可執行驗證已補齊，不能倒填歷史。

| 情境 | 驗證來源 | 限制 |
| --- | --- | --- |
| Citation creates backlink | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Recommendation is not a citation | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Hidden target and unsafe link | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Complementary next reading | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Insufficient candidates | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Local and imported reading | `test/discovery/browser.mjs` | 實際 Chrome 與受控網路攔截；非人工作品接受 |
| No connections | `test/discovery/browser.mjs` | `assets.acceptance.test.ts` 實際編譯及 Astro Container 渲染空群組；兩種頁面由 Chrome 檢視，語意使用離線攔截 |
| Semantic enrichment unavailable | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Local and imported articles share a slug | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Draft and future article exclusion | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Article becomes public | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Public article changes | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Article is withdrawn or deleted | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Publication fails | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Article reading URL changes | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Explicit acronym definition | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Ambiguous token | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| No usable terms | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Click a retrieved passage | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Identical source rebuild | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Title outranks incidental body mention | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Natural Chinese query | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Technical punctuation | `test/discovery/corpus.acceptance.test.ts` | 合成公開來源／本機建置；非正式發布證據 |
| Share filtered search | `test/discovery/browser.mjs` | 實際 Chrome 與受控網路攔截；非人工作品接受 |
| Safe highlighted excerpt | `test/discovery/browser.mjs` | 實際 Chrome 與受控網路攔截；非人工作品接受 |
| Empty and excessive input | `test/discovery/browser.mjs` | 實際 Chrome 與受控網路攔截；非人工作品接受 |
| No matches | `test/discovery/browser.mjs` | 實際 Chrome 與受控網路攔截；非人工作品接受 |
| Index request fails | `test/discovery/browser.mjs` | 實際 Chrome 與受控網路攔截；非人工作品接受 |
| JavaScript unavailable | `test/discovery/browser.mjs` | 實際 Chrome 與受控網路攔截；非人工作品接受 |
| Different wording finds same meaning | `test/discovery/semantic.acceptance.test.ts` | 離線替身；provider／實際免費額度未驗收 |
| Service timeout and query race | `test/discovery/browser.mjs` | 實際 Chrome 與受控網路攔截；非人工作品接受 |
| Provider release mismatch | `test/discovery/semantic.acceptance.test.ts` | 離線替身；provider／實際免費額度未驗收 |
| Type a query before submit | `test/discovery/browser.mjs` | 實際 Chrome 與受控網路攔截；非人工作品接受 |
| Budget exhausted | `test/discovery/semantic.acceptance.test.ts` | 離線替身；provider／實際免費額度未驗收 |
| Semantic retrieval without generation | `test/discovery/semantic.acceptance.test.ts` | 離線替身；provider／實際免費額度未驗收 |
| Admission unavailable | `test/discovery/semantic.acceptance.test.ts` | 離線替身；provider／實際免費額度未驗收 |
| Explicit temporary BGE configuration | `test/discovery/semantic.acceptance.test.ts` | 僅用合成核准資料；不代表真實帳戶符合資格 |
| Prohibited or unidentified fallback | `test/discovery/semantic.acceptance.test.ts` | 離線替身；provider／實際免費額度未驗收 |
| Article mentions a prohibited runtime model | `test/discovery/semantic.acceptance.test.ts` | 專用 authored-model-name 來源 fixture；不是實際模型呼叫 |
| Model price is absent from public documentation | `test/discovery/semantic.acceptance.test.ts` | 離線替身；provider／實際免費額度未驗收 |
| Model-specific evidence is obtained | `test/discovery/semantic.acceptance.test.ts` | 僅用合成核准資料；不代表真實帳戶符合資格 |
| Pricing or model identity changes | `test/discovery/semantic.acceptance.test.ts` | 離線替身；provider／實際免費額度未驗收 |
| Free allowance is exhausted | `test/discovery/semantic.acceptance.test.ts` | 離線替身；provider／實際免費額度未驗收 |
| Concurrent requests compete for the final free units | `test/discovery/semantic.acceptance.test.ts` | 離線替身；provider／實際免費額度未驗收 |
| Paid account has uncoordinated consumers | `test/discovery/semantic.acceptance.test.ts` | 離線替身；provider／實際免費額度未驗收 |
| Index preparation exceeds free storage or compute | `test/discovery/lifecycle.acceptance.test.ts；semantic.acceptance.test.ts` | 本機容量／模型不相容拒絕；完整 provider migration 未驗收 |
| Provider reset has not been confirmed | `test/discovery/semantic.acceptance.test.ts` | 離線替身；provider／實際免費額度未驗收 |
| Replace temporary BGE only through a compatible release | `test/discovery/lifecycle.acceptance.test.ts；semantic.acceptance.test.ts` | 本機容量／模型不相容拒絕；完整 provider migration 未驗收 |

逐情境原文與來源雜湊另見 `test/discovery/spec-scenarios.json`。
推薦面板見 `output/discovery/evaluation.json`；當期５４題來自現有公開證據，沒有固定題數或百分比 gate；歷史已觀察題目只作回歸。


２０２６－１０－２１新增的 Sparse terminology evidence、New public evidence、No judged public sources，由 `assets.acceptance.test.ts` 的「Evaluation follows empty, sparse, growing and withdrawn public evidence without quotas」共同驗證。測試實際執行凍結與評測 CLI，涵蓋空庫、單篇、新增明確縮寫及撤回後重新生成；不新增 CI 或模型呼叫。題數／百分比門檻已依使用者指示取消，其他既有未完成情境仍保留。


本輪補充：無效遠端計數與重複結果的真實 Chrome red／green、逐詞理由不得為空、英文縮寫邊界、非有限用量設定、未完成本文的 deadline 取消、D1 額度上限及最後一份額度、未知 outcome 保留預約、模型／維度一致切換，以及 add/edit/rename/withdraw 的 corpus → staging → deployed → active → search 離線演練均已有可執行驗證。`lifecycle` 是受注入 adapter 控制的離線路徑，沒有正式資源或排程接線。

未執行部分集中在真實 provider、帳戶證據、正式接線、部署及啟用，對應未勾選的３．３／４．３；１．１只保留原先的測試歷史限制，不把合成 pass 冒稱全部情境都曾先紅後綠。


本機模型比較新增情境：Two different embedding spaces、Model is missing or changed、Overlong input or malformed output、Local results remain local evidence，對應 `assets.acceptance.test.ts` 的 Ollama loopback／pin／格式／輸出／space tests，以及實際 Ollama 執行收據 `output/discovery/ollama/comparison-20261021/verification.json`。實測兩個模型完整索引與同題比較，仍不等於 Cloudflare 的３．３／４．３驗收。


本機搜尋頁新增情境：Actual local semantic search in the existing page、Local inference unavailable and recovered、Incompatible local preview or invalid request、Local preview cleanup，對應 `test/discovery/local-preview.acceptance.test.ts` 的回應／篩選／分頁／取消／過載／輸入／來源／快取測試，以及 `local-search-cua-20261021.md` 所載的實際 Computer Use 操作。真實本機推論、暫停後降級、恢復後重試及正常 stop 清理已觀察；SIGINT／SIGTERM／期限由同一 cleanup 路徑處理，本輪沒有分別觸發這三種結束方式，不宣稱已逐一實測。新測試最初因尚無實作模組而失敗，接著修正測試 fixture 的站台 base path 後通過；這不是每項情境都曾獨立紅測試的證明，歷史限制仍保留。


使用者２０２６－１０－２１實際畫面回饋後，Share simple search／Legacy filters do not hide articles 取代先前讀者篩選介面情境；後端篩選測試保留。既有 browser suite 首次明確失敗為４個下拉選單而預期０個，簡化後通過；後續修正測試對成功後重試按鈕的過時前提，不削弱失敗重試驗證。本輪 Computer Use 實際驗證單一表單直接使用 BGE、輸入零推論、手機畫面、服務失敗降級／恢復及分頁返回。見 `simplified-search-cua-20261021.md`。

最新移除建議用詞：既有 browser acceptance 先重現３個建議連結對預期０個失敗，再確認 region／links 全部消失、無結果文案無殘留，原有分頁／返回／降級與打字不推論檢查仍通過。Computer Use 已在本機建置頁實際按搜尋、檢視並保存無建議的文章列表。此輪只驗收 UI，沒有重新呼叫 BGE 或任何雲端模型；先前 BGE 接線保持原樣。

Minimal reader search surface：既有瀏覽器測試檢查移除說明、重複標題及額外總覽連結，保留分頁、返回、無 JavaScript、降級及手機畫面檢查；公開站８６項、建置、型別檢查與 Spectra validate/analyze 通過。Computer Use 已實際按搜尋並保存最小介面畫面。沒有重新呼叫任何模型或部署。


２０２６－１０－２１審查後修正：

| 情境 | 現有驗證與結果 |
| --- | --- |
| Release conflict refreshes lexical fallback | recovery.acceptance.test.ts 覆蓋４０９與成功回應後 manifest 改版；實際建置 browser.mjs 攔截新版公開索引，確認撤回文章消失、沒有自動重送模型請求。 |
| Current release cannot be loaded after conflict | 同一組 Node／Chrome 測試確認清空文章與分頁、查詢保留、錯誤與重試可用。 |
| New search supersedes release recovery | recovery.acceptance.test.ts 延後舊索引回應，確認不覆寫較新的搜尋。 |
| Repeated preview runs preserve independent evidence | local-preview.acceptance.test.ts 寫入兩組真實暫存收據後逐一讀回；另連續兩次實際前景預覽核對，既有收據內容不變。 |
| Different article identities share one reading URL | corpus.acceptance.test.ts 覆蓋相同、尾斜線及 query／fragment 正規化衝突，保留同 slug 不同路徑來源。 |

這６個新驗收測試最初確實失敗，修正後相關３３項全部通過。延伸既有 Node runner 與 browser suite，沒有新增測試層或 CI。前景啟停另外重現管線輸入保持開啟導致程序無法退出；修正後必須同時驗證程序退出與獨立 socket 連線被拒絕，不能只採信 finished 收據。


## 正式靜態搜尋驗收補證（２０２６－１０－２１）

既有 Stage A 與 Minimal reader search surface 的正式證據見 [production-acceptance-20261021.md](production-acceptance-20261021.md)：精確部署 SHA／manifest／資產與 HTML 一致、導覽列實際送出 AI／中文查詢、文章連結、分頁返回、無結果及３２０／３９０px 雙主題畫面。這是正式靜態站操作，不是本機替身，也沒有雲端模型呼叫。沒有修改既有 Gherkin 或擴張人工作品接受／雲端語意驗收；原歷史與 provider 缺口保持。
