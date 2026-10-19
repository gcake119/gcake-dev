# 通知原因修正：7.1－7.3

## 問題與修正

新增系列備稿本身沒有造成文章 ID 錯誤。真實試行期間，新觀察器發現三篇舊文摘要／正文差異，卻先把原因統一寫成 manual_required；通知產生器又把特定原因丟棄，持久待辦合併也會覆蓋具體原因。Python 接收端因此一律顯示「檢查文章身分與原錯誤」，標頭還把正常備稿描述成「已暫停自動重試」。

修正沿用既有觀察、D1 持久待辦、通知資料與 Hermes 接收端：

- 新系列原稿就緒、尚待前景建立或核對草稿：待備稿。
- 同 ID 內容有差異：內容待同步，不重發或重寄。
- 取消、延期：明確指出尚未確認解除／延期，provider 仍可能按最後確認時段發布。
- 未結排程意圖：優先顯示結果未明，要求讀回原 ID，不重做或另建。
- 未分類的舊錯誤：保留人工確認與原始操作紀錄，不直接指稱身分錯誤。
- 通用持久待辦不覆蓋具體原因；未知操作的恢復提醒優先於一般內容同步。
- 相同原因集合跨輪次／程序重啟仍安靜；資料讀取失敗保留原通知；真實差異不因新增草稿而被靜音。
- 完整備稿完成且讀回後，下一輪不再把它列為待備稿。

## 規格與 TDD 證據

先在原 quiet-background delta 補上 Action-specific truthful attention reasons 與四組 Gherkin，再新增任務與失敗測試，沒有新增測試層、服務、依賴或 timer。

| 可觀察情境 | 驗證入口 |
| --- | --- |
| 新系列備稿、內容差異、取消、延期、未知 arm，以及備稿完成後解除待辦 | distribution-scheduled.test.ts：attention reasons distinguish new series drafts, content drift, cancellation, postponement and uncertain arm |
| 具體原因不被通用 hold 覆蓋；實際 TS 資料交給 Python 接收端；重啟去重 | distribution-attention.test.ts：series preparation and content holds preserve specific reasons through the Hermes consumer and restart |
| 清單省略時仍保留原因；未知代碼不破壞原資料；恢復原因優先 | distribution-attention.test.ts：specific durable schedule reasons survive omitted inventory and unknown reasons cannot replace the feed |
| 真實 D1 repository 通知資料、舊／新 hold 合併、D1 讀取失敗保留 | distribution-sync.test.ts：production scheduled durable holds retain content and recovery reasons instead of a legacy generic fallback |
| 六種原因呈現正確、不假稱已取消／延期／身分錯誤、同組不重送 | test_substack_attention.py：test_actionable_reasons_do_not_invent_identity_errors_or_completed_cancellation |

RED：Node 20 項中新增 3 項明確失敗；Python 新代碼被舊 allowlist 拒絕，通用文案／標頭斷言失敗。GREEN：相關 Node 37／37、Python 8／8 通過。跨語言測試只呼叫 fixture sender，沒有實際 Hermes／Telegram／Substack 寄送。

完整 pnpm test、pnpm check、pnpm build:all、pnpm release:dry-run 皆通過。第一輪沙箱內完整測試與 dry-run 因臨時檔案權限／127.0.0.1 listen 被拒失敗，保留原日誌；僅將失敗兩項以獲准的沙箱外環境重跑，未弱化斷言。未改動的 check／build 通過證據沿用同一程式碼、相依與設定候選。精確命令、雜湊與日誌見 attention-reasons-evidence.json 及 Git 外耐久驗證目錄。

## 啟用界線

這是本機候選修正，未提交、推送、部署或切換通知 runtime。正式接收端仍為原本固定程式，因此本機通過不代表正式文案已更新。

新原因代碼仍使用既有 schema 1 的 slug／code 有限資料，不擴大訊息或憑證範圍。但舊 Python 接收端會拒絕新代碼，正式啟用須先更新並核對 privileged consumer allowlist，再成對切換 producer 的 immutable runtime／pin；保留既有去重 ledger 與 unknown 寄送紀錄，不能刪除、清空或重播。正式切換／寄送另需授權。

本次沒有修改三篇舊文，也沒有消除其真實內容差異；10／22 試行文章排程與另兩篇草稿未動。原有 dirty 文件與先前 3.1 完成／5.3 待驗狀態均保留。

