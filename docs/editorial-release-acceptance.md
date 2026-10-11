# PR ＃7 人工驗收清單

此表是待驗收項目，不代表正式環境已驗收。每項請記錄候選完整 SHA、執行人、時間、環境及證據連結；私人憑證與 chat 內容不得貼入公開 PR。

本次權限只有審查、修正、測試、推送 feature branch 與更新 PR。不要合併，不要建立正式排程、部署正式候選或啟用通知。正式 `EDITORIAL_RELEASE_ENABLED` 保持未設／false，Hermes 正式 `HERMES_RSS_NOTIFY_ENABLED` 保持未設／false。

## 已完成的技術查核

- 完整 diff 範圍：PR base `883ee22` 至候選 feature head，包含原 planner／交接與整合程式、規格、測試、Actions、安全報告及本文。
- 審查發現並修正：兩次 ingestion 之間 ready→draft→ready 的文章仍保留舊順位。Git 歷史現在可讓重新取得資格的文章回到正確 FIFO 位置；測試先失敗再通過。
- 補上 `Validate editorial release`：PR、feature push 與 main push 的只讀 CI。執行完整測試、Astro check、build 及暫存 HTTP 演練；顯式設定兩個啟用旗標為 false，不取得 secrets、不部署、不推 Git、不發真實 Telegram。
- 原 main 最新失敗 run `38137837004` 是第五篇 unknown topic `automation`。PR 已改成既有分類 `development-automation`。這只修正候選，未修復尚未合併的 main；不重跑舊 main 或部署舊內容。
- 本機結果見 `editorial-release-verification.json`。線上結果必須確認 PR 最新完整 SHA 對應的 CI，不以舊提交成功或自動程式審查代替。
- 已完成 TDD 回環 RSS／HTML 到模擬 Telegram API，並複審／補強底層正式 gate、固定 mock sender、DB 拒絕前唯讀檢查與預設 live 路徑保留；27 項 Python 測試通過。證據與重現命令見 [模擬驗收紀錄](editorial-release-mock-review.md) 及 [安全邊界複審與剩餘人工項目](editorial-release-boundary-review.md)。這不勾選下方真實私人 Telegram／Hermes 供應商驗收。

## A．PR 與內容審閱

代理已完成隔離 Chromium 桌面／手機與觸控檢查，證據見 [預覽驗收紀錄](editorial-release-preview-review.md)。需要擁有者執行的設定與限制見 [設定步驟](editorial-release-user-setup.md)。以下核取方塊仍保留給擁有者簽核，不將代理檢查當作人工接受。

- [ ] PR 保持 OPEN／未合併；最新完整 SHA 的 `Validate editorial release / validate` 全綠。若要設為 required check，由擁有者另行設定 ruleset，不能為了排程關閉分支保護。
- [ ] 審閱 Git journal 儲存例外與 publication intent／public confirmation 的區別；接受目前操作資料存 Git，正文與順序仍以 Markdown／manifest 為唯一來源。
- [ ] 核對六篇正文與原稿逐字一致、manifest 順序一致、status 仍為 ready；只接受第五篇分類修正。
- [ ] 在隔離預覽人工查看文章版面、上一章／下一章與返回系列連結，至少檢查桌面及手機寬度。預覽不得將六篇正式 Markdown 改為 published。

## B．排程與恢復（隔離 fixture／測試 repo）

