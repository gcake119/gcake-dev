# PR42 Codex 重新審查與 P1 修正

本次依使用者要求對 `99dd599de489c275c88d3129a39b0ec3289faa71` [重新觸發 Codex](https://github.com/gcake119/gcake-dev/pull/42#issuecomment-6275046480)。原審查額度不足紀錄保留；本次審查成功完成並提出 [P1：新草稿使舊 Pages 查詢失效](https://github.com/gcake119/gcake-dev/pull/42#discussion_r4317747769)，不是把過去額度失敗改稱成功。

## 重現與根因

原方法只在另一個發布查詢開始時更新序號。新草稿沒有對應的已存原稿，也不發新查詢，createPost 只清除舊 target rows，未清 Pages／錯誤或使在途查詢失效。因此已完成與在途的舊證據都可能出現在新草稿。

先依既有文章切換／未追蹤身分與過期證據契約，新增三項 actual Vue setup 驗收。真實 RED：已完成舊查詢的 pagesStatus 應空卻殘留；新草稿後晚到成功的 rows 應空卻為 acceptance；晚到錯誤的訊息應空卻為舊文章錯誤。沒有放寬規格或新增測試層。

## 修正

新草稿與新發布查詢共用 resetPublicationEvidence：清除 target rows／Pages／錯誤並遞增查詢序號。既有成功／失敗世代檢查保留，所以晚到的舊結果都被忽略；正常已儲存文章仍能讀取自己的證據。聚焦 Vue／Worker 驗收 63／63 通過。五項完整本機 gate 全通過（test／check／build:all／release:dry-run／editorial:rehearse）；check 為 228 files、0 errors／warnings／hints。Spectra analyze 無 findings、validate 與 diff 檢查通過。既有 SQLite ResourceWarning／ExperimentalWarning 原樣保留。完整本機結果與精確指紋見 pr42-fix-local-gates-20261020.json；CI 與新 head 審查須另行確認。

僅修改 PR42 的介面邏輯、既有測試及本 change 的證據／任務。後台歸檔、正式版本、同步 runtime、排程寫入、發布及寄送皆未變更；未合併或部署。既有本機／CI／歷史正式證據互相區分。
