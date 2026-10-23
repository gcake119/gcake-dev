# 提交範圍與證據核對

本輪使用者明確授權本change提交、push與PR；不合併、部署或操作正式資料。本清單是spectra-commit的明確提交集合，不包含未列檔案。任務11／14完成，保留3項正式驗收；不封存。

原touched紀錄缺失，CLI不允許對已完成任務補寫done。依完整gate候選SHA及實際diff還原以下12份來源範圍，不重寫任務完成狀態，不把無關修改當成本change。

## 程式、測試與決策文件

- apps/search-worker/src/service.ts
- apps/search-worker/src/sync.ts
- docs/article-discovery-runbook.md
- docs/decisions/ADR-001-cloudflare-semantic-search.md
- docs/decisions/index.md
- scripts/hermes/test_acl_inventory.py
- scripts/hermes/test_update_entry.py
- scripts/hermes/update_entry.py
- src/lib/discovery/build.ts
- test/discovery/cloud-runtime.acceptance.test.ts
- test/discovery/cloud-sync.acceptance.test.ts
- test/discovery/corpus.acceptance.test.ts

## Change規格與全部攜帶證據

- openspec/changes/fix-discovery-corpus-identity/.openspec.yaml
- openspec/changes/fix-discovery-corpus-identity/commit-scope.md
- openspec/changes/fix-discovery-corpus-identity/design.md
- openspec/changes/fix-discovery-corpus-identity/evidence/acl-batch-green.log
- openspec/changes/fix-discovery-corpus-identity/evidence/build-all.log
- openspec/changes/fix-discovery-corpus-identity/evidence/capacity-red.log
- openspec/changes/fix-discovery-corpus-identity/evidence/check-isolated.log
- openspec/changes/fix-discovery-corpus-identity/evidence/check-original-repaired.log
- openspec/changes/fix-discovery-corpus-identity/evidence/check.log
- openspec/changes/fix-discovery-corpus-identity/evidence/cloud-evaluate.before-gate-repair.txt
- openspec/changes/fix-discovery-corpus-identity/evidence/comparison-case.txt
- openspec/changes/fix-discovery-corpus-identity/evidence/comparison.log
- openspec/changes/fix-discovery-corpus-identity/evidence/configuration-order-red.log
- openspec/changes/fix-discovery-corpus-identity/evidence/continuation-green.log
- openspec/changes/fix-discovery-corpus-identity/evidence/continuation-intermediate-failures.log
- openspec/changes/fix-discovery-corpus-identity/evidence/continuation-red.log
- openspec/changes/fix-discovery-corpus-identity/evidence/distribution-test.log
- openspec/changes/fix-discovery-corpus-identity/evidence/editorial-rehearse.log
- openspec/changes/fix-discovery-corpus-identity/evidence/effective-metadata-red.log
- openspec/changes/fix-discovery-corpus-identity/evidence/equal-input-comparison.json
- openspec/changes/fix-discovery-corpus-identity/evidence/final-apply-status.json
- openspec/changes/fix-discovery-corpus-identity/evidence/full-test-unsandboxed.log
- openspec/changes/fix-discovery-corpus-identity/evidence/full-test.log
- openspec/changes/fix-discovery-corpus-identity/evidence/gate-repair-final-apply.json
- openspec/changes/fix-discovery-corpus-identity/evidence/gate-repair-summary.json
- openspec/changes/fix-discovery-corpus-identity/evidence/gate-repaired-build-all.log
- openspec/changes/fix-discovery-corpus-identity/evidence/gate-repaired-check.log
- openspec/changes/fix-discovery-corpus-identity/evidence/gate-repaired-editorial-rehearse.log
- openspec/changes/fix-discovery-corpus-identity/evidence/gate-repaired-release-dry-run.log
- openspec/changes/fix-discovery-corpus-identity/evidence/gate-repaired-results.json
- openspec/changes/fix-discovery-corpus-identity/evidence/gate-repaired-test.log
- openspec/changes/fix-discovery-corpus-identity/evidence/hermes-crash-reproduction.log
- openspec/changes/fix-discovery-corpus-identity/evidence/hermes-entry-reproduction.log
- openspec/changes/fix-discovery-corpus-identity/evidence/hermes-install-python313.log
- openspec/changes/fix-discovery-corpus-identity/evidence/hermes-install-unrestricted.log
- openspec/changes/fix-discovery-corpus-identity/evidence/hermes-sandbox-reproduction.log
- openspec/changes/fix-discovery-corpus-identity/evidence/identity-green.log
- openspec/changes/fix-discovery-corpus-identity/evidence/identity-red.log
- openspec/changes/fix-discovery-corpus-identity/evidence/local-gate-summary.json
- openspec/changes/fix-discovery-corpus-identity/evidence/local-source-smoke.before-gate-repair.txt
- openspec/changes/fix-discovery-corpus-identity/evidence/no-change-budget-red.log
- openspec/changes/fix-discovery-corpus-identity/evidence/observability-test.log
- openspec/changes/fix-discovery-corpus-identity/evidence/output-type-repair.json
- openspec/changes/fix-discovery-corpus-identity/evidence/pre-pr-review.json
- openspec/changes/fix-discovery-corpus-identity/evidence/public-test.log
- openspec/changes/fix-discovery-corpus-identity/evidence/recovery-profile-after.log
- openspec/changes/fix-discovery-corpus-identity/evidence/recovery-profile-before.log
- openspec/changes/fix-discovery-corpus-identity/evidence/recovery-profile-recipe.txt
- openspec/changes/fix-discovery-corpus-identity/evidence/recovery-startup-green.log
- openspec/changes/fix-discovery-corpus-identity/evidence/recovery-startup-red.log
- openspec/changes/fix-discovery-corpus-identity/evidence/release-dry-run-unsandboxed.log
- openspec/changes/fix-discovery-corpus-identity/evidence/release-dry-run.log
- openspec/changes/fix-discovery-corpus-identity/evidence/runtime-green.log
- openspec/changes/fix-discovery-corpus-identity/evidence/spectra-analyze-gate-repair.json
- openspec/changes/fix-discovery-corpus-identity/evidence/spectra-analyze.json
- openspec/changes/fix-discovery-corpus-identity/evidence/spectra-validate-gate-repair.log
- openspec/changes/fix-discovery-corpus-identity/evidence/spectra-validate.log
- openspec/changes/fix-discovery-corpus-identity/evidence/workspace-foundation.log
- openspec/changes/fix-discovery-corpus-identity/evidence/workspaces-test.log
- openspec/changes/fix-discovery-corpus-identity/local-verification.md
- openspec/changes/fix-discovery-corpus-identity/production-handoff.md
- openspec/changes/fix-discovery-corpus-identity/proposal.md
- openspec/changes/fix-discovery-corpus-identity/specs/stable-discovery-synchronization/spec.md
- openspec/changes/fix-discovery-corpus-identity/tasks.md

