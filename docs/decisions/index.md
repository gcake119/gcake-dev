# 專案決策索引

規格與驗收以 `openspec/` 為準；本索引保存跨回合需要沿用的決策，不把本機、CI、部署或模型測試互相當成完成證明。

| 決策 | 狀態 | 適用範圍 |
| --- | --- | --- |
| [ADR-001：Cloudflare 免費語意搜尋](ADR-001-cloudflare-semantic-search.md) | 已採納；２０２６－１０－２１[正式驗收通過](../../openspec/changes/build-article-discovery-knowledge/cloud-production-acceptance-20261021.md) | 公開文章搜尋、BGE-M3、帳戶免費硬上限、每日額度、[雲端索引自動同步](../../openspec/changes/build-article-discovery-knowledge/cloud-hosted-sync-20261021.md)、隱私與回復；２０２６－１０－２２ [main 部署驗收](../../openspec/changes/build-article-discovery-knowledge/main-cloudflare-acceptance-20261022.md) |

既有視覺決策仍見 `DESIGN.md`、`docs/design-system.md` 與 `docs/blog-redesign-approved.md`，不因新增索引而重新設計。

２０２６－１０－２２目前已驗收 main `d92a05b`，Worker `1ddf7f63-75bb-4f04-8d04-2d118503a77e` 與 Pages 部署 `39664907333`；[本次正式驗收](../../openspec/changes/build-article-discovery-knowledge/main58-production-acceptance-20261022.md)保存索引對齊及自然 cron 恢復證據。[前次 ecfebeb 紀錄](../../openspec/changes/build-article-discovery-knowledge/source-timeout-production-acceptance-20261022.md)保留為歷史。BGE-M3、免費硬上限、啟用開關與期限未改；首次自然新增文章完整同步仍待驗收。
