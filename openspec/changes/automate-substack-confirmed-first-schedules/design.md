## Context

2026-10-29 的既有自然輪次已恢復，但兩篇公開稿因 D1 缺原 ID 誤報需要新建。既有排程 coordinator 已有來源、時段、generation、intent、同 ID、完整內容讀回及未知結果不重播；普通 worker 只具草稿權限。

使用者本輪授權原 ID 對帳及自動首次排程；後續明確選擇先完成實作，等下一篇正式文章確認時段後才做真實驗收與啟用。此選擇保留正式關閉，沒有授權任意挑草稿、補造時段或提前發布來驗收。

## Goals / Non-Goals

Goals：原 ID 對帳；單一既有輪次中的獨立首次排程 worker；正常／失敗／邊界 acceptance TDD；完整本機 gate；可執行、可核對的後續平台驗收與啟用入口。

Non-Goals：不自動修改已公開正文、改期／取消既有排程、補寄、新增 timer、私人 provider API、憑證匯出、CI workflow、換 model、變更原站發布政策或其他未提交工作。

## Decisions

### 原 ID 對帳只接納完整匿名證據

兩篇既有公開 URL 與數字 ID 均由目前平台證據取得，完整內容 fingerprint 與釘選 main 比較後，在現有鎖及版本條件下接納。保留舊 delivery 值及全部紀錄；不以公開文章推論寄送或真人實收。若 provider 與 Git 不同，依使用者後續明確選擇，在同 ID 公開稿修正正文至 Git；先存 before／intent、關閉 resend、保留原日期並重新讀回完整內容。未知結果不重播，沒有完整證據不標 verified。

### 明確核准的平台呈現

使用者核准兩篇表格改為條列：保留每個欄名及儲存格原文，其他段落、程式碼、連結及原始 PNG 位元組不變。每篇 approval 綁定 remoteId、sourceRevision、時間與圖片 SHA256；只忽略平台圖片檢視器包裝，嚴格比較核准轉換後內容，標記 presentation_only，不宣稱原始 HTML 相等。任何文字、欄位關係或圖片變動仍報差異。這項查核支援目前只在本機候選，正式舊 observer 仍可能顯示格式差異；不為消除提示提前部署或啟用。

### 首次排程共用既有 coordinator 與輪次

新增獨立 autoSchedule scope，不把舊 draftOnly 收據升格。只使用原站 durable confirmed slot；先驗證 eligibility 與 main，再在 mutation 前重新核對 source／slot／authority。沿用 ScheduleCoordinator、AttendedScheduleProvider、FileAttendedExchange 及現有 D1 writer lock，不新增資料庫或重試佇列。已公開、armed、cancelled、intent 或 genuine hold 直接排除；只有缺乏原 ID 的新稿準備注意可進入首次 discovery。

### 受限 Computer Use 與啟用證據分離

首次 worker 只具 find/read/create/update-draft/first-arm，不提供 remove 或 public update。變更前先保存 intent，再以有界私人 request、來源與 generation 綁定 gate 驗證操作；工具只交回實際 UI observation，由父程序驗證並保存 reply。失敗／未知不重播；不編造 observed values。期限到達或輪詢失敗時，必須等待既有 executor 的終止承諾（包含程序群組 SIGTERM／SIGKILL 收尾）完成後才返回 coordinator，避免釋放鎖後與下一個草稿 worker 重疊。圖片沿用 expectedDraftContent／normalizeDraftObservation 的原 PNG SHA256 URN，比較、baseline、intent 及 arm 全程使用相同表示；實際貼上仍使用來源 HTTPS URL，缺圖或圖片位元組改變會阻擋。透過原來源與 slot commitment 的釘選資料產生確切 scope，不讓背景直接拿一般前景命令自動批准任意操作。

啟用要求 owner authorization、scopeDigest、pinDigest、expiry、真實保存／重載／同 ID／slug／雙通道／排程 trial；local 或空隊列結果不合格。現階段只產出關閉範例與試行入口，正式設定不變。AGENTS.md 明列本次使用者授權的獨立自動首次排程例外；其餘觀察器、公開稿、改期／取消／補寄仍維持原前景邊界。

### 重用既有測試層與生命週期

具體風險是第一次 provider 排程與寄送的不可重播副作用；既有 coordinator 覆蓋了狀態與未知結果，但缺少 worker eligibility、站內時段串接與 activation 防護。擴充現有 Node acceptance／SQLite integration 及 sync-round 測試，不新增 workflow、E2E framework 或相同情境多層鏡像。成本為數秒 focused 測試與既有完整 gate；真實平台驗收需一篇正式 future slot，下一篇前不啟用。以 observable writes、durable state、cleaned resources、disabled policy 的零 provider calls 驗證效益。

## Implementation Contract

Behavior：普通輪次的獨立首次 worker 只從明確確認的 future reservations 建立／接納同 ID 草稿並保存 Substack schedule，email/appInbox=true、audience=everyone、timeZone=Asia/Taipei；到期由 Substack 自行發布，observer 另驗匿名公開。

Interface：autoSchedule policy version automatic-substack-first-schedules-v1，enabled/writeEnabled、origin/repository/branch、Chrome executor/evidence paths、expiry、maxArticles/timeout/budget、qualificationRef/authorizationRef；與 schedule policy version 分開。runAutoScheduleRound 回傳既有 slug/target/operation/status/code 摘要；disabled 為空；unqualified 在任何 provider access 前報 bounded SUBSTACK error。

Contract：已有公共身分、armed／cancelled／intent／真正人工 hold 的項目不寫。新稿 complete scan 含 Drafts/Scheduled/Published，排程回應含同 ID、內容、slug、slot 與 saved/reloaded 證據。main 或 slot 變動停止；失去回應保留意圖及 private session。

Failure：不符合 scope、source、slot、activation、timeout、identity 或 readback 皆停止對應文章，其他符合項目可在預算內續行；不重放 provider mutation。

Acceptance：先依本次 specs 建立真實 RED，再 GREEN；執行 affected full test/check/build/release/rehearsal 與 Spectra validate/analyze。啟用階段另外完成 future original 同 ID prepare/arm/remove/rearm、unattended trial、到期公開與後續匿名自然輪次，不以本機或空隊列標完成。

## Risks / Trade-offs

- 目前沒有 future eligible slot → 本機完成後保留真實驗收與啟用待辦。
- Provider UI 可改動 → 真實 observation 缺漏停止，不用 source 值填觀察證據。
- 啟用收據重用 → 同時綁定 exact policy 與 runtime pin，舊 draft-only 一律拒絕。
- Browser 操作結果不明 → 保存現有 intent/session，下一輪不重播。

## Migration Plan

先條件對帳兩篇公開原 ID；本機 gated 候選保留正式 autoSchedule disabled。下一篇確認後，採新私人安裝及 pin、原 credentials／timer／locks；完成真實 trial 才產生 matching qualification／authorization 並啟用。停用僅關閉新 arm，既有 provider schedules 仍須盤點且不自動取消；保留原 runtime、pin、plist 與 histories 供恢復。