- openspec/changes/fix-discovery-corpus-identity/evidence/raw-log-bytes.tar.gz
- openspec/changes/fix-discovery-corpus-identity/evidence/log-formatting.json

## 排除但保留

- output/discovery/merge-deploy-cloud-20261021/cloud-evaluate.ts
- output/discovery/source-download-fix-20261022/local-source-smoke.ts

兩份本機歷史腳本維持原位置與修復後內容，不強制納入Git忽略目錄；其原始內容、修復說明與前後hash保留於change證據。無其他tracked dirty檔案。

## 驗證沿用

所有14份受測候選（含兩份output）hash與完整gate一致；依賴lockfile、設定與工具版本未變，也沒有安裝／更新依賴。沿用1096項測試、原目錄294檔零診斷、build:all與兩項發布演練；本輪只補授權及提交範圍文件、執行staged diff／Spectra查核，不重跑未變的產品gate。正式provider、部署、自然新文章及人工搜尋驗收尚未執行。

## Commit message

spectra(fix-discovery-corpus-identity): 穩定文章索引身分並改善有界同步

Change: fix-discovery-corpus-identity
Tasks: 11/14 complete

## 原始log保存

staged檢查發現工具輸出行尾空白；raw-log-bytes.tar.gz逐位元封存所有原始log，log-formatting.json保存archive／原始／文字版hash。文字log只正規化行尾空白及多餘EOF空行，不修改結果或錯誤。未調整Git檢查規則，不影響產品gate效力。
