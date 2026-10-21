# 本機 BGE-M3 搜尋頁 Computer Use 驗收

本輪已將現有建置搜尋頁接到本機 Ollama，並透過 Codex Computer Use 實際操作。僅前景本機預覽，未部署、啟用雲端模型或改動正式 endpoint。基底 HEAD 為 `6ea5c0b47f0551feb8a2381edc841573aa077f58`；包含既有尚未提交的 discovery 實作，完整候選雜湊另見本輪 JSON 收據，不以 HEAD 代替工作目錄版本。

## 實際模型與資料

使用既有 `http://127.0.0.1:11434` Ollama、`bge-m3:latest`，digest `7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab`，１０２４維。文章庫為 `9c7fbc69dc237f25f430acfd1e1f7099f24463d0d4a861a69646435082713b22`，３３篇公開文章、２６３３段；重用先前已驗證的文件向量，文件推論新增０次，查詢推論實際完成９次、失敗０次；另有１次語意請求在暫停狀態回傳５０３，未呼叫模型。這是本輪有限操作證據，沒有重新評分、設定題數門檻或宣稱整體相關性已被人工接受。

## 實際操作與可觀察結果

使用 Computer Use `cua_repl` 的真實 IAB 頁面與原生可存取性控制，不攔截模型回應，不注入搜尋結果。

| 操作 | 實際結果 | 證據 |
| --- | --- | --- |
| 首頁輸入「現場工作 工程問題」並按搜尋 | 關鍵字模式找到１篇 Day 28，當時模型計數０ | 前景 status 收據；既有資料來源 |
| 下拉切換「依意思搜尋」 | 實際 BGE-M3 找到１０篇，第３篇為 Day 12〈原來我在做翻譯〉 | `semantic-ax.txt`、`semantic-desktop.png` |
| 點選 Day 12 搜尋結果 | 跳至同源真實原文及「現場說的是工作」段落 | `source-ax.txt` |
| 瀏覽器返回 | 保留查詢、語意模式與第１頁 | Computer Use 實際返回觀察 |
| 選擇「產品開發」主題 | 剩６篇且每篇有該主題標籤 | `filter-ax.txt` |
| 再選「2026 鐵人賽幕後」系列 | 不符合交叉條件，顯示空結果與清除篩選建議 | `series-empty-ax.txt` |
| 導覽列送出「AI」，再切語意模式 | 找到２４篇，保留 GET 查詢網址 | Computer Use 狀態觀察 |
| 點下一頁再用瀏覽器返回 | 頁碼２與文章清單改變，返回恢復頁碼１ | `page2-ax.txt` |
| 選最新文章 | URL 有 `sort=newest`，文章依發布日期排列 | `newest-ax.txt` |
| 前景終端 pause 後點重試 | 回傳５０３；顯示「依意思搜尋暫時無法使用，已顯示關鍵字結果」，保留２４篇關鍵字結果；模型計數仍８次 | `degraded-ax.txt`、`degraded-desktop.png` |
| resume 後點重試 | 恢復「依意思搜尋結果」，模型完成數由８增至９ | `recovered-ax.txt`、finished 收據 |
| ３９０像素深色／明亮，以及３２０像素明亮版 | 控制項換行，原生下拉可用，未觀察到橫向溢出 | `phone-dark.png`、`phone-light.png`、`phone-320.png` |

上述檔案位於忽略的 `output/discovery/local-preview-20261021/`。手機檢查使用 Computer Use 的暫時 viewport，結束前已 reset，預覽分頁已關閉。圖片是本輪實際畫面；本機程式不保留一般使用者查詢紀錄，這些由 agent 主動保存的測試畫面僅含公開測試詞與文章。

## 接線與界線

前景指令：`node --import tsx scripts/discovery/local-preview.ts --run`。無明確 `--run` 就拒絕啟動 listener；只在 `127.0.0.1` 隨機連接埠提供既有 dist，改寫回應的語意 endpoint 與本機隱私說明。沒有更改磁碟上的公開 HTML。`local-search.ts` 重用既有 lexical／cosine／RRF；請求限４０９６ bytes、１至２００字、每頁１０篇、一次一個模型請求，四秒取消。模型輸出只加入目前文章／段落。未開 generation、下載或模型替代路徑。

比對先前完整候選收據，２４份公開站及 Worker 來源檔均未改變，實際 `dist/search/index.html` 的 `data-semantic` 仍空白；`public-unchanged.json` 保存清單與 HTML digest。先前建置、release dry-run、editorial rehearsal 及離線瀏覽器驗證仍只作其原有責任的證據：本輪不以它們代替實際 Ollama 畫面驗收，也不在相同來源上重做整套建置。新的本機預覽檔與 helper 取消參數由本輪 Node acceptance、型別檢查與實際操作覆蓋。

新 acceptance 最初因尚無實作模組而失敗；修正 fixture 的 base path 後４項測試通過。這不是每個情境獨立先紅後綠的歷史證明。既有１．１歷史限制不改標完成。公開搜尋測試８６項與 `pnpm check` 通過；Spectra validate 通過、analyze 無 findings。完整測試與精準候選證據以本輪 JSON 收據為準。

## 清理

正常 stop 已實測：本次 listener 關閉、９次查詢使用的新載入 BGE-M3 已釋放，`loadedAfter.models` 為空。另以獨立連線確認原連接埠不能再連線，而既有 Ollama `/api/ps` 仍正常且無載入模型。沒有停止／重啟共享 daemon。`finished.json` 與 `cleanup-independent.json` 保存證據。SIGINT／SIGTERM／期限使用相同 cleanup 路徑，本輪未分別觸發；不冒稱三者逐一實測。

本機實作與 agent 操作驗收已完成，不代表使用者已親自接受產品，也不完成原３．３／４．３的 Cloudflare 帳戶、計費／免費、D1／Vectorize、部署讀回與正式啟用。維持不部署、不呼叫雲端模型的使用者界線。
