# Multi-platform publishing design

## Status and production gate

2026-10-13，使用者確認原始鐵人賽 30 篇已完成同步渲染，「2026 鐵人賽幕後」系列已全部完稿，並開始排程連載發佈。稿件完成與全部公開是不同狀態：尚未到公開時間的篇目仍按既有排程處理，不因全系列完稿就提早公開。現行發布政策沿用已核准的受控同步流程：依既有授權的平台、文章及精確版本範圍執行；Pages 原文公開並驗證後，才進行平台同步。Substack 的新文章電子報政策已獲確認，適用範圍及正式啟用狀態見下節；Substack App 通知維持關閉。

Markdown 進入 `main` 本身不構成平台發布或寄信授權。既有受控流程的來源核對、D1 狀態對帳、公開驗證及未知結果恢復規則，依 [同步發文腳本操作手冊](distribution-scripted-runbook.md) 執行。本次僅確認與整理文件，不擴大既有同步範圍或執行平台操作。

### 電子報政策（2026-10-13 已確認，正式設定待啟用）

使用者已允許 Substack 對本次確認後首次發布的新文章寄送電子報，各平台每篇最多寄送一次。既有已發布文章不補寄，普通內容更新、版本更新與重試不再次寄送；尚未到公開時間的文章不提早寄送。Substack App 通知未包含在本次電子郵件政策確認中，維持關閉。

寄送意圖與文章更新分開記錄，由 D1 保存每個平台的寄送意圖、結果與防重複紀錄。遇到逾時或結果不明，保留原意圖並核對結果，不能以重新發布或新建意圖方式再次寄送。同一平台已確認寄送成功後，後續同步只更新或驗證文章。

這是文件政策的確認，尚未更動正式私人設定、執行腳本或平台設定，也未取得真實寄送驗收。正式啟用仍需讓受控流程符合本段規則並完成驗證；既有操作手冊中 emailDisabled 等關閉條件在完成實作切換前仍有效。

### 早期啟用限制（歷史）

早期 Phase 1 僅實作本機 transform、adapter、測試與 dry-run，曾規定鐵人賽結束且六篇幕後系列開始前不發布外部文章或寄送電子報。當時規劃以幕後系列作為第一批正式驗證對象。新系列已開始連載，因此「等待完賽與開始連載」不再是現行全面禁令；後續操作仍受既有精確授權約束。

## Source, canonical and distribution policy

`src/content/posts/**/*.{md,mdx}` is the only editable source for new articles. GitHub Pages is canonical:

~~~text
Markdown / MDX source
→ shared publication transform
→ portable publication
└─ Substack adapter  → publish → verify → state
~~~

Targets never write Markdown back. Each target publishes and verifies independently; one failure does not roll back another target or GitHub Pages.

Plain articles default to full text:

~~~yaml
distribution:
  mode: full
~~~

Articles that materially depend on Vue or MDX interaction use an explicitly authored fallback:

~~~yaml
distribution:
  mode: interactive-summary
  fallback: |
    這段內容由作者維護，保留文章核心結論與必要的靜態替代資訊。
~~~

The transform never infers the mode from component names. An `interactive-summary` without `distribution.fallback` is invalid. A `full` article containing source-only MDX constructs is also invalid; adapters and LLMs must not invent fallback prose.

## Portable publication

The provider-neutral contract contains:

- slug, title and description
- canonical URL
- published and updated dates
- distribution mode
- portable Markdown body
- referenced assets
- source revision

The shared transform strips source frontmatter, validates unsupported MDX at the shared boundary and adds a visible canonical link. Provider payloads may be derived from this contract; the shared contract never depends on provider-specific shapes.

## Adapter contract and prepare-only behavior

Adapters expose separate `prepare`, `publish` and `verify` operations. Newsletter intent is independent from create/update intent.

以下 dry-run adapter 保留為預演工具，仍不發布或寄信；它們不代表正式同步流程的全部能力：

- `substackDryRunAdapter` keeps only the portable publication at its boundary, does not encode reverse-engineered Substack requests and rejects publish/verify calls.


## 研究、後續證據與待驗證事項（2026-10-13 整理）

本節只核對 repository 內既有紀錄，未重新查閱官方網站、呼叫 provider 或執行真實平台驗收。研究日期與後續證據日期分開保留，不能以舊研究推定現在的平台 API 能力。

| 項目 | 後續文件證據與日期 | 適用範圍／尚未確認部分 |
| --- | --- | --- |
| Substack canonical／日期例外 | [2026-10-11 草稿查核與 2026-10-12 方案決定](substack-capability-verification.md)：採全文鏡像，平台 canonical 指向自身文章，正文保留 Pages 來源連結 | 不宣稱 Substack HTML canonical 指回 Pages；方案核准與真實公開驗證是不同證據。 |
| Substack 實際公開讀回 | [2026-10-12 分鐘精度與讀回紀錄](archive/publication-history/distribution-unattended-runbook.md)：同 ID `220011124`，標題、正文、來源連結、平台 canonical 與原文時間所屬分鐘通過 | 僅當次文章與授權的分鐘精度例外；不推定秒級日期或所有文章均已驗證。該次未寄信／App 通知。 |
| 發布狀態與部署 | 2026-09-28 證據中的持久化 harness 為本機 SQLite 相容驗證，未在該任務部署 D1／Admin／Worker | 現行狀態所有權仍是 D1；本機測試不能補成正式部署證據。 |
| 真實電子報寄送 | 2026-10-13 使用者已允許 Substack 的新文章最多寄一次；早期受控案例未寄信 | 正式設定啟用、真實寄送及防重複／未知結果驗收仍待完成，政策核准不能代替寄送證據。 |

