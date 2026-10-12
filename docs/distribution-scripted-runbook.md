# Substack 同步腳本

正式來源為 gcake119/gcake-dev main 的完整 Markdown。原文正常公開且匿名讀回內容、標題、日期、canonical、圖片與連結符合精確版本後，才可同步至 Substack。

使用已核准並釘選的 runtime 與 Git 外私人政策；unattended.targets 必須只有 substack。啟動入口仍為 scripts/publishing/sync-distribution.ts，參數保留 --config、--pin、--acceptance、--out、--lock；預設僅產生計畫，既有授權執行才加 --execute。憑證只以既有 env-file 載入，不讀回、列印或複製。

每輪使用共享鎖、D1 在途對帳、固定 main 快照與精確計畫。相同版本只唯讀驗證；更新沿用原 ID，不再次發布。Substack canonical 為平台文章，正文保留 Pages 原文連結；來源時間對應到使用者已接受的分鐘精度。

結果未知時保留原 ID、操作意圖與必要快照，不重播。不得依時間偷取鎖；故障恢復先證明執行者已停止，再查核在途資料。成功或已結束失敗輪次由既有腳本清理只屬該輪的快照。

Substack 操作使用使用者核准的 Chrome 與經驗收的介面契約。正式 runtime 的安裝／切換由 owning conversation 驗收，不因 repo 程式清理就自動替換 pin、啟用寫入或部署。電子郵件與 App 通知依已生效的精確授權及既有設定，不因普通更新、重試或查核重新寄送。

歷史操作紀錄保存於 docs/archive/publication-history，不能作為重啟舊平台或舊雙平台計畫的授權。

2026／10／13，獨立 LaunchAgent dev.gcake.distribution-sync 已啟用，每 900 秒執行；政策位於 Git 外 native-substack-final-20261013，目標只有 substack，舊 Codex heartbeat 已停用。正式 runtime 保持釘選；repo 清理不直接替換已驗收的安裝版本。Chrome 需保持開啟，重啟後重新綁定驗證。
