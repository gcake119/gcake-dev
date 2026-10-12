# 2026／10／12 正式啟用進度

擁有者已另行核准正式發文與既有 Hermes 私人 DM 通知，並明確核准 PR ＃7 精確 24c2b43 合併及正式 Worker 部署。合併 SHA：4a54cf211b16b4e475caa183136a92d2a8883936。

- Worker [38193839571](https://github.com/gcake119/gcake-dev/actions/runs/38193839571) 成功，version a568bc94-d6a8-40a6-aa3e-e71f6fe8c084；沒有待套用 migration，部署時 RELEASE_WRITE_ENABLED=false。
- 正式 D1 已匯出私人備份；部署前後 version=23，release count=0。沒有清庫或重建身份。
- Actions→Worker [38194005086](https://github.com/gcake119/gcake-dev/actions/runs/38194005086) 收到預期 HTTP409，證明 Secret 配對與停用防護。run failure 是 runner 對409的預期拒絕，不是 Pages 部署失敗；finally 已恢復 GitHub RELEASE_AUTOMATION_ENABLED=false。
- 擁有者回報 Hermes live 基線於台北時間10：04：36建立，程式 SHA-256 f4b1e2dd88e53674e30abbd73b7a8ba7874246f74c20b46a9a6745e4a30ee7ac，mode=live、正式 site、failures=0、文章／uncertain／待發=0；沒有歷史通知。
- 擁有者回報唯一 live job 550aaf17723d（gcake-editorial-rss-live），每60分鐘，啟用／scheduled，no-agent，deliver與failure-deliver均local。私人設定與既有live DB保留，沒有第二個Telegram poller或gateway重啟。首次cron尚未執行；下一次11：15：05。手動wrapper exit=0。
- 既有bot的單次私人連線測試API成功，擁有者已確認收訊；這不代表新文章RSS通知鏈已完成。

## 正式佇列讀取修正

啟用Worker變數後，正式CMS的佇列讀取失敗，而六篇文章仍ready、GitHub自動發文未開啟。舊讀法對每一主線commit逐檔GET，會耗盡免費Worker的50次外部請求預算。新增60commit、兩篇文章與manifest的受限API測試，觀察真正RED，批次後只需12次外部讀取。另有immutable cache RED與歷史不存在檔案RED。

採唯讀GraphQL每批10個first-parent快照、所有候選路徑同批讀取，並在單次request快取immutable tree／blob。main每次重新讀取，沒有取消寫入前的版本核對。1000commit上限維持；reply超過2MiB、partial／cycle／一般provider error停止；僅明確指向nullable歷史file的NOT_FOUND可終止已觀察的ready期間。真實GitHub已確認六篇與系列的continuous-ready結果等同舊讀法。候選未修改正文、manifest、D1 migration或Secret。

完整本機281 Node／31 Python、check零診斷、build:all、D1 mock靜態演練、Worker dry-run及兩個Spectra change驗證通過。首次query過深與型別錯誤均先本機修正；沒有用CI反覆試錯。

GitHub RELEASE_AUTOMATION_ENABLED仍false，舊EDITORIAL_RELEASE_ENABLED保持false。Worker變數已true，但正式自動排程須待本修正部署後CMS讀取成功再開啟。首次durable observation不能早於發布時段，預期首個可用時段為10／15（四）07：00台北時間，不能回填時間補發10／12。

參考：[Cloudflare subrequest limits](https://developers.cloudflare.com/workers/platform/limits/)、[GitHub Commit GraphQL](https://docs.github.com/en/graphql/reference/commits)。私人備份、Secrets與完整outbox不放Git。
