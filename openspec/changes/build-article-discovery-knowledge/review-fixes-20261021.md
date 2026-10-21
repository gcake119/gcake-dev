# 審查３項問題修正與本機驗證（２０２６－１０－２１）

３項問題均已修正，已確認的搜尋設計維持原樣。沒有部署、雲端模型呼叫或啟用，也沒有新增模型推論。

- 版本衝突：４０９或回應期間 manifest 改版後，重新讀取當期靜態索引再計算關鍵字結果，排除撤回文章。重載失敗就清掉舊結果／分頁，保留查詢與重試。沒有自動重送模型請求，舊回應也不能覆寫新搜尋。
- 預覽紀錄：每次輸出獨立 run 目錄，原有收據不覆寫。實際啟停測試另發現管線 stdin 讓程序在 STOPPED 後仍存活；確認僅剩 fd 0 後，stop 關閉自有輸入，兩次實際啟停均通過程序退出與獨立 socket 關閉查核。既有 Ollama daemon 不停止、不卸載既有模型。
- 重複網址：建立閱讀位置對照前，先驗證去除 query／fragment／尾斜線後的網址唯一性；不同文章身分共用位置時拒絕建置。同 slug 不同路徑仍有效。

６個新驗收先失敗後通過；針對性３３項、完整 pnpm test（公開站９２項）、pnpm check（最終２６０檔零錯誤／警告／提示）、pnpm build:all、pnpm release:dry-run、pnpm editorial:rehearse 均通過。完整測試／建置之後僅更動不被測試組匯入的 CLI stop 輸入清理；以修正後實際兩次啟停及最終型別檢查驗證，不重跑未受影響的全部流程。

實際建置 Chrome browser suite 通過：撤回後的新索引復原、資產失敗清空、單一搜尋框、無篩選／建議／說明文字、鍵盤、分頁／返回、無 JavaScript、３２０／３９０／１２８０px 與雙主題。語意契約使用離線攔截，provider／generation calls 均為零，不代表本輪重新驗收模型品質。

當期３３篇、２６３３段，全部資產 digest／閱讀錨點查核通過；公開 endpoint 仍空白，實際呼叫本機匯入的 default Worker 正確搜尋路徑回５０３。沒有遠端資源。兩次預覽只讀既有 Ollama metadata，embedding／cloud／generation／download 呼叫均零，前次及歷史收據內容不變。

最初 check 在 sandbox 因全域 pnpm 解析專案指定版本所需的 lock 寫入受限，未改 lock 或降低檢查，改於可執行既有本機流程的工具環境通過。舊審查原文及最初失敗紀錄保留，沒有回填成成功。

Spectra analyze 無 findings、validate 及 diff whitespace 通過。新增３個修正任務已完成，整體２４／２７；原１．１歷史先紅後綠限制，以及３．３／４．３真實帳戶、免費／零超額、平台接線、部署／啟用驗收仍保留未完成。這些與本輪３項修正分開計算。

證據：`output/discovery/review-fixes-20261021/` 的 red／green／完整 gate logs、browser-result.json、preview-smoke.json 與當次預覽收據；精確來源見同 change 的 review-fixes-candidate-20261021.json。搜尋頁、間距 CSS、確認設計文件與 pnpm-lock.yaml 對比本輪起始雜湊未變。沒有 commit／push／merge／archive。
