# 同步腳本 PR 範圍與驗證

本次提交把既有已驗證的同步流程保存為可審查的版本，並新增整輪同步及 Substack 側邊瀏覽器交接入口。分支基於 main，包含腳本所需但尚未提交的受控跨平台前置流程；與仍開啟的 PR #8 的 portable preparation 檔案有重疊。PR #8 保持不變，兩份 PR 應一起評估整合順序，不能假設它已合併。

提交按功能分為：發布模擬的路徑與清理修正、持久化跨平台同步前置流程、來源與意圖綁定的 Substack 交接工具、整輪同步腳本、CI Chrome 環境、操作文件與驗證紀錄。每個新增行為的測試與實作保留在同一提交，前置流程先於使用它的新入口。

`distribution:sync` 預設只產生計畫，明確 `--execute` 才執行；讀取一次新 main 快照，以完整匿名 Pages 證據產生每版每平台授權。同版只讀回；新版本保留 remote ID；未知操作不重播；失敗隔離、共享鎖與私人證據清理均由腳本處理。`distribution:handoff` 核對固定來源、D1 原意圖、期限與完整實際 DOM 證據，獨占保存回覆。Substack 寫入仍由已登入的 Codex 側邊瀏覽器完成，沒有背景 browser／Cookie／未公開 API。

政策仍是零電子郵件／Substack App 寄送；Paragraph canonical 指向 Pages；Substack 的平台 canonical 例外與分鐘精度均為已核准範圍。範例政策預設停用且一般能力旗標不提升。PR 不修改文章、原文排程、正式部署或 GitHub Secret，不包含憑證、私人 pin／policy、D1 資料或 `.distribution-handoff` 操作證據。

本機：377 項 Node、31 項 Python、186 檔 Astro／TypeScript 0 errors／warnings／hints、build:all、release:dry-run、Spectra validate／analyze 與 diff 檢查通過。保留真實行為 RED→GREEN：pending prepare 禁止 publish、未結束意圖要求 attention、相同失敗去重與恢復通知、不同來源版本完成通知、已有遠端身份禁止重做 create。初始缺少模組的測試失敗不列為產品 RED。

真實唯讀腳本驗證：2026／10／12 21：34（Asia／Taipei），新快照 commit bb241cb375c9d0b05c8301eba6e0d2cae2bab409；25 個候選中1篇符合，5篇未published、19篇外部聚合阻擋。第一篇兩平台完整讀回均verified；只執行verify，沒有新增文章、更新內容或寄送通知。全D1鎖／checkpoint／未結束意圖均0，所屬來源快照已移除。該驗證不是這次 PR 重新發布或正式部署的證據。

先前 handoff／runbook 內的「未提交、待切換」是該階段的操作快照；最新命令與腳本範圍以 distribution-scripted-runbook.md 及本文件為準。正式本機排程已在前一輪核准並切換到腳本化版本，舊 runtime／pin／policy 保留供回復；這次提交及 PR 不改動它們。CI 安裝 fixture 所需 Chrome，僅執行本機模擬，無 provider 憑證或文章寫入。
