# 本機實作交接（２０２６－１０－２１）

狀態：６／１５項完成，尚未完整驗收，不可宣稱 release ready。沒有部署、建立遠端資源、呼叫模型、啟用 runtime／排程、修改正式 Substack 設定，亦沒有 commit／push／merge／archive。

## 已完成的單位

- １．２：公開來源入口、來源命名空間、HTML／段落擷取、MDX 診斷、修訂與內容雜湊快取。
- １．３：沿既有網站建置重算文章庫及關聯、固定公開資格時間、改名／撤回／刪除、舊陣列索引相容、資產版本與雜湊。
- １．４：有來源的詞彙與明確縮寫、中文／技術符號處理，無依據不展開，不改原文或官方分類。
- ２．１：正文引用與反向連結、去重與自我引用排除、安全外部參考，推薦不冒充引用。
- ２．４：兩個文章模板、搜尋頁與既有導覽 GET 入口，篩選／分頁／分享／返回、重試、無 JavaScript 入口、２００字限制、安全高亮與手機雙主題。
- ３．１：獨立且預設關閉的公開 Worker 契約、固定來源 manifest／資產驗證、目前版本 allowlist、RRF 合併、暫時 BGE-M3 唯一例外及拒絕未核實替代模型。

其餘任務保留未勾選：１．１的全情境先失敗 fixtures 與真實４０題不完整；２．２推薦實用品質、２．３完整 held-out 檢索品質及２．５完整 gate 尚未通過。３．２、３．３、４．１、４．２、４．３已有部分本機介面／fixture，但整體驗收、較完整的用量與版本生命週期整合仍未完成。不能把未授權的 provider 啟用稱為已完成，也不把它當成停止既有本機工作的理由。

## 實際驗證

探索功能的 Node 驗收為３８／３８通過。保留初次１１項失敗、後續詞頻／詞彙、快取、壓縮、逐詞推薦證據及逾時後不得開始下一次遠端查詢的 red 紀錄。這不是全部４８情境皆已在實作前建立獨立紅測試的宣告；逐情境對照見 `acceptance-map.md`。

實際建置有３３篇公開文章、２，６３３個段落；`pnpm discovery:inspect` 核對資產 SHA-256、所有段落的文章修訂及真實標題錨點。首次關鍵字資產包括索引與段落，合計４１６，３７８ bytes gzip，低於５００KiB；這是本次建置大小，不是網路計費或普遍效能承諾。

Chrome 在 `/gcake-dev` 基底路徑通過桌面１２８０px、手機３９０／３２０px、明暗主題與兩種文章模板。包含原生 GET、篩選／返回／分頁、載入失敗重試、４２９降級、取消舊請求、安全文字呈現、鍵盤及無 JavaScript 入口。實際離站請求計數為零；兩次語意請求由本機 Playwright route 攔截，沒有到達模型。`result.json` 保存實際 corpusId。

這版 Astro 在 agent 環境會預設背景化；早期測試留下的精確 PID／port 已核對並停止。最終 harness 使用 `--ignore-lock`、專用臨時埠、自己的程序群組與 finally 清理；正常結束確認 listener 已關閉，沒有 Docker 或文章 fixture 殘留。截圖與量測保留於 `output/playwright/discovery/`，不是獨立人工作品接受。

## 完整 gate 與失敗紀錄

- `pnpm check`：交付來源通過，０ errors／warnings／hints。
- `pnpm build:all`：公開站及所有工作區建置通過。
- `pnpm test`：前一輪 aggregate 通過；最新 aggregate 在既有 distribution 第１４３項失敗，該組２８９／２９０通過。失敗為執行器逾時 fixture 的 PID 檔案未出現（ENOENT）；保持原測試及執行器來源與 HEAD 一致，單項重現通過，尚未證明穩定根因。完整 gate 維持未通過，不把單項重跑當成修復。
- `pnpm release:dry-run`：最初一次公開讀回停在 awaiting-verification；加上只讀診斷、保持原斷言後通過，原始指令亦通過。初次失敗未穩定重現，保留限制，沒有宣稱已修復正式發布流程。
- `pnpm editorial:rehearse`：通過可拋棄的本機演練。
- 最初沙箱內的 socket／Chrome 權限失敗有保留；後續以核准的本機測試權限執行，沒有削弱檢查。

