# 單次人工發布候選與正式差異診斷

2026／10／12：擁有者明確授權今天發布系列第１篇〈我是怎麼跟 ChatGPT 協作寫完 30 篇系列文的〉，沿用同一份 D1 與最新 main，完成 GitHub Pages 及正文、canonical、日期、RSS、系列驗證。第４篇與 Paragraph／Substack 不在本次操作範圍。此文件只記錄候選，文章尚未由本修正發布。

## 接法

CMS 已儲存、ready 且沒有本機編輯的文章可先預覽「立即發布（單次人工）」。預覽不寫 D1 或 Git；main 與畫面已審閱版本不同時要求重新開啟文章。明確確認綁定 preview 的 queue version／source revision，D1 以 CAS 留下 manual 身分、真正操作時間、擁有者及原 lease，再沿用既有 atomic post／manifest write 與全文來源摘要／公開驗證。

全系列完整度、暫停、前章公開時間、active series、既有日期承諾與 unconfirmed release 均阻擋不安全的人工操作。重複相同 intent 只回報原紀錄，不新增身分或 Git write；未知回應保留原身分。沒有回填 startedAt 或假造07：00排程。人工發於週一／四會佔用當天候選日，但原紀錄仍保留實際 manual time；測試確認週一人工第１篇後，週四接續第２篇。

## 驗證邊界

queue／delivery／API／UI helper 有 RED→GREEN：預覽唯讀、未確認／CSRF／stale source/version 阻擋、前章與保留承諾、actual manual time、duplicate／unknown identity、來源摘要／canonical／RSS、後續章序。UI module 最初 import failure 不列作產品RED；建立 interface stub 後才觀察行為RED。

回環 mock CMS 桌面與390×844手機檢查完成，沒有橫向溢出；人工確認操作產生一次 mock write、保留receipt，沒有正式API／Telegram呼叫。原稿六篇與manifest沒有diff，隔離D1模擬演練仍驗證正文與章序不變。

## 正式讀取尚需診斷

PR16部署run38195953150成功，但正式CMS仍回400且D1尚無startedAt。正式D1備份＋GitHub真實唯讀回應在本機成功產生10／15排程；原生本機Workerd＋合成provider與備份副本亦成功。擁有者另外以限定Contents read App5276010查核十層主線與首篇Blob，沒有GraphQL errors，token已撤銷。這些結果不能宣稱正式CMS App5109954與實際歷史完整讀取已成功。

候選只輸出穩定診斷：error category／known runtime class／已白名單的缺少欄位，GraphQL error type／root presence／depth rejected／blob index。沒有raw message、body、token、cookie、private key。未知error及prototype inherited名稱均使用固定fallback。正式自動開關保持false，待部署後查核實際原因；不可清庫或以人工紀錄偽造排程已驗收。

私人Telegram連線與唯一live job由擁有者另行驗收；RSS新文章推播仍須實際文章公開後確認。操作者須保留原live.sqlite，不新增getUpdates或重新建立基線。

最終候選完整驗證：293個Node測試、31個Python測試、153檔check零診斷、build:all、D1隔離靜態／mock通知演練、Worker production dry-run與Spectra驗證均通過。正文與manifest尚未修改。私人與正式provider操作不由上述本機證據替代。
