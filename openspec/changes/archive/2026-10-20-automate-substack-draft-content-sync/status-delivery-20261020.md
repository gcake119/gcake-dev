# 已部署唯讀狀態功能的乾淨 Git 交付

## 範圍與來源

以 main 合併 commit `6e8f715fb14a142e43e322d640e40a21e9fc0907` 建立隔離 clone，從正式版本 `b7019878-d470-4558-9d68-ebaee8a7fe4a` 的保存候選取回三項改善：Substack 列表／單篇三種獨立狀態畫面、舊發布紀錄唯讀接線、Pages 現行發布／部署／公開驗證紀錄呈現。此處保存的歷史正式驗收不是本次重新部署或重新驗證文章。

只加入 15 個來源／測試／契約檔與本 change 的規格、文件及歷史證據。未納入後台 Spectra 歸檔、DESIGN／設計系統變更、另一輪 draft-list runtime 修復、依賴、workflow、migration 或部署設定。主工作區及原隔離 worktree 保留原狀。

正式候選早於 PR41 的最後審查修正，因此保留 main 的 substack-draft-api.ts／test，確保無 intent 的待對帳紀錄仍顯示 unresolvedOperation 與前景查核入口；不覆蓋 PR41 的同步執行器、來源或整輪期限修正。

## 本輪真實 RED／GREEN

既有文章切換驗收涵蓋先前查詢的成功／失敗晚到。實際 Vue setup 上先查 acceptance，再查 next，後篇先成功後前篇成功：原候選把 publicationStates 誤覆為 acceptance，真實 RED 已保存。發布查詢加入序號，過期成功與錯誤都不再修改最新狀態；既有 Vue／Worker 聚焦驗收 60／60 通過。未新增測試層或套件。

## 驗證與限制

完整本機結果與候選指紋見 status-delivery-local-gates-20261020.json。本輪 test、check、build:all、release:dry-run、editorial:rehearse 全通過；check 共 228 files，0 errors／warnings／hints。Spectra analyze 無 findings、validate 與 diff 檢查通過。既有 Hermes SQLite ResourceWarning／Node ExperimentalWarning 保留於原始 log，沒有當作失敗吞掉。CI／Codex 必須另外核對 PR 精確 head，這份本機證據不冒稱線上審查結果。

歷史正式桌機／390px、明暗主題、owner Chrome GET 與部署 bytes 證據分別見 frontend-production-20261020.md、publication-read-fix-20261020.md 與 pages-current-20261020.md；不代表本次組合已部署。故障／過期登入／晚到回應與方法拒絕的本機證據，不能冒充正式故障注入或真人實收。

目前授權僅 commit／push／PR／CI 與審查，不合併、不部署、不修改正式 runtime／timer、不啟用排程寫入、不寄送。
