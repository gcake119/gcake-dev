# 兩項通知誤報修正：已部署與切換

## 行為與失敗驗收

佇列版本是原站資料版本，不代表 Substack 的實際發布時刻改變。背景觀察改用已確認的同篇 slug 與實際時刻比較，忽略 queueVersion 162→165 及 UTC／台北字串差異；真正改期、來源失去資格、時段消失仍要求前景處理。只有新證據證明是同篇同時刻、且沒有未結意圖或獨立錯誤，才清除舊的延期誤報。保留原 slot/version、remote ID、觀察時間與首次寄送承諾。

前景排程寫入的 validateScheduleCommitment／handoff 完整版本檢查沒有放寬。先補測試，觀察到版本相同時刻及舊 hold 的兩項 coordinator RED，observer→SQLite→attention 整合 RED；其他真實改期、取消、未知意圖控制先前已通過。修正後兩套相關測試 95／95 通過。

本次一併部署前次已驗證的內容通知規則：原稿未變時，摘要呈現與已知平台格式差異不推播；讀取失敗是驗證未完成，不當成內容修改，也不改文章。真實正文／標題／連結／圖片差異及原稿內容變更仍保留通知；前景完整內容驗證不變。

## 本機與精確部署基底

原工作目錄 pnpm test、pnpm check、pnpm build:all、pnpm release:dry-run 通過。部署基底與工作目錄有另外的 CI／測試腳本差異，因此另從遠端 main ed7de732b11767894e12ae9178d33a0c0dfde5ba 建立 owned 隔離驗證目錄，只覆蓋 11 個通知相關檔案，沒有帶入其他 CI 變更。

隔離驗證首次缺少 workspace 套件連結，@gcake/admin-contract 匯入失敗；原失敗與日誌保留。補齊相同版本、且全部解析於隔離目錄內的連結後，完整四項 gate 再次通過，沒有改來源或弱化斷言。Spectra validate／analyze 及 diff check 通過；沒有使用已移除的 --strict。

## 實際切換與讀回

建立獨立 installed-attention-false-positives-20261019 runtime，19084 個 pinned 檔案全部相符。正式 Git／D1／匿名公開頁面私人預檢通過，六篇皆正常、零待辦，原 provider 承諾完全一致。只寫私人通知快照，沒有 live send。

Hermes consumer SHA256 b9e09441a9ed92d2c86e936ac3ea072747f02c7023479a25c3df276745fc4fb2 與候選相同，故沿用既有 root-owned consumer、daemon、Hermes active/gate 與去重 ledger，沒有安裝、停止或重啟接收端，也沒有開啟／複製／重設 ledger。

在舊輪次閒置時取得既有 round lock，保存舊 agent，僅將原 gui/501/dev.gcake.distribution-sync 的路徑切換至新 runtime；仍為單一 900 秒 timer，provider write gate 關閉。新 agent SHA256 8c9444c43615fd0967e654d183821dea72b23d7071bcd1d5684c782bcda7168d。

啟動驗證 round-2GAy9q 與再執行同一正式唯讀程式的 round-cHgF1K 均 completed／quiet，六篇皆 observed，來源快照移除，D1 locks／checkpoints／intents 全空。最新正式接收收據 clear、issueCount=0，且時間晚於最新 feed，沒有新增訊息。這是啟動與人工重複驗證，沒有冒稱新的自然 timer occurrence 或未來 5.3 驗收已完成。

10／22 07：00 台北時間的 ID 221098688 仍 scheduled／armed，email／App 設定原樣保留；保存的 queueVersion 仍為首次承諾的 162，目前原站為 165、實際時刻相同。其他兩篇 221099415、221099763 維持 draft_prepared／not_armed。三篇舊文 ID 與所有 provider 承諾未改，沒有本次文章編輯、建立／取消／重排、重發或重寄。

## 保存與剩餘範圍

原工作目錄保留；19 份本次範圍外的原有未提交檔案雜湊未改，沒有 commit 或 push。只清理本次 owned 隔離驗證 clone 與其中的依賴／產物；舊已安裝 runtime 和 previous-agent.plist 保留供必要時依 idle／lock 流程回復，不連帶移除其他工作資料。

本文件與 notification-false-positives-deployment.json 是先前 local-only 證據之後的實際部署結果；保留舊失敗和未部署歷史，不回寫成成功。9.1～9.4 完成；5.3 仍待未來實際 provider 發布、普通後續觀察與寄送證據。