自動審查曾拒絕把新增的詞彙測試從「排除無關詞」改成「只要求排序」。該命令未執行；最終保留原斷言，透過來源標題／章節及反覆正文證據修正擷取。沒有以放寬驗收取得通過。

## 資料與品質缺口

真實文章中沒有足夠「完整詞＝縮寫」的明確定義，當期自動詞義庫為０組；不補造１０組同義詞。４０個評測位置中３０題有固定來源判斷，１０題同義詞仍待來源。使用者目前要求白話解釋，尚未授權改寫原品質門檻。

已觀察的１５題回歸題目，各只指定一篇應命中的文章，其中１４題在前五名命中該目標；這是有限標註下的回歸命中，不是完整相關文章集合的檢索品質。此題組已被看過，也不包含缺少的５題同義詞 held-out，不能稱為完整品質通過。保留原題組與修正版本的來源鏈，不更改預期文章來湊通過率。

２０組推薦面板逐顯示詞驗證來源段落。修正了一個「兩個理由詞只保留第一詞段落」的實際缺陷。機械來源有效不代表理由有用；例如「都會、幾乎」等敘事詞仍顯示出品質不足，相關與延伸閱讀的８０％實用關聯門檻尚未接受。

真實 BGE 品質、實際１０２４維輸出、tokenizer／直接端點輸入上限、帳戶免費及強制零超額證據、實際 D1／Vectorize、provider 隱私、正式讀回、啟用與人工驗收均未完成。遠端保持關閉。

精確來源雜湊、候選 corpusId、測試與 gate 狀態見 `local-candidate-20261021.json`。本次之前既有的 distribution 文件、其他規劃歸檔與 canonical specs 變更均未混入本工作的完成宣告。

## ２０２６－１０－２１補充：依使用者指示先萃取公開文章

本節取代前述「當期詞義庫０組、３０題／缺１０題」作為最新狀態；先前數字保留為歷史結果。使用者已授權從公開文章先萃取資料再繼續，沒有要求修改原驗收門檻。

逐篇檢視現有３３篇公開文章及２，６３３個段落，先掃描括號、定義語句及技術詞，再人工檢視上下文。保存１０筆逐字原文記錄：１筆明確中英名稱對照，另９筆為概念解釋。這是釘選公開文章庫的檢視，沒有把其他外站教材或常識全名補成作者原文。詳見 `public-terminology-extraction-20261021.md` 及 `test/discovery/public-terminology-review.json`。

採用「系統層級的理解（system-level understanding）」作為既有設計允許的附來源校正。每筆校正保存原文、來源修訂與審閱者；未公開、修訂改變、引句不符或名稱未出現在引句內時不生效。校正資料進入設定及 corpus 雜湊；與自動縮寫相同，歧義不展開。這不是獨立人工作品接受。

新增測試先得到 `0 !== 1` 的真實失敗，再實作；相同測試與探索功能測試共３９項通過。校正表、實際建置索引及來源段落一致；`pnpm check` 與 `pnpm build:all` 通過。評測報表原先把待補數寫死１０，使用 v5 得到實際失敗後改為依題目狀態計數；重新讀回為３１題有來源、９題待補、releaseQualityGate 仍為 INCOMPLETE。

v5 在此次評測之前保存，保留舊題組已觀察狀態、全部既有預期文章及舊版本；新中英題放在 tuning，沒有把既有已觀察題改稱全新 held-out。完整４０題／２０題 held-out 品質仍未完成，不能因有限目標文章回歸命中而宣告門檻通過。

