# PR #30：乾淨 CI 環境的依賴隔離修正

PR 最初的 c42c972 在兩個必要驗證均因同一問題失敗：準備工具於模組載入時匯入只存在於開發機正式 runtime 的 packaging_contract。乾淨 Linux checkout 沒有這個模組，因此搬移驗收在來源檢查前即失敗。原本的 Mac 本機驗證結果仍屬當時環境的真實結果，但不足以證明沒有安裝 runtime 的 checkout 可用。

失敗紀錄：

- Validate pull request：https://github.com/gcake119/gcake-dev/actions/runs/38762944895
- Validate editorial release：https://github.com/gcake119/gcake-dev/actions/runs/38762944991

已先在本機的 relocation 子程序阻擋該 installed-only module，重現相同 ModuleNotFoundError，再調整準備工具：只做 repo 來源檢查時使用標準函式庫，真正執行 prepare 且確認輸入完整後才載入既有安裝控制模組。實際製作套件時仍須既有 runtime、固定 baseline 與 approval policy；沒有加入替代 packaging contract、測試專用正式 fallback、跳過測試或修改 workflow。

修正後兩項搬移驗收已在本機 Python 及正式使用的 Python 3.11 通過。原四筆 commit 保留，CI 修正以追加提交交付。修正後已依序重跑完整 pnpm test（含 Hermes 185 項）、pnpm check、pnpm build:all、pnpm release:dry-run，全部通過，Spectra validate／analyze 與 git diff --check 亦通過。最新遠端 CI 的 exact head 與結論另由 PR #30 的 checks 核對，不能使用舊版本綠燈代替。

只改準備工具的載入邊界與驗收覆蓋，不改 notification sender、publication_monitor.py、正式 runtime、設定、通知歷史或備份；沒有補送、重啟、merge 或部署。
