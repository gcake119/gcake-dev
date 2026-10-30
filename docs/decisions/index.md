# 專案決策索引

２０２６－１０－２９ 自動首次排程候選：使用者授權兩篇原 ID 對帳、同 ID 網站正文修正且不重發／不補寄，與後續依原站已確認時段首次排程及 email／App；後續明確選擇先完成本機實作，等下一篇確認時段才做真實驗收與啟用。採獨立 automatic-substack-first-schedules-v1 worker 共用原輪次及鎖，anonymous observer 仍零 browser／provider write；只取固定合格 main 與 current confirmed future slot，未知意圖不重播，public／armed 不改期或補寄。須另有 exact scope／pin／expiry／真實平台資格，舊 draftOnly 與空隊列不升格；正式 autoSchedule 未啟用。AGENTS.md 同步明列此獨立 worker 例外，仍須下一篇正式時段的真實驗收與另行啟用；不擴張其他背景寫入權限。沿用既有權限架構，記本索引與 automate-substack-confirmed-first-schedules 即可，不改 ADR-001 搜尋政策。

規格與驗收以 `openspec/` 為準；本索引保存跨回合需要沿用的決策，不把本機、CI、部署或模型測試互相當成完成證明。

２０２６－１０－２６ Hermes 容量政策：使用者選擇保留原 4 GiB 管理上限，未核准調為 6 GiB；另行規劃精確舊套件封存，保留首次 runtime 備份與現用版本。[封存審閱方案](../hermes-retired-versions-archive-plan-20261026.md)列出三項候選、完整核對前提、容量與還原方式。使用者後續明確授權實作與執行，archive-hermes-retired-versions 已完成 7／7，三項精確舊套件正式封存、永久 root 還原入口已保存；[正式回執](../../openspec/changes/archive/2026-10-26-archive-hermes-retired-versions/verification.md)核對原工作、通知帳本、控制檔與 Gateway PID 不變。時間修正版本 fcb86727… 已通過原工作 13：32：37 自然 dry-run 資格，13：36 查核 live／ready 與[已安裝程式讀回](../../openspec/changes/archive/2026-10-26-clarify-original-site-publication-times/verification.md)通過；未重送通知。臨時準備目錄已清理，永久 root 還原入口與全部原始備份保留。

２０２６－１０－２６ [原站通知時間](../../openspec/changes/archive/2026-10-26-clarify-original-site-publication-times/design.md)：使用者選定原定發布時間與公開確認時間分列。排程只取正式承諾，確認時間只取 Hermes 完成該頁成功查核且位於同輪頁面觀察期間的時刻；資料不足明示未提供／未記錄，不推論首次公開瞬間。保留原 URL 去重與歷史，不回改或重送既有通知，不改 Substack 三行格式；正式 immutable runtime 透過既有受控 successor 採用，安裝證據獨立列示。沿用既有時間與權限政策，無新 ADR。

| 決策 | 狀態 | 適用範圍 |
| --- | --- | --- |
| [ADR-001：Cloudflare 免費語意搜尋](ADR-001-cloudflare-semantic-search.md) | 已採納；２０２６－１０－２１[正式驗收通過](../../openspec/changes/build-article-discovery-knowledge/cloud-production-acceptance-20261021.md) | 公開文章搜尋、BGE-M3、帳戶免費硬上限、每日額度、[雲端索引自動同步](../../openspec/changes/build-article-discovery-knowledge/cloud-hosted-sync-20261021.md)、隱私與回復；２０２６－１０－２２ [main 部署驗收](../../openspec/changes/build-article-discovery-knowledge/main-cloudflare-acceptance-20261022.md) |

既有視覺決策仍見 `DESIGN.md`、`docs/design-system.md` 與 `docs/blog-redesign-approved.md`，不因新增索引而重新設計。

