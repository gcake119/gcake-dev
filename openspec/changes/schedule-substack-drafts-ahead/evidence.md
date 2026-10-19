# 第一階段本機驗收證據（2026／10／19）

後續真實 Substack UI 驗收、專用草稿及尚未提交的排程預覽另見 [ui-qualification.md](ui-qualification.md)。`c1b97b4` 審查後的 6 項修正與本機驗證另見 [audit-fixes.md](audit-fixes.md)。 取消結果的重複對帳與保存失敗恢復補正見 [cancellation-recovery.md](cancellation-recovery.md)。下述沒有 provider 操作的記錄屬本機實作階段，不能套用到後續 UI 階段。

本輪是未提交候選；沒有部署、套用正式 migration、安裝 runtime、更新 pin／私人設定／LaunchAgent、登入 provider 或寄送訂閱通知。正式狀態不由本輪 fixture 推論。

## 驗收索引

- A：`scripts/publishing/distribution-advance.test.ts`，真實 coordinator＋SQLite／D1 seam，provider 為可觀察的本機模擬。
- S：`scripts/publishing/distribution-scheduled.test.ts`，真實固定 Git 快照、來源資格、CLI 審閱及背景 adapter。
- T：`scripts/publishing/distribution-attended.test.ts`，真實檔案交換與 scope／expiry 契約。
- Y：`scripts/publishing/distribution-sync.test.ts`，既有輪次、鎖、清理與提醒整合。
- 每列以測試名稱片段索引；表格是 coverage 對照，不表示每個情境都獨立跑過真實 provider。當前 UI 控制項與實際雙通道排程讀回仍未合格，task 3.1 保留；真實首次寄送及正式輪次為 task 5.3。

## substack-scheduled-publication

| Gherkin 情境 | 本機驗收定位／限制 |
| --- | --- |
| Original is not yet public | S／advance review prepares；A／advance same-ID |
| Source cannot form a complete mirror | S／advance source blocks（draft、mdx、duplicate、incomplete、media） |
| Provider schedule is armed | A／advance same-ID；confirmed queue adapter；foreground handoff |
| Date is estimated or unsupported | A／schedule rejects；calendar month horizon |
| Original deployment fails at the due instant | A／Pages outage and later Pages date |
| Duplicate processing or restart | A／advance same-ID；lost intent survives closing SQLite |
| Wrong or occupied slug | A／slug mismatch blocks；occupied discovery；incomplete discovery |
| Previously published mirror is adopted | A／all three previously public identities；formerly public identity |
| Armed article content changes | A／armed revision and postponement |
| Source changes while no foreground controller is available | A／background drift；S／background observer includes vanished sources |
| Slug changes after preparation | A／source slug rename；incomplete discovery |
| Publication wins the revision race | A／published cancellation；sending content cannot be edited |
| Postponement succeeds | A／armed revision and postponement |
| Cancellation succeeds | A／armed revision and postponement |
| Cancellation races with publication | A／published cancellation；unknown remove |
| Schedule acknowledgement is lost | A／unknown arm；lost arm reconciles；lost arm can be reconciled after provider publication |
| Old schedule removal is not confirmed | A／unknown remove |
| Two operations compete | A／independent writers and stale generations |
| Public correction is observed after the first delivery | A／content sync actually edits drafts and public articles |
| Public content verifies while Pages is unavailable | A／Pages outage and later Pages date |
| Public article is correct but delivery evidence is absent | A／advance same-ID；Pages outage and later Pages date |
| Content or publication minute is wrong | A／foreground verification never replaces；partial saved body |
| An existing unscheduled draft is updated | A／content sync actually edits drafts and public articles |
| An armed draft is updated rather than only marked stale | A／armed revision and postponement |
| A public article is updated after its original changes | A／content sync actually edits drafts and public articles |
| Content already matches | A／content sync actually edits；public provider-only divergence |
| Remote-only edits diverge from the source | A／public provider-only divergence |
| Source changes during synchronization | A／source C arriving during save B；source or remote drift after unscheduling；published cancellation |
| Remote content changes after comparison | A／remote changes between comparison and edit；source or remote drift after unscheduling |
| Saved content cannot be verified | A／partial saved body；unknown update；semantic content comparison；image readback |

## publishing-operations

