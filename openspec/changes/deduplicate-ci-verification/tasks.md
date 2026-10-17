## 1. 驗證聯集與單一執行

- [x] 1.1 針對 One complete read-only PR validation 與 Preserve test coverage while eliminating repeated execution，以既有 foundation／deployment rehearsal 測試呈現 PR 雙跑與 release queue 重列的 RED，保存失敗原因。
- [x] 1.2 將 PR 驗證整併為唯讀 validate 聯集，保留 main／manual editorial 與全部必要 gate；移除一份重列 test，取得同一測試 GREEN。
- [x] 1.3 完成既有完整本機 test、check、build:all、release dry-run 與 editorial rehearsal；保存 logs、strict spec validation、diff 與原 checkout 保留證據。

## 2. R00／R01 現候選承接（2026-10-17）

- [x] 2.1 對帳 A00：固定當前 remote／primary／candidate、逐檔 block 與舊證據適用性，保存原 dirty，僅承接明確來源到 b10d352。
- [x] 2.2 依 A01 擴充既有契約與本機 shell 負向驗證，保留原 RED、當前 GREEN 與失敗傳遞／history 前提的敏感度證據。
- [x] 2.3 完成受 PR33 影響的完整既有 local gate 聯集一次，保存白名單 diff、追溯、清理及未驗界線，供人工審查。
