# Substack 草稿同步：後台前端 API

本文件描述已實作的後台唯讀 API；HTTP 路由尚未部署。私人 Chrome 草稿同步 runtime 已於 2026-10-19T15:54:47.369Z 啟用既有 ID 的持續寫入，新建與排程寫入保持停用。真實圖片／全文恢復及一次自然完整盤點皆已通過，證據見下方紀錄。API 部署、同步 runtime 與真人寄送收據是不同證據。

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

## Computer Use 寫入與啟用界線

2026／10／19 單篇前景真實驗收已使原 ID `221099415` 的 D1 紀錄取得 `verified`／`draft_prepared`／`not_armed`，並以本機候選投影確認前端可呈現這三個獨立狀態。HTTP 路由尚未部署；這不是正式環境 API 已可呼叫的宣告。實際來源、全文比對、同 ID／slug 與保留失敗見 [provider 驗收紀錄](../openspec/changes/automate-substack-draft-content-sync/live-provider-20261019.md)。本次為相同內容重存，且沒有圖片；無人資格與正式啟用條件保持下述要求。

既有單一 `distribution:sync` 輪次會先評估獨立 `draftSync` 設定，再執行草稿階段與匿名觀察器；預設無設定或未啟用時完全不新增 authenticated 存取。它不會改變現有 `scheduled.writeEnabled=false`，也不會改寫已排程文章。

`draftSync` 的啟用範圍包含 `policyVersion=unattended-draft-sync-v1`、`transport=computer-use`、origin、固定 repository／main、到期時間與工作階段排他宣告。還需要 `runtimePinFile`、`qualificationRef`、`authorizationRef`，以及有限的 `maxArticles`、`timeoutMs`、可選 `maxRoundMs`，與 Chrome 執行者及私有證據目錄。`allowCreate=false` 是本次選定的既有 ID 範圍，缺少原 ID 時回報 `SUBSTACK_DRAFT_CREATION_DISABLED`，不存取瀏覽器或建立操作意圖。每輪篇數與單請求期限必須明確設定；程式允許的上限為每輪 20 篇、單請求 600 秒、草稿階段整輪 840 秒，未指定整輪期限時為 60 秒。實際值須由後續 provider 驗收確認；這些上限不是效能量測。

驗收／授權文件須位於 Git 外，綁定 policy scope digest 與 runtime pin 檔案 SHA256、政策及有效期限，`draftOnly=true`。驗收須明確證明 `passed`、`fullReadback`、`exactSlug`、`sameId`、`unattendedExecutor`、`sessionExclusive`；授權須為 `approved=true`。目前資格及授權文件已依真實媒體／全文恢復證據產生，綁定已安裝 runtime pin；自然完整盤點亦已另行驗收通過。

程式透過既有 FileAttendedExchange 發出 v2 精確請求，Computer Use 執行者使用以下既有 CLI 入口的新操作：

```text
pnpm distribution:handoff inspect-draft --request <request.json> --config <private-policy.json> --source-root <fixed-source>
pnpm distribution:handoff reply-draft --request <request.json> --config <private-policy.json> --source-root <fixed-source> --evidence <saved-observation.json>
```

這些是介面說明，不是本次授權執行的正式操作清單。請求位於該輪來源快照旁的私人 `draft-sessions` 目錄，回覆後重新驗證來源、state generation、scope digest、期限及原 ID。更新證據還須包含實際編輯前 observation，與請求中的完整內容 digest 及 draft 狀態一致；保存後證據須重載並包含完整文字、結構、程式碼、slug、圖片載入與 alt、連結，以及 Drafts／Scheduled 清單結果。

一般草稿寫入仍須由已驗收且獲授權的 Computer Use 執行者處理；未接上時保留待處理／逾時結果，不宣稱無人寫入成功，也不重建草稿。另有明確授權的單篇唯讀 qualification，可由既有 timer 呼叫桌面版內附 CLI，在自己的新 Chrome 分頁完整讀回；它使用一次性原 ID／來源／runtime 範圍，不啟用一般寫入。瀏覽器以 chrome 名稱選取，控制程式核對實際 browserFamily，拒絕數字 ID 與非 Chrome 證據。自然輪次證據見 [驗收紀錄](../openspec/changes/automate-substack-draft-content-sync/natural-provider-20261019.md)。此接線沒有新增 timer，後台 HTTP 路由仍未部署。

UI 的操作前後檢查與本機鎖無法提供平台原子式條件寫入保證；其他人同時在平台操作仍是殘餘風險。正式啟用前須以受控工作階段確認可接受的操作範圍及排他方式，不能把本機 fixture 當成已解決這項競態。

