# 專案決策索引

規格與驗收以 `openspec/` 為準；本索引保存跨回合需要沿用的決策，不把本機、CI、部署或模型測試互相當成完成證明。

| 決策 | 狀態 | 適用範圍 |
| --- | --- | --- |
| [ADR-001：Cloudflare 免費語意搜尋](ADR-001-cloudflare-semantic-search.md) | 已採納；２０２６－１０－２１[正式驗收通過](../../openspec/changes/build-article-discovery-knowledge/cloud-production-acceptance-20261021.md) | 公開文章搜尋、BGE-M3、帳戶免費硬上限、每日額度、[雲端索引自動同步](../../openspec/changes/build-article-discovery-knowledge/cloud-hosted-sync-20261021.md)、隱私與回復；２０２６－１０－２２ [main 部署驗收](../../openspec/changes/build-article-discovery-knowledge/main-cloudflare-acceptance-20261022.md) |

既有視覺決策仍見 `DESIGN.md`、`docs/design-system.md` 與 `docs/blog-redesign-approved.md`，不因新增索引而重新設計。

２０２６－１０－２２目前已驗收 main `d92a05b`，Worker `1ddf7f63-75bb-4f04-8d04-2d118503a77e` 與 Pages 部署 `39664907333`；[本次正式驗收](../../openspec/changes/build-article-discovery-knowledge/main58-production-acceptance-20261022.md)保存索引對齊及自然 cron 恢復證據。[前次 ecfebeb 紀錄](../../openspec/changes/build-article-discovery-knowledge/source-timeout-production-acceptance-20261022.md)保留為歷史。BGE-M3、免費硬上限、啟用開關與期限未改；首次自然新增文章完整同步仍待驗收。

２０２６－１０－２２ Substack 發布驗證與 Hermes 通知修復：使用者授權將原定與實際時間差分開呈現、隔離其他草稿失敗並增加一次性成功通知。[規格與實作契約](../../openspec/changes/archive/2026-10-22-repair-substack-publication-notifications/design.md)保留原 ID／slug、新建及排程寫入停用、不重新發布或重寄訂閱者；不更動 ADR-001 的搜尋／模型／額度／cron。正式權限修復及通知 ACK 仍須另有驗收證據。

本修復後續已沿用原站共用私訊流程完成自然輪次 ACK 267，使用者確認 Telegram 收到；詳細[正式驗收](../../openspec/changes/archive/2026-10-22-repair-substack-publication-notifications/shared-production-acceptance-20261022.json)與[三行格式讀回](../../openspec/changes/archive/2026-10-22-repair-substack-publication-notifications/three-line-format-20261022.json)分開保存。未採用專用群組；舊快照 PermissionError 系統根因與訂閱者實收仍未確立，原排程試行 5.3 維持未完成。

２０２６－１０－２２ 此修復已完成封存，16 項任務完成；main `347dfd8` CI 與重新觸發的遠端審查均通過，正式自然輪次、Hermes 實收與三行格式證據分開保留。詳見[結案紀錄](../../openspec/changes/archive/2026-10-22-repair-substack-publication-notifications/closeout-20261022.md)。新建及排程寫入仍停用，訂閱者寄送仍未知，另一項排程試行 5.3 保持未完成。