最新 corpusId 為 `b66c9191798652d4f2ef33536d2adb1020fd2a72b23ab41c3409be8ca19256e0`，所有資產 digest 及段落錨點通過，索引加段落 gzip 共４１６，４９６ bytes。既有 Chrome suite 對此 corpus 通過，確認自有 localhost 伺服器已關閉；沙箱內初次無法監聽 localhost，改用已核准的本機瀏覽器測試權限完成，未改斷言。

沒有重跑未變動的完整 aggregate 來覆蓋先前 distribution 逾時 fixture 的未解失敗；完整 gate 仍未通過。其他未完成任務、推薦實用品質與遠端啟用門檻維持原狀，沒有額外勾選 task、commit、push、部署、排程或 provider 呼叫。本輪精確檔案與結果見 `local-candidate-terminology-20261021.json`。

## ２０２６－１０－２１最新決策：評測隨來源成長，不設資料配額

使用者明確指示「這些資料會隨著文章增加而增加，不用硬設門檻」。本節取代先前「缺９題、固定４０題及檢索／推薦百分比阻擋」的現行要求；歷史資料與數字不改寫。proposal、design、未完成 tasks 及 public-article-knowledge spec 已同步，新增 sparse／growing／empty 三個 Given／When／Then，完整情境索引現為５１個。已完成的 task 保留，沒有藉本次規格調整勾選其他未完成任務。

當期凍結工具從公開文章產生標題與明確詞義的預期命中題目；歷史中文／改寫題只在來源修訂及證據相符時沿用。`retrieval-judgments-current.json` 不預留空白名額、不要求固定比例，既有 v1 至 v5 保留。評測涵蓋所有當期推薦面板，不要求固定面板數；指標作觀察，零資料回傳 NO_JUDGED_DATA 與 null 指標，不判成通過或失敗。文章增加後，下一次實際建置與凍結評測即可累積資料，沒有新增背景排程。

新驗收先在空文章庫得到舊工具硬找 day-01 的真實失敗；實作後同一測試實際執行凍結及評測 CLI，走過空庫、單篇、加入縮寫文章、撤回縮寫文章。探索套件４０項全數通過，Spectra analyze 零 findings、validate 通過、diff whitespace 檢查通過。

對現有３３篇／１筆詞義重新凍結，得到５４題（３３標題、１０中文、１詞義、１０改寫），沒有缺額狀態。這是當期資料量，不是新門檻；題目只標記已知應命中的文章，不是所有相關文章的完整標註。全部作回歸觀察，沒有新 held-out 宣告或 provider 品質宣告。

本輪只改評測工具、驗收及規格／操作文件，公開站 runtime 與建置資產內容未變；沿用先前同 corpus 的建置及瀏覽器證據，不重複跑未改變的檢查。整體既有未解完整測試失敗仍保留，沒有宣稱完整交付或啟用；來源有效性、可見性、實際錯誤修正、遠端零付費及啟用授權維持。


## ２０２６－１０－２１：剩餘本機實作與完整 gate

使用者授權完成剩餘本機實作與驗證，明確禁止部署／遠端模型啟用。完成敘事詞排除、無支持理由不產生推薦、英文縮寫字界、瀏覽器載入原子交接及不合法遠端結果降級；規則與 stop-list 內容進入 corpus 設定。保留當期來源、正文、分類與 canonical。

語意服務補上完整額度鍵／有限上限、未知執行結果保留預約、過期證據與零費率證明、D1 原子 reservation 不得超過授權 policy、請求本文未結束時 deadline 主動取消，以及既有 provider timeout 之後不得開始下一次操作。測試只用離線 policy、替身與 SQLite；default Worker、公開 endpoint、bindings、正式排程保持原停用狀態。

索引演練串接實際 corpus builder、stageRelease、read-after-write、確認部署與 promoteRelease、SearchService 及目前靜態搜尋；覆蓋新增、修改、改名、撤回、發布失敗、選用索引失敗及舊向量拒絕。未變正文只嵌入一次，模型／維度入快取鍵；空白設定、NaN／無限容量、無效／零向量被拒絕。文章與查詢模型設定或維度不一致不得切換。這是離線邏輯驗收，沒有真實 provider 接線或執行。