2026／10／19 Chrome 無人單篇唯讀自然輪次已通過：同 ID／slug、完整 digest 吻合、provider 寫入為零，checkedAt 為 `2026-10-19T12:31:20.724Z`。這使現有 D1 投影維持 verified／draft_prepared／not_armed；[自然輪次紀錄](../openspec/changes/automate-substack-draft-content-sync/natural-provider-20261019.md) 與一般草稿自動寫入資格分開。正式 HTTP API 仍需部署本機候選才能使用。

2026／10／19 22：33 的 Chrome 無人背景實際完整重存與重載驗收已通過。實際 D1 v53 投影為 verified／draft_prepared／not_armed，checkedAt=`2026-10-19T14:33:36.275Z`、unresolvedOperation=false。原 ID／slug、既有排程與寄送設定保留；[寫入驗收紀錄](../openspec/changes/automate-substack-draft-content-sync/write-provider-20261019.md) 保留前三次寫入前失敗及最終成功證據。這是同一內容實際重存，單次範圍已消耗，未啟用全清單常態寫入；HTTP API 仍未部署。


2026／10／19 持續同步擴充：一般 worker 已接上與 qualification 共用的無人 CLI 程序；控制程式核對真實 Chrome、原 ID／版本／操作意圖、完整 before／after 與來源新鮮度，獨立產生 reply。成功的原始證據另存 Git 外，完成後清理 payload session；失敗保留 unknown，後續不重播。使用者已選定「既有 ID 自動同步，新建保持停用」，該布林能力與篇數／期限／執行者設定一起綁定 scope digest。後台可依 sync.code 顯示「自動新建未啟用」，actions 仍只是前景檢視提示，不代表新增寫入權限。實際持續啟用與自然清單驗收紀錄另行填入，HTTP 路由仍未部署。

`sync.status=excluded` 表示這篇已排程或已發布、來源版本未變且沒有獨立待處理問題，本輪排除草稿編輯，不新增前景異常。此狀態的 checkedAt 是盤點判斷時間，不是重新讀取 provider 的時間。排程／公開／寄送證據仍看各自欄位；來源變動或原有 intent／error／pending action 仍保留前景處理。


## 已核准的圖片等價驗證

草稿專用 `mediaProfile=original-sha256-png-v1` 保留原始 UI 證據，由控制程式獨立取得來源及畫面所指向的託管原圖並比對 SHA256。平台改寫圖片 URL／顯示外框可以等價，但圖片順序、alt、正文連結、程式碼及其餘內容仍須嚴格一致。僅支援獨立未包超連結的 PNG，每篇最多 8 張、每張最多 8 MiB。格式、來源結構、載入或原圖驗證不完整時，不顯示已同步；缺少已驗收媒體 profile 時回報 `SUBSTACK_DRAFT_MEDIA_UNQUALIFIED`。來源圖片 bytes 改變也會使同步保持 pending，不能只由 Markdown 版本相同推論已同步。

這是執行者的內容驗證能力，不新增前端圖片寫入端點。前端仍使用既有狀態、code、checkedAt、desiredRevision／savedRevision 來呈現；verified 必須有完整讀回證據。


## 目前啟用範圍（2026／10／19）

已安裝 `installed-draft-continuous-media-chrome-20261019`，原 900 秒計時器、Chrome 自有新分頁、每輪最多 20 筆、單請求 600 秒、草稿階段 840 秒。啟用既有未排程從未公開 ID 的草稿保存與完整讀回；`allowCreate=false`、`scheduled.writeEnabled=false`。授權到期時間為 `2026-11-18T15:44:12.782Z`（台北 11／18 23：44），到期後不可繼續新 dispatch。最新真實證據及自然輪次見 [持續同步驗收](../openspec/changes/automate-substack-draft-content-sync/continuous-provider-20261019.md)。上方單次資格段落為各階段歷史，不代表目前仍是單次範圍。

前端接線仍須部署本機 Worker 候選；本次沒有新增後台畫面、部署 HTTP 路由、commit 或 push。前端讀 API 不會觸發同步，可以輪詢最後持久狀態並顯示 checkedAt。已排程／公開文章的 excluded 只代表不屬一般草稿同步範圍，仍須保留 publication、delivery 與獨立 attention。


台北 2026／10／20 00：06 自然驗收：原 timer runs=1、exit=0，六筆全部 observed，兩篇合格草稿 verified、四篇保護文章 excluded，25 次實際 Chrome 呼叫僅讀取，零 provider 寫入。原 ID／slug／排程／寄送承諾與清理對帳通過。這個自然輪次沒有內容差異；實際圖片 A 與 Git B 的兩次寫入證據另列，不宣稱本輪有寫入。最新狀態的前端投影與時間在 [機器摘要](../openspec/changes/automate-substack-draft-content-sync/continuous-provider-results.json)。
