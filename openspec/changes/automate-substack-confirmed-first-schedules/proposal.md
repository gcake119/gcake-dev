## Why

既有同步工作只觀察排程，兩篇已公開文章缺少原 ID 對帳；後續原站已確認時段也不會自動轉成 Substack 的首次排程。使用者於 2026-10-29 授權完成原身分對帳，以及依原站已確認時段自動首次排程、公開並提交電子郵件與 App 通知。

## What Changes

- 接納兩篇已公開文章的原 ID，完整匿名驗證，不重發、不改日期、不補寄，保留既有寄送歷史。
- 新增另行驗收與啟用的自動首次排程 worker，沿用同一輪次與共享鎖；只處理完整、已保存並釘選 main 的合格來源及真正已確認的未來原站時段。
- 透過現有 Computer Use 介面讀取、準備同一草稿並首次排程，保存／離開／重載確認原 ID、slug、內容、台北時段、所有人與電子郵件／App。
- 發布交由 Substack 的已保存排程完成，原匿名 observer 保持無登入、零寫入；未知結果不重播，已公開與已排程文章不重排或補寄。
- 完成正常、失敗、邊界 TDD、本機完整 gate、真實平台與自然輪次驗收，再啟用同一正式工作。

## Capabilities

### New Capabilities

- `automatic-substack-first-schedules`: 已確認來源／時段的首次排程、獨立 worker 啟用與一次性副作用。

### Modified Capabilities

- `quiet-background-distribution`: 允許明確獨立啟用的首次排程 worker 共用輪次；原匿名 observer 與其他人工邊界保留。

## Impact

- scripts/publishing/sync-distribution.ts 與現有排程 coordinator、Computer Use executor、固定來源與啟用驗證。
- 新增 scripts/publishing/substack-auto-schedule.ts 與針對行為的本機測試；不新增 timer、CI workflow、provider SDK 或私人 API。
- docs/distribution-scripted-runbook.md 與 docs/decisions/index.md 記錄本次明確授權、驗收層次及停用／還原。
- 正式私人安裝採受測候選、獨立 runtime pin 與原 credentials；原工作目錄未提交內容不納入。