瀏覽器新增成功語意結果、分頁、篩選／返回、輸入零遠端請求、４０９／４２９／５０３降級、惡意遠端標題／網址的來源重接及無生成 endpoint。最終 corpus 的３２０／３９０px 雙主題截圖已實際讀取，沿用１２８０px 與兩種文章模板。`Actual article connection component` 使用現有 Astro compiler／Container 編譯真實元件，注入公開文章 fixture，確認空群組不輸出 section／h2／details、非空連結與引用可用且標題跳脫，不新增依賴或 CI。

完整 gate：`pnpm test`、`pnpm check`、`pnpm build:all`、`pnpm release:dry-run`、`pnpm editorial:rehearse` 均通過。完整測試公開站階段後新增的元件驗收，另以受影響的 `pnpm test:public` 完整測試組補驗通過；其餘來源未再更動，不重複未變動 aggregate。Spectra analyze／validate 及 diff whitespace 通過。

最終完整測試前再次重現既有 distribution 訊號 fixture 的 PID 檔案未建立失敗。原斷言與 production executeComputerUse 不改；增加失敗診斷，單獨２９０項通過，但不足以斷言 OS 或負載根因。將只需測訊號的 fixture 從 Node 啟動改為 shell 內建指令，仍忽略 TERM 並寫入 receipt，保留１５００ms timeout、強制終止及 PID 回收斷言。額外敏感度實驗僅抑制自有程序群組的 SIGKILL，證明 fixture 仍存活、原清理斷言能抓出缺失，finally 恢復與精準清理。此後完整 gate 通過；不能把它說成修復正式 Substack 執行器。

當期３３篇、２，６３３段、１筆有來源詞義，５４題觀察性評測。所有３３篇推薦面板／１９８個位置已核對來源，詳見 recommendation-review-20261021.md；理由仍可能寬泛，不宣稱模型品質或讀者偏好。全部資產及真實錨點核對通過，gzip 合計４１６，４１９ bytes。

Chrome 本機 CPU ４倍節流、３２０px、無網路限速，５次冷載入及２０次暖查詢均有有效結果／零錯誤；暖查詢 p95 約１６．３ms，冷載入 p95 約１４２．６ms。這是共享主機的單輪觀察，限制包含本機 HTTP、快取與 CPU profile；不推論真實手機、provider、效能改善或費用節省。量測前可見１６個可用邏輯核心、load average 約１２；沒有停止其他人的程序。原始樣本見 latency.json。

任務目前１２／１５完成。１．１保留早期未全部逐情境先紅後綠的歷史限制；３．３／４．３保留真實 provider、帳戶與正式接線／部署／啟用驗收。這些不是尚未實作的離線搜尋功能，不以本機假資料補成完成。精確候選、來源雜湊與 gate 結果見 local-candidate-final-20261021.json。沒有 Git commit／push／merge／archive，沒有付費、遠端模型、部署、通知或正式排程變更。所有自有 preview／fixture／敏感度程序及暫存目錄均確認清理。


## ２０２６－１０－２１新增授權：Ollama BGE-M3／EmbeddingGemma 2 本機比較

使用者先授權本機 Ollama BGE-M3，再明確加入 `embeddinggemma-2:latest` 比較。已先同步 proposal／spec／design／tasks 及 Given／When／Then，使用既有 Node runner 驗證 loopback、精確 installed digest、模型各自格式、禁止截斷、非有限／空向量拒絕、模型與 corpus 空間隔離；沒有修改 Cloudflare BGE-only 允許清單、零額度或公開頁面空 endpoint。

本機服務原已運作、兩模型原已安裝，不下載、不重啟／停止服務。HTTP 服務版本０．４０．６；metadata 分別為 BGE-M3 GGUF/F16、Gemma 2 safetensors/MLX/NVFP4。Gemma 2 metadata 的 hidden embedding length 與 projection 輸出不是同一欄位，實際 API 已觀察並驗證 BGE １０２４／Gemma 2 ７６８維，不憑欄位名稱猜測。

