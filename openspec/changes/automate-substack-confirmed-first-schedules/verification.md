# 2026／10／29 本機候選與原 ID 對帳

## 結果與範圍

兩篇原 ID 同站正文修正及正式 D1 對帳已完成。自動首次排程已實作並通過完整本機 gate；依使用者「先完成實作，待下一篇確認時段再做正式驗收與啟用」，3.2 保留未完成。本機驗證完成後，使用者另行授權獨立提交、推送、建立 PR，確認 CI 與審查通過後合併；正式驗收與啟用仍保留未完成。本次不部署或啟用新 runtime。

候選根目錄：`/Users/caiyijun/.codex/worktrees/substack-auto-first-schedule/gcake-dev`，基底 main `b30190e591c1fa30c579b8b9a6803a06c715eca4`。Spectra CLI 本輪將 change 解析至原專案，只有本 change 新文件在原工作目錄；程式與 runbook 變更在隔離 worktree。

## 原 ID 與正式操作

| slug | 原 ID | 保留原 UTC 發布時間 |
| --- | --- | --- |
| ai-agent-development-workflow | 221750546 | 2026-10-23T08:19:32.755Z |
| ai-ui-five-stage-workflow | 221751141 | 2026-10-23T08:23:18.821Z |

使用者核准表格改為條列並保留全部欄名／內容。已讀取同 ID 編輯器、儲存核准正文、逐項讀回後，各按一次網站「立即更新」；沒有重發、補寄或變更日期。完整匿名讀回核對原 ID、canonical、日期、全部文字／欄名／儲存格／程式碼／連結及原圖 PNG 位元組。第二篇首次匿名回應是舊快取；保存原回應後，單次無快取匿名讀取確認新欄名及全文，沒有再次提交。

D1 原 version 16 → 17 保存原 ID 與本次 update-public intent，匿名驗證後條件 version 17 → 18，verification=presentation_only，approvedPresentation 綁定原 ID／來源 revision／原 PNG 雜湊。原 delivery=not_armed 與全部寄送歷史、原日期保留；沒有由公開狀態推論寄送。僅結清本次意圖並釋放本次 owner 鎖，讀回無殘留 target lock／checkpoint。

此核准呈現辨識支援目前只在候選；正式舊 observer 尚未採用，之後仍可能顯示格式差異。該提示不代表正文未更新，也不授權補寄；待正式候選採用另行驗收。

## Gherkin 與測試映射

| 驗收風險 | 證據與既有測試層 |
| --- | --- |
| confirmed future article 首次 arm 一次、restart 不重播 | distribution-auto-schedule.test.ts，SQLite acceptance |
| 過去／無確認／暫停／超過三月／protected states | 同一 worker acceptance 的 eligibility 與狀態情境 |
| source／slot race、missing tracked original rename | 同檔 acceptance，boundary-red.log → final-focused-green.log |
| 原 ID／slug／channel／generation／before gate／完整讀回 | distribution-auto-executor.test.ts，沿用既有 executor integration |
| 未知結果保留 session、不重播、非首次操作拒絕 | executor 與 worker acceptance，既有 cleanup 測試 |
| disabled／unqualified／舊 draft-only 收據拒絕 | activation integration；零 provider access 斷言 |
| 單輪串接、observer 不獲寫入權、uncertain cleanup | distribution-sync.test.ts，integration-red.log → integration-green.log |
| 核准條列及圖檔原始位元組、實際內容漂移 | distribution-native-presentation.test.ts，presentation-red.log → all-focused-final.log |
| 兩篇真實同 ID 公開修正／日期／無補寄 | 本輪 before／intent／saved UI／anonymous／D1 收據，並非 local fixture |

Focused acceptance 共 73／73 通過。完整本機驗證通過 pnpm test、pnpm check、pnpm build:all、pnpm release:dry-run、pnpm editorial:rehearse；型別檢查 0 errors／0 warnings／0 hints。完整 gate 第一次遭沙箱禁止綁定 127.0.0.1 測試連接埠，保留 sandbox-failure-test.log 後在允許既有測試能力的環境重跑全部，未更動條件。舊測試／首次 RED 保留，不改稱已成功。

Spectra validate／analyze 與 git diff --check 分開保存；不使用已移除 --strict。沒有新增 workflow、框架或依賴。所有測試只用本機資料，正式寫入只限已授權兩篇身分及正文對帳。

## 保存與後續

證據在 `/Users/caiyijun/project/gcake-dev/output/discovery/substack-auto-schedule-20261029/`：local-gates.json、all-focused-final.log、settlement-*.json／sql、兩篇 public-after-observation-verification.json、production-disabled.json、dirty-preservation.json 及 candidate-provenance.json。

原工作目錄既有 1,038 個未提交檔案全部雜湊未變。正式 autoSchedule 缺省關閉、scheduled.writeEnabled=false，原 900 秒 timer 及正式 runtime 未替換。保留隔離 worktree 供後續真實驗收；沿用的使用者 Chrome 分頁保留，沒有新增分頁或臨時 Docker 環境。

下一篇確認原站 future slot 後，依 runbook 完成 same-ID prepare／arm／remove／rearm、完整重載與 email／App 選項、unattended executor 真實 trial，再釘選採用及啟用。到期平台公開與匿名自然輪次另存證據，不要求真人實收。停用只關閉新 arming；既有 provider schedule 不會因此取消。還原保留原 runtime／pin／plist／delivery 歷史，不清除未知 intent。

## PR 交付

本 change 與候選程式在隔離 worktree 一併提交。完整本機 gate 的 13 個來源檔雜湊與候選完全一致，基底仍是最新 main b30190e；只新增本節與可攜式精簡證據，沒有為提交重跑未變更的通過檢查。local-verification.json 保存原驗證時間、命令、秒數及候選來源雜湊；reconciliation-receipt.json 保存兩篇同 ID／原日期／欄名與全文／原圖核對及條件 D1 對帳摘要。原始私有操作記錄留在原 output，不上傳全頁、帳號工作階段或設定檔。
