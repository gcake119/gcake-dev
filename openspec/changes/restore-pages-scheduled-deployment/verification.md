# 既有連載建置與 CMS 驗證修補結果

日期：2026-10-13。狀態：本機候選已驗證；尚未提交、推送、合併或部署。使用 `restore-pages-scheduled-deployment` 既有 change，原 push main／minute-37 候選與四項完成紀錄保留於 `legacy/`，不再是啟用方案。

## 已完成

- 保留 editorial 的 `0 23 * * 0,3`／`7 * * * *`、資格、篇序、D1 身分、production gates 與 Secret acceptance。撤回普通 Pages 的 push／minute-37 觸發，且 job guard 明確要求手動事件。既有 editorial 是唯一自動連載部署入口；人工重部署仍須另外授權。
- 兩條 Pages build 都先執行 `content:restore:ithome`。只讀部落格保存的 completed 快照，核對獨立 manifest 的 revision `bad9d573e90b068abbd87e63e58969694dee2053` 與全部 30 篇 SHA-256，成功才原子替換。來源失聯、解析失敗、active／19 篇、缺篇、revision 改變、正文或正文連同內附雜湊改動，一律停止並保留原檔。不抓取已完賽來源。
- CMS 的 release 驗證按實際 artifact SHA 查兩條 Pages workflow，排除 skipped／無新文章巡查與其他版本。普通手動 checkout 固定觸發版本；editorial checkout 固定原子發文版本。重試重新核對同一 SHA 的失敗 run，只呼叫 rerun-failed-jobs，保留原 release 身分與既有 Actions write gate。
- 公開頁、來源摘要、日期及 RSS 的既有獨立驗證保留。六篇文章及 manifest 沒有修改；五篇 ready 的本機建置閱讀路由均不存在。

## 驗證證據

隔離候選：`/private/tmp/gcake-pages-autodeploy-20261013`。測試紀錄：`/private/tmp/gcake-editorial-delivery-20261013`。

- `workflow-red.log`：真實 YAML 重現 legacy triggers 未撤回、建置缺少嚴格恢復入口。
- `cms-red.log`：現有 reader 把較新且不相干的 SHA 當成本次發文部署，確實失敗。
- `targeted.log`：41 項相關測試通過，包括實際 restoration CLI 非零退出、原檔保留、SHA 關聯、failed-job 重試及時間邊界。
- `test.log`：完整 `pnpm test` 通過，僅使用本機替身。既有 HTTP 模擬測試需允許 loopback socket；沙箱限制的第一次執行不算產品 RED。
- `check.log`：194 檔案，0 errors／warnings／hints。
- `build.log`：`pnpm build:all` 通過，包含 Astro／Admin／Worker／contracts。
- `release-dry-run.log`：通過；正文及篇序保留，productionWrites=false、telegramNetworkCalls=0。
- `actionlint.log`：兩條受影響 workflow 通過。
- `spectra-analysis.json`／`spectra-validation.log`：無 findings／errors／warnings。
- 建置產物另核對：completed、30 篇、固定 revision、全部正文雜湊符合；五篇 ready 路由不存在。

## 推送與部署前的待確認工作

本次沒有執行 provider／正式 D1／公開部署驗收。正式 D1 的暫停、前篇 verified-public、固定占位及 gate 現況仍需唯讀確認；GitHub 排程不保證準點。

提交範圍須包含兩條 workflow、package command、嚴格恢復程式及獨立 manifest、已確認的完整 30 篇 generated snapshot、Worker 的 SHA 關聯／重試、相關測試、三份現行操作文件及此 change。完整 generated snapshot 是先前已確認的本機變更，本輪未改其內容。其他設計／分發／email 變更不屬本次交付。

新版 CMS 只信任有 artifact SHA job 名稱的 run；各 workflow 最近 100 次 main run 以外或舊版沒有該身分的 run 保持未知，必要時由 owner 核對原 Actions run。失敗復原權限保持原狀，沒有自行開啟 Actions write 或 Worker retry gate。

使用者確認後，仍需另行處理 scoped commit／push、CI 與正式 rollout。依既有發布次序先更新建置 workflow，再 rollout 相符 Worker reader；保留 gate 現況及唯一連載排程，勿用正式 ready 文章手動提早驗收。正式部署完成後才取得新版本 Actions／Pages／CMS 與 URL／RSS 證據。

## 工作區核對

已將 28 個限定範圍檔案帶回工作區，與隔離候選逐檔核對一致；範圍外 376 個既有檔案的內容與權限保持不變，Git index 未改動，已確認的 30 篇快照未改動。本輪 4 項任務及先前 4 項歷史任務均完成，保留未歸檔 change 供推送前審閱。核對明細：`/private/tmp/gcake-editorial-delivery-20261013/copy-verification.json`。
