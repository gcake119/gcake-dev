# 已部署通知修補的來源整合

使用者於２０２６－１０－３０授權將與正式後台完全一致的既有修補另立 PR，通過檢查後合併，避免部署唯讀索引監測時回退現有通知功能。本次不重新發布、驗證或寄送文章，不改通知帳本、既有排程、Hermes runtime 或正式設定。

正式基底為 `c5c0ba17-9cec-4301-a722-95f33de39b5d`。從 main `425c7108a05eeb276f736e34d2d29724c77d01fb` 只替換 publication-monitor-summary.ts 後，編譯產物與下載的正式 Worker 排除來源路徑註解後完全一致，SHA256 為 `04c81537e77a719acada1367bb4740b68a3aa6c575abdbe74f9c2a9ad25110b3`；來源 SHA256 為 `8d1876e400158f04b3d174b5101d677dafa4ac66c478fc79255d919c69df85e9`。

本次只整合該來源、ScheduleRecord 的可選型別與既有驗收測試；main 既有 approvedPresentation 型別保留。規格與驗收情境沿用原 repair-immediate-substack-notifications，不新增核准方式或通知能力；原始目錄其他 dirty 保留。原五項任務是此前已完成的實作與正式通知驗收，不代表本次重新執行那些正式操作。

本輪先將既有測試放到 main，１４案中３案因缺少立即發布候選而真實失敗；原失敗保存於 ignored 本機證據。整合後的本機完整 gate、PR／main CI 與後續部署結果另行追加，不將舊正式驗收當成本次 CI。

完整比對證據保存在本機 output/discovery/index-status-release/deployed-admin-compatibility.json；未提交原始 provider 輸出、查詢、IP、secret、私人帳本或 Telegram 截圖。

本輪完整本機 pnpm test、pnpm check、pnpm build:all、pnpm release:dry-run、pnpm editorial:rehearse 全數通過；Spectra validate／analyze 無問題。首次沙箱執行因禁止 fixture 綁定127.0.0.1及原生權限檢查而失敗，原失敗保留；改用正常本機權限完成同一套 gate，未修改斷言或排除檔案。１４項摘要測試及１１項 Python 契約測試通過。
