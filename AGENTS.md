<!-- SPECTRA:START v1.0.2 -->

# Spectra Instructions

This project uses Spectra for Spec-Driven Development(SDD). Specs live in `openspec/specs/`, change proposals in `openspec/changes/`.

## Use `$spectra-*` skills when:

- A discussion needs structure before coding → `$spectra-discuss`
- User wants to plan, propose, or design a change → `$spectra-propose`
- Tasks are ready to implement → `$spectra-apply`
- There's an in-progress change to continue → `$spectra-ingest`
- User asks about specs or how something works → `$spectra-ask`
- Implementation is done → `$spectra-archive`
- Commit only files related to a specific change → `$spectra-commit`

## Workflow

discuss? → propose → apply ⇄ ingest → archive

- `discuss` is optional — skip if requirements are clear
- Requirements change mid-work? `ingest` → resume `apply`

## Parked Changes

Changes can be parked（暫存）— temporarily moved out of `openspec/changes/`. Parked changes won't appear in `spectra list` but can be found with `spectra list --parked`. To restore: `spectra unpark <name>`. The `$spectra-apply` and `$spectra-ingest` skills handle parked changes automatically.

<!-- SPECTRA:END -->

## Substack 同步發文規則

- Substack 正式網址的 slug 必須與權威 Git 原文 slug 完全一致（舊政策另須已驗證 GitHub Pages）；禁止採用平台自動產生的縮寫、隨機代稱或追加後綴。
- 首次發布前在原草稿設定並重新載入核對 slug；發布後依本篇生效的來源政策，驗證新網址的原文章 ID、canonical、完整內容、原文連結與實際發布時間，全部通過才能宣稱公開驗證完成；原定時間、實際時間與差距分開呈現，時間差本身不視為身分或內容不符。
- 既有文章網址修正保留原 ID，不重新發布、不重寄電子郵件或 App 通知；完整匿名驗證後對帳 D1 remote URL，保留來源版本與寄送紀錄。
- slug 衝突、儲存失敗或身分／來源不符時停止，不另建文章或換用備選 slug。背景排程保持唯讀，網址修正交由明確前景操作。
- 操作與驗收細節見 `docs/distribution-scripted-runbook.md`；文件規則與正式釘選 runtime 的實際能力須分別回報。

### 提前備稿與 Substack 排程政策

- 新政策為 `scheduled-source-first-delivery-v1`：來源是已儲存、符合資格並釘選 main 版本的完整 Git Markdown；slug 與此來源完全一致。舊政策 `pages-first-no-newsletter` 仍須先驗證 Pages，舊核准文件不能授權新政策寄送。
- 新政策只能在前景依已確認的原站固定時段，安排同一文章 ID 的首次發布與電子郵件／App inbox 通知。佇列預估時間不構成排程授權；Substack 可在 Pages 失敗時獨立公開與首次寄送。
- 原稿修改須實際讀取、比對、編輯及重新讀回同一篇文章；已排程稿先確認解除舊排程，再更新及重排。延期沿用同 ID；取消只解除排程並保留草稿。文章已公開後，只修正文，不改日期、不重新發布或補寄。
- Git 是內容來源，D1 只保存身分、版本、排程、操作意圖及驗證證據。原稿刪除、退回草稿、改名、時段變動與結果未知，均保留最後確認的 provider 狀態，交前景處理；本機暫停不代表 Substack 已取消。
- 正式 runtime、D1 migration、排程寫入開關及訂閱者寄送的啟用另需明確授權。本機驗證不能取代實際 provider 介面驗收或寄送證據。

### Computer Use 草稿同步的本機實作

- `automate-substack-draft-content-sync` 已由使用者選定沿用既有 Computer Use handoff；本機實作與後台唯讀 API 說明見 `docs/substack-draft-sync-api.md`。正式執行者、工作階段與無人輪次驗收／啟用仍獨立處理，既有正式觀察器及排程不因本機實作改變。

### Chrome 分頁管理

