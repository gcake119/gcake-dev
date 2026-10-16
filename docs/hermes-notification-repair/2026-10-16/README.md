# 正式更新控制工具回存（２０２６－１０－１６）

本次只保存現有正式保護機制並補本機驗收，不更新正式 runtime。基準 main 為 3412e0e7d22a5d92e0388951731c22101518455d；正式 selector 為 f36ad05d1ea2fe93fe82712008904ae1cbe7cc4b9b606833fae07aa8bbaf753c、live／ready。

## 回存範圍與來源

六支來源均從 /usr/local/share/gcake-hermes-runtime/tools 唯讀取得，原檔均為 root-owned、模式 0644、非 symlink 且無 group/world write；逐支 SHA-256 與 repo 原版本見 control-source-inventory.json。回存檔案與正式來源逐位元相同，沒有藉回存修改既有政策。

- production_entry.py：核准前必須具備綁定的 Telegram 能力證據。
- production_owner.py：候選更新進入 service lifecycle 前檢查套件；qualification 在 ready 前驗證本次 Gateway 啟動的 Telegram 健康；first-install 仍要求固定的九支控制模組。
- packaging_contract.py：綁定 capability、離線 SDK 報告、lock、依賴／module metadata、proof 檔案與 payload。
- telegram_health.py：拒絕過期、其他程序／啟動、非 connected、平台錯誤等健康資料。
- offline_guard.py、offline_probe.py：保存上述證據的產生及隔離邊界，拒絕 provider／模型載入、網路、私人憑證讀取、子程序及未授權寫入。

同目錄其餘五支 repo 對應控制工具已在先前唯讀比對確認一致。gateway／monitor／management bootstrap 是 installer 生成的固定入口，不作為可手動採用的來源副本。未複製正式 .env、SQLite、備份或 root-private receipt。

## 驗收與證據界線

先在 hermes-update-entry-integration 補 Requirement／Given／When／Then，再補 implementation contract 和第 17 組任務。來源測試為 scripts/hermes/test_control_saveback.py，參與既有 pnpm test:hermes 與 pnpm test。

- control-red.log：回存前，ProductionStore.approve 接受無 capability manifest、production_owner.manage 接受已核准但缺少能力證據的更新、Supervisor.verify_managed 在 Telegram 未連線時仍標 ready；三項均由既有公開入口重現。缺少 helper import 的錯誤另列，不作為這三項產品 RED。
- control-green.log：回存後十項驗收通過，包含完整套件核准／更新、缺失及篡改證據拒絕、健康成功／失敗與時間邊界、固定安裝模組不足拒絕、離線效果封鎖。
- native-control-green.log：同十項以目前選用的 Python 3.11.15、-I -B -S 執行通過。
- native-offline-sdk.log：以相同 native interpreter 執行 repo 內 offline_probe，九種拒絕邊界、18 個 SDK symbols、依賴及 module origins 驗證通過；一個記憶體 fixture request、零實際 Telegram 請求、零模型呼叫、未啟動 Gateway。這是 SDK／synthetic health 證據，不是新的正式健康或真人收件證據。
- selected-manifest-readonly.json：回存的 require_manifest 接受目前正式 manifest，且其 proof 內容與正式檔案相同；只讀公開檔案。
- local-gates.json 與各項 log：完整本機 gates 的實際結果。test-sandbox-preflight.log 為 pnpm 版本快取受 sandbox 阻擋的前置失敗，不是產品測試失敗。

驗收只使用 disposable fixture authority／payload、mock actor／supervisor 或隔離子程序；不取得 root 權限、不呼叫 launchctl、不執行正式 manage／owner_main。測試中對 manage／owner_main 的呼叫均替換了正式路徑及服務邊界。原生日誌的 Gateway／健康情境同樣是 fixture。

## 操作限制

這不是新的通用安裝器。既有 owner_main 仍綁定歷史固定 inputs、control hashes、baseline 與一次性流程；歷史通知 continuation 已消耗，不可重跑。保存 offline helpers 不會自動改變既有 first-install 的固定模組 allowlist。日後如要重建套件或安裝，須另外準備 exact manifest、全部相依項、核准及 qualification；本次不宣稱全新機器安裝已驗收。

本次不 commit、不 push、不採用 release、不部署、不改正式設定或排程、不發送通知、不刪備份。最終正式檔案雜湊及 selector 再讀回結果另見 control-source-inventory.json。

## 最終查核

完整 pnpm test（含 Hermes 195 項）、pnpm check（199 files；0 errors／warnings／hints）、pnpm build:all、pnpm release:dry-run 均 exit 0。Spectra validate／analyze 通過且零 findings，git diff --check 通過。完整測試 log 保留既有 Python 3.14 SQLite ResourceWarning，未把警告隱藏或改為測試成功證據。

六支 repo 程式與正式來源 SHA-256 逐一完全相同；正式來源雜湊、owner／mode 與 active／gate 在前後讀回均未變。本次未開啟正式 SQLite 或私有憑證；不以 selector 相同推論當前 Telegram 健康或資料庫內容完全不變。

## 審查與本機提交授權

回存驗證完成後，使用者另授權 review 並只提交本次回存、不 push 或更動正式環境。前文「不 commit」為回存階段的歷史界線，本次限定提交依新授權處理。審查範圍、結果與限制見 REVIEW.md。
