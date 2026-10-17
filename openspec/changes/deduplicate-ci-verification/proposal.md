## Why

PR 同時執行兩份相同測試、檢查與網站建置，套件彙總又重複執行 release queue 測試。以既有檢查聯集去重，保留必要發布演練與 required validate。

## What Changes

- main PR 由單一唯讀驗證入口執行完整測試、型別檢查、所有 workspace 建置、release dry-run 與 editorial rehearsal。
- editorial 保留 main push 與手動驗證，移除 PR 與固定 feature push 的重複觸發。
- test 彙總保留 release queue 測試一次，維持其他測試聯集。

## Capabilities

### New Capabilities

- `ci-verification-deduplication`: PR 驗證聯集與事件去重契約。

### Modified Capabilities

無。

## Impact

- Modified: `.github/workflows/validate-pr.yml`, `.github/workflows/validate-editorial.yml`, `package.json`, `scripts/workspace/foundation.test.ts`, `scripts/publishing/deployment-rehearsal.test.ts`。
- 不修改部署、權限、required checks、runner、產品斷言與發布行為。
