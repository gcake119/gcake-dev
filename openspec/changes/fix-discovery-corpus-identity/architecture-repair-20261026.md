# 差異同步架構修補（２０２６－１０－２６，本機候選）

本輪依使用者「從第一性原理修補架構」授權完成本機規格、實作與驗證。不是只增加 quota、改等待秒數或新增例外開關。正式環境尚未遷移／部署；４．２／４．３仍未完成。

## 根因與資料責任

舊流程把 corpusId 同時當公開集合版本與物理 namespace，因此新增１９段也要將２，９５５個未變向量重新讀取／上傳／讀回；每分鐘未見資料便再讀，最後用盡的是 vectorQueries500，並非 requests500。先前正式停止紀錄仍在 原站與搜尋恢復紀錄（`editorial-release-recovery-20261026.md`，原工作目錄保留的歷史證據），原始收據及扣額不改寫。

| 責任 | 修補後權威 | 可觀察行為 |
| --- | --- | --- |
| 公開資格、修訂、文章集合 | 已核 hash 的公開 manifest／corpus | 讀者只接受與已完成索引一致的當期版本 |
| 物理向量所在位置 | SHA-256(modelConfig) namespace | 加文章不搬移整庫；不混用模型 |
| 已完整核實的段落 | D1 ledger 的 articleId／revision／contentHash／modelConfig／namespace／metadataHash | 全部相符才跨 release 重用 proof，未變段零 provider 讀寫 |
| 未完成輸出及 provider 可見性 | pending ＋ mutationId／nextAttemptAt／readbackAttempts | 原 Cron 自行續作，不需要在對話說「繼續」 |
| 每日免費預算 | 既有共享原子 reservation／UTC windows | 不加額、不退款，未知推論不重播 |

不新增服務、佇列、依賴或測試層。沿用每分鐘 Cron、每批１６段、單租約、４５秒輪次、現有來源完整性與版本屏障。變動中的公開版本保留當期關鍵字結果，不用混合索引或擴大 topK 掩蓋召回問題。

## 實作契約

- `0005_vector_proofs.sql` 只新增 proof 與排程狀態欄位，舊列及收據不改寫。namespace／metadataHash 空白的舊列不是可直接重用的新 proof。
- 由公開集合減去已核實 proof 計算差異，不再把位置游標當完成證明；cursor 只是目前核實數。真正修訂（包括會改 sourceRevision 的 metadata）仍使 passageId／proof 失效；本輪沒有修改公開 passageId 契約或新增跨修訂 embedding cache。
- 新／變更段完整核對數值、１０２４維、finite、norm、namespace 與完整 metadata 後才寫 proof。受控寫入以外的外部修改會使 proof 的信任前提失效，須重新對帳；不能把 proof 當任意外部破壞的自動偵測器。
- 撤回只處理已知 owned 向量，provider 確認不存在才移除 ledger。完全對齊後仍須最終公開來源及 policy／lease guard 才提升。
- 同批上傳 acknowledgement 與 pending 狀態持久保存。供應商未報告已處理該 mutation，零 getByIds；已處理仍須完整讀回，不把 acknowledgement 當完成。UUID 只比相等，不排序或以時間推論其已完成。此設計要求該索引由這個排程單一寫入者控制。
- 可見性仍不完整時，下一次讀回依１、２、４、８、１６、３０、３０分鐘持久安排；中間 Cron 輪次不讀向量、不推論，仍保守預留 Worker／D1 控制成本。
- 任一共享 quota 拒絕保留原工作，安排次日 UTC。現有 runtime 只建立新日 window 一次；條款、容量證據過期或人工開關關閉仍不能自動恢復，也不自動延長證據。
- `activeVectorNamespace` 與 activeCorpusId 在同一 promotion 更新。缺少物理 namespace 證明的新讀者回關鍵字降級，不能以舊 activeCorpusId 假裝已遷移。

## 本機證據與有效範圍

原始紀錄：`output/discovery/architecture-repair-20261026/`，可攜摘要與檔案 hash 位於本 change 的 `evidence/architecture-repair-20261026/`。

