# c1b97b4 審查修正（2026／10／19）

本輪依使用者明確授權，修正審查發現的 6 項缺漏；沿用現有規格與 Gherkin，不更改驗收標準。修正只存在本機未提交工作目錄，不含正式 provider 操作。Task 3.1 的已保存排程列表讀回及 task 5.3 的正式試行仍待驗。

## 需求、驗收與修正對照

既有驗收套件中的 `audit regression:` 案例直接檢查實際 coordinator、SQLite／D1、來源快照與 handoff 行為，不檢查來源字串。沒有新增測試層、依賴、CI workflow 或背景 timer。

| 修正項目／既定需求 | 驗收案例名稱片段與可觀察結果 |
| --- | --- |
| 過期前景交接／Confirmed time and first-delivery commitment | `a waiting arm handoff rejects`：已改期、取消、版本不同或到期的佇列承諾被拒絕。`the foreground proof command freshly reads`：真實 inspect／proof／reply 命令透過本機依賴讀取目前 queue，拒絕等待期間變動的時段，不產生 reply 或 provider arm。 |
| 系列資格／Finalized immutable source；Scheduled-source observation | `paused series`、`publication-paused series`、`external series`：備稿被阻擋；既有 armed ID 提出 cancel-schedule，保留最後確認時間與仍待解除標示，沒有匿名公開讀取或 provider 寫入。 |
| 接手原 ID／Persistent identity；Separate publication and delivery evidence | `adopt an existing schedule`：保存讀回的時間、通道；同時段 arm 的冪等成功也保存完整來源／佇列承諾，到期可匿名驗證；全程沒有新增 provider mutation。 |
| 同內容改期／Disarm before replacement；Postponement preserves identity | `a same-content revision to a new time`：依序 remove → 草稿 readback → arm；`failed removal blocks`：解除失敗保留 remove intent，禁止替代 arm。 |
| 已取消稿／Cancellation succeeds；Durable manual hold | `confirmed cancellation remains quiet`：取消後到舊時段，含原稿消失時，都不查公開頁、不產生假警報；`a lost cancellation acknowledgement`：原 ID 唯讀對帳成功後回到取消狀態，無第二次 remove。 |
| 正文完整性／Source-authoritative content comparison and editing | `meaningful inline spaces are repaired`：有意義的文字空白差異會觸發同 ID 修改並完整讀回；既有相同內容零寫入、清單包裝與程式碼空白測試繼續有效。 |

對應程式修正：

- Arm request 的 digest 現在綁定完整 slot。所有前景 inspect／proof／reply 都重新讀佇列，重用相同時間／版本驗證；缺少 slot 的舊交接不會被默認接受。新原生 transport 仍未合格，沒有回退路徑。
- 暫停及外部系列的判斷移入既有共用 release eligibility，原站佇列與提前備稿共用，移除原站重複判斷。Git adapter 仍將 manifest 的兩種 paused 與 external 形式轉成相同政策欄位。
- 已保存排程的實際觀察與明確核准的 arm 承諾分開保存；冪等 arm 與新 arm 使用同一完整持久化路徑，不能僅回報成功而漏掉觀察時間、來源或通道。
- 所有需要改變既有排程時間的 revise 操作，都經確認解除及草稿讀回；未知移除不繼續重排。
- 取消的 desired disposition 在移除前持久化，解除確認後 delivery 回到 not_armed，保留 armedRevision 與歷史時間。未知移除對帳也保留取消結果；歷史時間不再觸發取消稿的公開驗證。
- 普通文字只折疊連續空白、移除區塊外緣及區塊之間的無意義格式空白；行內元素前後的空白保留。已觀察的單層清單 paragraph／巢狀 code 包裝與單一 fence 結尾換行規則保持有效。

## 前景操作與競態界線

未來另行授權真實排程時，必須在最後 UI 確認動作前重新執行 `proof-schedule`，核對目前 queue 與 UI 預覽，不沿用等待前的檢查。`reply-schedule` 仍再讀目前 queue；若 provider 已操作但後續來源／佇列變動，結果維持未知 intent，不能宣稱已取消或自動重播。這些檢查無法提供跨原站與 Substack 的原子交易，也不把預覽視為已保存排程證據。

## 本機驗證與證據

詳細結果及 log SHA-256 見 `audit-fixes-gates.json`；完整工作目錄來源／依賴摘要見 `audit-fixes-candidate-sha256.json`。前階段的 `candidate-sha256.json`、`gate-results.json` 與 `ui-gate-results.json` 保留為歷史，不改稱本輪候選證據。

第一批 acceptance RED 是 8 個行為失敗，覆蓋全部 6 項問題（系列旗標分成 3 案）；另保留遺失取消回覆、取消後來源消失的 RED。實際 handoff 命令案例作為整合驗證，最初未注入本機依賴的錯誤不當作行為 RED。原始紀錄在 Git 外 `/private/tmp/gcake-substack-audit-fixes-20261019/`，可能由系統清理；可重跑案例保留於既有測試檔。

執行使用專案指定 Corepack pnpm 10.17.1，子命令透過同版本 wrapper 執行，未修改 packageManager。完整測試與 release:dry-run 在 sandbox 曾因既有 Unix／loopback socket 的 EPERM 失敗；以獲准的本機執行權限完成，不削弱測試。release:dry-run 使用臨時 Git、SQLite、Astro 與 mock Telegram，productionWrites=false、telegramNetworkCalls=0。沒有 Docker 資源。

保留原有 `AGENTS.md`、`docs/distribution-scripted-runbook.md` 及 `openspec/specs/publishing-operations/spec.md` 的未提交內容，與本輪開始摘要逐位元相同。沒有 commit、push、archive、部署、正式 D1 migration、runtime／pin／LaunchAgent 切換、真實排程或通知。程式修正不能取代 task 3.1、5.3 的實際 provider 證據。
