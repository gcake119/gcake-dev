# Substack 草稿同步：後台前端 API

正式唯讀 API 已於台北時間 2026／10／20 00：14 部署並完成下述正式驗收。API 只讀取 D1 最後保存的狀態，不會啟動同步、編輯草稿、排程、發布或寄送。

- 正式 origin：`https://gcake-admin-worker-production.wwhowbuhow.workers.dev`
- Worker version：`66a6ea7d-8d71-49a7-b91a-67cd2a095f9c`，流量 100％。
- 新建保持停用，既有 ID 的 Chrome 持續同步設定保留；排程寫入仍關閉。
- 此次沒有新增後台畫面；前端可以依以下契約串接。

## 讀取方式

沿用 CMS 登入 Cookie `gcake_session`。兩個端點均為唯讀，回應帶 `Cache-Control: no-store`；不會因讀取啟動同步、Computer Use、排程或寄送。

| 方法與路徑 | 用途 |
| --- | --- |
| `GET /api/v1/substack/drafts?limit=50&offset=0` | 讀取已追蹤原稿的狀態列表，按固定身分排序 |
| `GET /api/v1/substack/drafts/<slug>` | 讀取單篇已追蹤原稿；尚未被盤點的文章為 404 |

列表不是全部 Git 文章的清單，也不是即時讀取 Substack。它呈現 D1 中最後保存的觀察結果；前端應保留最後檢查時間。`limit` 為 1～100，`offset` 為 0～100000 的整數。GET 不需要 CSRF 寫入 token；它不授予任何寫入權限。

列表回應外層為 `{schemaVersion: 1, drafts: [...], page: {limit, offset, hasMore}}`，單篇外層為 `{draft: {...}}`。同一個投影供兩個端點使用。

## 單篇資料

```json
{
  "draft": {
    "schemaVersion": 1,
    "slug": "example-article",
    "providerId": "123456",
    "version": 8,
    "sync": {
      "status": "reconciliation-required",
      "desiredRevision": "source-B",
      "savedRevision": "source-A",
      "checkedAt": "2026-10-19T09:00:00Z",
      "code": "SUBSTACK_DRAFT_OUTCOME_UNKNOWN",
      "transport": "computer-use",
      "unresolvedOperation": true
    },
    "publication": {
      "state": "draft_prepared",
      "confirmedTime": null,
      "armedRevision": null
    },
    "delivery": {
      "evidence": "not_armed",
      "deliveredRevision": null,
      "subscriberReceipt": "unknown"
    },
    "attention": {"pendingAction": null, "code": null},
    "actions": ["foreground-reconcile"],
    "updatedAt": "2026-10-19T09:00:00Z"
  }
}
```

這是格式範例，不是真實文章或寄送收據。缺少的可選值使用 `null`。`providerId` 保留原平台文章 ID，`version` 是耐久紀錄的版本，不是發布次數。

| 欄位 | 前端呈現方式與限制 |
| --- | --- |
| `sync.desiredRevision` | 這次希望同步的 Git 來源版本 |
| `sync.savedRevision` | 最近完整保存並驗證過的版本；結果未知時保留舊版本 |
| `sync.checkedAt` | 最後一次同步檢查時間；不代表當前 provider 一定仍相同 |
| `sync.unresolvedOperation` | 有未決操作，不提供直接「重試建立／更新」按鈕 |
| `publication` | 最後保存的文章／排程觀察；不得由同步狀態推算為已發布 |
| `delivery.evidence` | `not_armed`、`armed`、`unknown`、`provider_reported`；均不能當作真人實收 |
| `delivery.subscriberReceipt` | 本 API 固定為 `unknown`，沒有獨立收件證據 |
| `attention` | 獨立的排程／身分待辦與錯誤；草稿曾驗證成功也不能隱藏這些待辦 |
| `actions` | 前景流程提示，並非此 API 授權執行的命令 |

## 狀態與可用操作提示

| `sync.status` | 建議顯示 | 意義 |
| --- | --- | --- |
| `not-observed` | 尚未進行草稿同步查核 | 舊紀錄尚無新同步證據 |
| `pending` | 待同步 | 期望與保存版本不同；不能顯示已同步 |
| `syncing` | 同步處理中 | 程式已開始處理；請配合時間判斷，逾時不等於 provider 未保存 |
| `verified` | 已保存並驗證 | 最近一次完整讀回吻合該保存版本；不代表已排程或寄送 |
| `conflict` | 人工修改衝突 | 保留實際平台修改，交前景審閱 |
| `inconclusive` | 驗證未完成 | 來源、私人草稿或媒體讀取不完整；不可顯示為內容已變更 |
| `excluded` | 不屬一般草稿同步範圍 | 來源未變且沒有獨立待辦的已排程／已公開文章；不啟動編輯 |
| `foreground-required` | 需前景處理 | 排程／公開文章、失去資格、改名或其他獨立待辦 |
| `reconciliation-required` | 結果待查證 | 已送出的操作結果不明，先查原 ID，不直接重播 |

有未決 intent 時投影固定顯示 `reconciliation-required`。即使歷史紀錄寫為 verified，期望與保存版本不一致時仍投影為 pending。

`foreground-review` 表示交既有前景流程審閱內容或排程；`foreground-reconcile` 表示先釐清未決結果。沒有提供 POST／DELETE API 來自動重試、忽略衝突、解除排程、重排、發布或寄送。這些路由的寫入要求會回覆 405。

## 錯誤