- 先保存三個實際 RED：缺少獨立物理 proof、provider 尚未處理卻直接 promotion、未持久等待而反覆讀回。不是 fixture 無法啟動造成的 RED。
- 差異案例：２，９５５筆已核實基線，再加入一篇含１９段的新文章。只嵌入／上傳１９段，舊段 provider 讀取０／寫入０，總 getByIds４次、upsert２批；完成 promotion 後兩輪 no_change。這是本機立即可見 fixture 的操作計數，並非真實延遲、帳單或自然收據。
- 真實 builder 的 topics 修訂會改 sourceRevision／passageId；舊 proof 失效並重新核實。測試也覆蓋 owned 撤回、舊 pending 保留、已 active 但尚無物理 proof 的遷移屏障、provider 未處理／可見性延遲／上限３０分鐘、UTC 日界線、quota 不補滿、未知推論、來源／租約／policy 變動。
- 完整 `pnpm test` 通過（其中搜尋８３項）；其後只延伸上述成本／等待保護，最終受影響搜尋套件另行驗證。`pnpm check`、`pnpm build:all`、`pnpm release:dry-run`、`pnpm editorial:rehearse` 通過；最後搜尋控制成本修正另由搜尋 build／驗收覆蓋。不重跑未受影響的通過階段。
- 初次 sandbox 內的 HTTP localhost bind 遭 EPERM；原始失敗保存，取得執行環境核准後原命令通過，未降低斷言。型別檢查另發現兩個保留 output 腳本仍引用已移除暫存 checkout；先保存原始副本，再改為目前專案的相對 import，只修復可編譯引用，未執行或重新產生其歷史品質評分。
- Spectra validate／analyze 結果另存摘要。沒有 CI、正式 provider 或真人相關性新證據；不得標記４．２／４．３完成。

## 正式遷移清單（待另行授權，不由 heartbeat 執行）

１．釘選本機候選及完整 gate 的來源 hash，依原流程取得可部署 artifact／CI。保留所有其他 dirty 修改，不把 Substack／後台改動納入候選。

２．以原先獲准的唯讀程序，重新確認原 account／免費方案、七種資源、billing／capacity 期限、所有索引與 provider IDs、physical／otherDimensions、ledger／pending／owner／lease、公開來源。最後已保存的停止證據為版本 `368d3408-295f-44ce-9b6f-0e6b637a520a`、INDEX_SYNC=false、SEMANTIC=true、cursor2960、pending0；這是１４：３４保存值，不冒稱本輪已重新讀取正式環境。checkpoint4217之後的停止收據仍須完整接續，不跳過4227。

３．維持 INDEX_SYNC=false，備份去 secret 的狀態／policy 及必要完整原始證據，執行新增 migration。獨立確認只新增欄位，原 receipts／reservations／window 扣額／billing／limits／pending 完全保留。若舊 pending 存在，不轉換 payload 的 namespace；先在原收據下對帳，禁止重播未知模型。

４．部署相容的新 Worker 並驗證 bindings／traffic／程式來源，確認缺少 activeVectorNamespace 時安全降級。重新核實容量後才沿原 guard 更新必要且已授權的 capacity 欄位；不更動 limits500、paidOverage0、billing期限或手工補日 window。另依當次授權恢復 INDEX_SYNC，實際工作由原 Cron 完成，不前景 trigger。

５．首次 stable namespace 轉換需要一次完整 provider 核實，不能把舊 ledger 欄位填滿就算遷移。２，９７４段、１６段批次，理想可見時至少１８６批 reuse ＋１８６批 readback，共３７２次 getByIds；獨立全量 audit 按最多２０筆再需１４９次，合計５２１次，已超過單日５００次保守操作預算，還未計讀者／錯誤／其他資源。因此須按當期共享餘額跨日分段，不為遷移提高上限；這只是計畫算式，實際成本以 reservations／收據為準。

６．之後一般新增１９段只需兩批差異，理想可見時四次 getByIds。若另做當次獨立全量 audit，須再預留１４９次；這項一次性驗收不能每分鐘或每日無條件重做。官方查詢／儲存維度與全帳戶共享快照分開核算，應用 vectorQueries 不是官方帳單。

７．完整 provider audit、所有新舊批次與 UTC 額度收據、pending0／owner空lease0、最終來源及兩次相隔至少６０秒的獨立自然 no_change 都需保留。舊架構中斷與新架構轉換分開標示；不把轉換或缺證改稱首次全程自然新文章驗收。４．３真 API／桌面／手機與獨立人工相關性依原授權及最多８個模型請求界線另執行。

## 回復與排程界線

正式候選未獲授權前，不部署、不寫 D1、不移動任何向量、不改正式開關／額度。若正式遷移失敗，維持 INDEX_SYNC=false 與當期關鍵字；不可將舊 Worker 恢復到新物理 namespace 上，也不恢復撤回文章。舊原始向量與未決收據保留，不退款或重播。

本輪嘗試保留完整歷史 prompt 的 heartbeat 更新被 automatic review 拒絕，理由是歷史提示仍含部署／恢復動作。之後改成純唯讀狀態追蹤並成功更新同一 heartbeat：不得執行 CLI／provider／模型、D1／索引／policy 寫入、capacity 續期、部署或恢復。每日頻率與其他 automation 不動；不讓舊提示自行恢復舊流程。
