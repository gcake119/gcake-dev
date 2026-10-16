# gcake-dev 工作樹來源對帳與安全收尾（２０２６－１０－１６）

使用者授權包含所有 gcake-dev 工作樹的既有未提交工作、必要提交／PR／合併及安全清理；不部署、不改正式 Hermes 或 Substack runtime／排程，不刪備份。

## 主線與有效來源

對帳基準 85db4b1c46b6676d648da5465077bff5cc3d4aa8。API-free 公開驗收工具、29 項測試及三個靜態 fixture 原本只存在 read-only-release-acceptance 工作樹，已按 source-inventory.json 原樣回存。既有首篇的 shell 入口放在 historical 並設為 0644，只作追溯，不可重新安裝或重跑已完成 job。

工具只核對固定歷史首篇，不能代替目前 Hermes 的通用新文章監控。保留 GitHub REST／GraphQL／內部 JSON API 禁止、無憑證／代理／redirect、隔離公開 Git、子程序群組逾時清理、HTTP 不完整回應的結構化結果、獨立 page／RSS 與 exact run／parent／checkout provenance。此次只執行 fixture tests，不對正式來源執行網路 CLI。

## 工作樹對帳原則

- Hermes closeout 的程式碼多數已與 main 相同，或精確對應 main 歷史 373299f；其舊文件缺少後續正式採用／修復狀態，不能覆蓋目前主線。
- 舊 distribution integration 含已退役 Paragraph 程式及較早的 Substack／發布模型。已核對已合併歷史及當前退休政策；保存原始 patch／index／檔案，不重新啟用已退役功能。
- CMS 舊分支的兩筆 Series CRUD 提交並非 main 祖先，與新版發布佇列可能有相容性差異。完整提交保存在原分支及 Git bundle；來源／截圖已封存；使用者已授權移植建立、改名與刪除功能，須以目前主線重新整合及驗證，保留新版發布佇列與安全規則。
- CI 工作樹屬另一個仍在執行的對話；本輪不與其同時改寫檔案。交付／清理須以該 owning 對話的 fresh SHA 與完成狀態為準。
- 不將既有 snapshot 的舊 19 篇或歷史設計文件覆蓋目前受保護的 30 篇與最新正式說明。

## 可還原備份

持久保留區：`.git/codex-worktree-closeout-backups/20261016-bz8ke0d7/`，權限 0700。包含各工作樹原始 HEAD／branch、dirty 與 ignored 檔案的 SHA-256、binary staged／unstaged patch、index.before、原檔及瀏覽器證據、SQL 備份。`all-local-refs.bundle` 已驗證為完整 Git 歷史，可恢復未合併分支。外部暫存備份 `/private/tmp/gcake-all-closeout-20261016-bz8ke0d7/` 同時保留，不當作唯一備份。

SQL、私人環境與完整 runtime 不放入 repo。Git bundle 和工作樹備份不在清理名單。此 README 不授權重新執行歷史 provider／production 操作，也不把 fixture 或本機驗證升格為正式環境驗收。

原始盤點／來源判定與清理 receipt 保存於上述持久保留區；實際清理清單以最後 receipt 為準，不由「HEAD 已合併」推論 ignored 證據可丟棄。

## CMS 整合與驗證

Series CRUD 已移植到目前主線；保留新版佇列、手動發布、slug 服務與 Paragraph 退役政策。系列建立、名稱修改、原子改名、確認刪除、標題／篇數摘要均透過既有 Git 寫入，並受已開始連載的識別／篇序鎖定。已修正一般文章儲存夾帶刪除的可選來源問題，發布寫入型別仍要求完整來源。

完整本機 test、check、build:all、release:dry-run 全部通過；另外新認證／CSRF 測試完成 focused 27 項。桌面與手機截圖、鍵盤建立、改名碰撞保留草稿、成功改名、刪除取消／確認及已開始連載鎖定均有本機記憶體 fixture 證據，不能視為正式站部署驗收。詳細 RED／GREEN 與畫面保存在私有備份。必要遠端 CI 與合併依 PR checks／merge receipt；實際清理只在合併後進行。

## 後續另案 CMS 正式部署結案

上方「不部署」為工作樹收尾當時的授權邊界。後續使用者另行授權 PR ＃32 的 CMS 正式部署，已於同日以 main `6f02e56` 完成；正式 version `ded9864d-4748-4143-96b4-87e80b73d871`，１００％ 流量，健康與介面查看通過。此次未變更 Hermes／Substack runtime 或排程，未補發文章或通知。

部署前 D1 備份、部署 receipt 與原始查核 logs 保留於另一個私有目錄 `.git/codex-production-backups/pr32-cms-20261016-zp885i4z/`，不取代或清理上方工作樹備份與 bundle。詳細結果、證據界線及回復基準見 [CMS 正式部署與結案紀錄](../../publishing-cms-deployment-20261016.md)。此次只將摘要回填文件，SQL 與憑證未回存。
