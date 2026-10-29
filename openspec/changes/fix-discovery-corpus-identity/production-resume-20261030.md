# 雲端語意索引恢復（２０２６－１０－３０）

目前狀態：已恢復同步開關；舊向量轉換由原Cron自然續作，完整公開corpus與人工搜尋驗收尚未完成。以下保留準備階段、失敗及正式結果的時間界線。

## 本次授權與範圍

使用者先確認重新核實免費方案與容量、部署已驗證的搜尋架構修補、執行0005必要遷移，再恢復原Cron；其後明確選擇「授權提交、PR、檢查後合併」。只處理本change的搜尋程式／驗收／必要規格，原工作目錄的後台、Substack、Hermes及其他dirty修改保留。

不變：BGE-M3 plain／1024維、requests500、vectorQueries500、paidOverage0、原billing證據期限及每分鐘Cron。不發文、不改排程、不寄送、不部署Pages／Admin／Hermes，不手動同步或promotion。首次轉換會由原Cron逐批核實舊向量；不把舊清冊直接填proof，也不把此轉換當任務4.2的真正新文章全程自然驗收。

## 候選與驗證

初始提交的三份搜尋程式、一份additive migration及兩份驗收測試SHA-256與10/26本機架構候選完全一致；釘選值見[evidence摘要](evidence/architecture-repair-20261026/summary.json)。最新main基底為4cad4e45d02dfd4ffc5792a0bb06536d4db9a890，新增CI與發布測試後，完整pnpm test、check、build:all、release:dry-run、editorial:rehearse全部通過；Spectra validate通過、analyze零發現。見[當期gate摘要](evidence/production-resume-20261030/local-gates.json)。

原基底0b60f766的各項本機gate已通過，兩個首次失敗來自隔離快照缺Git根／HEAD，補齊臨時fixture的Git環境後原測試通過，沒有弱化斷言；原失敗保留。這些不是新main的CI證據。Wrangler4.142.0 dry-run產物47.18KiB、SEMANTIC=true／INDEX_SYNC=false。正式部署前還須PR與main CI及最新provider guard。

## 已完成的唯讀準備（不是正式遷移收據）

Cloudflare後台顯示原帳戶Workers Free／US$0／目前方案。帳戶V1索引空、V2唯一，provider完整分頁2960個唯一ID與D1清冊一致；pending0、owner空lease0。當期公開manifest三資產hash通過，共38篇／2995段；2960筆舊清冊的文章／修訂／文字hash均與當期來源一致，缺35段。既有3031040維、完整當期3066880維，其他索引維度實測0。正式恢復前須重新核對並限時寫入capacity證據，這份歷史準備不能自動續期。

第一次D1清冊讀取fetch failed已保留並停止依賴；匿名連線、獨立whoami、單次SELECT1及新的完整清冊查核成功後才繼續唯讀準備。失敗根因仍未知，不能把後來成功當初次自然全通過。

從實際schema建立的本機SQLite套用0005後，2960筆舊資料完全保留；僅新增vectors.namespace／metadataHash及sync.mutationId／nextAttemptAt／readbackAttempts五欄，舊proof保持空白。所有現場查核D1陳述均零寫入。完整原始紀錄保留於原工作目錄的`output/discovery/index-resume-20261030/`，未提交secret、查詢、IP、向量值或憑證。

## 正式操作順序與回復

PR檢查通過後合併並確認main CI，重新釘選Worker來源。維持INDEX_SYNC=false，核對租約／pending／來源、備份去secret的policy與必要清冊／扣額／schema證據，再只套用0005並獨立讀回，證明原rows、receipts、reservations與window未改寫。部署相容Worker時保留原bindings、runtime及SEMANTIC=true；缺activeVectorNamespace時須維持關鍵字降級。

當期全帳戶容量、ID歸屬與免費方案通過後，以原policy精確比對條件，只更新syncCapacity（有效期最多24h且不超過原billing期限），不補日window或額度、不改activeCorpusId。最後恢復INDEX_SYNC=true並獨立核對正式版本／程式／設定及原Cron。只觀察自然輪次，保存連續收據／預留／pending／租約與進度；跨日由runtime自然續作。

遇未知推論、來源衝突、陌生向量、scope不明或新連線未知結果，停止依賴、保留證據，不重播、不退款、不清pending。必要時只停同步；若語意版本有疑義再停語意，維持當期公開關鍵字。不把舊Worker恢復到已轉換stable namespace的配置上。

完整同步、獨立全量provider audit、兩筆間隔至少60秒的自然no_change、真實搜尋與人工相關性各自另列證據；本次開關恢復不直接勾選4.2／4.3或原12.2。


