<!-- SPECTRA:START v1.0.2 -->

# Spectra Instructions

This project uses Spectra for Spec-Driven Development(SDD). Specs live in `openspec/specs/`, change proposals in `openspec/changes/`.

## Use `$spectra-*` skills when:

- A discussion needs structure before coding → `$spectra-discuss`
- User wants to plan, propose, or design a change → `$spectra-propose`
- Tasks are ready to implement → `$spectra-apply`
- There's an in-progress change to continue → `$spectra-ingest`
- User asks about specs or how something works → `$spectra-ask`
- Implementation is done → `$spectra-archive`
- Commit only files related to a specific change → `$spectra-commit`

## Workflow

discuss? → propose → apply ⇄ ingest → archive

- `discuss` is optional — skip if requirements are clear
- Requirements change mid-work? `ingest` → resume `apply`

## Parked Changes

Changes can be parked（暫存）— temporarily moved out of `openspec/changes/`. Parked changes won't appear in `spectra list` but can be found with `spectra list --parked`. To restore: `spectra unpark <name>`. The `$spectra-apply` and `$spectra-ingest` skills handle parked changes automatically.

<!-- SPECTRA:END -->

### 提前備稿與 Substack 排程政策

- 新政策為 `scheduled-source-first-delivery-v1`：來源是已儲存、符合資格並釘選 main 版本的完整 Git Markdown；slug 與此來源完全一致。舊政策 `pages-first-no-newsletter` 仍須先驗證 Pages，舊核准文件不能授權新政策寄送。
- 新政策只能在前景依已確認的原站固定時段，安排同一文章 ID 的首次發布與電子郵件／App inbox 通知。佇列預估時間不構成排程授權；Substack 可在 Pages 失敗時獨立公開與首次寄送。
- 原稿修改須實際讀取、比對、編輯及重新讀回同一篇文章；已排程稿先確認解除舊排程，再更新及重排。延期沿用同 ID；取消只解除排程並保留草稿。文章已公開後，只修正文，不改日期、不重新發布或補寄。
- Git 是內容來源，D1 只保存身分、版本、排程、操作意圖及驗證證據。原稿刪除、退回草稿、改名、時段變動與結果未知，均保留最後確認的 provider 狀態，交前景處理；本機暫停不代表 Substack 已取消。
- 正式 runtime、D1 migration、排程寫入開關及訂閱者寄送的啟用另需明確授權。本機驗證不能取代實際 provider 介面驗收或寄送證據。