- [ ] 週一／四台北 07：00 前不發，之後同時段只保留一個新 reservation；不承諾精確分鐘、不補發啟用前或更早錯過的時段。
- [ ] 缺章、planned、draft、暫停或前章尚未到公開時間時，全系列停止排程。
- [ ] 兩篇獨立文章依資格時間先後插隊；系列之後接續原章序，已開始系列先於其他等待系列。
- [ ] CMS 兩次檢查間 draft→ready／系列暫停→恢復會重新取得資格，正文修改不改變原順位。
- [ ] 故意讓 build／deploy／RSS 查核失敗：pending 保留原篇，沒有 completed、沒有下一篇、沒有成功通知；恢復後只確認同篇。
- [ ] CMS 同時寫入、刪除 active／pending、修改 pending 正文或 metadata：明確停止且不覆蓋 CMS、不 force push；操作者可依交接文件修復。
- [ ] 舊 HTML、錯 canonical 或來源 SHA 不符不能完成確認。RSS＋HTTP 200＋canonical＋來源 SHA 都吻合後才 completed。
- [ ] 接受已知部署競爭窗口：main SHA 檢查與 Pages deploy 不是跨服務原子鎖；若不接受短暫舊 artifact，先另行設計 CMS 協調鎖。跨時段恢復沿用原 pending 時段，實際可見時間與 reservation 時段可能不同，請核對恢復後的發文節奏。

## C．GitHub 正式設定（須另行授權）

- [ ] 決定 GitHub environment `editorial-release` 的 main 限制、reviewer 與無人值守策略；先保持正式旗標停用。
- [ ] 測試所選 token 的最小 contents write 權限與 main ruleset 相容性。候選已接專用 GitHub App，只限此 repo、必要權限；安裝 scope、ruleset 相容性及真實 push 仍需供應商驗收。
- [ ] 記錄候選預覽與正式 Pages 部署的版本證據，確認完整 manifest、RSS 與公開 HTML。PR CI 是本機形狀的部署演練，不能代替正式 Pages 供應商驗收。
- [ ] 規劃首次 durable ingestion，必須在想使用的 07：00 時段前完成；錯過就等待下一時段，不修改 startedAt 偽造啟用時間。

## D．Hermes 與 Telegram（獨立 OS 帳號、私人測試）

- [ ] 由 Hermes 帳號本人確認 Python／安裝路徑，先跑 dry-run；只有一個 hourly job、一個固定 live SQLite，權限 private，升級／重啟保留 DB。
- [ ] 確認既有 Hermes daemon／Telegram getUpdates poller 維持原狀；本工具只用 sendMessage，不增加第二個 poller。
- [ ] token／chat ID 僅存該帳號私人設定，不放 repo、提示詞、log 或公開 PR；正式 job 維持停用。
- [ ] 擁有者另行授權私人測試 chat／憑證，確認首次 live baseline 沒有歷史推播；dry-run DB 不當作 live DB 使用。
- [ ] 控制的新文章必須有 RSS 與成功 canonical HTML，才收到一次包含標題、URL、台北時間的訊息；變更 GUID、重啟、重複檢查均不重送。
- [ ] RSS／頁面故障時不發成功通知並退避；模擬 Telegram 回應遺失，`--status` 顯示 uncertain，重啟不重送，由私人 chat 與 outbox 人工核對。

## E．啟用與停止（本次不執行）

- [ ] A～D 完成或明確記錄豁免後，由擁有者另行授權合併及正式啟用；GitHub 與 Hermes 兩個旗標分別控制，不因 CI 全綠自動啟用。
- [ ] 驗證停止流程：關閉 queue 旗標只停止新準備，已有 published 意圖仍可能被一般 Pages build 部署；取消 pending 要核對公開證據並一起恢復 post／manifest／journal，必要時暫停 Pages workflow。
- [ ] 停止 Telegram job／live 旗標並保留私人 DB，不能刪 DB 來重送；指定故障處理人與 uncertain 對帳方式。

詳細安裝命令、故障修復與停止步驟見 [操作交接](editorial-release-operations.md)。


2026／10／12 無人值守後續：專用 GitHub App 接法與唯讀配置盤點已加入候選；前文「App 認證未實作」為歷史起點，現況與仍待擁有者授權的 repo scope／main bypass／CMS 相容性，見 [無人值守方案](editorial-release-unattended.md)。正式開關維持停用，所有真人／供應商未完成勾選保持未完成。