回應格式為 `{error: {code}}`。前端以 code 對應顯示文案，不解析內部錯誤字串。

| HTTP | code | 處理 |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | 缺少／到期／不屬目前 owner 的登入 |
| 400 | `INVALID_PAGINATION` | 修正列表範圍 |
| 404 | `ARTICLE_NOT_FOUND` | 文章未追蹤或 slug 無效，不推定 provider 不存在 |
| 405 | `METHOD_NOT_ALLOWED` | 此 API 只讀 |
| 503 | `SUBSTACK_STATE_UNAVAILABLE` | D1 未設定、紀錄無法解碼或讀取失敗；保留畫面既有狀態，不清成空清單 |

外層 Worker 的既有 `RUNTIME_NOT_CONFIGURED` 回應仍適用。回應不包含全文、完整 handoff、憑證、私人分享連結、工作階段路徑或 intent ID。

## 登入與串接範例

後台使用同源 Cookie。未登入時導向 `/api/v1/auth/login`，沿用正常 GitHub owner OAuth；瀏覽器管理 HttpOnly Cookie，前端不讀取或另存 Cookie，不需要傳 Bearer token。GET 不需 CSRF token。

```ts
async function readDraftStatus(slug: string, signal?: AbortSignal) {
  const response = await fetch(
    `/api/v1/substack/drafts/${encodeURIComponent(slug)}`,
    { credentials: 'same-origin', cache: 'no-store', signal },
  );
  const payload = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(payload.error?.code ?? 'REQUEST_FAILED'), {
      status: response.status,
    });
  }
  return payload.draft;
}
```

列表同樣使用相對路徑 `/api/v1/substack/drafts?limit=50&offset=0`。目前未開放跨來源 CORS；另一個前端網域不能直接改用絕對網址加 credentials 就完成串接，需要同源部署／代理方案。

頁面顯示時可每 60 秒讀取一次，切換頁面時取消未完成請求；隱藏頁面可暫停輪詢。這是呈現頻率建議，並非新建排程。同步 timer 為 15 分鐘，讀 API 不會提前觸發。顯示 `sync.checkedAt` 並轉換為 Asia／Taipei；`updatedAt` 可能只是其他觀察 metadata 更新，不能代替最後全文檢查時間。503 或網路失敗時保留上次成功資料並標示讀取失敗。

`actions` 是既有前景流程的導覽提示，不是 API 可執行的命令；已排程／公開且 excluded 的文章也可能有 foreground-review，不應只因 actions 非空就顯示同步異常。`sync.transport=computer-use` 表示同步來源，不表示 excluded 文章也被開啟瀏覽器。

## 發布與寄送的獨立狀態

| `publication.state` | 建議顯示 |
| --- | --- |
| `not-observed` | 尚無平台身分證據 |
| `draft_prepared` | 草稿 |
| `cancelled_draft` | 已解除排程、保留草稿 |
| `scheduled` | 已排程；時間使用 confirmedTime |
| `published_unverified` | 平台顯示公開，待完整驗證 |
| `verified` | 公開驗證完成；仍獨立於草稿 sync.status |
| `reconciliation_required` | 發布狀態待對帳 |

`delivery.evidence` 的 `not_armed`／`armed`／`unknown`／`provider_reported` 分別表示未安排寄送、已安排、未知、平台回報；都不能顯示為真人已收到。`subscriberReceipt` 固定 unknown。已同步、已排程、已寄送應分開呈現。

## 正式驗收與目前資料

台北 2026／10／20 正常 GitHub owner 登入後，正式列表讀到六筆真實紀錄；單篇、首末頁 hasMore、錯誤參數與不存在文章皆驗收。

| 原 ID | `sync.status` | `publication.state` | `delivery.evidence` |
| --- | --- | --- | --- |
| 221099415 | verified | draft_prepared | not_armed |
| 221099763 | verified | draft_prepared | not_armed |
| 221098688 | excluded | scheduled | armed |
| 其餘三篇已公開原 ID | excluded | verified | not_armed |

這是驗收時快照，前端以 API 的 checkedAt／version 為準；不得把表格當成持續即時保證。既有 221098688 排程仍為 10／22 07：00 台北時間，原寄送承諾未更動。

正式 HTTP 實測：健康 200；匿名列表／單篇 GET 401；匿名 POST／PUT／PATCH／DELETE 401，均為 UNAUTHENTICATED，私有路由帶 no-store。登入狀態以真實 Chrome 讀到成功列表／單篇、首末頁及 INVALID_PAGINATION／ARTICLE_NOT_FOUND。**已登入非 GET 的 405 與狀態讀取失敗 503 沿用相同候選本機路由測試證據，沒有宣稱正式注入故障或匯出 owner session 做該項測試。**

三個既有 HTML／JS／CSS 雜湊、正式變數與 bindings、六篇 Substack 身分／排程／寄送承諾及同步設定雜湊都與部署前一致。沒有 migration、排程／文章寫入、發布或通知。正常 OAuth 登入會建立 CMS session，因此不宣稱整個驗收零 D1 寫入。

部署與證據細節見 [正式部署驗收](../openspec/changes/automate-substack-draft-content-sync/api-production-20261020.md)；完整同步資格／圖片支援見 [持續同步驗收](../openspec/changes/automate-substack-draft-content-sync/continuous-provider-20261019.md)。前端 API 與同步 runtime 是不同交付層；圖片目前支援獨立 PNG，原圖雜湊、順序、alt 與連結均須驗證，無需增加前端寫入端點。