## Substack 現行操作方式與歷史研究

2026-10-13，使用者確認 Substack 已改為透過 Computer Use 操作自己已開啟的 Chrome 瀏覽器後台。這取代先前 Codex 側邊瀏覽器路徑，不要求另開專用 profile 或搬移登入狀態。操作仍依既有受控交接流程核對文章版本、D1 原意圖與遠端 ID，保存實際畫面／內容讀回證據，再獨立匿名驗證公開結果。

本文不以這項使用者現況確認推定本次已取得 Chrome 控制、登入有效或完成平台操作。Chrome 無法取得、登入失效或寫入結果不明時，保留原意圖並回報；不透過 Cookie 匯出、背景 Playwright、另行 CDP 連線或未公開 API 繞過。電子報依前述已確認政策，正式寄信設定仍待啟用。

### 2026-09-27 介面研究（歷史）

Substack now has official Developer API terms and an official MCP server. The documented API scope is public creator/publication data. The official MCP is read-only for publication analytics and explicitly cannot publish posts, send Notes or modify an account. No stable official article publishing API, SDK or CLI was found.

Native web/mobile publishing can create, update, schedule and optionally notify subscribers, but that UI is not a supported automation contract. RSS import is an ingestion/migration feature, not a per-post reliable publishing API.

當時的研究結論（下列「未來」描述屬歷史階段，不代表現行 Chrome 流程尚不可用）：

- publishing automation remained unavailable in the production adapter at that stage
- any future browser or internal-endpoint implementation must live behind the replaceable Substack adapter
- cookies, browser profiles and runtime authentication stay outside the repository
- GitHub Pages never depend on Substack
- public web/RSS can be used for verification only after a separately approved write
- retry must use stored remote identity and verification state; create and newsletter-send cannot be retried as one operation

現行 Chrome Computer Use 依賴 Substack 後台畫面；後台變更或無法確認結果時，應保留可恢復的原意圖。先前關於未公開請求的研究不構成使用該路徑的授權。

## Publication state

發佈執行狀態由 D1 統一保存，包含各平台的執行與嘗試紀錄、遠端文章 ID／URL、來源版本、重試與驗證結果，以及電子報寄送紀錄。文章正文、編輯狀態與 `publishedAt` 仍由 Git 管理。兩者分工依 [publishing-operations 規格](../openspec/specs/publishing-operations/spec.md)，不建立第二份可編輯正文。

各平台狀態獨立；文章來源版本更新時，舊平台結果應標示需要重新同步。更新文章、驗證結果與寄送電子報是不同操作，普通更新或重試不得再次寄信。API 成功不等於公開驗證完成。

### JSON 遷移歷史

早期設計曾用 `src/data/publishing/publication-state.json` 保存跨平台狀態。後續 D1 遷移已淘汰這些舊檔案；它們不再是目前的狀態來源，也不要求恢復。舊欄位名稱與狀態枚舉只代表當時的 JSON 格式，不應當作現行 D1 欄位定義。

現行規格要求非空舊資料只能一次匯入或於驗收前相容讀取；完成切換後只寫入 D1，不同時寫入 D1 與 JSON。這是遷移規則的歷史說明，不代表本次重新執行了正式資料遷移。

## Secrets and credentials

Expected later, but not required for the current dry-run gate:

- Substack credentials only if a future supported publishing interface appears
- if unofficial Substack automation is separately approved: an external browser profile/session store, never committed

Never commit API keys, cookies, browser profiles, newsletter credentials or runtime tokens.

## Implementation phases

### Phase 1 — shared publishing contract

- add distribution metadata to the post schema
- define and test portable publication generation
- validate full vs interactive-summary modes
- add MD and MDX fixtures/tests
- keep site rendering unchanged

### Phase 3 — Substack isolated adapter

- re-confirm the current automation surface
- isolate authentication/runtime state
- implement only through a separately approved and replaceable adapter
- verify public results and persist independent failures

### Phase 4 — orchestration

- add an explicit command/workflow targeting one or multiple platforms
- prevent duplicate newsletter sends
- support retry per target and report results independently

External publication must never be triggered merely because Markdown reaches `main`.

## Operations that become public or send email

以下操作會公開內容或通知收件人。文章公開沿用既有受控範圍；電子報依本文件已確認的新文章政策處理，普通更新或重試不得再次寄送。Substack App 通知與測試郵件未包含在本次政策確認中。文件允許寄信不等於正式設定已啟用：

- Substack web/app publish with web enabled: makes a post public
- Substack publish/send with email or push selected: notifies subscribers
- Any future adapter method named `publish` or newsletter intent `send`
