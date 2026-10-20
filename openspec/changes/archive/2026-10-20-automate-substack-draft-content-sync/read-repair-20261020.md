# 原草稿清單讀回修正（2026／10／20）

範圍：Chrome、既有草稿 ID `221099415`、slug `ithome-2026-template-hardening`。本次沒有發布、排程、寄送、新建或 Worker 部署操作。

## 原因與修正

已保留的 `request-FCNIkS`／`request-Bwt1jy` 真實紀錄顯示，已發佈清單使用 `/publish/posts/detail/ID?referrer=...`，但執行者自行只取 `/publish/post/`，將存在的三筆已發佈文章漏掉，於進入原草稿編輯器前誤判清單不完整。不是原稿全文比對失敗。

新增共用清單驗證器，接受同站兩種實際網址格式，從各頁籤實際文字讀取總數。子執行者先執行確定性驗證，父控制器在寫入前置裁決與最終回覆前獨立再驗證。仍拒絕載入中、未處理分頁、總數不符、重複／跨狀態身分、異站連結及受保護原 ID；嚴格全文與圖片比較維持不變。未新增計時器、依賴或 CI 層。

首次修正版前景實測 `request-v6PqYc` 在編輯器前停止：執行者把 `aria-selected` 的字串 `"true"` 寫入要求布林值的欄位。保留失敗原件，僅補明確擷取型別指示，沒有放寬驗證器。

## 本機與前景證據

真實 RED 後，44 個既有 Node／SQLite 聚焦測試通過。最終相同候選的五項完整本機 gate 全部通過：`check`、`test`、`build:all`、`release:dry-run`、`editorial:rehearse`。

`request-L6gNjW` 於台北 02：24 完成 Chrome 全文重載讀回，三清單 3／1／3、原稿只在草稿、Saved、原 ID／slug 均正確。11 次實際 Chrome 呼叫，沒有填寫／貼上；完整指紋與 Git 一致：

`sha256:e0bf0977ae22ffe1d050ad9a51ebcada48dbf526ef332c596e617d5c21b16721`

當時 main `509d71b21e6261f5b674bdc77cb38deaf73d785d`，文章 revision `sha256:6bd00a9217daefa1d9775b93523e10d063231e1fba5c9f0fc02202391de7890b`。專用分頁關閉，target／round lock 釋放；前景只讀不直接覆寫 D1 成功狀態。

## 私人安裝與自然輪次

台北 02：25 在既有 round lock 下，只替換執行者、共用清單驗證器及 activation 必要 pin 清單；精準備份原檔、pin、資格／授權收據、設定與 plist。新版 pin：`623921bf07fbd55ae37bba9675645b092ae020cbf705d3118c87a8b5840b661d`。收據連結明列真實前景讀回及前版 pin，保留原媒體資格，不宣稱新的媒體寫入驗收。

設定／plist 位元組相同，原 900 秒 timer，沒有 reload／kickstart。`enabled=true`、`writeEnabled=true`、`allowCreate=false`、`scheduled.writeEnabled=false`；到期時間仍為 `2026-11-18T15:44:12.782Z`。

第 8 次自然輪次於台北 02：29 啟動，但 main 在執行中合併 PR #41，變為 `6e8f715fb14a142e43e322d640e40a21e9fc0907`。文章原稿沒有變動；來源保護依規則回報 `SUBSTACK_SOURCE_CHANGED` 並停止，該輪不算驗收通過，沒有 provider 寫入，來源已清除、lock／checkpoint／intent 均為零。原始失敗保留，等待原 timer 下一次自然執行，不手動重播。

第 9 次自然輪次釘選新 main，但兩個 Chrome 請求在清單導覽逾時後立刻關閉自己的分頁，無法取得後續實際畫面；沒有進入編輯器。`request-BsP7xG`／`request-t6UrHS` 原件保留，兩篇均 blocked，該輪不算通過；來源清理且 lock／checkpoint／intent 均為零。執行者接著補明確的全請求生命週期指示：唯讀 goto／reload 逾時先保留錯誤並讀取原分頁的實際狀態，在原期限內確認可用畫面；不逐呼叫關閉分頁、不重播填寫或貼上，真正身分／儲存／驗證問題仍停止。此修正版五項既有完整本機 gate 再次全通過，其後重新進行以下真實驗收，不以第 9 輪失敗作為成功證據。

導覽修正版 `request-TyDr3c` 於台北 03：00 對 main `6e8f715` 完成原 ID／slug 的 Saved 全文重載讀回，完整指紋相同，22 次實際 Chrome 呼叫、零內容寫入、專用分頁關閉。本次正常導覽成功，未人工製造逾時，不能宣稱實測觸發逾時分支。03：01 在同一鎖與備份流程更新背景 pin 為 `154d919567c7eccb6a47674ef88b21b401680d84893a6739f151cb97f44f32ae`，前版為 `623921bf...`，保留兩次備份及資格鏈。設定、期限、plist／timer 仍完全相同，沒有 reload／kickstart。

## 最終自然與正式後台驗收

第 10 次自然輪次 `round-r0UjkD` 於台北 03：09 啟動、03：18 完成，`completed`、exit 0。六筆 `sync-draft` 與六筆 `observe-schedule` 全部 observed；不是手動啟動或人工補寫回覆。

- `request-69e7eO`：原 ID `221099415`，20 次真實 Chrome 呼叫，完整 Saved 重載、原 slug、3／1／3 清單均通過，全文指紋與當前 main 一致。D1 `draftSync.status=verified`，查核時間 `2026-10-19T19:14:43.431Z`，source revision／baseline digest 與上述原稿相同。
- `request-DWXI9F`：另一既有 ID `221099763`，16 次真實 Chrome 呼叫，完整讀回通過。兩份派發動作都是 `draft-read`，沒有填寫／貼上或文章寫入。
- 重新取得當前 Git main 的獨立來源快照，核對仍為 `6e8f715fb14a142e43e322d640e40a21e9fc0907`，全文與自然輪次原始觀察相符，核對後移除該自有快照。
- 六篇正式紀錄從首次修正前起的 ID、slug、URL、排程、發布／寄送承諾與 intent 均相同。`allowCreate=false`、排程寫入 false、原設定及 plist 位元組相同、到期時間不變。
- final D1 lock／checkpoint／intent 全部為零；輪次來源移除、draft sessions 清空，本次 9 個已知專用 Chrome 分頁全部確認關閉。既有使用者分頁與 Brave 未操作。

正式後台同一原稿頁面以既有「重新讀取狀態」取得真實結果：從 02：51 的「驗證未完成」，更新為 03：14 的「已保存並驗證」；發布維持「草稿」，寄送維持「未安排寄送／尚無實收證據」。已保存前後文字與截圖，未使用回應覆寫或直接寫入成功狀態。既有 Hermes 觀察器／通知 ledger 照原設定執行，與 Substack 訂閱者寄送分開。

機器摘要見 [read-repair-results.json](read-repair-results.json)。本次完成一輪最後修正版自然驗收；因原稿內容相同而只讀，沿用既有媒體寫入資格，不宣稱新的內容寫入或媒體重驗。本次沒有 commit、push 或 Worker 部署。

私人完整證據：`/private/tmp/gcake-draft-list-fix-20261020` 及 `/private/tmp/gcake-draft-list-navigation-fix-20261020`。原始正文、畫面及本機設定維持私人檔案，不納入公開文件。
