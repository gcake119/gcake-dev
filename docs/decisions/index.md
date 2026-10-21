# 專案決策索引

規格與驗收以 `openspec/` 為準；本索引保存跨回合需要沿用的決策，不把本機、CI、部署或模型測試互相當成完成證明。

| 決策 | 狀態 | 適用範圍 |
| --- | --- | --- |
| [ADR-001：Cloudflare 免費語意搜尋](ADR-001-cloudflare-semantic-search.md) | 已採納；２０２６－１０－２１[正式驗收通過](../../openspec/changes/build-article-discovery-knowledge/cloud-production-acceptance-20261021.md) | 公開文章搜尋、BGE-M3、帳戶免費硬上限、每日額度、[雲端索引自動同步](../../openspec/changes/build-article-discovery-knowledge/cloud-hosted-sync-20261021.md)、隱私與回復；２０２６－１０－２２ [main 部署驗收](../../openspec/changes/build-article-discovery-knowledge/main-cloudflare-acceptance-20261022.md) |

既有視覺決策仍見 `DESIGN.md`、`docs/design-system.md` 與 `docs/blog-redesign-approved.md`，不因新增索引而重新設計。

２０２６－１０－２２的來源逾時與讀取修正仍為[本機候選](../../openspec/changes/build-article-discovery-knowledge/source-download-repair-20261022.md)，未變更正式設定或部署；逾時預算由原始臨時選擇改為按資料規模分開處理。