## PR83審查修正：撤回後恢復的實體證明

PR審查指出：owned向量已刪除、但等待下輪確認不存在時仍保留完整proof；若文章此時恢復公開，可誤以為向量仍存在而promotion或no_change。依既有exact-membership／撤回續作／讀者降級契約，四個acceptance案例先真實RED，涵蓋刪除完成／刪除回應遺失及恢復原集合／恢復時另新增文章。另保存讀者端到達source_initial而未由policy阻擋的RED。

修正於刪除前，在原policy及owner／lease條件下撤銷activeVectorNamespace與該批metadataHash；保留文章、修訂、內容hash及namespace作owned清理／重用依據。只有同一目標已完成的狀態可走no_change捷徑。失聯或重新公開都須完整重驗，promotion後才恢復讀者資格。沒有補滿額度、刪owned清冊或改驗收條件。兩個既有no_change fixture補齊其聲稱的已完成同步狀態，原零推論及每日budget斷言保留。

多出的成本限於owned刪除路徑的兩項條件式D1更新及一次既有guard，仍在原每輪admission40控制預留內；一般新增／no_change不增加provider讀寫、不增加逐分鐘全量掃描。沒有新服務、依賴、測試層或migration。四個修正案例GREEN；受影響專案完整本機gate五項全部通過，見[修正驗證摘要](evidence/production-resume-20261030/review-proof-invalidation.json)。此修正更新sync與acceptance候選hash，初始候選與原RED收據保留，不改稱初次通過。


## 正式結果（台北１０／３０凌晨）

[PR83](https://github.com/gcake119/gcake-dev/pull/83)已正常合併為main `b3e2d50f71f8b5428ca6fba696974fcc7b376ccd`，其tree與受測head `e352578`完全相同。[PR CI](https://github.com/gcake119/gcake-dev/actions/runs/40917567917)及[exact main CI](https://github.com/gcake119/gcake-dev/actions/runs/40918690173)均在原Mint runner成功。前段runner離線／排隊已保存；runner其後自行恢復，本次沒有更動主機服務、CI路由、保護或強制合併。

只套用0005，獨立讀回證明原2960清冊、4227收據、6496預留、sync舊欄位、policy與windows完全保留；所有新proof仍空白。因正式migration登錄只有0001／0002、但0003／0004 schema已存在，本次使用只含0005的遷移目錄，未重跑或補造歷史登錄。

先以同步停用部署版本350af749-9e6a-4b20-bd02-4e3900a5d71d；從provider重新下載程式，逐位元等於已釘選bundle（SHA-256 `4ccbf39c407744fdc487f047b59cba8f655fe88b5035553bc911b0b1a6405058`），所有bindings／runtime／原Cron相同。容量更新只改syncCapacity，原每日500／paidOverage0／billing與扣額保留，證據有效至UTC2026-10-30T17:21:49.667084Z，即台北10/31 01:21:49。

容量寫入首次checked判為invalid JSON，因固定Wrangler --file import在完整JSON前輸出進度文字。原validated=false結果未改寫，未重送寫入；完整JSON後綴顯示一個查詢／一列寫入，獨立全JSON零寫入讀回證明唯一變更為syncCapacity，之後才恢復。這是已對帳結果，不把首次格式失敗改稱自然成功。

最後以相同bundle恢復同步，正式版本540fe715-0270-4560-b538-f5791e6e417b、100%流量；唯一binding差異是INDEX_SYNC_ENABLED=false→true，SEMANTIC=true／每分鐘Cron／runtime與逐位元程式均保留。

自然收據4228開始首批16段重用／上傳，4229／4230等待provider mutation處理，4231確認首批16段並同輪上傳下一批16段。觀察於UTC17:29:23，cursor16／2995、pending16 uploaded、owner空lease0；當UTC日window由runtime建立一次，requests仍500、vectorQueries剩497，未手工建補額度。從安全checkpoint4217完整續讀無缺號；這些自然輪次尚無新embedding。未觸發internal同步、補段或promotion，未發文／寄送或改其他排程。

[正式摘要](evidence/production-resume-20261030/production-receipt.json)保存讀回、預留、容量與新收據範圍。作用中corpus仍是舊版本，activeVectorNamespace尚未設定，讀者維持當期關鍵字降級；不能宣稱2995段完整同步、兩次新版本no_change、真實語意API／手機／人工相關性或4.2／4.3／原12.2完成。原大檔及失敗保留於本次原工作目錄output，沒有提交secret、query、IP或向量值。