- 本節取代舊操作紀錄中「一般 worker 僅操作自己的新 Chrome 分頁」的限制；僅調整分頁管理規則，不代表正式 runtime 已更新或重新驗收，也不新增草稿寫入、排程、發布或寄送授權。
- 持續更新 Substack 草稿時，先盤點既有 Chrome 分頁，優先沿用同帳號、同刊物且可安全操作的 Substack 後台分頁；不得每輪無條件新增分頁。
- 若確有需要新增分頁，記錄本次新增的分頁識別，於任務完成或失敗收尾時關閉本次新增且不需人工接手的分頁，避免累積。沿用使用者原本開啟的分頁時，完成後保留；不得關閉其他工作或來源不明的分頁。
- 關閉前確認草稿已儲存；若尚有未儲存內容、操作結果未知或需要人工接手，保留必要分頁並明確回報原因。

## 技術系列文章協作與定稿交接

- ChatGPT Project 對話指令參考副本：`docs/editorial/chatgpt-project-instructions.md`。此文件僅供對照；Repo 的 Agent 執行規則仍由本檔與各項正式發布規格決定。

適用於 `docs/editorial/<series-slug>/` 的技術系列寫作；本節是 Repo 端執行規則，與 ChatGPT Project 的對話／審稿流程互補。遵守上方 Spectra 規則與發布安全限制，不為文件編輯擅自啟動產品功能開發。

### 文件與權威

- 通用模板：`docs/editorial/_templates/series-plan.md`、`docs/editorial/_templates/progress-and-handoff.md`；更新通用方法時才修訂模板，不自動覆寫其他系列。
- 每個系列獨立保存 `docs/editorial/<series-slug>/series-plan.md` 與 `progress-and-handoff.md`。目前部落格系統系列使用 `docs/editorial/blog-system/`。
- 正式文章 Markdown 是正文權威；`src/content/series/*.yaml`（Series manifest）是章節、閱讀順序及編輯進度權威；交接文件只保存跨篇寫作脈絡。現有文章路徑須先查 Repo，不憑模板猜測。
- 最新 Git、OpenSpec、正式部署與驗收紀錄優先於舊的實作摘要。不能把規格、測試、PR 或部署成功直接寫成已公開驗收。

### 開始與進行單篇工作

- 「開始討論第 X 篇／下一篇」：先讀該系列企劃、最新交接、上一篇定稿與本篇必要的少數 Git／OpenSpec／驗收資料。先整理核心問題、真實素材、前後篇界線，未經要求不直接寫初稿。
- 寫作順序：核心問題 → 真實經驗 → 論點 → 標題 → 簡要大綱 → 初稿 → 多輪審稿 → 定稿。依第一性原理與金字塔原理，保留「當時知道／後來理解／目前仍不知道」，不補造作者經驗或能力。
- 涉及既有已發布文章，先比對重複主題；不因後續理解改寫成當時已知的決策。

### 使用者明確確認「定稿，更新 Repo 和交接紀錄」時

1. 核對最後確認的定稿版本、正式 Markdown 路徑與 frontmatter；只改本次相關文章，不自行重新潤稿或更改其他文章。
2. 核對並更新必要的 Series manifest，保持正文與章節、篇序及狀態一致；不要自創與 manifest 重複的文章順序欄位。
3. 更新**該系列** `progress-and-handoff.md`：實際定稿進度、本篇核心與證據、當時／後來／未知的界線、已談／未談、下一篇切入點、文章路徑和 commit／PR（若已知）。不複製完整正文或對話。
4. 僅在章節／候選篇目確實需要調整時更新該系列 `series-plan.md`；未公開篇目可調整，已公開篇目保留發表事實。
5. 優先透過分支與 PR 提交並驗證差異；遵守 main 保護及 CI。若未能寫入或檢查未通過，明確回報，不宣稱完成。

### 發布保護

- **寫作定稿 ≠ ready／published ≠ 正式公開**。不要因「定稿」自動設成 `published`、擅自承諾發布時段、觸發 GitHub Pages／Substack／電子報／Hermes 或更動 D1 發布狀態。
- 任何可能觸發發布的狀態／日期或 manifest 變更，先依現有發布規格確認具體副作用與授權；未授權則維持安全狀態，明確告知所需後續步驟。
- 此節不覆蓋既有 Substack／Chrome、GitHub 保護、身份權限、正式發布與外部寫入規則。
