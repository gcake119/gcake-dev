## 1. 身分修正：先 acceptance RED

提案時以下全部待授權；２０２６－１０－２４使用者已授權本機tasks1–3的實作及驗證，正式tasks4仍未授權。完成狀態依勾選與本機驗證收據判定。規格情境已先完成；每個本機任務控制在約一小時內，較長的自然觀察獨立等待，不增加排程。不得修改既有 build-article-discovery-knowledge 的1.1與12.2完成狀態。

- [x] 1.1 為 Stable search content identity 建立真實 failing acceptance：延伸 test/discovery/corpus.acceptance.test.ts 與 test/discovery/assets.acceptance.test.ts，以同一離線完結快照／釘選manifest，在兩固定時間走還原及discovery組裝路徑，確認搜尋身分相同、追溯可不同、已同步零enrichment、未完成不歸零；保存候選SHA／diff及失敗原因，確保失敗來自行為而非fixture錯誤。
- [x] 1.2 為 Effective source changes invalidate identity 建立 acceptance 變動表：正文、標題／描述、URL／canonical、公開日期／資格、topics／series、別名／抽取設定各自變動會失效；未跨資格時鐘與無序鍵順序不失效；涵蓋撤回與空集合。執行既有 corpus／assets acceptance，確認原有通過情境持續保護且新增缺陷有可保存RED。
- [x] 1.3 交付「穩定內容身分與獨立追溯」：在 src/lib/discovery/site.ts 與 src/lib/discovery/build.ts 分離有版本白名單內容投影與完整快照／建置追溯，不破壞manifest與資產hash驗證；以1.1／1.2測試GREEN及來源混合下載拒絕證明。只在投影純邏輯有獨立邊界時補unit，不複製整份acceptance。

## 2. 續作效率：再 acceptance RED 與最小改動

- [x] 2.1 為 Bounded verified continuation 延伸 test/discovery/cloud-sync.acceptance.test.ts，先證明可讀pending後同輪最多再上傳一批、最後部分批次可提升的RED；加入不完整讀回、剩餘時間／額度不足即保存退出、source最終變更不提升的驗收，固定16段批次及可讀時序，保存基線輪次與呼叫／預留計數。
- [x] 2.2 為 Durable safe resumption and free-only admission 延伸既有 cloud-sync／cloud-runtime acceptance：驗證同身分重建保留pending、真版本變動有／無pending、單租約競爭、失去owner、中斷未知推論不重播、已存輸出遇暫時上傳錯誤可恢復、讀者與同步爭最後額度、期限／停用；用可觀察狀態、消耗與提升結果驗證，新增不受既有測試保護的行為先保存RED。
- [x] 2.3 交付「完整讀回後同輪有界續作」：修改 apps/search-worker/src/sync.ts，在既有45秒期限內最多讀回一批＋準備一批，新上傳等下輪讀回，不改cron／batch16；先列舉最多兩階段最壞D1／Worker／Vectorize／推論成本並共享原子預留，再增加工作。以2.1／2.2 GREEN、超時退出與不足預留零額外provider操作證明；必要D1原子邊界延伸既有integration，不新增測試層。
- [x] 2.4 在同來源、16段、相同時鐘／provider可讀序列比較原版與候選，證明已讀回後不強制空等一輪且所有安全斷言保持；報告輪次、總時間、provider操作數、資源預留及等待分布，不把本機時間或371輪理想估算當正式延遲／節費證據。若穩定身分已解決主要問題且續作成本不值，先取得範圍修訂再省略，不默默刪任務。

## 3. 轉換與完整本機驗證

- [x] 3.1 為 Capacity-safe legacy identity transition 及「舊版本相容轉換與容量安全」建立並通過離線acceptance：舊身份一次性轉換必須完整核對，所有已存／準備／pending／保留／其他用量合計，容量不足／未知、向量歸屬未知即停止；實測替身同ID移動／覆寫／複製三種語意，均不得未讀回就提升或假定雙整庫免費，報告僅本機證據。
- [x] 3.2 整理每項Gherkin到既有acceptance的對照與RED／GREEN收據，完成當時受影響專案完整Local Preflight；目前基線為pnpm test、pnpm check、pnpm build:all、pnpm release:dry-run、pnpm editorial:rehearse，彙總已含單項不重跑。執行spectra validate及analyze並記錄限制；尚未獲准不得commit／push／PR。CI若後續失敗先讀log、本機重現修正再完整gate，不反覆推送試錯。
- [x] 3.3 回填原ADR-001、決策索引及既有操作文件的同輪有界續作、舊版本轉換、容量核實與回復界線，不變更模型、免費上限、期限、開關或歷史驗收。內容審查須與本spec一致、保留原change未完成事項，並驗證文件連結與Spectra，形成可審查本機候選。

