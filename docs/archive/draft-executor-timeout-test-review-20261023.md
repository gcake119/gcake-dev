# 草稿執行者逾時測試審查（2026-10-23）

基準為 main `451805a68f9557c76b2e148541031e87e6e77fa6`。本次只調整既有測試與本紀錄；不修改產品行為、正式 runtime、相依套件、CI、排程或通知。

## 必要性與審查結論

未提交修改將 Node 子程序換成 `/bin/sh` 合成程序，排除額外 Node 啟動與載入依賴，並加入失敗時的合成執行日誌。但原修改只保留一個會返回的 SIGTERM handler，刪除了 handler 超過強制終止寬限的案例，因此不能原樣提交。

修正版保留兩種情境：handler 記錄訊號後返回，以及記錄後持續卡住。兩者均不自行結束；維持請求期限 1500ms、一秒強制終止寬限、4500ms 外部觀察上限及一秒 OS 回收觀察，要求實際收到 SIGTERM、有界回報 SUBSTACK_EXECUTOR_TIMEOUT，且原 PID 已不存在。finally 仍只終止本測試擁有的程序群組並清除臨時目錄，產品程式完全不變。

此為既有 Node／OS 程序整合測試的 fixture 修整，不新增測試層、工作流程、套件或前置檢查。shell busy loop 會使用 CPU，兩個案例每輪約五秒；重複抽樣僅用於本次審查，不加入 CI。較便宜的替代方案是保留舊測試，但仍依賴另一個 Node 啟動；單純增加期限或刪除延遲案例則無法維持原有驗收範圍。

## 規格與決策

沿用 [Bounded recovery and truthful disablement／Completed owned attempt exits](../../openspec/specs/unattended-substack-drafts/spec.md) 及 [PR41 原始修正與限制](../../openspec/changes/archive/2026-10-20-automate-substack-draft-content-sync/pr41-review-fixes-20261020.md)。不改 requirement、Gherkin、產品期限或正式啟用條件；已封存 change 不重開、不改歷史驗收結論。

本次為測試維護，decision-context Level 0；既有身分保留與正式操作邊界仍適用，無新政策或 ADR／決策索引更新。新建維持停用，不安裝正式版本、不改排程、不重送通知，也不以此證明舊 feed PermissionError 根因已修復。

## 驗證與限制

- 原 main 測試在本機通過一次，未重現歷史偶發失敗；不宣稱此次調整已證實修復該歷史失敗或跨平台穩定性。
- 對同一產品入口做兩次獨立暫時故障注入：漏送 SIGKILL、漏送 SIGTERM，兩者均使兩個案例失敗；測後恢復產品原檔，未提交故障注入。
- 還原後修正版連跑三輪，兩例均通過，共 6／6；這是有界樣本，不是長期穩定保證。此前第一次修正版試跑另有 2／2 通過，不混入上述三輪計數。
- 既有完整本機五項 gate 全部通過：`pnpm test`、`pnpm check`、`pnpm build:all`、`pnpm release:dry-run`、`pnpm editorial:rehearse`。Linux CI 與正式環境證據獨立，不以本機 macOS 通過代替。
- 原始備份、基準、故障注入與還原後紀錄位於 `/private/tmp/gcake-timeout-review-20261023/`，主工作區原修改保持原樣，未吸收其他草稿規格或文章配圖。

## 完整本機 gate 紀錄

| 命令 | 結果 | 秒數 | log SHA256 |
| --- | --- | ---: | --- |
| `pnpm test` | exit 0 | 511.982 | `240c53dced57764af21ed38dd440099fa43bf8b21245ffa66382bf3bd32168e5` |
| `pnpm check` | exit 0 | 8.48 | `edb889ace693204c3fbb6f9b3a08a0810eaf0ed1e36b00a6b4477ccf6f50241f` |
| `pnpm build:all` | exit 0 | 7.561 | `1b39828a36b0dfbecc97ce31e792d29c8809369309b99620762ae0919379c8a9` |
| `pnpm release:dry-run` | exit 0 | 13.158 | `48ecc8618c313464ac2a9f897ec418322beebd4bd7be64bbc66cbb2d43549b7c` |
| `pnpm editorial:rehearse` | exit 0 | 12.684 | `77262ef41e2e61606b7399fd1dd97625d03196b1bd700c92ca67d32ef034c83b` |

既有 SQLite／socket ResourceWarning 與 Node ExperimentalWarning 保留，未宣稱修復。合成演練為零正式寫入、零 Telegram 網路呼叫。