２０２６－１０－２２當時已驗收 main `d92a05b`，Worker `1ddf7f63-75bb-4f04-8d04-2d118503a77e` 與 Pages 部署 `39664907333`；[本次正式驗收](../../openspec/changes/build-article-discovery-knowledge/main58-production-acceptance-20261022.md)保存索引對齊及自然 cron 恢復證據。[前次 ecfebeb 紀錄](../../openspec/changes/build-article-discovery-knowledge/source-timeout-production-acceptance-20261022.md)保留為歷史。BGE-M3、免費硬上限、啟用開關與期限未改；首次自然新增文章完整同步仍待驗收。

２０２６－１０－２２ Substack 發布驗證與 Hermes 通知修復：使用者授權將原定與實際時間差分開呈現、隔離其他草稿失敗並增加一次性成功通知。[規格與實作契約](../../openspec/changes/archive/2026-10-22-repair-substack-publication-notifications/design.md)保留原 ID／slug、新建及排程寫入停用、不重新發布或重寄訂閱者；不更動 ADR-001 的搜尋／模型／額度／cron。正式權限修復及通知 ACK 仍須另有驗收證據。

本修復後續已沿用原站共用私訊流程完成自然輪次 ACK 267，使用者確認 Telegram 收到；詳細[正式驗收](../../openspec/changes/archive/2026-10-22-repair-substack-publication-notifications/shared-production-acceptance-20261022.json)與[三行格式讀回](../../openspec/changes/archive/2026-10-22-repair-substack-publication-notifications/three-line-format-20261022.json)分開保存。未採用專用群組；舊快照 PermissionError 系統根因與訂閱者實收仍未確立，原排程試行 5.3 維持未完成。

２０２６－１０－２２ 此修復已完成封存，16 項任務完成；main `347dfd8` CI 與重新觸發的遠端審查均通過，正式自然輪次、Hermes 實收與三行格式證據分開保留。詳見[結案紀錄](../../openspec/changes/archive/2026-10-22-repair-substack-publication-notifications/closeout-20261022.md)。新建及排程寫入仍停用，訂閱者寄送仍未知，另一項排程試行 5.3 保持未完成。

２０２６－１０－２３ Hermes 發布監控 `add-hermes-publication-monitor` 已完成 74／74 項並封存；[結案紀錄](../../openspec/changes/archive/2026-10-23-add-hermes-publication-monitor/closeout-20261023.md)保留 PR #64／#65 的已完成遠端審查、合併與各自 main CI 成功證據。這是來源與規格結案，原生 ACL 新版未正式安裝或新增正式資格驗收；舊 PermissionError 根因仍未知。新建及排程寫入維持停用，不改 timer、不重送通知；訂閱者監控依使用者決定停止，排程試行 5.3 保持未完成。ADR-001 與既有權限政策不變。

２０２６－１０－２３ [add-article-sharing](../../openspec/changes/archive/2026-10-23-add-article-sharing/design.md)：文章正文後、延伸閱讀前提供複製及裝置支援時的原生分享。分享使用新部落格正式閱讀網址，與內容權威 canonical 分開；鐵人賽 canonical、Open Graph URL、原始版本連結保持舊站政策，接受平台可能依舊站 metadata 顯示預覽。沿用既有雙主題、鍵盤焦點與４４px 控制，不加平台 SDK、追蹤、登入或後端。複製成功、系統分享完成、實際發文／送達與人工驗收各自需要證據。[本機驗證紀錄](../../openspec/changes/archive/2026-10-23-add-article-sharing/local-verification.md)不構成部署或平台送達驗收；ADR-001 不受影響，無須新增 ADR。

２０２６－１０－２３ 使用者修訂同一變更：僅保留「分享文章」，使用 SVG 圖示加可見文字；移除獨立複製按鈕及剪貼簿操作。不支援或分享失敗時顯示完整網址供手動複製，取消保持中性。本修訂取代上一段的雙按鈕政策，網址、canonical／OG 所有權及外部操作邊界維持；驗證見 [單一分享按鈕紀錄](../../openspec/changes/archive/2026-10-23-add-article-sharing/single-share-verification.md)。

