# 後台前端正式部署與 Chrome 驗收

台北 2026／10／20 01：37：50，經使用者明確授權，部署一次成功。正式 version 534184e5-b51c-4afe-a8d2-61a66ab53b8c，deployment 26b32954-da5d-47ba-b168-3adba74d269a，100％流量。回復基準 66a6ea7d-8d71-49a7-b91a-67cd2a095f9c 保留，未回復。

## 候選與設定

使用 /private/tmp/gcake-admin-ui-production-20261020/candidate 隔離快照，沿用先前正式 API 來源與完整 production 設定，只覆蓋七個已驗收前端來源／測試檔與三個建置資產。前端候選所有來源、依賴及設定雜湊仍與上輪五項通過 gate 一致，因此重用 check／test／build:all／release:dry-run／editorial:rehearse，不因階段切換重跑相同檢查。此次另行完成 production dry-run 及部署前 current version 比對。

部署使用 keep-vars。正式 Worker resources（含後端 etag、handlers、runtime metadata、D1／R2、plain vars、secret 名稱）與前版逐項完全相同。保留 RELEASE_WRITE_ENABLED=true、SUBSTACK_WRITE_ENABLED=false、PARAGRAPH_WRITE_ENABLED=false；沒有取用或輸出 secret 值、變更憑證、migration 或同步 runtime。正式三個 HTML／JS／CSS 與候選逐 bytes SHA256 相同：index-DVBQ00qb.js、index-EBQCjx1N.css、index.html。

## 正式驗收

- /health=ok；列表與單篇匿名 GET 均 401 UNAUTHENTICATED、no-store。
- 自建 Chrome 分頁正常沿用既有 owner 登入，載入正式 Document 與新資產，沒有任何 response override、API 模擬或本機代理。
- 發布管理真實列表六篇，原草稿 ID 221099415 單篇與手動重新讀取，三次新端點皆 GET／200／no-store；本分頁捕捉到的十個後台 API 請求全部 GET。
- 每列明確分開「草稿同步／發布／寄送」，顯示台北查核時間、原編號與「尚無實收證據」。當時兩篇一般草稿均 verified／draft_prepared／not_armed，四筆 protected 為 excluded。ID 221098688 仍為 scheduled／armed，10／22 07：00 台北。這是本次快照，不是未來同步或真人實收保證。
- 桌機原尺寸與 390×844 手機，明暗兩主題皆讀得到三種標籤，無頁面水平溢出；保存實際完整列表與原草稿手機截圖。
- 既有舊 publications 查詢的「發佈中心尚未設定。」及 GitHub Pages「尚未設定」仍保留；它們與新 Substack API 獨立，不以隱藏舊錯誤冒充全部系統正常。此次不修改該既有後端流程。
- 503、401 失效、404 未追蹤、未知／衝突與晚到回應保留上一輪本機行為證據；本次沒有在正式注入故障，也沒有點擊發布、排程、寄送或儲存文章。

## 承諾保留及清理

部署前、部署後及 Chrome 驗收完成後唯讀比對六篇原 ID、slug、URLs、observed／desired state、時間與 slot、email／App、armed／delivered revision、公開歷史及 intent，全部保留。同步設定 SHA256 一致，allowCreate=false、scheduled.writeEnabled=false，既有 timer 未改。背景同步查核 metadata 可自然更新，正常後台讀取也可能更新 runtime metadata，因此不宣稱所有 D1 零寫入。

驗收專用 Chrome 分頁已關閉，viewport 已 reset，初始暗色主題恢復；沒有開啟本機驗收伺服器、沒有操作 Brave。工作樹保留供審閱，沒有 commit／push／merge。部署記錄、dry-run、設定、匿名 HTTP、Chrome 遮蔽後 API 證據與 D1 比對保留於 /private/tmp/gcake-admin-ui-production-20261020，常規文件不含 session／Cookie／CSRF 或私人全文。

機器摘要 frontend-production-results.json。先前 frontend-ui-20261020.md 的「尚未部署」是該輪歷史結果；本文件記錄此次後續正式交付。

## 非通過紀錄

最初在沙箱內透過 pnpm wrapper 查 CLI 時，其套件管理器解析嘗試寫 lockfile 而被系統拒絕；未部署。改用已安裝且版本確認的 Wrangler 4.142.0 執行 dry-run／正式部署，沒有安裝更新或改專案 lockfile。本次部署一次成功，無線上試錯推送。
