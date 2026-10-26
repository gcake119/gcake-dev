# 原站通知時間修正驗證

## 正式結果（2026／10／26）

已正式採用，台北時間 13：36 查核為 live／ready。正式選定版本為 fcb86727dd27036f25aebd129aeee685631cdf85cc60a5998a32ed8661020d54；已安裝程式純讀回通過，後續原站文章通知分列「原定發布時間（台北）」與「公開確認時間（台北）」。既有通知不回改或重送。

原工作 550aaf17723d 於 13：32：37.480265 自然執行，execution 738ae1d4aae94c2ea45ffb04d8cd6d17，UID 502，以該正式候選的 dry-run 完成且 exit code 為零；原生 SDK、當前 Gateway 健康、原排程關聯與自然執行資格通過後才恢復 live。原工作及通知帳本核對保留，未手動觸發工作，管理操作零訊息。這不代表已寄出一則使用新格式的真實文章通知；格式以已安裝的合格來源雜湊與行為測試核對，未製造測試文章或重送舊事件。

[正式 owner 回執](evidence/production-owner-active-live.json)、[live 純讀回](evidence/production-installed-readback.json)、[最後選定與 gate](evidence/final-public-selection.json)、[實際安裝 payload 差異](evidence/installed-payload-diff.json)分開保存。實際只改 library/publication_monitor.py，Gateway code、runtime、依賴與 Telegram capability 保留。owner 回執的 next_step 為共用舊 adapter 的歷史通知 continuation 文案，本次不執行 continuation，也不因此授權發訊息。

封存三項舊套件、保留 4 GiB 上限與永久還原入口的結果見[封存驗證](../2026-10-26-archive-hermes-retired-versions/verification.md)。兩個本機暫存準備目錄已在正式完成後精準清理，舊暫存操作入口不再使用；正式 proposal、release、cold archive 與 root 還原控制程式保留。下方為過程紀錄，不是待執行清單。

使用者已確認收到 Substack 的 Hermes Telegram 通知，並針對原站通知選定「原定＋公開確認時間」。本修正只處理原站時間語意。

## 原因與行為

舊程式把 RSS publishedAt 標成「台北發布時間」。延遲公開仍保留原定日期時，訊息因此誤導。現在原定時間只取 confirmed commitment，確認時間由成功驗證 canonical 頁面後的 observer clock 產生；同輪 publicWindow 約束有效範圍。原 authenticated summary window 與 request ID 驗證保持原樣。缺少資料顯示未提供／未記錄，不使用 RSS、工作開始或寄送時間補值。

既有 URL 去重、intent／ACK、帳本 schema、sent／intent／unknown 歷史不變。Substack 三行通知、訂閱者寄送、文章及 RSS 日期不在變更範圍。

## 本機證據

- 先執行既有 acceptance suite 的延遲發布案例，得到真實 RED：舊訊息只有 07：00，新契約要求原定 07：00 與確認 09：24。[RED 紀錄](evidence/initial-red.json)。
- 實作後原站 acceptance／integration／unit 共 45 案通過，包括成功查核時刻、未知排程／時刻、bool、NaN、Infinity、越界／反向／缺少觀察期間及原有重送抑制。
- 完整 test:hermes 在 sandbox 因本機 socket 禁止而失敗；保留原始紀錄，不削弱測試。允許原生權限後，主機 Python 完整 297 案通過，103.869 秒。[完整紀錄](evidence/full-unsandboxed.log)。紀錄中的 HermesSelectionMismatch 是既有負向測試輸出，整體 exit code 為零。
- 正式選定 Python 3.11.15 同一套完整 297 案通過，194.676 秒。[選定 runtime 紀錄](evidence/selected-unsandboxed.log)。這是測試執行時間，沒有成本或節省金額推論。
- Spectra validate／analyze 通過，零 findings；git diff --check 通過。
- [新訊息示例](evidence/new-message-preview.txt)使用驗收情境的查核時刻，不能當成本篇歷史時間證據。

## 正式採用

