# Substack 提交與推送整理（2026-10-20）

## 範圍與決策

使用者授權整理 Substack 相關變更、建立 commit 並推送。工作在獨立副本 `/private/tmp/gcake-substack-delivery-20261020`、分支 `codex/substack-draft-sync-20261020`，基底為遠端 main `509d71b21e6261f5b674bdc77cb38deaf73d785d`。自原工作區選取 48 份 Substack 檔案，複製前後逐檔 SHA-256 相同；未納入 DESIGN.md、docs/design-system.md、simplify-admin-workflows 或後台歸檔 commit e789dbe。

沿用本 change、publishing-operations、quiet-background-distribution 與既有 Substack 政策；Git 為內容來源，保留原 ID／slug，草稿、排程、公開與寄送權限分開。專案沒有 docs/decisions registry，本輪沒有新增產品決策，故不新增 ADR 系統。保留 API 部署任務 10.1／10.2 的未完成狀態，不以本機測試替代正式部署或 provider 驗收。

## 提交拆分

1. 草稿同步核心：14 份程式／測試檔，含同 ID 內容核對、未知結果處理、受限 Chrome 執行者、圖片完整性與既有輪次／鎖／通知整合。
2. 後台唯讀 API：4 份程式／測試檔，提供 owner 登入後的列表與單篇狀態，分頁、錯誤、no-store 與禁止寫入。
3. 規格與證據：AGENTS.md、兩份 runbook、API 契約與此 change 的規格、Gherkin、任務及歷史失敗／本機／實際驗收紀錄。兩份 runbook 補上歷史日期界線，避免早期「尚未啟用」與後續啟用證據被混讀。

## 驗證界線

原有 continuous-media-local-candidate.json 的 18 份程式／測試雜湊全部符合本次複製內容；因整合基底已是最新 main，仍執行本候選的五項既有完整本機 gate，不以舊基底的通過代替。Spectra analyze／validate 通過；本機 JSON 與文件連結檢查通過。

第一次 sandbox 中的 pnpm test：Hermes 本機 HTTP／socket 測試遭 `PermissionError: [Errno 1] Operation not permitted`，共 23 failures／16 errors，完整紀錄保留於 `/private/tmp/gcake-substack-prepush-20261020/test.log`。沒有改測試或忽略失敗；允許測試建立本機臨時服務後重跑完整 gate，最終結果另存同目錄 `full-permitted/results.json`。這不是線上 CI 或產品修正。

本輪不呼叫真實 Substack、不重新安裝或切換私人 runtime、不改 timer／排程／寄送／正式設定，不部署 Worker，不建立 PR 或合併。既有 provider／自然輪次證據保留原日期與限制，不宣稱本輪重新驗收。原工作區保持原樣，後續其他工作的變更不自動納入此快照。


## 本候選最終結果

五項既有 gate 全部通過：`pnpm test`、`pnpm check`（225 files，0 errors／warnings／hints）、`pnpm build:all`、`pnpm release:dry-run`、`pnpm editorial:rehearse`。18 份程式／測試在執行前後與複製快照雜湊相同，機器摘要與依賴／設定指紋見 [本候選本機 gate](commit-local-gates-20261020.json)。Hermes 既有 SQLite ResourceWarning 與 Node SQLite ExperimentalWarning 保留，完整 gate exit 0；未忽略失敗或改斷言。

這些結果只證明本機候選，不宣稱分支推送自動完成 CI、正式 HTTP API 已部署或重新完成 provider 驗收。程式／依賴／設定未再修改，不因拆成三個 commit 重跑相同的完整 gate。


## 同批後續文件補齊

完成前三個 commit 推送後，另一項已授權工作補齊了 2026／10／20 00：14：31 的唯讀 API 正式部署及 00：19 驗收結案。將已完成的七份 Substack 文件更新另作第四個 commit；本輪沒有執行部署。第一批快照中的「部署任務待完成／HTTP 未部署」保留當時界線，最新狀態由 [API 部署紀錄](api-production-20261020.md)、[機器摘要](api-production-results.json) 與前端契約承接；原部署前契約保留為 frontend-api-before-production-20261020.md。

最新 API 文件／任務／對照與實作紀錄皆逐檔從主工作區複製，複製前後雜湊相同。25 項任務完成；正式 version 66a6ea7d-8d71-49a7-b91a-67cd2a095f9c 是另一項工作的保存證據。原機器摘要 sourceDeltaCommitted=false 保留部署當時語境，不能當成推送後仍未提交的狀態。

第四個 commit 只有文件，程式、依賴與設定仍與本輪五項 gate 的指紋一致；不重跑未改的產品測試，不重做正式驗收，不改 runtime／排程／寄送。後台歸檔 e789dbe 仍不在分支中。