- [x] 3.4 交付 Complete local gate without weakened authority checks：先以原10秒期限及150ms ACL子程序啟動成本取得復原acceptance RED；合併單次authority節點檢查並保留每節點ACL／owner／mode與期限，驗證晚出現寫權、metadata變動及逾時child回收。保留舊output原檔備份並修正明確型別，原目錄完整gate須通過，不改timeout、斷言、排除或正式runtime。

## 4. 另獲明確授權後的正式驗收

- [x] 4.1 為 Separate local and unattended acceptance evidence 準備具體候選部署／遷移清單，取得當次外部操作授權後才執行：釘選實作／CI／Worker與Pages版本、當期免費證據／全帳戶容量、pending／lease／配額、真實ID／namespace語意及完整provider讀回；不能只改activeCorpusId、補滿額度或複製雙整庫。保存部署與provider證據，失敗維持當期關鍵字；若需migration或破壞相容先補規格及授權。
- [ ] 4.2 在另外核准的真實新文章成功公開後，只觀察既有自然cron，串接manifest、首批偵測、全部新／重用段與預留、pending、完整讀回、最終來源檢查、promotion及自然no_change；記錄起訖、延遲分布、樣本數與中斷。前景同步、人工補段或切換即標混合完成、不關閉原12.2；缺證或額度不足即保存原因，另行規劃後續自然機會，不重播未知結果。
- [ ] 4.3 另依當次授權執行真實semantic API與瀏覽器／手機驗收，確認新文章、修訂／撤回排除、關鍵字降級／恢復、閱讀連結，並取得獨立人工相關性回報；查詢計入共享額度，報告本機、CI、部署、provider、自然排程與人工各自結果。只有4.2完整自然鏈與本項證據俱足才評估原12.2可否依原條件結案，歷史1.1不回補為已完成。


## 5. First-principles architecture repair (2026-10-26 local authorization)

Production remains paused. These tasks do not convert the interrupted old-code run into new-architecture natural acceptance. Preserve every completed historical task and other worktree modification.

- [x] 5.1 Specify Release-independent verified vector objects and Durable provider visibility and quota scheduling; save real failing acceptance for delta-only provider work, durable visibility waiting and autonomous UTC rollover, retaining real metadata-revision invalidation regression in the existing cloud-sync suite.
- [x] 5.2 Implement Release-independent verified vector objects with additive proof migration, delta planning, stable query namespace, exact-membership promotion and owned withdrawal handling; verify nineteen additions leave 2,955 proven objects untouched, legacy transition and source/lease/unknown safety in existing acceptance suites.
- [x] 5.3 Implement Durable provider visibility and quota scheduling with persisted mutation acknowledgement, bounded readback scheduling and next-UTC quota continuation; verify early ticks spend no vector reads and a restart resumes without foreground commands or inference replay.
- [x] 5.4 Complete affected local gates and spectra validate/analyze, document migration costs, rollback and remaining production/human evidence in architecture-repair-20261026.md and ADR-001. Preserve current production pause and 500/zero-paid-overage policies; no commit, push, deployment or production migration.


## 6. Authorized production resumption (2026-10-30)

The user authorized capacity verification, additive migration, compatible Worker deployment and original Cron restoration, then explicitly authorized scoped commits, PR and merge after checks. Preserve the 500 limits, zero paid overage, historical evidence and unrelated dirty files. No Pages/Admin/Hermes deployment or publication is included.

- [x] 6.1 Pin the six architecture candidate files on current main and complete the existing local gate, retaining original environment failures and corrected evidence without weakening tests.
- [ ] 6.2 Commit only search implementation and necessary specification/evidence, pass PR CI, merge after checks and verify main CI for the deployment source.
- [ ] 6.3 With synchronization disabled, recheck account Free/capacity, ownership/pending/lease and source; apply only 0005, verify all original state and reservations unchanged, deploy the compatible Worker and independently read back source/settings.
- [ ] 6.4 Update only freshly proven capacity evidence under exact policy guards, restore the original Cron switch, and capture natural progress or a concrete stop reason without manual synchronization, promotion or quota refill; distinguish switch restoration from full corpus/human acceptance.