## 2026／10／19 已授權部署：預檢完成，待系統驗證

使用者已明確授權開始部署及成對切換，不再需要重複詢問部署同意。實際 sudo 唯讀查核回覆 a password is required；root-owned consumer 的更新仍需使用者完成 macOS 管理員驗證，不能將模型工具的沙箱授權視為管理員身分。

首次真實部署預檢還原了三篇既有文章已保存 SUBSTACK_PUBLIC_EVIDENCE_MISMATCH 的狀態，發現分類仍降回通用原因。先在 production scheduled durable holds 的既有 D1／通知測試補同一狀態，觀察 RED，再保留 sync-content 操作的「內容待同步／驗證」分類；文案要求先前景比對、確認差異後更新，不能由錯誤碼直接斷言身分有誤或盲目編輯。新版完整 pnpm test／check／build:all／release:dry-run 再次通過。原 attention-reasons-evidence.json 為前一候選歷史證據；本次精確候選及新驗證見 attention-cutover-evidence.json。

獨立私人 runtime、完整 19084 檔 pin、真實唯讀來源／D1 預檢、新驗收收據與成對更新腳本均已備妥。正式 Python 3.11 執行接收端 8／8 測試通過。預檢通知只寫私人檔，三篇正確為內容同步原因；本篇仍於 2026-10-22T07:00:00+08:00 armed。正式 producer／consumer 尚未切換，沒有 live message 或 Substack mutation。

準備好的單次更新腳本會核對封存檔案、pin、既有服務與 Hermes selector，取得既有 round lock、防止中斷 writer，先更新向後相容 consumer 再切 producer。備份僅留在既有受保護 control 目錄；不清空／改寫原 events ledger，不重播 unknown。服務復原失敗會另外保存紀錄。腳本限定使用最近一小時預檢；到期需刷新預檢後重新封存。

Task 7.4 保留未完成，直到管理員驗證後實際切換並讀回安裝雜湊、正常通知收據及相同待辦的安靜結果；prepared 不等於 deployed。5.3 維持等待真正 provider 發布的驗收。

## 實際切換與讀回完成

使用者完成管理員驗證後，首次嘗試因既有輪次執行中而停止；確認該輪次結束、lock 自行釋放且兩端仍為舊版，再由使用者執行同一封存腳本。實際 cutover 成功，未強制中斷 writer、未清理或重設 ledger。

已讀回正式 consumer SHA256 b9e09441a9ed92d2c86e936ac3ea072747f02c7023479a25c3df276745fc4fb2、agent SHA256 55db9adf70b3e0824fe1c3969d5b7eae9e6e4597f5e02f1c45ffba3977dfc4b1，皆符合部署包；19084 個 runtime 檔案 pin 全相符。既有唯一 900 秒 observer 已切換，provider write gate 仍關閉。正式 Hermes UID／Python 3.11 的 fixture-only probe 通過。

第一輪 round-Qe6FdX 讀回三篇 SUBSTACK_CONTENT_SYNC_REQUIRED，正式接收端 eventId=4、status=sent、messageId=80。再次執行相同唯讀 observer 得 round-s5NFES，相同三篇原因保持一致；正式接收端回覆 quiet、eventId=4，沒有新增重複寄送。既有 ledger 切換前 events=3、unknown=0；沒有 reset 或 replay。傳輸確認不代表使用者實收／已讀，humanReceived 仍為 false。

兩輪來源快照均清理，D1 audit locks／checkpoints／intents 全空。本篇仍 armed 於 2026／10／22 07：00 台北時間；其他兩篇仍未 armed，未編輯或重發文章。正式安裝訊息已核對使用「內容待同步／驗證」，不再聲稱文章身分錯誤或暫停重試。三篇真實內容差異仍待前景處理，沒有因部署通知修正而清除。

本段與 attention-cutover-verification.json 為 prepared／blocked 紀錄的後續實際部署證據，保留先前歷史。Task 7.4 完成；5.3 仍等待 10／22 真正 provider 發布與之後普通自動驗證。此次為啟用啟動輪次與人工重複驗證，不冒稱已完成該未來驗收。未 commit、push 或部署 Pages／Worker，原有未提交內容保留。
