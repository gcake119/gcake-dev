# 選擇性提交範圍（2026／10／19）

使用者授權只提交 `schedule-substack-drafts-ahead` 相關變更，保留其他未提交內容。Task 3.1 的實際排程保存後列表讀回及 task 5.3 的正式試行仍未完成；不封存、不推送、不部署、不建立排程、不寄送通知。

## 範圍拆分

- 提交本變更的規格、設計、任務、程式、migration、測試、真實 UI fixtures 及驗收證據。task tracking 沒有列出的共享入口及 UI 修正，以候選清單、Git 差異與驗收證據補足範圍核對。
- `AGENTS.md` 僅提交新增的「提前備稿與 Substack 排程政策」段落。實作前已存在的「Substack 同步發文規則」及其本機文字調整留在工作目錄，不納入本次提交。
- `docs/distribution-scripted-runbook.md` 僅提交新政策說明、歷史安裝標示與真實 UI 契約；實作前已存在的「Substack 與原站 slug 一致」段落留在工作目錄。
- `openspec/specs/publishing-operations/spec.md` 的既有 slug 規則變更整份不暫存。新政策規格保留於本變更的 delta specs，沒有提前合併主規格。

## 驗證證據的適用範圍

`candidate-sha256.json` 記錄完整已測工作目錄，包含上述刻意保留未提交的文件內容；它不是此選擇性提交的完整 Git tree 清單。提交的程式、測試、依賴與設定均與已通過本機 gates 的摘要相同，未重跑未變動的完整測試。兩份部分暫存文件的 Git blob 與候選摘要不同，屬提交範圍拆分，不能宣稱為同一份文件快照。Git commit tree 為實際提交檔案的依據。

提交前核對來源備份、候選摘要、gate 紀錄摘要與暫存差異；提交後再次確認全部原有工作目錄檔案逐位元未變，以及上述未提交內容仍保留。本次沒有新的 provider、CI、寄送或部署驗收證據。
