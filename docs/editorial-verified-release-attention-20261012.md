# 已公開驗證文章的舊日期誤報修正

## 行為與範圍

CMS 原本在已公開文章的 QueueView 上繼續附帶 LEGACY_SCHEDULE_REQUIRES_ADOPTION，導致第１篇雖為 verified-public，仍列入「需處理」並提示採用自動排程。

這次只在既有 presentation 的文章／有效發布紀錄比對處移除該誤報：文章必須是 published、紀錄必須是未解除的 verified-public，而且原因必須正好是舊日期待採用。人工與正常排程發布均適用。既有計數與列表直接使用修正後資料，沒有新增另一套前端狀態判斷。

未驗證、未知結果、失敗、解除身分、重新 ready，以及暫停／錯過固定日期的提醒均保留。候選篩選、取得時段、保留日期、實際發布時間、下一篇估計、Git 寫入、D1 格式與通知流程皆未改動。沒有 migration、record repair、回填、重發或通知重送。

## 真實 TDD 與驗收證據

- 先補規格及 Given／When／Then，才追加 tasks 並寫 acceptance tests。
- RED：實際 SQLite-backed QueueView 對 verified-public 的 reason 仍回傳 LEGACY_SCHEDULE_REQUIRES_ADOPTION，正常案例失敗；未解決日期案例保持通過。
- GREEN：36 個佇列測試通過，包含人工／排程已驗證章節，實際時間及第２篇 10/15 07:00 不變，view 前後完整 Stored（含 version、身分、事件及證據）deepEqual。
- 邊界：awaiting-verification／verification-unknown／failed／unlocked／ready-again 保留舊日期提醒與原 error；已有的 ready 舊日期 adoption 測試仍通過。
- 變異敏感性：暫時取消原因限制，暫停提醒測試立即失敗；恢復原候選程式後全部 36 個測試再次通過。
- 隔離 CMS 使用實際修正後 QueueView、一次性記憶體 SQLite、合成身分及 127.0.0.1 唯讀 fixture，拒絕全部非 GET；桌面及 390px 手機畫面「需處理」0 篇，保留第１篇時間線與第２篇 10/15 估計，无水平溢出。Fixture 寫入次數 0、紀錄數量 1；結束已關閉 server、清除 viewport override、關閉驗收分頁。
- 完整本機 gate：298 Node、31 Python；Astro check 154 files／0 errors／0 warnings／0 hints；build:all；D1/static/mock-RSS-to-Telegram rehearsal；Worker production dry-run；兩個 active Spectra validate 均通過。
- 整合演練：sixBodiesUnchanged=true、readingOrderUnchanged=true、repeatNotifications=0、productionWrites=false、telegramNetworkCalls=0。
- Spectra analyzer 既有 10 Warning／3 Suggestion、0 Critical；這次針對可觀察的誤報行為補齊規格，不把歷史文字分析警告宣稱為新執行錯誤。

## 決策與正式環境界線

沿用 integrate-editorial-release 的 Effective Implementation Contract：D1 唯一 runtime、Git 正文與 manifest 權威、同一身分完成公開验证、前後篇順序不變。DESIGN.md 沒有變更；本 repo 沒有 docs/decisions ledger，本次不引入新架構或策略決策、不需新 ADR／archive。

前一次已核准的 PR 17／18 合併及正式驗收證據：第１篇 release ID 3219666a-9730-4b8e-8561-362d50447620；發布 commit eb6b988ad3f030fab2555a789897b7e81e5a0ad6；Pages run 38201797158；PR 18 Worker run 38202421587；自動流程 run 38202603915 success；D1 verified-public，原 attempt 1；Hermes sent 1，第二次不重複。這是先前完成的正式驗收，與本次 local fixture 證據分開。

本次由 ac0cc598ecc562e46482a1132aab4ddfbb5adb3b 建立修正分支，只允許 commit／push／PR，不合併、不部署。正式自動發文及 Hermes 通知維持啟用；沒有改變正式設定、讀写正式 D1 或通知紀錄，也未聯絡 Telegram。正式 CMS 在新候選尚未部署前仍會顯示原本誤報，不代表修正已上線。
