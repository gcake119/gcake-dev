> ２０２６－１０－２４：本機實作及驗證已依使用者新指示啟動。以下「本次只建立提案／不實作」描述提案階段；目前授權僅涵蓋本機tasks1–3，不包含tasks4的正式操作。

## Context

基線為 main 13f71b8584b8307e0f4bfd3bf84f3bde500dd11e，開始時工作目錄乾淨。本次只建立提案，所有實作與正式操作任務保持未完成。

Decision context：Level 2；產品為公開文章搜尋；風險為來源資格、背景續作、共享配額、供應商結果與容量。已讀 `docs/decisions/index.md`、`docs/decisions/ADR-001-cloudflare-semantic-search.md`、既有搜尋 proposal／design／tasks 及 public-article-knowledge spec、分享封存正式驗收。缺少正式 public-article-knowledge spec，原因是原 change 尚未封存，不是重新初始化需求。

本 change 為獨立修正，依賴 `openspec/changes/build-article-discovery-knowledge/specs/public-article-knowledge/spec.md` 的來源、安全與同步契約，補強可重現身分與續作效率；不取代或封存原 change。原 tasks 1.1 歷史 RED 與 12.2 自然新增文章全程同步不改勾選，不以此次新增 RED 補造歷史。沒有變更 ADR 的模型／免費／隱私邊界；採納後須在原 ADR 與 ledger 說明同輪有界續作，無須另設 ADR。

來源證據：`openspec/changes/archive/2026-10-23-add-article-sharing/production-acceptance-20261023.md`，及同目錄 `evidence/production-20261023/before-manifest.json`、`evidence/production-20261023/after-manifest.json`。corpus 2349f4ae…→aefe3aff…，configurationDigest 相同，passages 與 connections digest 完全相同，snapshotDigest 與 index digest 不同。兩份 manifest 本身不能證明所有差異只有 generatedAt；根因另有來源鏈與前次固定兩個時間、同一釘選 manifest／來源、posts／passages 相同但 corpus 不同的離線重現（此次未重新執行）。不依賴已刪除 output 路徑。

前次唯讀查核由交接提供，時間為 2026-10-23 約15:51 UTC（台北23:51），此次未向正式環境重新查詢：Worker cd0f2555-abdf-4ddc-93fd-c79647036ec9、每分鐘 cron、兩開關 true；aefe3aff…游標／清冊2955、pending0、owner空、no_change；paidOverage0，證據期限2026-11-20T00:00:00Z。這是歷史快照，不能代表現在狀態。PR67 部署30ac964，PR68／69已合併但未再部署。

歷史收據 id2413–2717：舊版本1824段經114批驗證，經過303.891分鐘；上傳到讀回平均95.82秒（53.268–285.326），含排程等待，非純供應商延遲或費用。2460的50502暫時錯誤後以已保存輸出恢復，非永久阻塞；該範圍未見額度／容量耗盡證據。2718換目標後進度歸零；後續前景重用2688筆、補267段，與自然 cron 共同完成，2774自然 promoted，不能算全程自然同步。這些數據來自交接的正式唯讀查核，不是此次新量測。

## Goals / Non-Goals

In scope：先穩定內容身分，再在既有同步流程消除「讀回成功後固定空等下一輪」；保留一次性轉換、安全續作及驗收計畫。

Out of scope：本次不實作、不 commit／push／PR，不改正式 D1／Vectorize／設定／排程、不呼叫模型／同步、不部署。後續也不提高 cron 頻率、不擴大１６段批次、不新增佇列服務、付費方案或雙整庫保留、不調整搜尋排序／UI／發文。

## Decisions

### 穩定內容身分與獨立追溯

在 buildPublicDiscovery 的最後依白名單產生確定性內容投影，以有版本的 identity domain（例如 discovery-content-v2）計算 corpusId。投影包含 configurationDigest、已通過公開資格的文章集合、來源身分、articleId、sourceRevision、title／description、閱讀／canonical／alias URL、公開日期、topics／series、抽取後段落／定位、terms／connections 的實際搜尋內容。物件鍵排序；只對語意為集合的欄位排序，段落順序與排序結果順序必須保留。不得把整個來源快照直接當內容身分。