本次採用前正式版本為 4fe889d8069a96b6d9f11b31d5940ebd00722280d39eabf412ab8ed906dbf554，immutable library 不能就地修改。由此 baseline 準備完整 successor，只允許 library/publication_monitor.py 內容變動，Gateway code／runtime／依賴與 SDK proof 保持一致。

沿用既有 owner_successor、manifest／packaging 驗證與 updater／原生服務健康檢查。管理員採用時會等待原每小時工作的自然 dry-run，再恢復 live；不手動觸發工作、不新增計時器、不重送或修改既有訊息。實際安裝與純讀回證據尚未取得前，本修正不得宣稱正式生效。

沒有建立測試文章、真實測試 Telegram、commit、push 或 PR。前一個 Substack 修復及其他聊天的既有 dirty 工作均保留。

已備妥受控候選 `fcb86727dd27036f25aebd129aeee685631cdf85cc60a5998a32ed8661020d54`，僅 `library/publication_monitor.py` 改動，完整 manifest 與離線 SDK 證明核對通過。[套件摘要](evidence/prepared-successor.json)。管理員操作入口：`bash /private/tmp/gcake-original-site-times-20261026/owner_adopt.sh`。套件由 UID 501 擁有，保留至正式採用與讀回結束；結束後只移除該精確暫存目錄。

管理員已執行採用；第一輪回覆 blocked，proposal 已核准並建立 next-candidate，active 仍為舊 4fe 版本的 live。未宣稱生效、未盲目重跑；待唯讀核對受保護 managed_update 原因。代理端 sudo -n 回覆 password is required，不能沿用另一終端機的管理員認證。

受保護診斷確認 managed_update 原因為 disk-budget；磁碟可用 135,697,047,552 bytes。既有 updater 的原規則同時要求至少 4 GiB 加候選大小的可用空間，以及整個 authority 加候選不超過 4 GiB。初步診斷只列 releases／proposals／不存在的 backups，未涵蓋 private，故尚不足判斷可處置項目；已補完整目錄大小的唯讀診斷。容量上限、既有版本與備份均未更改。

完整容量核對：authority 4,823,534,781 bytes（約 4.49 GiB），加候選為 5,197,180,069 bytes（約 4.84 GiB），超過原 4 GiB 上限。private/first-runtime 是 2,216,043,633 bytes 首次安裝備份；保留規則要求舊 proposal／release／rollback／私人備份保持原政策，不能批次 prune。沒有移走備份、刪舊版本或更改檢查來避開門檻。容量政策變更須依使用者 AGENTS.md 的 mandated gates 規則取得明確授權；時間修正維持 3／4 任務完成，正式尚未採用。

使用者明確選擇維持 4 GiB、另行規劃舊版本封存，未核准 6 GiB。已建立並暫存 archive-hermes-retired-versions 提案，規格與 Gherkin 在 tasks 前完成，validate／analyze 零 findings；本回合只規劃，未搬移或刪除。精確清單、容量及還原方式見 docs/hermes-retired-versions-archive-plan-20261026.md。時間修正仍 3／4，舊版 ready/live 未改。

2026／10／26 後續管理員操作：三項精確舊套件已完成封存，4 GiB 限制保留，root-owned 永久還原入口已保存。候選 fcb86727dd27036f25aebd129aeee685631cdf85cc60a5998a32ed8661020d54 已選入 dry-run／verifying，已安裝程式 SHA256 94a43f69cecb074300e8c8a6d88642b251991ecc365c48cee0089659ad8fa42a 與完整測試來源一致；純讀回通過，零通知。管理員 owner entry 正在等待既有工作自然 dry-run；此時不要重跑安裝、改排程或終止執行中的終端機。正式 live 接受仍未完成。

本次實際使用的[候選準備程式](evidence/owner-entry-source/prepare.py)、[安裝讀回程式](evidence/owner-entry-source/read-installed.py)與[唯讀診斷](evidence/owner-entry-source/read-adoption-state.py)保留為歷史來源快照，避免依賴已清理的暫存套件；不因此重新授權舊操作。
