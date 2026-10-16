# 控制工具回存提交審查（２０２６－１０－１６）

結論：本次範圍未發現需要阻擋提交的問題；未混入網站、Worker、workflow、依賴或其他功能變更。六支程式重新與 root-owned 正式來源比對，SHA-256 全部吻合。這是既有機制的來源保存，不是新的 runtime 採用或全面安全認證。

## 範圍

一筆原子提交包含 scripts/hermes 下的 production_entry.py、production_owner.py、packaging_contract.py、telegram_health.py、offline_guard.py、offline_probe.py、test_control_saveback.py；既有 add-hermes-publication-monitor 的 proposal、design、tasks 與 hermes-update-entry-integration delta spec；本目錄的回存／來源／RED／GREEN／SDK／完整 gate 證據與審查文件。

## 保護機制核對

- ProductionStore.approve 在既有 exact-digest authority 核准前先檢查 capability 與離線 SDK 證據，未刪除父層身分、digest 或持久化限制。
- production_owner.manage 在已有 approval／digest／payload 檢查之後、建立 supervisor 之前驗證 Telegram package；未移除原 updater exclusion、維護／selector／rollback 流程。
- Supervisor.verify_managed 保留自然排程 dry-run、UID／runtime／Gateway 身分、單一程序及 summary 檢查，並在 ready 前檢查本次啟動的 Telegram 健康。
- first-install 的固定控制集合納入 packaging_contract 與 telegram_health，仍拒絕任意或不完整模組集合。
- offline_guard／offline_probe 保留禁止 provider／模型、網路、私人憑證與子程序的邊界；SDK request 僅在記憶體 fixture 完成。
- 測試把 production path、actor／supervisor 及 root 身分判斷替換為 disposable fixture／mock。未以真正 root、launchd 或正式 job 操作作為本機測試。

## 驗證及限制

已核對既有完整 pnpm test（Hermes 195 項）、check、build:all、release:dry-run 成功紀錄；提交審查沒有再修改產品程式或測試。十項 focused acceptance 另於審查時重跑。Spectra validate／analyze 與 git diff --check 亦通過。記錄保留 Python 3.14 的既有 ResourceWarning，未改寫歷史 RED。

正式六支來源 owner／mode／hash 及 active／gate 再讀回均與回存 inventory 相同。未讀取正式 SQLite 或憑證，不由 selector 推論服務即時健康、真人已讀或資料庫靜止。歷史固定 inputs 與已消耗 continuation 仍不能重跑；全新安裝及特權部署未新增驗收。

使用者已授權這筆本機提交；不 push、不部署、不改正式環境或備份。所有暫存記憶體 fixture token 都是明確標示的測試資料，未納入 .env、SQLite、私鑰或實際 Bot Token。

## 暫存後的 log 格式修正

完整 staged diff 檢查發現新增 log 的工具原生行尾空白；先前未追蹤檔案未參與一般 git diff --check。已保留原始 log，repo 副本僅移除行尾空白與檔尾多餘空行，沒有改寫測試結果或程式碼。

原始備份：/private/tmp/gcake-control-review-20261016-hya12cth。逐檔原始／正規化 SHA-256 見該目錄的 normalization.json；備份保留，不納入提交。
