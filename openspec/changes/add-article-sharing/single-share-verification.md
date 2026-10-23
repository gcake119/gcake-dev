# 單一 SVG 分享按鈕修訂（２０２６－１０－２３）

使用者要求只保留「分享文章」並使用 SVG，另明確選擇不支援／失敗時顯示完整網址手動複製。本修訂取代原雙按鈕與剪貼簿政策；原 spec 已保存於 `history/copy-and-share/spec.md`，原測試證據及完成任務保留為上一輪紀錄。更新 spec/Gherkin 後才追加 revision tasks，未修改已完成任務的歷史敘述。

## 結果

- 基底目前為 `ee21bab5c17f57a6f363b78dd4e8846802987716`，與第一輪不同；本聊天未執行 commit／push，既有其他工作的 dirty 在開始時已消失，未重置或處理其內容。測試針對目前工作區執行。
- 正文尾端只保留「SVG＋分享文章」一個按鈕。SVG 沿用 Icon.astro、icon-paths.ts，24×24、currentColor、1.7 stroke、aria-hidden，不重複朗讀；文字仍可見。
- 不支援時隱藏無法使用的操作，顯示「此瀏覽器不支援分享，請手動複製下方連結」及唯讀完整網址。非取消錯誤顯示「無法開啟分享，請手動複製下方連結」與網址。無 JavaScript 同樣可手動選取。
- 已移除剪貼簿讀寫；取消中性、完成不宣稱發文、操作期間防重複、乾淨正式閱讀網址與原標題、canonical／OG／原文連結政策維持。

## 驗證

- RED：`revision-rendered-red.log` 記錄舊版仍存在１個複製按鈕而非０的真正斷言失敗。`revision-red.log` 另保留舊控制器依賴已移除 copy 元素造成的失敗；該輪 DOM node 差異輸出卡住，已精準停止 PID 80803／80805，未以逾時當產品證據。將斷言改用節點數量後單獨取得上述 RED。
- 公開 aggregate：執行 package.json 的同一條 `test:public` 指令，１００／１００通過，含新版５項 DOM 行為驗收。原複製行為案例因使用者移除功能而被新合約案例取代，沒有 skip。
- Content validation：０ errors／warnings。Astro build：５２頁通過。
- 建置 HTML：`node --import tsx --test test/article-sharing.rendered.test.ts`，１／１；仍遍歷所有建置文章，涵蓋單一操作、SVG 裝飾語意、唯一位置、可選取網址及來源所有權。
- Scoped Astro check：７０檔，０ errors／warnings／hints。完整 check 的上一輪既有 output 型別錯誤仍是未解限制，本輪沒有修改正式設定或把 scoped check 當完整 gate。
- `pnpm` 啟動器本輪因無法寫入受保護鎖檔而失敗，未安裝／升級依賴；使用已安裝的 CLI `node node_modules/astro/bin/astro.mjs build`／`check --tsconfig output/article-sharing/check-scope.json`，以及 `node --import tsx scripts/content/validate-series.ts` 執行相同產品命令。最初嘗試的舊 Astro CLI 路徑不存在，已依套件 bin 修正；只有後續成功命令作為 GREEN。
- Browser：`output/playwright/article-sharing/revision-verify.mjs`，Chrome 155.0.8059.86，３篇×１２８０／３９０×明暗主題，共１２組通過。核對單一可見 SVG 分享、鍵盤 Tab／Enter、焦點、４４px、無溢出、正確標題與乾淨網址。分享取消／錯誤與不支援使用明確 capability doubles；完整網址經實際鍵盤選取，no-JavaScript 通過。首輪測試因同一文件的舊 payload 殘留而失敗，改成每組獨立載入文件後通過，產品碼未為此變動。
- 已檢視手機暗色截圖；截圖及結果為 `output/playwright/article-sharing/revision-*.png`、`revision-result.json`。日誌為 `output/article-sharing/revision-*.log`。
- Spectra validate 通過；analyze 僅建議補 Example，沒有 Critical／Warning。`git diff --check` 通過。

## 預覽及未驗證範圍

沿用本聊天擁有的 `127.0.0.1:4397` 預覽與 listener PID 15965，更新建置後以真實瀏覽器重新讀取並驗證新版。網址：<http://127.0.0.1:4397/gcake-dev/posts/ai-agent-development-workflow/>。停止前先用 `lsof -nP -iTCP:4397 -sTCP:LISTEN` 核對歸屬，再執行 `kill -TERM 15965`。

原生系統選單的真實開啟與取消、社群接收、部署及使用者人工確認仍未驗證，task 3.2 保持未完成；不以此次瀏覽器替身補成通過。未提交、推送、部署或對外發文。

## 使用者確認與按鈕文案更新

使用者於２０２６－１０－２３回報實際點擊已正確彈出系統分享選單：記為使用者提供的選單開啟證據，未延伸推定已取消、已發送或平台接收。隨後採用「分享這篇文章」；已同步元件、目前規格與設計文件。`label-red.log` 記錄舊文字斷言失敗；更新後 DOM＋建置文章檢查６／６通過，建置５２頁、Spectra validate、diff check 通過。原 listener 提供的 HTML 已確認含 SVG 及新文字。沒有重新操作或發送原生分享，未提交、推送或部署。
