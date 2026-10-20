# main f4ea22f 正式後台部署與驗收紀錄

本文件回填台北 2026／10／20 已完成的正式部署與驗收快照。本次回填只更新文件，不重新查核 provider、不再次部署、不推送，也不啟用排程寫入或寄送。

## 實際版本與來源

| 項目 | 已保存證據 |
| --- | --- |
| 來源 commit | `f4ea22f097973f4978e7dccbbaddad87bb3c4ec7`，main 合併 PR #42 |
| Worker | `gcake-admin-worker-production` |
| 正式 origin | https://gcake-admin-worker-production.wwhowbuhow.workers.dev |
| Worker version | `c65baef6-faa6-40c8-bb89-6a5047db216d` |
| Deployment | `55c29a09-1ac7-4eb0-be36-ce0ec091d546` |
| 部署時間 | UTC 2026-10-19 19:38:46.864032；台北 2026-10-20 03:38:46.864032 |
| 流量／次數 | 100％／一次 |
| 回復基準 | `b7019878-d470-4558-9d68-ebaee8a7fe4a`，未執行回復 |

使用乾淨隔離 clone；358 個程式／測試／依賴與設定輸入逐檔匹配 PR #42 已通過完整本機 gate 的候選，合併 tree 與 `cea6a19` 一致。未混入後台歸檔 commit `e789dbe`、主規格同步、DESIGN／設計系統變更或其他未提交工作。重新建置 admin／worker、production dry-run 後，以當前正式部署身分守門再部署；沒有 migration。

此前 [PR #42 CI](https://github.com/gcake119/gcake-dev/actions/runs/39309242767)、精確 `cea6a19` 的 Codex 再審與 [main 合併 CI](https://github.com/gcake119/gcake-dev/actions/runs/39311030734) 皆通過，原 P1 已解決。63 項聚焦及五項完整本機 gate 見 [P1 修正證據](pr42-review-fix-20261020.md) 與 [本機結果](pr42-fix-local-gates-20261020.json)。本次文件回填不重跑相同程式的完整測試，也不把歷史測試當成新執行。

## 正式 API 與介面驗收

- 健康 200；正式 HTML／JS／CSS 三個 SHA256 與乾淨候選相同。版本 metadata 確認為上述 version／100％流量。
- 正常 Chrome owner 工作階段：列表六筆、原 ID 221099415 單篇、首末頁、無效分頁、未追蹤文章共六項；分別 200／200／200／200／400／404，全部 no-store。首筆 limit=1 offset=0 hasMore=true，末筆 offset=5 hasMore=false；錯誤為 INVALID_PAGINATION／ARTICLE_NOT_FOUND。
- 匿名健康／列表／單篇及五項寫入拒絕共八項：健康 200，其餘 401 UNAUTHENTICATED，私有回應 no-store。登入後 405 與儲存失敗 503 沿用精確來源的本機測試，未匯出 session 或對正式環境注入故障。
- 使用實際正式 Document／資產，無回應覆寫或代理。23 個捕捉到的後台 API 請求全為 GET，16 個 Substack／publications 狀態回應皆 200／no-store；沒有點擊儲存、立即發布、排程或寄送操作。
- 1728×907 桌面、390×844 手機，各驗明亮與暗色的列表／文章狀態／Pages 紀錄。無水平溢出；document scrollWidth 分別 1713／375，皆不超出 viewport。可見具名操作群組最多兩個按鈕，文字與三種獨立狀態可讀。
- 已公開 `ithome-2026-astro-choice` 顯示已保存的 Pages 發布、同 commit 部署及文章／RSS 驗證，台北 2026／10／19 08：46；release ID、sourceRevision、verifiedAt 與部署前 D1 原紀錄一致。原 ID 221099415 草稿顯示 Pages 尚無發布紀錄，沒有沿用前篇成功或連結。這次只驗證呈現，沒有重新查核公開站。

## 草稿 221099763：驗證未完成

原 ID `221099763`、slug `ithome-2026-tech-blog-boundary`。部署前保存快照 UTC 19:36:46.342（台北 03:36:46.342）記錄 sync.status=verified，該次 checkedAt 為台北 03:18:02.732。驗收時 API 與畫面顯示 **inconclusive／驗證未完成**，checkedAt 為 UTC 2026-10-19 19:39:20.992（台北 2026-10-20 03:39:20.992），代碼 `SUBSTACK_DRAFT_LIST_INCOMPLETE`；驗收後 UTC 19:50:05.536 的保存快照仍為此狀態。

此代碼表示當次清單證據不完整；本次沒有釐清深層原因、修復同步 runtime、重試 provider 操作或改寫為成功。desiredRevision 與最後 savedRevision 仍同為 `sha256:81bb7fba698446db8ee414d6bf7023e748587b47fa64282065c7996677992e35`，相等並不能取代當次完整查核。API unresolvedOperation=false，仍須如實顯示驗證未完成。

發布狀態仍為 draft_prepared／草稿，寄送為 not_armed／未安排寄送，subscriberReceipt=unknown。這筆不算本輪草稿全文驗證成功，也不推定內容錯誤、已發布、寄送失敗或真人已收到。部署／API／介面驗收通過與個別草稿全文同步結果分開記錄。既有其他同步資格或排程實收驗收不因這次部署結案。

## 保留設定、承諾與清理

正式 plain vars、D1／R2 bindings、secret 名稱及 runtime metadata 與部署前一致。保留原 RELEASE_WRITE_ENABLED=true；SUBSTACK_WRITE_ENABLED=false、PARAGRAPH_WRITE_ENABLED=false、allowCreate=false、scheduled.writeEnabled=false。既有原站自動發布已啟用狀態與原 ID 221098688 的既有 scheduled／armed 承諾保留，沒有新啟用排程寫入、發布或訂閱者寄送。

六篇原身分／slug／URL、時段、發布歷史、寄送 channels／armed／delivered revisions／intent 與同步設定雜湊皆保留。三筆 Pages release 完整物件及 paused／overrides／adopted 控制皆不變。queue metadata version 178→180；正常驗收的既有讀取可更新 metadata，不宣稱整個 D1 零寫入。兩篇草稿的同步查核狀態在保存快照間有更新，不能把「承諾未變」寫成全部同步狀態完全不變。

自建 Chrome 分頁已關閉，viewport reset、原暗色主題恢復，未建立本機伺服器／Docker。鍵盤捲動未完成與文章等待逾時保留在操作紀錄，先檢視實際畫面再改用正常捲動／接續已完成的讀取，沒有盲目重送或變更文章。

機器摘要見 [正式部署結果](production-main-f4ea22f-results.json)。私有原件：`/private/tmp/gcake-production-f4ea22f-20261020`。截圖與 HTML 報告：`/Users/caiyijun/.codex/visualizations/2026/10/19/01a153ab-2054-7613-8fb6-a0e9e54085b6/f4ea22f-production-20261020`。本 commit 僅保存遮蔽後的文字／JSON，未納入 Cookie、session、secret 值、私人全文、工作階段或原始 D1 快照。以上路徑為本機歷史原件位置，不是 repo 內的可攜附件，也不是本次新執行。
