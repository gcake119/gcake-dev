# 舊套件封存實作與正式驗證

使用者已明確授權依既有方案實作並執行，維持 4 GiB 上限與還原能力，封存完成後繼續原站時間修正的受控採用。這取代前一回合「僅規劃」的執行範圍，不改原驗收條件或精確候選清單。

## 本機完成

先觀察到新驗收入口缺失的 RED，再實作封存工具。12 項隔離檔案測試通過，包含原生 ACL／延伸屬性／權限保留、精確身分驗證、內容異常、來源被使用、缺權限、同磁碟限制、每項 intent 與 rename 邊界中斷、還原、目的地衝突、失敗回復及正好 4 GiB／超過一 byte。

完整既有 Hermes gate 共 308 項通過，109.995 秒；[最終紀錄](evidence/final-full.log)。既有負向測試的 HermesSelectionMismatch 輸出保留，不代表整體 gate 失敗。系統 Python 與正式選定 Python 3.11.15 皆通過封存專項 12 項。跨版本測試替身的 stat 欄位差異已修正，最終完整 gate 在修正後完成。

未新增依賴、CI 工作、計時器或整套 runtime 測試副本。測試臨時目錄由 TemporaryDirectory 管理，在成功與一般失敗／中斷後清理。正式封存為同磁碟 rename，不刪除、壓縮或改動封存資料內容。

## 已備妥的管理員操作

[套件雜湊與入口](evidence/prepared-owner.json)固定原核准三項、原 root controls 與兩份工具來源雜湊。安裝不改寫正式工具；root 入口先驗證精確雜湊，再以 root 私有暫存副本執行。封存後永久保存 root-owned 還原控制程式，不依賴本機暫存目錄。

一個前景操作串接：root 封存前置核對 → 三項精確封存與完整驗證 → 保存 root 還原入口 → 原時間修正 owner entry → 自然 dry-run 資格 → 恢復 live → 已安裝程式純讀回。任一步失敗即停止，不更換候選、放寬門檻或重送通知。系統管理員認證仍須由使用者在終端機完成。

預定還原入口為 sudo bash /usr/local/share/gcake-hermes-archives/20261026-retired-versions/controls/owner_restore.sh；只有正式成功回執確認保存後，才能宣稱該入口已存在。若還原回原本超額狀態，原更新容量檢查仍會阻擋後續更新。

## 正式結果

管理員已執行，三項精確套件完成封存，完整內容與 metadata 核對通過；inventory digest 為 62bed370dd82ebce225e2d5eb4aa5aac1aaf9d3b20a357f12ea37cd783b84ea1。root-owned 永久還原控制程式已保存。封存後 authority 3,713,116,158 bytes，加候選預估 4,086,761,446 bytes，4 GiB 上限與可用空間要求皆通過。原工作、通知帳本、保留控制檔案及 Gateway PID 未變，服務健康通過，封存操作零訊息／零服務操作。詳見 evidence/production-archive-success.json。原站時間修正的受控採用接續執行，尚待自然資格與 live 讀回，不能僅憑封存成功宣稱正式生效。

第一次正式前置核對在任何搬移前，因 Python plistlib 不接受一份 macOS plutil 接受的既有 LaunchDaemon 格式而中止；未修改該服務設定。已改用原生 plutil 唯讀 JSON 轉換，不忽略檔案。四份原生 plist 均讀取通過；重現用含控制字元的合法原生格式 fixture 已證明 Python 解析失敗而原生成功。修正後完整 309 項通過，103.960 秒，三個 Python 的封存專項 12 項均通過，最新來源已重新釘選。

## 依賴採用與收尾完成

原站時間修正候選 fcb86727… 已經原工作 13：32：37 自然 dry-run 資格，於 13：36 查核為 live／ready，已安裝程式讀回與實際 payload 差異核對通過；只改原站監控 library，無舊通知重送。詳見原站時間修正的 verification.md 與正式回執。

本機準備目錄 /private/tmp/gcake-original-site-times-20261026 與 /private/tmp/gcake-retired-archive-20261026 已在成功後依 owned marker／UID／精確路徑清理；[清理回執](evidence/local-preparation-cleanup.json)確認正式版本、proposal、cold archive 與永久 root 還原控制程式保留。沒有 Docker 環境或新計時器。root owner 暫存副本由原入口的 TemporaryDirectory 在結束後清理。未進行正式還原演練，原生隔離 metadata 往返與正式封存前後的完整驗證分開保存。

永久還原指令：

    sudo bash /usr/local/share/gcake-hermes-archives/20261026-retired-versions/controls/owner_restore.sh

此指令只在日後明確要求還原時使用；本次沒有執行還原。還原會回復三項原位置，不切換現用 runtime；若回到超額管理目錄，原更新容量限制仍有效。

本次實際使用的[雜湊釘選入口產生器](evidence/owner-entry-source/prepare-owner.py)與[前景串接入口](evidence/owner-entry-source/run-authorized.sh)另存為歷史來源快照，供核對 root 還原控制程式的來源；這些檔案不是新的執行授權，也不應直接重跑已完成的歷史操作。
