# PR #41：CI 與審查修正（2026-10-20）

## 原始候選與結果

候選 `7e617b8d401be301d94fbbaebf8298abeec52e9e` 的 [CI 39295170194](https://github.com/gcake119/gcake-dev/actions/runs/39295170194) 失敗於 distribution 驗收：274 項中 273 pass、1 fail。普通執行者同 ID 更新情境預期 observed，實際 manual_required。後續型別、建置與演練被跳過，不能稱原 CI 通過。原始 log 保留於 `/private/tmp/gcake-pr41-ci-failed.log`。

[Codex 審查](https://github.com/gcake119/gcake-dev/pull/41#issuecomment-6273275865) 對同一候選完成，提出兩個 P1、兩個 P2；原始未解決狀態保留，不能用本機 GREEN 代替新候選審查。

## 重現、根因與最小修正

- CI 同型失敗：未改的原情境本機單項連跑 15 次通過，因此不冒稱原本可穩定重現。將 before-ready 檔案公開分成兩次寫入、相隔 180ms 後，在原本同 ID 更新／相等輪次唯讀驗收中穩定重現同樣的 manual_required／未決 intent；把測試正常工作期限設為 5 秒後，仍在約 654ms 失敗，排除只因 1 秒測試預算。協調訊號直接寫至可見路徑，另一程序可讀到不完整 JSON；改為先完整寫入私人 partial 檔，再以同檔案系統 hard link 原子公開，保留 exclusive-create 與既有驗證。before-ready 與 before-verdict 兩個方向都修正，沒有忽略 parse error 或移除安全檢查。原 CI 未保留內部 parse 原因，故不宣稱能排除所有平台時序因素；新候選仍須由 CI 驗證。
- [P1：舊授權 dispatch](https://github.com/gcake119/gcake-dev/pull/41#discussion_r4316880156)：現有驗收在 readSource 後更換一份有效 policy，舊程式確實呼叫舊執行者一次。修正為每次核對當前 policy 後與輪次初始完整 scope 比較，不同即停止 dispatch；新的有效 scope 留待後續輪次，不自動沿用舊 executor／期限。驗收確認零 dispatch、無新增 intent。
- [P1：改名阻塞公平性](https://github.com/gcake119/gcake-dev/pull/41#discussion_r4316880166)：刪除已追蹤原稿，加上字母靠前新稿並設 maxArticles=1，舊程式連五輪只處理 a。修正為保存候選的 checkedAt 與持久的 rename hold，讓原稿與後續來源輪替；hold 保留 lastErrorCode，不能在下一輪變成可建立的新身分。驗收確認五輪可到達原 ID，且無 provider 存取或替代建立。
- [P2：無 intent 對帳投影](https://github.com/gcake119/gcake-dev/pull/41#discussion_r4316880177)：透過列表／單篇實際路由，reconciliation-required 卻回 unresolvedOperation=false。修正投影將該狀態本身視為未決，回 foreground-reconcile；不洩漏 checkpoint／intent 細節。
- [P2：SIGTERM 不結束](https://github.com/gcake119/gcake-dev/pull/41#discussion_r4316880183)：真實自建測試子程序捕捉 SIGTERM，期限後仍運行。修正為 SIGTERM 後一秒寬限，再 SIGKILL 自有 process group，獨立於 exit event 結束 promise；父程序在寬限內先離開也仍保留 group cleanup。測試等待有界 OS 回收確認程序不存在。最初測試模擬檔格式未成功啟動的 ENOENT 是無效重現，另以 .cjs／絕對 Node shebang 修正後取得真實 still-running RED，未把無效重現計入。

## 驗收依據與範圍

沿用已核准 Qualified unattended draft integration、Freshness and source lifecycle boundaries、Bounded recovery and truthful disablement、Authenticated frontend status projection 及 Parent verifies immediately before paste 的 Gherkin；不改驗收條件，不加 runner／依賴／CI 或弱化既有斷言。擴充原 Node／SQLite／檔案交換與 Worker 路由 seam，局部草稿＋API 全部 53／53 通過。

修正位於獨立 `codex/substack-draft-sync-20261020`，沒有後台歸檔、前端、內容、migration、workflow 或正式設定變更。主工作區未寫入。普通功能測試使用有限但足以包含 Node 啟動的預算，逾時行為由另一個真實 SIGTERM 測試保留；不是放寬產品的執行上限。

這是新的 PR 候選，不更新已安裝的草稿 runtime 或正式 Worker，不啟動真實 Chrome／Substack、不重做 provider 驗收、排程、寄送、合併或部署。既有部署證據仍是歷史版本；新候選的 CI／重新審查結果必須另讀回，不以舊通過或本機測試代替。


## 本候選完整本機 gate

`pnpm test`、`pnpm check`、`pnpm build:all`、`pnpm release:dry-run`、`pnpm editorial:rehearse` 全部 exit 0；程式／測試與設定在執行前後指紋一致，Spectra analyze／validate、JSON／文件連結與 diff check 通過。摘要與原始失敗／GREEN log 雜湊見 [新候選本機證據](pr41-fix-local-gates-20261020.json)。既有 Hermes SQLite ResourceWarning／Node SQLite ExperimentalWarning 保留，未修改無關測試。

後續以一個獨立修正 commit 更新同一 PR；不改寫原四個 commit。舊審查討論與失敗不自行改稱已解決；新 CI／重新審查是否完成，另以 PR 的最新 head 實際結果為準。
