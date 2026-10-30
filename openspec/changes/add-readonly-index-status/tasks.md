## 1. 驗收先行與來源核對

- [x] 1.1 重新核對目前搜尋來源、正式runtime pin、dirty歸屬與 ADR-001，確認 Same Worker read-only route 不碰現有同步／搜尋／500額度／期限；以本變更decision context及差異審閱保存結果。
- [x] 1.2 依已完成Gherkin先新增真實失敗acceptance，涵蓋 Independently authorized read-only observation、Minimal coherent and bounded status、Observation failures remain explicit and non-mutating；同時涵蓋 Owner restricted admin observation 的未登入／非owner／到期／缺設定與token不外洩；以未實作端點的404／缺少契約造成RED，保存測試輸出，不以mock setup失敗代替行為失敗。
- [x] 1.3 先新增monitor真實失敗acceptance，涵蓋 Incremental retained receipt continuity、Public source alignment and honest progress、Waiting and blocking states remain distinguishable、Completion candidate does not replace acceptance、Bounded monitoring and safe credential lifecycle；同時先以 Accessible graphical progress without fabricated completion 驗證304/2995=10.1%、2994/2995=99.9%、0/0、未知／錯誤／舊值及滿條未驗收，再以 Honest and bounded admin progress display 驗證unknown total、失敗保留時間、隱藏停輪詢與競態；用可控HTTPS／來源／時鐘邊界證明gap、逾時、來源異動與錯誤完成判定的RED。

## 2. 唯讀服務與監測客戶端

- [x] 2.1 實作 Independent expiring monitor credential，以獨立token與有效期保護GET，錯誤授權在讀取前返回404，兩種token不可互用；以acceptance確認過期、缺設定、相同token、過長輸入及同步路徑拒絕，補純比較／時間邊界unit並驗證GREEN。
- [x] 2.2 實作 Coherent bounded status and receipts，以固定單一SELECT與安全欄位產生schemaVersion=1摘要、部署版本與1至50筆安全收據；以SQLite fixture integration驗證並行寫入快照、retention／高水位／分頁、原始敏感值不外洩及64KiB上限，並由acceptance驗證400／404／503、no-store、無D1寫入、無UTC window建立與零AI／Vectorize呼叫。
- [x] 2.3 完成 Same Worker read-only route 接線與平台版本綁定、型別更新；以既有搜尋／自然同步回歸證明路由、原flags與Cron契約未變，監測失敗不阻止既有服務；不新增全域required secret造成未啟用環境部署失敗。
- [x] 2.4 實作 Monitor evidence and completion candidate 的固定origin客戶端，使用Keychain讀取token且不落log／argv；依public digest取得總數、每頁原子保存checkpoint與0600證據，30秒／10頁／不重試限制；以acceptance與必要分類unit驗證等待、stale、gap、版本改變、來源改變及兩筆60秒no_change只產生候選。
- [x] 2.5 將新acceptance接入既有測試入口，記錄一次狀態查詢的query plan、rows_read、response bytes與耗時，核對96次摘要／日及backlog規劃上界；以現有完整gate驗證，不新增CI workflow或額外測試層，不據此聲稱官方費用節省。

- [x] 2.6 實作 Owner authenticated admin panel 的owner session唯讀代理，固定上游host與伺服器token，驗證schema與當期來源digest總數；以Admin Worker acceptance證明未授權／缺設定零上游、無秘密外洩／無發布與同步寫入、上游失敗及來源異動標unknown。
- [x] 2.7 依 Graphical progress follows existing admin standards 在發布管理加入具可及標籤的原生進度條、段數與百分比，沿用 docs/design-system.md 字級／間距／按鈕與雙主題；具5分鐘可見刷新、10秒手動間隔、取消競態與帶時間的舊資料提示；以既有Vue狀態測試及瀏覽器量測桌面／390px雙主題4組、320px邊界／200%縮放／鍵盤／讀屏值及實際字級間距控制尺寸、缺驗收不顯示搜尋正常，無新E2E平台。

## 3. 文件與本機交付

- [x] 3.1 先在 docs/design-system.md 補共用進度條規則及既有字級／間距／元件引用（明示未實作），再在runbook與 ADR-001／決策索引記錄僅讀觀測、Keychain安全配置／輪替／到期、部署與回復順序、Dashboard備援及實際驗收界線；以文件審閱確認不改舊歷史或4.2／4.3完成狀態，所有未部署項清楚標為候選。
- [x] 3.2 完成並保存 pnpm test、pnpm check、pnpm build:all、pnpm release:dry-run、pnpm editorial:rehearse、Spectra validate及analyze結果；只在影響碼／依賴／設定變化時重跑已驗證項，保留所有RED與失敗，不自動提交或部署。

## 4. 另獲正式操作授權後的整合與啟用

- [ ] 4.1 取得本變更Git操作授權後，僅提交必要來源／規格，PR必要檢查通過後按授權合併並核對exact main CI；用PR diff、head／base、checks與main證據驗證，原其他dirty保留。
- [ ] 4.2 取得secret／正式部署授權後，證明Keychain可在無人輪次讀取、30日內token到期與原origin／runtime pin正確；安全配置搜尋Worker與Admin Worker新secret，按Migration Plan分別部署搜尋Worker、Admin Worker與Admin前端並核對三者產物，讀回程式、flags／Cron／bindings及舊secret保留；實際GET確認安全摘要、舊token拒絕、provider資料無監測寫入及無推論，結果未知先對帳不重送。
- [ ] 4.3 取得既有追蹤啟用授權後，將既有automation改接新client，每15分鐘安靜追蹤；以兩個自然監測輪次與一次受控錯誤憑證測試確認進度、checkpoint、告警去重及失敗不改雲端。全量候選後依原授權做獨立provider audit與最多6次搜尋／瀏覽器驗證，無管理權限時明示audit blocked；若未到候選則保留待驗收，不自勾人工相關性或新文章自然驗收。


## 本機查詢量測限制

2.5的測試接線、query plan／bytes／一次耗時與完整本機gate已執行；官方rows_read不由node:sqlite提供，記為null並保留未完成，待後續正式smoke。4.1至4.3均不在本輪授權內；不得為完成任務自行提交、部署或啟用。

本輪追加授權已涵蓋4.1至4.3，依檢查與正式驗收逐項執行；2.5已取得正式D1單次rows_read=3022、rows_written=0，原本機null限制與歷史紀錄保留。