在第一次推論前釘選當期３３篇、２６３３段、５４題與２個模型 digest、原文輸入格式、服務／硬體及 source digests。完整計算２份隔離索引、沒有既有向量快取；５４題加１０題無關查詢逐題交錯兩模型順序，再以同題５次／模型交錯觀察暖查詢。４６８次成功 embedding 推論請求，０次失敗；每模型６４筆 query rows。另以 embedding 空輸入釋放本次載入的２個模型，沒有 chat／generate／pull 或雲端請求。完成後 `/api/ps` 空清單，原服務保留。

Python 獨立重新計算目標文章前５名命中、核對所有排名身分及引用段落修訂，並驗證全部５２６６個向量檔案的長度、有限值與單位長度。BGE-M3 的純向量／混合各５４／５４，Gemma 2 純向量５２／５４、混合５３／５４；關鍵字基準５３／５４。兩者１０題改寫皆在前５名，３３精確標題混合排名皆第一。模型排名不同的原題目與來源都保留，沒有事後更改預期文章。亂碼１０題兩模型皆回傳真實近鄰，沒有把它們宣告成無結果偵測通過。這些是有限、已觀察的標註；不稱為普遍準確率、新 held-out 或正式 provider 接受。

同題暖查詢中位數約３７．４／３８．０ms（各５次，範圍重疊），不能判定速度勝負。２個 runner／量化不同，不是純模型權重比較。完整冷索引單輪約５３．３／６４．７秒、純 float32 向量約１０．３／７．７MiB；不推論費用節省或真實手機速度。完整比較見 ollama-comparison-20261021.md。

型別檢查先發現 runner 的 readonly tuple 索引註記缺漏；實測當時來源已保存，再以 TypeScript transpile 驗證修正後 JavaScript 完全相同，未重複模型推論。證據副本最初使用 .ts 副檔名而被 Astro check 納入，改存 .ts.txt；不修改 tsconfig、不忽略真正的來源錯誤。原失敗與修正後檢查紀錄均保留。完整 `pnpm test` 與８２項公開站測試通過，最終型別檢查另外確認。公開站 build／瀏覽器及發布演練所依賴的 runtime 來源未變，沿用上一候選相同雜湊的證據，不為 CLI 比較重跑模型或發布。

本次新增本機實驗任務５．１／５．２，完成後整體１４／１７；原３項的歷史／Cloudflare／正式接線限制仍保留。未部署、未切換正式模型、未建立資源、未 commit／push／merge／archive、未更改 Substack 或正式排程。精確來源、結果、核驗及 gate 見 local-ollama-candidate-20261021.json。


## 已確認設計的本機實作收尾（２０２６－１０－２１）

本機範圍已實作完成。搜尋頁沿用使用者明確接受的精簡緊湊版：單一搜尋框、結果數量與文章列表；前景本機 BGE-M3 接線、關鍵字降級、分頁及錯誤復原保留。此輪核對後沒有發現待補的本機功能；修正操作文件仍要求選擇模式、注入說明文字的舊描述，並把 proposal/design 的現行介面敘述同步到已確認版本。歷史完成任務與先前執行收據保留。

目前工作目錄的完整 `pnpm test`、`pnpm check`、`pnpm build:all`、`pnpm release:dry-run`、`pnpm editorial:rehearse` 通過，未降低任何既有 gate。發布乾跑首次在 sandbox 因本機 listen EPERM 失敗，保留原紀錄後於允許自有 loopback listener 的環境通過；不是忽略失敗。乾跑與編輯演練均為隔離副本／模擬介面，不是正式發布。建置產物重新檢查：３３篇、２６３３段、全部資產 digest 與段落 anchor 一致；公開 endpoint 仍空白，實際 default Worker function 回傳５０３，無外部連線。Spectra validate 通過、analyze 無 findings、git diff --check 通過。