２０２６－１０－２３ 最終文案採「分享這篇文章」＋SVG。使用者已確認介面可接受、真實選單開啟及取消正常；僅授權完成驗證、提交與建立 PR，不合併或部署。人工回報與自動 payload／復原測試分別保存於本變更的 PR 驗證紀錄，不推定平台送達。

２０２６－１０－２３ 使用者核准完整篇尾版面及公開站字級，後續僅授權更新 Spectra、實作、驗證與本機預覽，取代上一輪提交／PR 的執行範圍。新順序為接著讀（系列下一篇優先、前篇／系列集中、既有推薦合併去重）→分享→訂閱→收合參考與引用。推薦上限有下一篇為２、否則３；沒有公開下一篇不等於完結。不改排名、正文、canonical／OG 或首頁訂閱；[規格](../../openspec/changes/archive/2026-10-23-add-article-sharing/specs/article-ending/spec.md)與[本機紀錄](../../openspec/changes/archive/2026-10-23-add-article-sharing/reading-ending-verification.md)分別保存。沒有 commit、push、PR 或部署。

２０２６－１０－２３ 使用者確認實際閱讀優先新版，重新授權完整提交前驗證、提交與建立 PR，取代上一輪僅本機的執行限制；仍不合併或部署。[提交前驗證](../../openspec/changes/archive/2026-10-23-add-article-sharing/pre-pr-verification.md)保存完整 gate、舊版面斷言修正及人工驗收界線。不改 ADR-001、canonical／OG、正文、provider 或正式排程權限。

２０２６－１０－２３ 後續已依明確授權合併 PR ＃６７，main `30ac964` 的 CI 及 Pages 部署 `39960141344` 通過；再依另一筆正式 D1／Vectorize 寫入授權，重用２，６８８筆、補齊２６７段、完整讀回２，９５５筆後由自然 cron 提升，正式語意搜尋恢復。詳見[部署與正式驗收](../../openspec/changes/archive/2026-10-23-add-article-sharing/production-acceptance-20261023.md)。本次完成 `add-article-sharing` 封存及兩份正式規格同步，只提交並建立封存 PR，不合併或再次部署；ADR-001、Worker／排程、零付費超額及原證據期限不變，無新 ADR。另一變更的歷史 RED 與首次自然新增文章全程同步仍待驗收。

２０２６－１０－２４ `fix-discovery-corpus-identity` 本機候選：分離穩定搜尋內容身分與產製追溯，完整讀回後可在既有期限／共享原子預留內同輪續作一批；每分鐘cron、１６段批次、未知結果不重播及零付費超額保留。容量證據不足停止新上傳，舊身分轉換仍須全量核實，不預設雙整庫免費。詳見[設計與本機驗收](../../openspec/changes/fix-discovery-corpus-identity/design.md)及ADR-001新增節；沒有正式設定／資料寫入、模型查詢或部署，既有歷史RED與自然新增文章全程驗收保持未完成。

２０２６－１０－２４ 使用者追加授權修復完整本機gate：舊output保留並補型別，不改檢查排除；Hermes同次authority驗證的ACL檢查合併至一個有界native子程序，每節點仍核對ACL／owner／mode，不跨次快取，保留30秒ACL期限與10秒崩潰復原驗收。詳見[本機修正紀錄](../../openspec/changes/fix-discovery-corpus-identity/local-verification.md)。這是本機候選，未安裝正式控制程式或更動正式ACL／服務／通知；不宣稱舊正式PermissionError根因已修復，ADR-001免費搜尋政策不變。

