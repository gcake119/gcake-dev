# main 來源下載逾時修正：正式部署驗收

２０２６－１０－２２，來源 main `ecfebebaaaa1c0d070975d58dbd752ff497d1de7`；main CI 39656622195 通過。

## 部署與產物

- Cloudflare 搜尋 Worker：`88aa9c47-20d6-4563-bbae-5c42b3f405e2`；正式程式逐位元組等於 main 建置 bundle。設定、秘密名稱、排程及原政策在 Worker 更新後完全相同。
- GitHub Pages：[部署 39658022913](https://github.com/gcake119/gcake-dev/actions/runs/39658022913) 成功，head 為同一 main。正式 HTML、manifest、前端 JS 均與該次 GitHub artifact 相同；實際 JS 含２２秒等待預算。完整文章資產重新下載核對雜湊。

## 文章庫版本對齊

新版建置的快照雜湊改變，使 corpusId 由 `ebb16a40…` 更新為 `5a6e5ce1…`；段落資產雜湊仍為 `a5cc672e…`。３３篇文章、２６３３段的修訂與來源身分均一致，並非新增文章。自動同步已自然取得新版、重用１６個既有向量並完成首批讀回；每分鐘的有界批次不等於整庫立即可用。期間實際４０９讓網站保留新版關鍵字、數量、分頁及重試。

為完成此次已授權的部署驗收，依既有前景索引維護邊界，取得同一 D1 租約並保守預留既有操作額度，先完整核對２６３３個供應商向量與清冊／來源／BGE 設定，再重用相同數值對齊新版 namespace。六批上傳後，完整讀回所有１０２４維數值、metadata 與 namespace，核對全索引仍為２６３３個向量，才條件式更新 activeCorpusId。沒有重新產生文章嵌入、沒有新增儲存維度，也沒有新增本機排程或改變常態雲端 cron。

共享預留為 requests／tokens／units／vectorQueries／storage 皆零，worker＝１、admission＝１２０００；只消耗既有額度，未擴大上限或退還預留。索引提升只改 activeCorpusId，其餘 policy 完全相同。租約已釋放，pending＝０；自然 cron 收據２０７至２１０均為新版 no_change。一次性前景對齊不冒稱整份更新由自然 cron 完成，也不關閉首次自然新增文章的任務１２．２。

## 正式行為

- 最終實際語意 API 為２００／hybrid／新版 corpus，對公開文章的改寫查詢首筆命中 Day 24，並具有真正段落連結。這是有限 smoke，非延遲分位數或全量品質保證。
- Computer Use 驗證自然版本衝突降級、關鍵字分頁、正常語意結果與重試恢復；另僅在驗收分頁暫時阻擋語意端點，確認網路失敗保留１０筆關鍵字文章與重試，清除阻擋後實際恢復２００與語意結果。未停用正式服務、修改額度或偽造供應商回應。
- ３２０／３９０像素均無水平溢出；保持單一搜尋框、數量、緊湊文章列表。文章正文與真實段落錨點可開啟。驗收後視窗已還原、網路覆寫已清除，保留正常搜尋頁。

## 正式設定與保留事項

BGE-M3 plain／１０２４維、Workers Free 零付費超額、本站原上限、SEMANTIC_ENABLED＝true、INDEX_SYNC_ENABLED＝true、原每分鐘 cron 及２０２６－１１－２０ UTC 證據期限保留；已消耗的當日額度沒有被補滿。搜尋驗收正常使用既有模型額度，與索引對齊零新嵌入分開記錄。沒有遷移、模型替換、方案升級、原始查詢／IP 診斷記錄或其他工作修改。

其餘進行中檔案與原始狀態基線一致；部署驗收當時沒有新的 Git commit 或 push；本次僅整理文件與證據提交，不再操作正式服務。上傳用的六份暫存 NDJSON 已在完整讀回後精準清除，保留雜湊及清理收據。可攜式收據見 [source-timeout-production-acceptance-20261022.json](source-timeout-production-acceptance-20261022.json)，包含原始收據雜湊、產物識別、索引操作及正式設定；原始紀錄保留於本機 output/discovery/deploy-source-timeout-20261022/，不依賴它才能閱讀本提交的結論。歷史１．１及首次自然新增文章１２．２仍未完成。

![３９０像素正式語意搜尋](evidence/source-timeout-production-20261022/semantic-390.jpg)

![語意連線失敗時保留關鍵字](evidence/source-timeout-production-20261022/network-fallback-390.jpg)

![３２０像素正式語意搜尋](evidence/source-timeout-production-20261022/semantic-320.jpg)

![新版索引尚未就緒時的自然降級](evidence/source-timeout-production-20261022/natural-fallback-390.jpg)

## 來源與證據界線

[PR ＃５７](https://github.com/gcake119/gcake-dev/pull/57) 將修正 9de66fa 合併至上述 main；[main CI](https://github.com/gcake119/gcake-dev/actions/runs/39656622195) 與 Pages 部署分開保存。Worker 於 UTC ２０２６－１０－２１ １９：０１部署，最終設定與自然排程讀回於１９：２０完成，均為臺灣１０月２２日。本文件回填既有結果，本次沒有重新執行驗收或重新核實供應商方案。

來源修正的本機失敗／成功證據仍見[本機紀錄](source-download-repair-20261022.md)。正式成功證明本次來源可完成讀取，不代表所有網路逾時或５０３永遠消失。此次降級涵蓋真實４０９與瀏覽器網路失敗，沒有製造正式５０３；５０３錯誤階段契約的受控失敗驗證仍以[本機診斷紀錄](private-error-diagnostics-20261022.md)為準。任務維持３４／３６，不修改規格或歷史核取狀態。

## 本次文件提交查核

隔離規格快照的 Spectra validate 通過；analyze 的覆蓋、一致性與缺漏均為 Clean，僅保留既有 reader-search 第６２行 may 用語建議，沒有新增重大問題。已核對３４個本機文件連結、四張截圖的 SHA-256、JSON 可解析性、３４／３６任務狀態與原工作目錄狀態基線。原始截圖為 JPEG，可攜副本改用相符副檔名，內容位元組不變；畫面截圖範圍小於瀏覽器 viewport，３２０／３９０像素依瀏覽器操作收據判定。這些是文件及證據查核，沒有重跑正式驗收或呼叫模型。
