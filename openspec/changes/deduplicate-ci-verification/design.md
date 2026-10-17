## Context

已授權依稽核第一階段實作。原候選基準為 6f02e56；2026-10-17 R00 已核對遠端 main b10d3525e2106d63b2e6f0030ccc61d855fdb5b5，五個白名單檔案的基準 bytes 均未變。保留原 worktree 與 dirty patch，切換 detached HEAD 承接 PR33；primary 42424f7 的本機保存／archive 不帶入。沿用 node:test 與 YAML 設定契約測試，不新增 gate 或產品測試層級。

## Goals / Non-Goals

範圍內：兩份 validation workflow 的事件與共用驗證、套件重列清單、現有設定測試。
非目標：修改產品行為、部署、runner、cache、required checks、branch protection、訂閱或遠端 CI；不 commit、push、merge、archive。

## Decisions

PR 的 validate job 取得原兩條 PR workflow 的聯集，加入停用發布／通知旗標、完整歷史 checkout 與 editorial rehearsal；保留 fail-fast，禁止 continue-on-error。Editorial lane 保留 main push 與 workflow_dispatch，刪除 PR 與固定 feature branch push。Package 中 release queue 保留在 editorial，從 public 清單移除重列。

## Implementation Contract

修改後 PR 僅一份 workflow 被選取；required 顯示名稱仍為 validate；tests、check、build:all、dry-run、rehearsal 與 Chrome 準備均只選取一次。權限仍 contents read，沒有 secrets、environment 或部署。既有 main／manual editorial 採原驗證聯集。保留全部非重列測試。

## Verification

先擴充現有 foundation 與 deployment-rehearsal 測試，觀察重複 workflow／重列 test 的真實設定 RED，再改 YAML／package 清單取得 GREEN。完整本機依序執行 pnpm test、pnpm check、pnpm build:all、pnpm release:dry-run、pnpm editorial:rehearse；彙總包含的子項不再單跑。規格以 Spectra 3.0 的 change-scoped validate／analyze 查核；遠端 CI 不執行，費用節省未量測。

## Risks

兩條原 lane 的環境旗標不同，PR 明確採安全的 disabled flags；rehearsal 必須保留。沒有既有 decision index，不替此次有限調整另建 ADR。既有發布與 provider gates 保持分離。

## R00／R01 reconciliation

採 A00／A01 已批准範圍；不擴張實作。舊 3／3 僅屬 6f02e56 候選；舊設定 RED 與相同的去重 patch 可重用，PR33 改變 distribution／Hermes／worker，完整 local gate 重新驗證一次。沿用既有 node:test／Bash fixture，執行實際 workflow run shell 並注入共同、dry-run 與 rehearsal 失敗，驗證非零及停止後續命令；靜態 assertions 驗證觸發、full history 與無條件 fail-fast。這是本機 shell 證據，不冒稱 Actions runner／checkout action 實跑。所需歷史不可用時 checkout action 應失敗的遠端行為保持未驗證。

rehearse-editorial 是 release-dry-run 相容入口；依批准保留兩者，不再次刪除。兩者使用 disposable Git／SQLite、loopback HTTP 與 mock Telegram。fixture 內 Git commit 為演練，不是交付 commit。沒有新測試層、工作流、依賴或強制 gate；新增少量 Bash fixture 子程序的成本用於填補只有 YAML 字串無法證明 exit 傳遞的缺口。