最新 Computer Use 的頁面來源、搜尋 client 與已接受間距 CSS 分別對應其原收據 digest，來源沒有再改，不重複瀏覽器或模型推論。完整 BGE/Gemma 比較與本機 BGE 頁面實測保留為先前本機證據，這輪沒有新增推論，不宣稱重新執行過模型或雲端驗收。

開始前保存所有受版控及非忽略未追蹤來源雜湊；結束時只修改本次 runbook 與 active change 文件，既有其他 WIP 保持原樣。整體２１／２４完成；１．１為無法回補的歷史紅測試證據，３．３／４．３仍保留實際帳戶、免費／無超額、Cloudflare 接線、部署與啟用驗收，不因本機完成而改稱已通過。沒有 commit、push、merge、archive、部署或雲端模型啟用。


## 審查３項修正完成（２０２６－１０－２１）

版本衝突不再回用已撤回文章、預覽每次獨立保留收據、重複正規化閱讀網址明確拒絕。６個新驗收先紅後綠，針對性３３項與完整本機 gate 通過；實際 Chrome 更新索引與兩次前景啟停通過，額外修正管線 stdin 清理。已確認的搜尋頁與間距雜湊未變，雲端維持停用，沒有推論或部署。詳見 review-fixes-20261021.md 與 review-fixes-candidate-20261021.json。整體２４／２７，原歷史與遠端３項保留。


## 文章搜尋獨立提交前驗證（２０２６－１０－２１）

使用者另行授權只提交文章搜尋相關工作，不推送、部署或啟用雲端。提交集合為９２份搜尋程式、測試、規格與設計／操作文件；排除 Substack 封存與正式規格變更、Hermes 變更，以及先前全 gate 排查時修改的 distribution 訊號 fixture。後者雖被 task 追蹤記錄列入，仍不屬本次功能提交。

從 Git 暫存內容匯出獨立副本，Substack／Hermes／distribution fixture 使用 HEAD 的原版，沒有納入工作目錄的其他進行中修改。副本的 pnpm test（含９２項公開站測試）、pnpm check（２５９檔，零錯誤／警告／提示）、pnpm build:all、pnpm release:dry-run、pnpm editorial:rehearse、discovery inspect 全部通過。既有 distribution fixture 此輪在原版即通過，不改寫先前失敗的歷史紀錄，也不把這次成功解讀為已修復其不穩定根因。

副本仍為３３篇／２６３３段，corpusId、全部資產 digest 及閱讀錨點與前次本機候選一致；搜尋程式與已確認間距未變，沿用同來源的瀏覽器、Computer Use 與本機模型證據，不重新推論。只同步 docs/design-system.md 的舊篩選描述至已接受的最小介面，未新增產品決策或更改畫面。此段驗證文件在執行後補記，不影響已測 runtime。

完整提交清單與隔離 gate logs 位於忽略的 output/discovery/commit-search-20261021/；臨時副本已清理，沒有正式寫入或通知。原１．１／３．３／４．３保持未完成，不 archive，不以提交宣稱正式發布或雲端驗收。


## 正式靜態搜尋已部署與驗收（２０２６－１０－２１）

PR ＃５０已合併，main f488015 的 CI 與既有 Pages 部署均成功；正式 manifest 與全部搜尋資料／HTML 和本次產物逐位元組一致。實際桌面 AI 搜尋２４篇、手機「測試」１１篇，分頁／返回、開原文、空結果、３２０／３９０px 雙主題無溢出均已驗證。來源、正式 corpus、資產雜湊、CI／部署連結與可攜截圖見 production-acceptance-20261021.md／json。正式 endpoint 仍空白，沒有模型推論或雲端啟用。

此紀錄更新先前「只有本機候選」的當期狀態，不回寫舊執行紀錄。任務仍２４／２７：１．１保留歷史先紅後綠證據限制；３．３／４．３保留雲端帳戶、模型、費用／零超額、接線及語意 release 驗收。原已完成任務與規格／Gherkin 不變，本輪只回填文件，未重新部署、執行模型、commit、push 或 archive。
