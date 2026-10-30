# 本機實作與驗證紀錄（２０２６－１０－３０）

## 範圍與狀態

使用者授權實作與本機驗證，明確不提交或部署。實作位於隔離worktree；原專案其他dirty檔案保留。來源基底880d844與已上線搜尋修補相容；本輪沒有讀寫正式Cloudflare、模型、向量、Keychain或automation設定。正式觀測pin540fe715只作上次交付來源參考，不冒稱本輪已重新核實。

- 已實作：獨立到期monitor授權、單SELECT一致安全快照、增量收據、固定origin客戶端／0600證據與checkpoint／公開三資產digest cache、owner後台代理、發布管理圖形化進度條、原刷新與停止語意。
- 段數與百分比向下保留一位；未知／空集合／換版／不一致／等待／滿條待確認／失敗舊值各自呈現；不把滿條或候選標為語意搜尋驗收通過。
- 無新依賴、資料表、雲端排程、CI或付費設定。必要共用契約與來源reader放既有admin-contract套件；Admin實際設定路徑為wrangler.toml，為規劃的locator修正，不改驗收條件。

## 真實失敗與修復

原始輸出皆位於本實作worktree的output/discovery/index-status-local/，保留且不覆寫；完整根目錄為 /Users/caiyijun/.codex/worktrees/restore-semantic-index-20261030/gcake-dev/。

- endpoint-red.log：未接線前，既有搜尋入口未回傳200狀態契約；endpoint-green.log驗證修補後的授權與安全快照。
- consumers-red.log：後台route404、進度比例缺失與monitor unavailable是實際行為RED；分別接線後GREEN。其他既有／支援測試如實屬回歸或追加覆蓋，不冒稱每一條均在實作前失敗。
- cache-red.log／cache-green.log：跨程序公開資產cache未保存造成RED，加入digest重驗／原子保存後GREEN。
- baseline-red.log／baseline-green.log：首次retention基準原先被當unknown，改為明確initial_baseline，不宣稱缺失歷史完整。
- utc-red.log／utc-green.log：日期缺UTC時間原先被接受；現拒絕且D1零讀取。
- browser-first-failure.log與後續diagnosis：QA入口硬編碼Vue預編譯URL，元件內部state已更新而DOM未更新。改由Vite正常解析入口，未改產品行為遷就harness。
- focus-ring-red.log：app的overflow clip裁切既有7px焦點外框；局部使用既有8px token預留空間後幾何驗證通過。
- full-gates/test.log：首次完整test的Vue工作流程fixture未隔離新子元件，Node直接載入.vue而失敗。沿用既有ReleaseQueuePanel／SubstackStatusPanel隔離方式加入IndexStatusPanel，不弱化既有斷言；workflow-fixture-green.log的38項全部通過。

## 本機畫面與功能證據

browser/metrics.json：1280、390、320px各light／dark共6組。實際量測h2=20px、數字17px、橫條12px高／5px圓角、數字至橫條12px、橫條至狀態16px、按鈕至少44px（實測約48.6px）、焦點外框空間8px。驗證文字對比至少4.5、橫條對比至少3、零頁面水平溢出、200%縮放、鍵盤焦點、progress可及名稱、unknown無aria-valuenow、滿條pending不報搜尋正常與503後保留上次資料。瀏覽器9次本機mock API，對外網路0，全部測試瀏覽器與暫時Vite均由同腳本finally關閉。這不是正式平台／實機手機／真人讀屏或獨立人工品質驗收。

截圖包含測試範例304／2995與2099到期日，均非正式最新進度或實際憑證期限。正式畫面仍未部署。

query-measure.json：單次本機Node SQLite記憶體查詢，2995 proof rows，記錄query plan、原始摘要bytes與耗時。沒有D1官方rows_read欄位，明確記null；它不可從耗時或query plan推論，任務2.5此部分保留，待獲授權的正式smoke取得，不聲稱官方費用節省。

## 完整gate與版本

最後候選hash見final-candidate-hashes.json；121份來源／測試／設定再次比對全部一致。最終 pnpm test（198.79秒）、check、build:all、release:dry-run、editorial:rehearse 五項全部exit0，結果見final-gates/results.json。Spectra validate通過，analyze零發現。之前失敗與修正後分段結果分別保留，不把原失敗改成成功。

## 尚未執行

任務4.1至4.3（Git、secret／部署、正式接線）均未執行；automation-3保持暫停。真實Keychain無人讀取、Cloudflare rows_read／獨立provider全量audit／正式語意API與瀏覽器／真人相關性均未驗證。本機mock不取代這些證據，也不勾原4.2／4.3或12.2，不archive本change。


## 收尾

本次暫時Vite／測試瀏覽器已由同支腳本關閉，六項借用依賴路徑已精準移除；沒有建立Docker。程式、規格與證據保留於本worktree，無commit／push／部署／正式secret／追蹤啟用。Spectra進度11／15：2.5的官方rows_read部分與4.1至4.3保留未完成；本機功能與完整gate已完成，preflight clean。


## PR85 審查修正與部署準備

本輪使用者已另授權提交、PR、檢查後合併、部署、監測憑證與正式驗收及恢復追蹤，取代前輪僅本機的執行範圍。c6edf47建立PR85；審查指出兩個P2，已各由實際驗收RED重現：後台不能以未追歷史的gap阻擋最新收據完成候選，及visibility切換不能繞過五分鐘自動讀取限制。修正保留monitor完整歷史檢查，只讓後台依原規格評估最新收據；自動讀取deadline跨隱藏持續保存。review-red.log及review-green.log保留兩項失敗與12項GREEN。

新候選完整test通過；首次check因本次建立的基底比對快照位於output下、被Astro當來源而失敗。已先保存完整來源壓縮、比對輸出與原始失敗，再精準移除本次快照後接續check與其餘gate，未改tsconfig排除或弱化測試。

正式Admin Worker c5c0ba17相對main多出既有即時發布通知修補；只替換publication-monitor-summary.ts的本機比對快照，排除來源路徑註解後與正式bundle完全一致。未直接部署會回退此行為的候選；是否將已部署修補另立相依PR整合，已交使用者決定。其他dirty來源保留。


修正版本機test與後續check、build:all、release:dry-run、editorial:rehearse均通過，見review-gates及review-gates-resumed；兩個審查thread的修正案例均GREEN。正式D1與狀態端點相同SELECT單次量測rows_read=3022、rows_written=0、D1 duration約16.65ms、原始snapshot約3917bytes，樣本數1，不宣稱官方帳單或節省費用。

## 正式 owner 讀取未通過與平台相容修補

搜尋唯讀入口２００、錯誤及無資格４０４，專用 Keychain 無互動讀取成功；後台程式與三份前端資產讀回吻合，匿名 API 為４０１。但 owner 實測仍回５０３，未將畫面或4.2標為通過。Cloudflare 官方要求同區域 Worker 的 global fetch 使用 global_fetch_strictly_public；正式 Admin 缺少此設定，因此補最小相容旗標，保留日期與所有業務開關、既有 secret 及路由。未捕捉到上游原始錯誤碼，不宣稱已觀察１０４２。既有 bindings 平台設定契約先失敗，再以完整本機與 PR／main CI 驗證，正式 owner 成功仍另驗。

平台旗標修補的既有 bindings／owner proxy 針對性測試與完整 pnpm test、check、build:all、release:dry-run、editorial:rehearse 均通過，Spectra validate／analyze 無問題。這仍是本機與候選證據，待 PR／main CI 及正式 owner 讀取成功才完成4.2。