sourceTree、eligibilityInstant、快照完整位元組雜湊與 generatedAt 仍為 provenance／完整性資料；快照驗證與釘選 hash 不移除。時間仍參與公開資格判定，但時鐘變化而公開集合與其有效資料不變時不換內容身分。schemaVersion 1 的既有介面優先保留，snapshotDigest 維持原本「完整快照」意義，不偷換為另一種雜湊；穩定內容投影在 corpusId 計算處分離，不新增必要 manifest 欄位。

同 corpusId 的 manifest 仍可有不同追溯與 index digest；讀取者必須核對 manifest 中每個實際資產 digest，不能因 corpus 相同跳過完整性檢查。初始來源下載仍驗證全部資產，最後 manifest 核對維持現有 descriptor／digest 與 corpus 防競態。文章實際修訂與公開資格永遠優先；新主題、改名、撤回、別名或抽取設定變更不可誤判 no_change。拒絕「只刪掉 generatedAt 其餘全雜湊」的脆弱黑名單，也拒絕直接移除 snapshotDigest 而只留正文修訂的不足投影。

### 完整讀回後同輪有界續作

保留 syncBatchSize=16、既有單一租約與45秒步驟期限。一次 invocation 最多確認一批既有 pending，並準備／上傳一批下一批；新上傳仍留待下一輪讀回，不同輪輪詢、不 busy-wait、不遞迴清空整庫。pending 尚未完整可讀時立即 awaiting_readback；最後一批確認後，同輪剩餘預算允許時可走既有最終來源／policy guard 與 promotion。

追加工作前檢查剩餘時間及所有資源預留；沒有足夠的既有來源／供應商操作預算就記錄 verified 並退出，下輪從已保存游標繼續。不得使用原每步 admission:40 常數冒充新增操作已涵蓋；實作先列舉最多兩階段的 D1／Worker／Vectorize／推論操作，保守共享原子預留每項最壞成本，額度不足時不做追加工作。推論前保存 reservation，輸出保存後才上傳；失敗仍依已知／未知結果分類。每項狀態轉換都受 owner／租約與公開來源／policy 檢查，舊 owner 不得在租約移交後提交游標或提升。

2955段為185批，原流程理想約371輪（約6小時11分，另加供應商等待）；單純移除此空等，理想可接近上傳首批＋185輪讀回／續作，但這是模型估算，不是延遲承諾。用相同16段批次、可讀時序及時鐘，比較原流程與候選的輪次、完成時間、呼叫數與預留數；不以時間推算費用。先完成身分修正的驗收，再評估此最小效率改動是否仍值得，不加入吞吐量服務或擴批。

### 舊版本相容轉換與容量安全

新 identity domain 首次會改 corpus。舊 corpus 不能只修改 activeCorpusId 或把舊清冊標成新版本。沿既有模型／contentHash／revision 完整驗證後重用數值，按照實際 provider 的 ID／namespace 語意遷移，待完整讀回才提升。相同 ID 是否移動、覆寫或佔雙份容量，須在未來獲授權的隔離供應商驗收核實；不把本機替身當證據。

容量以帳戶全部已存、準備中、pending、其他工作及保留版本合計，含讀取／寫入資源；無法證明餘量即停止。2955×1024=3025920維，雙整庫6051840維，不能默認免費容量足夠。優先重用／原位移轉已證明歸屬的 ID；不支援或容量未知就停在新版關鍵字搜尋，另提明確遷移決策，不偷偷複製整庫。只刪清冊證明歸屬且不在當前公開集合的向量；未知資料不刪，不刪當前有效版本來假造容量。

本機實作細化：沿用 operator-written policy JSON，新增可選 syncCapacity（validUntil、otherDimensions），不需D1 migration；缺少／過期證據的舊policy仍可提供既有讀者服務，但新的索引上傳停止。otherDimensions是其他索引、保留及準備中資料的已核實上界，本索引由describe總數涵蓋，將本批全部段落（含重用）再加一次作最壞複製容量。此欄位只能在另獲授權後依全帳戶證據填寫，不能由本機預設0套用正式環境。這是既有「未知容量停止」契約的資料表示，不改驗收條件或provider設定。成本是每個upload前一次describe及少量policy檢查；比新增全帳戶後台掃描服務更小，並以缺證／過期／其他用量／複製語意acceptance驗證。

