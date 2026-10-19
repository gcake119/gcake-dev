# 取消對帳及最後保存失敗恢復（2026／10／19）

本輪只延伸既有 task 6.5：確認取消成功後，重複唯讀對帳仍保留取消結果；取消完成保存失敗或回覆遺失後，必須在原 ID 上恢復，不重播 provider 移除。既有 Cancellation succeeds、Unknown outcomes are reconciled without replay、Explicit resolution 情境及 Implementation Contract 是驗收依據，沒有更改標準。

## 根因與修正

原移除流程在草稿讀回後，先保存 draft_prepared 並清除 remove intent，下一筆才保存 cancelled_draft；兩筆之間的失敗會失去可恢復的操作意圖。一般 reconcile 又只靠仍存在的 remove intent 判斷取消，已成功取消的紀錄反而被降回普通草稿。

- 取消流程在讀回同 ID 草稿及 Scheduled 不含該 ID 後，使用同一筆狀態保存同時記錄 cancelled_draft、not_armed、通道關閉並清除意圖。成功前保留 remove intent。
- 最後保存未成功時，意圖保留供後續唯讀對帳；若資料已保存但回覆遺失，後續讀回已取消紀錄也能保持取消結果。
- 對帳以持久的取消 disposition 加實際草稿／清單讀回恢復取消，不依賴 remove intent 是否仍在；舊版本中斷而留下 draft_prepared／desired cancelled 的紀錄也能恢復。
- 仍在 Scheduled 者繼續要求取消；草稿讀回缺少清單證據時保留阻擋，不將「想取消」誤報為「已取消」。
- 已確認取消與舊 observedTime／armedRevision 分別保存，重複對帳後到舊時段不再查公開頁。取消對帳不清除另有的內容漂移待辦，也不覆蓋後來明確授權的新 arm 意圖。

## TDD 與驗收對照

擴充既有 distribution-advance.test.ts，沒有新測試層、依賴或 CI 工作：

| 測試名稱片段 | 可觀察結果 |
| --- | --- |
| repeated read-only reconciliation | 兩次對帳及超過舊時段的背景觀察仍為 cancelled_draft；不查公開頁、不寫 provider，保留 ID／歷史版本。 |
| final save not-saved | 注入取消最後保存失敗，持久資料仍有 remove intent；以新 coordinator／repository 恢復，只讀原 ID，不重播移除。 |
| final save saved-reply-lost | 保存成功後注入回覆遺失；重啟後重複對帳仍為已取消，沒有重複 provider 寫入。 |
| an older interrupted draft record | 舊中斷紀錄經實際草稿／清單確認後，恢復取消狀態及解除該取消錯誤。 |
| desired cancellation does not hide still-scheduled | 仍排程的文章保留最後確認時間與 cancel-schedule 待辦，不能宣稱取消成功。 |
| desired cancellation does not hide incomplete-draft-readback | 不完整清單證據會被拒絕，不記為已取消。 |
| resolves only cancellation | 取消證據可解決，但較新來源內容差異仍保留 sync-content，沒有冒稱已同步新版。 |
| later explicitly authorized rearm | 取消後新的明確 arm 回覆遺失可正常唯讀對帳為 scheduled，不被先前取消 disposition 蓋掉。 |

先執行前 6 案，得到 6 個真正的行為 RED；其後通過。另保留內容待辦不可被取消對帳清除的 RED。完整 coordinator 套件 60 案通過；複查原先的兩支獨立重現腳本也確認取消結果保持、公開讀取為 0。詳細本機檢查及目前限制見 cancellation-recovery-gates.json，來源與設定摘要見 cancellation-recovery-candidate-sha256.json。

## 授權與保留界線

這些是本機 SQLite／provider mock 證據，不能取代 task 3.1 真實排程保存讀回或 task 5.3 正式試行。沒有正式 D1 migration、runtime／pin／LaunchAgent 切換、真實排程、通知、commit、push 或部署。原有其他未提交變更保留；舊 audit-fixes 證據屬前輪候選，沒有改稱本輪完整測試證據。Git 外原始 log 位於 /private/tmp/gcake-cancel-recovery-20261019/，可能由系統清理。

## 前輪驗證與阻擋紀錄（歷史）

- 通過：完整 coordinator 套件 60 案（包含本輪 8 案）、pnpm check（0 errors／warnings／hints）、pnpm build:all、pnpm release:dry-run、Spectra validate／analyze、git diff --check。
- 原複查的兩支獨立重現程式現在均維持 cancelled_draft；超過舊時間後公開頁讀取為 0。最後保存失敗時保留 remove intent，恢復後不重播 provider mutation。
- 普通 sandbox 的完整 distribution 套件：204 案中 189 通過、15 因 listen EPERM 127.0.0.1 失敗；15 項均是現有 loopback fixture 的環境權限限制，沒有削弱斷言或略過案例。
- 本輪完整 pnpm test 尚未執行：數次自動核准審查因 Selected model is at capacity 未能完成，動作未執行。這是核准服務失敗，不是動作被判定不安全。發布演練後來已獲核准並通過，完整測試的核准仍未恢復。
- Task 6.5 的取消實作與驗收完成；task 6.6 因本輪完整 aggregate 待驗重新保留未完成。Task 3.1、5.3 不變。沒有把前輪完整測試紀錄改稱本輪完整測試成功。


## 前次完整測試重試（歷史）

依使用者要求，本次只重試完整 `pnpm test`，沒有重跑版本一致且已通過的其他檢查。開始時重新核對 `cancellation-recovery-candidate-sha256.json` 的全部來源／依賴／設定摘要，以及每個通過檢查的 log SHA-256，全部相同，因此沿用先前的型別檢查、完整建置、發布演練及規格檢查。

兩次執行請求仍被自動核准服務以 `Selected model is at capacity` 拒絕啟動。命令沒有執行，沒有完整測試結果；task 6.6 保留未完成，3.1、5.3 不變。這是核准審查無法完成，並非動作被判定不安全，也不能記為測試通過。此次沒有重跑普通 sandbox 已證明受 EPERM 限制的完整套件，沒有繞過審查或削弱測試。

兩次請求紀錄位於 Git 外 `/private/tmp/gcake-full-test-retry-20261019/attempt-1.json` 與 `attempt-2.json`，摘要記入 `cancellation-recovery-gates.json`。本次只更新驗證說明與紀錄，其他未提交檔案保留原樣；沒有提交、推送、部署、排程、通知或 provider 操作。


## 最新完整測試通過

完整 `pnpm test` 已獲核准並實際執行完成，exit code 為 0；包含本輪取消恢復、先前 6 項修正及既有所有 aggregate 測試群，distribution 套件 204 案全部通過。Task 6.6 已完成，目前 19／21 項完成，只保留 3.1、5.3 待驗。

來源、依賴、設定及工具鏈與 `cancellation-recovery-candidate-sha256.json` 相同；先前通過的 pnpm check、build:all、release:dry-run 已核對原始 log SHA-256 後沿用，不重跑未變動的檢查。任務及驗證文件更新後另核對 Spectra validate／analyze。這次成功不會改寫先前核准服務容量失敗或普通 sandbox EPERM 的歷史紀錄。

本次完整 log：`/private/tmp/gcake-full-test-retry-20261019-next/pnpm-test.log`。實際執行結果、log SHA-256、沿用證據及任務進度記於 `cancellation-recovery-gates.json`。所有程式、測試、設定及其餘原有未提交檔案保持原樣；沒有提交、推送、部署、建立排程或寄送通知。