| Gherkin 情境 | 本機驗收定位／限制 |
| --- | --- |
| Save article only | S／advance review prepares；Y／scheduled observation reuses the existing round（providerWrites=0） |
| Old approval is presented to the new policy | A／schedule rejects legacy；real CLI review executes |
| Exact scheduled commitment is authorized | A／advance same-ID；foreground handoff；schedule exchange binds（T） |
| Retry verified article update | A／content sync actually edits；formerly public identity |
| Existing website-only article remains quiet | A／all three previously public identities |
| Delivery outcome is unknown | A／advance same-ID；lost arm can be reconciled after provider publication |
| First publication uses the original slug | A／advance same-ID；all three previously public identities |
| Slug cannot be saved or is already occupied | A／slug mismatch blocks；occupied discovery |
| A public mirror has the wrong slug | A／wrong anonymous canonical；foreground verification never replaces |
| Existing mirror URL is corrected | A／public slug correction edits the original identity（coordinator fixture）；真實 UI qualification 仍為 task 3.1 |
| Background work encounters a slug mismatch | A／background drift（零 authenticated calls）；S／background observer includes vanished sources |

## quiet-background-distribution

| Gherkin 情境 | 本機驗收定位／限制 |
| --- | --- |
| Repeated manual hold | Y／manual-held article remains skipped；scheduled observation reuses the existing round |
| Changed source or retained intent | A／background drift；unknown arm/remove/update/create；lost intent survives closing SQLite |
| Explicit resolution | A／reconcile lost create；lost arm reconciles；content sync actually edits |
| Local pause does not stop the provider | S／background observer includes vanished sources（stillArmedUntilConfirmed）；A／background drift |
| Unchanged verified article | A／content sync actually edits；Y／unchanged round verifies Substack |
| Browser operation is required | A／real CLI review；Y／scheduled observation reuses the existing round |
| Disposition changed after planning | A／independent writers and stale generations；Y／manual-held article remains skipped |
| Armed article becomes due without a running controller | A／advance same-ID；due observation accepts source publication metadata changes（provider mock，本機） |
| Published original changes | A／content sync actually edits；background drift |
| Armed source is edited, delayed or removed | A／background drift；S／background observer includes vanished sources |
| Repeated pending change | Y／scheduled observation reuses the existing round；Hermes receives held results |
| Schedule cannot be fully observed | S／background observer includes vanished sources；Y／production notification includes inventory-omitted D1 holds |

## RED／GREEN 與限制

最早真實 CLI RED 為 `prepare-draft` 被舊入口以 DISTRIBUTION_USAGE 拒絕；其後備稿審閱案例轉 GREEN。保留的 coordinator 行為 RED 包含接管其他 slug、遺失 arm 回覆時缺少原版本、sending 仍進入編輯、發布狀態變動誤判內容漂移、曾公開文章退回草稿被重新排程、遺失 arm 回覆後已公開仍不能對帳、解除排程後來源／遠端再次變動，以及圖片失效連帶阻擋取消。這些測試檢查實際呼叫、狀態、ID、版本及重播次數，不檢查來源字串。最早缺少新模組的 import 錯誤只是開發紀錄，不算行為 RED。

原始 RED／GREEN 紀錄位於 Git 外 `/private/tmp/gcake-substack-apply-20261019/`：`first-red.log`、`core-regression-red.log`、`legacy-red.log`、`public-minute-true-red.log`、`source-release-red.log`、`no-backfill-red.log`、`lost-arm-public-red.log`、`disarm-race-red.log`、`cancel-broken-media-red.log`，及相應 GREEN 紀錄。此目錄是暫存證據，可能被系統清理；規格與可重跑測試保留於 repo。

`pnpm test` 最初被系統 pnpm 12 的工具鏈鎖寫入阻擋，改用專案 Corepack pnpm 10.17.1。sandbox 內的既有 Hermes 測試另在 127.0.0.1／Unix socket bind 得到 EPERM；取得執行權限後，既有完整 aggregate 通過。首次 check 發現新 observer 的兩個 implicit-any，已修正。完整 aggregate 後修改的 distribution 共享路徑與排程邏輯，由最終 distribution suite 重新驗證，其餘未改動的既有測試證據沿用。

本機 release:dry-run 使用自己的暫存 Git、SQLite、Astro、loopback 與模擬 Telegram；productionWrites=false、telegramNetworkCalls=0。沒有 Docker 資源。候選來源與依賴摘要見 candidate-sha256.json；完整 gate 狀態另記於 gate-results.json。

## 未結案項目

- Task 3.1 的命令、前景 scope、意圖、時間／雙通道及列表讀回契約已有本機測試；目前沒有新排程控制項的真實 UI／保存重載證據，不能宣稱 provider transport 已合格。原生 transport 對新政策明確拒絕。
- Task 5.3 未獲本輪啟用授權：未選真實 pilot／時段，沒有真實 prepare／arm／remove／rearm、provider 自行公開、實際雙通道設定與後續普通背景輪次證據。訂閱者收信與裝置通知仍為 unknown。
- 未 commit、push 或 archive。既有三個 dirty 政策檔保留；主規格 publishing-operations/spec.md 與本輪開始備份逐位元相同，AGENTS／runbook 只延伸已授權的新政策。