## Implementation Contract

- 穩定身分：corpusId 維持64位hex，來源透過 loadDiscovery／buildPublicDiscovery 產出；來源內容投影相同、只有產製時間或 sourceTree 不同時，corpusId 相同，且已完成索引的後續輪次零 embedding／upsert／policy 更新，未完輪次不歸零。
- 真正變更：revision、公開集合、公開日期、閱讀連結、topics／series、別名／抽取設定改變時生成不同身分；新的當期關鍵字搜尋立即排除撤回資料，舊 semantic 不得服務為新版本。
- 續作：沿用 synchronizeIndex 的 no_change／busy／uploaded／verified／awaiting_readback／quota_exceeded／capacity_exceeded／source_changed／blocked／promoted 可觀察狀態。新增同輪續作由既有收據 detail 記錄本輪讀回段數與新上傳段數，不增加獨立監控服務或原始查詢記錄。
- 不變 rebuild 保留游標／pending；真變更且存在任何 pending 時先 source_changed 並保留，不能帶舊結果進新版本。reserved／UNKNOWN_INFERENCE 保留扣額且不自動重播；已保存輸出只允許同目標冪等上傳／核對。無 pending 的真變更才安全初始化新目標，舊清冊仍需相容性核實。
- 少讀、數值／修訂／namespace不合即不前進／不提升；暫時上傳失敗可續用已保存輸出，owner過期即停止後續變更。中斷後只能從已提交且已確認狀態恢復。
- 零付費超額、共享原子預留、未知不退額、證據到期／停用即停止、完整讀回及公開來源最終重查是硬邊界。不可用提高 cron 或略過讀回達標。

## Verification and Evidence

不新增測試層。具體缺口是現有「同輸入」測試沒有經過兩個還原時間的真實快照路徑，以及每輪只做一階段的狀態契約。延伸既有 corpus／assets acceptance 與 cloud-sync／runtime acceptance；本機使用固定時鐘、離線來源和既有 D1／provider 替身，無真實推論成本，維護成本是少量既有情境擴充。單純測 hash 字串或 mock 次數不足，須驗證公開結果、身分、續作、扣額與提升結果。先 acceptance RED，再視純投影邏輯與資料庫邊界拆 unit／integration，避免三層重複同一情境。

| 階段 | 驗證與界線 |
| --- | --- |
| 本機 TDD | 規格每項情境對照既有 acceptance case；先保存可重現失敗，再 GREEN。固定兩個時間通過 restoreCompletedSnapshot 到 discovery 的來源路徑；表格變動只改一項資料，驗證應變／不變。離線驗證併發、pending、期限與容量邊界。 |
| Local Preflight／PR CI | 未來實作讀取當時 required gate；目前基線為 pnpm test、pnpm check、pnpm build:all、pnpm release:dry-run、pnpm editorial:rehearse。受影響完整本機 gate 通過才可依新授權推送；不重跑已含於彙總的單項。CI失敗先讀log並本機重現；此次不執行產品測試、不推送。 |
| 供應商 | 另獲授權後核對當期免費方案／證據期限、全帳戶容量、真實 ID／namespace遷移、保存輸出續作及全量讀回，與本機替身分開；paidOverage0是政策，不能冒充帳單實收。 |
| 自然排程 | 經另外核准的新文章公開後，只觀察已部署 cron，從新 manifest、首次收據、每批新／重用／pending與預留、完整讀回、最後來源檢查、promotion到自然no_change串起完整證據；不得前景同步／手動補段／切換。發生人工介入就分類為混合完成，保留失敗原因，12.2不算通過。 |
| 真實搜尋與人工 | 正式同步完成後另依授權執行真實semantic查詢及瀏覽器／手機操作，確認新文可找到、舊修訂／撤回文不出現、降級／恢復與閱讀連結正確；查詢本身占共享額度。人工相關性判斷與API／UI結果各自記錄，零樣本不稱通過。 |

