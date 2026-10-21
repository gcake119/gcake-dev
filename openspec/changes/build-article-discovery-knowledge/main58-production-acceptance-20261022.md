# main ＃５８合併後正式部署驗收

２０２６－１０－２２，來源 main `d92a05ba66bb6adb26e551e791924a0a86facd8e`；[main CI](https://github.com/gcake119/gcake-dev/actions/runs/39664070757) 通過。此次 main 與前次已部署版本僅文件及證據不同，程式、依賴及設定未變，沿用既有完整本機 gate 與精確 main CI，不重跑未改變的 runtime 測試。

## 部署與產物

Worker 正式版本 `1ddf7f63-75bb-4f04-8d04-2d118503a77e`，部署時間 2026-10-21T19:48:54.95036Z。正式模組與該 main bundle 逐位元組相同，SHA-256 為 `d1d5f1b58b132866f78fd1b951d4d1bb2ef229cbab631893ed11050fb085f115`。部署前 dry-run 通過；明確保留 SEMANTIC_ENABLED=true、INDEX_SYNC_ENABLED=true，settings／policy／cron 讀回不變，沒有 migrations、secret 或資源增刪。這裡 policy 不變指 Worker 部署讀回階段；後續索引對齊僅改 activeCorpusId。

[GitHub Pages 部署](https://github.com/gcake119/gcake-dev/actions/runs/39664907333) 成功且來源為同一 main。正式搜尋 HTML、manifest、前端 JS 與該次 artifact 相同，JS 含２２秒等待預算；兩份完整文章資產另下載核對雜湊。

## 索引同步與對齊

新版 corpus 為 `e58ec806125977462eb0cf00285c3ab6c554a8ffb4535877556f388ce18e6637`，舊版為 `5a6e5ce10e4886b9d33c565163315e4647961e6ecea0420f3475b8fae9af12ae`。３３篇文章／２６３３段修訂未變，passages digest 保持相同；快照識別改變，不能當成新增文章。

自然 cron 收據２４１偵測新版本並上傳首批１６個重用向量、零新嵌入。期間瀏覽器實際４０９保留關鍵字２４篇、１０筆列表與分頁，並非強制停用正式服務。為完成部署驗收，依既有一次性前景維護授權，取得同一租約、預留原共享額度（worker＝１、admission＝１２０００，其餘０），核對清冊、文章修訂、內容 hash、模型、metadata、維度與向量，再重用數值對齊新版 namespace。六批上傳２６３３個後完整讀回每筆１０２４維數值（容許差１e－６）及 metadata／namespace，確認索引仍２６３３個，才條件式提升 activeCorpusId。其餘 policy 完全保留，沒有新文章嵌入或新增儲存維度。

供應商非同步處理期間等待讀回，未重播推論。提升收據２４２；自然 cron 隨後恢復新版 no_change，最新獨立收據２４３至２４５為 no_change，見可攜 JSON 的 finalReadback。pending＝０、租約已釋放。本次整庫以前景完成，不冒稱全程由自然 cron 完成；任務１２．２首次自然新增文章的完整同步仍開放，１．１仍為歷史紅測試證據缺口，任務維持３４／３６。

## 正式行為與手機

實際語意 API 為２００／hybrid／新版 corpus，公開文章改寫查詢首筆為「Day 24｜我不逐行讀程式碼，那我要怎麼知道 AI 做對了？」，具有真實段落連結。這是有限 smoke，不代表全量品質或延遲保證。

Computer Use 實際操作自然版本衝突降級、關鍵字分頁、重試恢復語意、語意分頁，並在３２０／３９０像素核對１０筆列表與無水平溢出。另只在驗收分頁暫時阻擋確切語意端點，確認網路失敗保留關鍵字與重試；finally 清除阻擋，重試後實際２００與語意結果恢復、重試隱藏。未偽造５０３、供應商回應、調額度或停正式開關。網路觀察另有兩次被後續導覽取消的 ERR_ABORTED，與用 inspector 阻擋的一次失敗分開保存；最終恢復通過。

BGE-M3 plain／１０２４維、Workers Free 零付費超額、原本站每日上限、兩個 true 開關、每分鐘 cron 與２０２６－１１－２０ UTC ００：００證據期限保留；每日已消耗額度未補滿。實際搜尋驗收有 BGE-M3 推論，與索引零新嵌入分開記錄；沒有查詢／IP 診斷日誌。原 Codex 每小時索引任務維持先前暫停狀態，本次未變更自動化。

驗收後清除網路覆寫、停止 Network 觀察並還原 viewport，保留正常搜尋頁。六份本次上傳暫存檔完整讀回後精準移除，共 34523819 bytes；保留雜湊與收據。原始 dirty checkout 與基線相同，隔離工作樹乾淨。部署驗收階段未修改來源或建立新 Git commit／push；本次另依使用者授權整理文件提交，不再次操作正式服務。

可攜式收據：[main58-production-acceptance-20261022.json](main58-production-acceptance-20261022.json)，保存產物、索引、政策、自然 cron 與瀏覽器觀察及原始收據 SHA-256。完整原始資料在本機 output/discovery/deploy-main58-20261022/；本提交已含閱讀結論所需證據，不需依賴該本機目錄。

![３９０像素正常語意搜尋](evidence/main58-production-20261022/semantic-390.jpg)

![語意連線失敗保留關鍵字](evidence/main58-production-20261022/network-fallback-390.jpg)

![３２０像素語意搜尋](evidence/main58-production-20261022/semantic-320.jpg)

![新版本尚未對齊的自然降級](evidence/main58-production-20261022/natural-fallback-390.jpg)

## 本次證據範圍

[PR ＃５８](https://github.com/gcake119/gcake-dev/pull/58) 的合併提交為上述 main。Worker UTC １０月２１日１９：４８部署，語意與最終設定讀回於其後完成；均為臺灣１０月２２日。本文件回填已完成的操作，本次沒有重新呼叫模型、部署、核實供應商方案或延長證據期限。沒有新增正式５０３故障注入，降級證據為真實４０９及瀏覽器限定的連線阻擋；成功也不代表未來所有網路逾時已消除。截圖保存原始 JPEG 位元組，截圖範圍小於 viewport；３２０／３９０像素依操作收據判定。

## 本次文件提交查核

隔離規格快照的 Spectra validate 通過；analyze 的覆蓋、一致性與缺漏均為 Clean，僅保留既有 reader-search 第６２行 may 用語建議。已核對３８個本機文件連結、四張原始截圖 SHA-256、JSON、部署來源識別及３４／３６任務狀態，原工作目錄狀態與基線相符。這些僅為文件及證據查核，沒有重跑正式驗收。