２０２６－１０－２６ `migrate-gcake-dev-ci-to-mint`：依使用者要求按最新Actions選定本repo，授權新增第六個Mint個人repo runner與全主機CPUQuota300%，共用MemoryHigh16GiB／MemoryMax20GiB、Tasks4096及原rootless建置鎖。只遷移可信PR／main驗證，fork保留hosted；原測試／Chrome fixtures／Hermes固定路徑與4GiB guard保留，Mint CI無sudo。Chrome由官方簽章來源安裝，僅新service使用/private私有8GiB容量tmpfs；容量不是RAM預留，仍受共用記憶體額度約束。完整本機與真實跨repo並行已成功，PR／main整合驗收另列，不改ADR-001搜尋／模型／免費額度，也不改或觸發正式發文、通知、Pages／Cloudflare部署與排程。原先Editorial release queue失敗屬既有觀測，不以本CI遷移修復或重新執行。見[本次驗收](../../openspec/changes/migrate-gcake-dev-ci-to-mint/verification.md)；不部署或archive。

２０２６－１０－２６本變更正式整合：gcake-dev PR71經獨立review與fresh ruleset／required validate／head-base-diff／threads核對後合併main25f9890d040dcde4303f674bd64a9b60e793c822；完整PR40218973967與main40219471212均在Mint成功。CPU300%／六runner／同建置鎖真實雙repo驗收與主機exact-main smoke40218042745也成功。原tmpfs容量、wrapper結構斷言、跨filesystem EXDEV與Chrome socket長路徑失敗及兩次取消均保留，修工具配置而未放寬guard/timeout。這是CI／靜態build驗收，原Editorial queue失敗不在本案修復；未部署/provider/archive，ADR-001及既有發布授權不變，詳見同案驗收紀錄。

２０２６－１０－２６ `fix-discovery-corpus-identity` 架構候選：公開集合與物理模型 namespace 分離，完整核實 proof 跨版本重用，只同步差異；provider mutation 狀態、讀回等待及 UTC quota 續作由現有 D1／Cron 持久管理。新增 additive migration，５００與零付費超額不變。正式同步仍停用，部署／遷移須另獲授權；本機證據不關閉４．２／４．３。見 [架構修補](../../openspec/changes/fix-discovery-corpus-identity/architecture-repair-20261026.md)與 ADR-001 新節。


２０２６－１０－３０ `fix-discovery-corpus-identity` 正式恢復：PR83／main b3e2d50 CI成功，0005 additive migration核對原資料與扣額不變；正式Worker540fe715、逐位元bundle核對通過，原Cron及兩開關true，每日500與零付費超額保留。自然首批16段完成、下一批已上傳，完整corpus仍未提升，維持當期關鍵字。容量到台北10/31 01:21:49，初始CLI格式失敗與獨立對帳保留，4.2／4.3不結案。見[正式紀錄](../../openspec/changes/fix-discovery-corpus-identity/production-resume-20261030.md)。


２０２６－１０－３０ 後台索引進度規劃：使用者指定圖形化進度條並遵循專案設計規範。沿用 DESIGN.md／docs/design-system.md 的既有後台字級、間距、基本控制與雙主題，新增同文件「後台圖形化進度條」設計契約；不重新制定品牌或公開站樣式。定量、未知、空集合、舊資料與滿條未驗收分列，沿用唯讀與owner授權邊界。Spectra `add-readonly-index-status` 已補Gherkin及規劃；尚未實作、提交或部署，不代表全量索引、語意搜尋或人工驗收完成。此為視覺共用契約的索引更新，不更動ADR-001模型、額度、期限與排程決策。


２０２６－１０－３０ 唯讀觀測本機實作：add-readonly-index-status 以獨立監測token與owner後台代理實作圖形化進度條，沿用既有後台設計系統；本機驗證結果另記該change verification.md，不代表正式啟用。使用者明確排除提交、部署與正式secret配置；automation-3保持暫停，原Cron／模型／額度／有效期不變。ADR-001新增本機候選界線；完整provider與人工搜尋驗收仍待完成。