## Risks / Trade-offs

- 投影漏掉可搜尋欄位 → 用明確欄位表與單欄變動情境保護，新增欄位時檢視identity domain；不修改 sourceRevision 原義。
- 同 corpus 不同追溯資產 → 每次按 manifest descriptor／digest驗證，來源競態時安全退出；不可取消資產雜湊。
- 增加同輪工作會超時或低估D1額度 → 每輪最多兩階段、每階段先守衛與最壞成本預留，餘額／時間不足即保存退出；最便宜替代是只交付身分修正，效率單獨採納。
- 供應商讀回仍慢 → 等待狀態立即退出，不忙等、不推論重播；改善僅去除可避免排程等待。

## Migration Plan

未來另獲授權後：先完整本機與CI，讀回舊manifest／policy／pending／lease／配額與全部歸屬清冊；先驗收相容Worker再發布新身分Pages，兩者過渡期間保留當期關鍵字搜尋。遇未知pending先停止並人工釐清，不能強制清空。轉換沿單一租約續作且完整讀回後條件提升；觀察自然no_change與真實搜尋。穩定身分修正及效率改動分別保留可審查diff與驗證證據。

回復須另獲授權：保留當前公開文章／關鍵字，必要時停語意；不回滾到包含撤回內容的舊站，不補滿扣額、不刪未知pending。可以撤回效率改動而保留穩定身分；不可用舊hash重新宣稱新索引相容。若介面實測要求schema／D1 migration，先 ingest補規格與驗收並取得授權，不在apply即興改契約。

## Open Questions

無阻礙提案的需求歧義。待外部驗收核實項目為當期容量、namespace／ID語意與供應商等待分布；核實前均走停止／關鍵字降級，不預設成功。這些不是本次外部操作授權。

## 完整本機 gate 修正（２０２６－１０－２４追加授權）

使用者明確授權定位及修復舊output型別與Hermes復原阻礙，仍不碰正式runtime或部署。舊腳本保留，結果陣列改用明確QueryResult型別，avg僅接受三種數值指標key，移除另一腳本未使用的import；不改tsconfig、不排除output、不執行歷史評估腳本。原始內容與SHA保存在本change evidence，避免改寫其原證據。

Profile顯示一次fresh recovery呼叫83次reject_write_acl，每次都啟動隔離Python子程序，合計佔約4.65／4.81秒；舊10秒總期限沒有反映多次完整authority驗證的重複啟動成本。保留30秒ACL子程序上限及10秒acceptance；把同一validate的固定節點清單合併為一個子程序，沿用NativeACLInventory逐節點完整檢查，整批共用同一deadline；不跨validate快取、不刪權限檢查。safe單節點及recursive payload檢查沿用同一有界執行器。原有非Darwin模式／owner檢查保留；Darwin子程序另核對同批節點的owner／mode／symlink，避免批次化接受parent過時metadata。

具體風險是重複spawn令崩潰復原超過既有期限；替代方案調高timeout或跳過ACL均不採用。延伸既有Python unittest，用150ms受控spawn成本重現原期限失敗，再驗證真實native ACL、晚出現寫權、metadata競態、逾時回收及全部崩潰階段。成本是小幅既有模組整理與少量情境，沒有新服務、依賴、workflow或測試層。正式權限、原ACL規則、秘密、timer及通知均不變。

追加影響檔案：scripts/hermes/update_entry.py、scripts/hermes/test_update_entry.py、scripts/hermes/test_acl_inventory.py，以及兩份仍保留於output的歷史腳本。此修正不改已封存Hermes規格或原正式驗收紀錄，另保留本機candidate證據。


## First-principles architecture repair (2026-10-26 candidate)

This section supersedes the historical per-corpus physical namespace and full reread-on-every-release decisions for the new local candidate. Production remains paused on the old code. Scope is the existing search Worker/D1 and existing tests; no queues, new services, model or limit changes, publishing changes or production writes.

### Release-independent verified vector objects

