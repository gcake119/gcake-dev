# 雲端語意索引恢復（２０２６－１０－３０）

## 本次授權與範圍

使用者先確認重新核實免費方案與容量、部署已驗證的搜尋架構修補、執行0005必要遷移，再恢復原Cron；其後明確選擇「授權提交、PR、檢查後合併」。只處理本change的搜尋程式／驗收／必要規格，原工作目錄的後台、Substack、Hermes及其他dirty修改保留。

不變：BGE-M3 plain／1024維、requests500、vectorQueries500、paidOverage0、原billing證據期限及每分鐘Cron。不發文、不改排程、不寄送、不部署Pages／Admin／Hermes，不手動同步或promotion。首次轉換會由原Cron逐批核實舊向量；不把舊清冊直接填proof，也不把此轉換當任務4.2的真正新文章全程自然驗收。

## 候選與驗證

三份搜尋程式、一份additive migration及兩份驗收測試的SHA-256與10/26本機架構候選完全一致；釘選值見[evidence摘要](evidence/architecture-repair-20261026/summary.json)。最新main基底為4cad4e45d02dfd4ffc5792a0bb06536d4db9a890，新增CI與發布測試後，完整pnpm test、check、build:all、release:dry-run、editorial:rehearse全部通過；Spectra validate通過、analyze零發現。見[當期gate摘要](evidence/production-resume-20261030/local-gates.json)。

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
