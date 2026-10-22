## Why
Substack 實際晚 62.155 秒發布被誤判身分不符，其他草稿失敗也會遮蔽 Hermes 通知。現有消費者 PermissionError 缺少階段診斷，且尚無公開同步成功通知。

## What Changes
- 將原定、實際發布時間與時間差分開保存及顯示，重新唯讀驗證舊誤判。
- 通知按文章隔離不完整結果，增加已驗證同步成功事件與持久去重。
- 定位權限失敗階段，提供保留既有帳本的精準修復及正式驗收。

## Capabilities
### New Capabilities
- `substack-publication-notifications`: 獨立發布時間、成功通知、部分失敗隔離與權限診斷。
### Modified Capabilities
- `publishing-operations`: 公開驗證分開呈現原定與實際時間。
- `quiet-background-distribution`: 不完整觀察只保留受影響及尚未觀察文章的待辦。

## Impact
既有排程觀察器、D1 JSON 狀態、後台唯讀 API／畫面、Hermes feed／消費者。無新依賴、計時器或 D1 migration。

## Shared-flow update approved on October 22
Substack success notifications SHALL use the original-site Hermes private-message monitoring flow and sender. Add independently verified public Substack evidence to its existing authenticated read-only API, preserve its existing cron identity and schedule, and reuse the existing private notification database. Preserve the legacy local-feed ledger and authenticate any historical pretransport reconciliation. The legacy feed remains for existing foreground attention; successful publications move to the shared monitor. No dedicated group, credential copy, new timer, gateway restart or provider write is included.

## Three-line message update approved on October 22
The owner requests only the existing verification heading, article title and public URL in each future Substack success message. Preserve detailed timing and verification records outside Telegram; preserve all acknowledgement and duplicate suppression history.