A vector is an embedding of a passage under one model configuration. A public release is a set of eligible passage identities and retrieval metadata, not a physical vector partition. Use SHA-256(modelConfig) as the stable namespace. Existing passage IDs remain intact. Add namespace and metadataHash to the verified ledger; hash the complete canonical provider metadata. Reuse only a proof matching article, revision, text hash, model, namespace and metadata hash. The runtime owns vector mutations; external mutation invalidates these proofs and requires reconciliation. A periodic full audit is distinct from ordinary delta synchronization and is still required for this acceptance.

Derive remaining work from desired passages minus matching proofs rather than a positional cursor. The cursor becomes a count of proven current objects for operator visibility. Delete only owned obsolete entries, confirm absence, then require exact membership and current proofs before promotion. A changed public manifest already causes source/active mismatch before reader inference. Preserve that barrier through final source checking; do not compensate for inactive vectors with overfetch or post-filtering alone. This intentionally accepts keyword-only operation while a delta is unfinished.

Legacy rows have empty new proof fields. They are not trusted as stable objects: perform the existing bounded provider ownership/value check, reuse compatible model output, upload to the stable namespace and fully verify it once. This is an explicit additive schema transition, not a permanent dual execution mode. Unknown ownership and inference still stop. Full migration costs and capacity are prerequisites for a later production plan; no operator relabeling or automatic migration of unresolved pending rows.

### Durable provider visibility and quota scheduling

Add mutationId, nextAttemptAt and readbackAttempts to the single durable sync state. Save upload acknowledgement with pending stage in one transaction. Read provider describe status before getByIds; compare the opaque mutation identifier for equality, never order UUIDs or infer completion from elapsed time. Single writer/single pending batch means another last-processed identifier cannot prove this mutation completed. Once reported processed, perform full existing value/namespace/metadata checks. Persist readback delay min(30 minutes, 1 minute * 2^attempts) after incomplete visibility; do not sleep in an execution. Retry state is authoritative across worker restarts. A missing acknowledgement retains embedded output for existing idempotent upload recovery; unknown inference remains non-replayable.

Quota denial stores nextAttemptAt at next UTC midnight. Existing cron returns waiting before that point and resumes only if original evidence remains eligible. Daily limits are never refilled. The 500 embedding-passage/request allocation and conservative 500 vector-operation allocation remain separate existing resources with unchanged shared atomic admission. Avoidable operation amplification is removed before any reconsideration of those limits. Official queried/stored dimensions and account snapshots remain a separate production guard, not inferred from these counters.

## Implementation Contract — architecture candidate

- Add migration 0005_vector_proofs.sql without rewriting historical migrations, receipts, reservations or payloads. New fields default to empty/zero; unresolved legacy payloads cannot silently switch namespace.
- synchronizeIndex plans a delta by matching durable proofs against the verified public manifest. No provider operations for unchanged proofs. One pending batch, batch <=16, lease and deadlines remain.
- runtime query uses the stable model namespace only after current public/active identity matches. A namespace migration is a coordinated Worker/D1 transition, never an activeCorpusId edit.
- Prove nineteen-only work over a 2,955-passage baseline, metadata invalidation, withdrawals, legacy transition, waiting across invocations, quota rollover and existing unknown/lease/source safety with the existing cloud-sync/cloud-runtime/semantic acceptance suites. No new testing layer or dependency.
- Extend the existing complete local gates once the candidate is complete. Record local, provider, natural and human evidence separately. Tasks 4.2 and 4.3 remain unchecked.
- Migration/rollback: deploy only after a separate production authorization and fresh full account/pending/free-capacity audit. Preserve current pending rows and reservations; reconcile their original target/namespace before activating the new worker. Old worker cannot serve a migrated stable namespace: rollback means INDEX_SYNC false and keyword fallback, not restoring the old worker over migrated state. Never replay inference or copy a second full corpus without verified capacity.

The added proof/wait fields buy delta-sized work and restart-safe waiting; maintenance cost is one additive migration plus existing state-machine tests. Raising limits, a local chat loop, fixed sleeps and a new queue service were rejected because they do not remove the identity error or supply provider completion evidence. The retained ledger is trusted between controlled mutations; detecting arbitrary out-of-band tampering still requires an explicit audit.
