# 2026 iThome 鐵人賽｜文章同步與自動發文流程

## 文件用途

本文件記錄 `gcake119/ithome-2026` 的文章同步、iThome 草稿匯入、每日發文與監控流程。

目的：

- 避免後續不同對話遺失已確認的發布規則。
- 區分「文章定稿」、「同步到 repo」、「iThome 草稿匯入」、「每日正式發文」四個階段。
- 維持 Markdown 單一文章來源。
- 將 Codex Computer Use 與 Hermes watchdog 的責任分開。

## 1. 文章來源與 repo

GitHub repo：`gcake119/ithome-2026`

個人連載網站：`https://gcake119.github.io/ithome-2026/`

正式文章 Markdown 放在：

```text
src/content/posts/
```

固定命名：

```text
day-01.md
day-02.md
...
day-30.md
```

GitHub Pages 固定網址：

```text
/day/01/
/day/02/
...
/day/30/
```

## 2. 專案「資料來源」與 GitHub repo 的同步規則

上傳 Markdown 到 ChatGPT 專案「資料來源」時，只視為討論、保存與後續文章銜接的資料來源。

**不會因為上傳檔案就自動同步到 GitHub repo。**

正式同步規則：

```text
單篇文章討論
→ 審稿
→ 使用者確認定稿
→ 產出完整 Markdown
→ 使用者明確說「同步到 repo」
→ 更新 src/content/posts/day-NN.md
```

文章在哪個對話完成定稿，就直接在該對話同步到 repo，不需要回到自動發文流程對話。

本對話主要保留給：

- GitHub Pages / repo 架構
- iThome 發文流程
- Codex Computer Use skill
- 草稿盤點與修復
- Hermes watchdog
- 發布異常處理

目前已經放入 repo 的 Day 1～5，先視為**測試稿**。正式同步時，以當時確認的最新定稿覆蓋。

## 3. Markdown 是唯一正式文章來源

正式內容只維護在 repo Markdown。

iThome 不另外人工維護第二份文章來源。

iThome 專用第一行：

```text
本文同步刊載於個人連載網站：https://gcake119.github.io/ithome-2026/day/NN/
```

**不寫回原始 Markdown。**

由發布流程動態產生。

Repo 已提供：

```bash
pnpm ithome:prepare -- --day N
```

以及 machine-readable 版本：

```bash
pnpm ithome:prepare -- --day N --json
```

輸出內容包含：

- `day`
- `dayString`
- `title`
- `body`
- `canonicalUrl`
- `syncLine`
- `publishDate`

其中 `body` 已經自動在第一行加入對應 GitHub Pages 網址。

## 4. 不再使用 Playwright 操作 iThome

曾經測試過 Playwright：

```text
首頁
→ 鐵人發文
→ 選鐵人賽系列
→ 編輯頁
→ 儲存草稿
```

雖然曾成功將 Day 5 存為草稿，但多次測試後觸發：

- Cloudflare error page
- Too Many Requests
- rate limit

因此決定：

> **移除 repo 中的 Playwright iThome UI 自動化。**

Repo 不再保存：

- Playwright dependency
- iThome browser session
- storage state
- sync-draft
- safe-check
- Playwright publisher

Repo 只負責產生發文 payload。

## 5. iThome UI 操作改由 Codex Computer Use 負責

正式方向：

```text
ithome-2026 repo
→ pnpm ithome:prepare
→ publishing payload
→ Codex Computer Use
→ iThome
```

Codex Computer Use 不自行改寫文章。

標題與正文必須完全以 repo payload 為準。

## 6. 開賽前：準備 payload，並以實際 UI 能力決定草稿匯入範圍

開賽前一定先完成本機端準備：

```text
Day 01～30 Markdown
→ 逐篇產生 payload
→ 建立本機 inventory
→ 驗證 Day、title、body、canonical URL
```

`import-drafts --all` 是否能在 Day 1 發布前使用，不能只依舊假設決定。已確認公開的 `/ironman/<series-id>` 系列頁要等 Day 1 正式發布後才會產生；目前 UI 截圖只能證明開賽前可以選參賽題目、編輯文章及儲存草稿，尚不能證明 Day 01～30 可同時作為彼此獨立的未來草稿存在。

因此 skill 支援此命令，但先設能力閘門：

```text
import-drafts --all
```

只有在 Computer Use 實測確認下列條件後才可啟用：

- 儲存 Day 01 草稿後，能建立並保留不同內容的 Day 02 草稿。
- 回到草稿列表時，兩篇都能個別辨識並開啟。
- 儲存第二篇沒有覆蓋第一篇。
- 全程不需要 series id，也沒有正式發表。

在尚未取得這份證據前，安全基線為：

```text
先完成 Day 01～30 本機 payload inventory
→ iThome 最多只建立 Day 01 草稿
→ Day 1 正式發布並完成 bootstrap
→ 再重新驗證 Day 02～30 批次匯入能力
```

如果實測證明 iThome 支援多篇賽前草稿，才可依保守節奏逐篇匯入，每篇儲存後確認草稿存在；若不支援，就改成 Day 1 bootstrap 後匯入 Day 02～30。

也需支援：

```text
import-drafts --day N
```

用途：

- 單篇補建
- 測試
- 修復漏傳

所有草稿匯入都只能點「儲存草稿」，不得點「發表文章」。

## 7. 草稿盤點 audit

建立全部草稿後，必須做：

```text
audit-drafts
```

至少檢查：

- Day 01～30 是否全部存在
- 是否有 missing
- 是否有 duplicate
- title 是否正確
- canonical URL 是否正確
- 是否仍是草稿
- 是否有 mismatch
- 是否已有文章被正式發布

Day 1 bootstrap 前不存在可用的公開 series URL。此時 audit 不得猜測 series id；公開系列檢查應明確記為：

```text
not_available_pre_bootstrap
```

草稿仍以參賽分類、完整參賽題目名稱、`18th鐵人賽` tag、payload title 與 canonical URL 交叉辨識。Day 1 bootstrap 後，公開狀態才可沿用已驗證的 series state。

建議 machine-readable 結果：

```json
{
  "status": "incomplete",
  "expected": 30,
  "found": 28,
  "missing": [7, 19],
  "duplicate": [],
  "mismatch": [],
  "auditedAt": "...",
  "source": "codex-ithome-ironman-publisher"
}
```

狀態至少包含：

```text
complete
incomplete
conflict
failed
```

## 8. 草稿缺漏修復

預計支援：

```text
repair-drafts --all
```

與：

```text
repair-drafts --day N
```

規則：

- `missing`：可以自動補建。
- `duplicate`：只回報，不自動刪除。
- `mismatch`：只回報，不自動覆寫。
- 已公開文章：不得因 repair 自動修改。

原則：

> 缺少可以補；有衝突不能自行猜哪一份是正確的。

repair 完成後應重新執行 `audit-drafts`。

只有 audit 才能確認：

```text
30/30 complete
```

## 9. 比賽期間：Day 1 bootstrap，之後每天只發布一篇既有草稿

每天正式發文只做：

```text
publish-day --day N
```

Day 1 是 bootstrap 流程：

```text
publish-day --day 1
→ 驗證唯一且內容正確的 Day 1 草稿
→ 確認尚未公開
→ 最多點一次「發表文章」
→ 驗證 Day 1 公開文章
→ 從文章標題上方的系列連結取得 series URL
→ 驗證系列頁及 Day 1 身分
→ 寫出 verified bootstrap state
```

公開文章標題上方的資訊列會顯示分類、可點擊的完整系列名稱，以及「系列第 1 篇」。series URL 必須從這個實際連結取得，不得由文章網址或名稱自行推測。

Day 2～30 流程：

```text
指定 Day N
→ 讀取且驗證 Day 1 bootstrap state
→ 找 Day N 既有草稿
→ 確認只有一篇
→ 驗證 title
→ 驗證 canonical URL
→ 確認尚未公開
→ 展開「儲存草稿」旁選單
→ 點一次「發表文章」
→ 驗證公開文章
```

`publish-day` 不負責建立新草稿。

Day 2～30 若缺少有效的 `seriesUrl`／`seriesId`，必須停止並回報 bootstrap 尚未完成，不得自行猜測或借用其他系列的 id。

如果發現 Day N 草稿缺少：

```text
publish-day
→ 停止
→ repair-drafts --day N
→ audit
→ 重新執行 publish-day
```

## 10. 發布安全規則

### 不得自行改稿

Codex 不得自行修改：

- title
- body
- canonical URL

文章內容完全以：

```bash
pnpm ithome:prepare -- --day N --json
```

輸出為準。

### 不得自行猜 Day

Day 必須來自使用者明確指定或未來明確排程。

### Publish 最多點一次

一次 `publish-day` 執行最多只允許一次 publish click。

若點擊後狀態不確定：

```text
不要再點一次
→ 先查公開頁
→ 確認是否已發文
```

Day 1 若文章已公開但尚未取得系列連結，屬於「發布成功、bootstrap 尚未完成」；後續只能繼續唯讀驗證與擷取系列資訊，不得再次點 publish。

### 不得猜測 series id

`seriesUrl` 必須來自 Day 1 公開文章標題上方的實際系列連結，並驗證：

- host 為 `ithelp.ithome.com.tw`
- path 符合 `/ironman/<series-id>`
- `seriesId` 與 URL path 一致
- 系列頁名稱正確，且可找到 Day 1

### 不自動刪除

Codex 不得自動刪除：

- 草稿
- 重複稿
- 已公開文章

### Cloudflare / 429

如果出現：

- Cloudflare
- Too Many Requests
- HTTP 429
- 登入失效
- 頁面狀態不確定

規則：

```text
立即停止
→ 回報
→ 不持續重試
→ 不嘗試繞過反自動化機制
```

## 11. Codex Computer Use skill 預計能力

已建立一個 iThome 鐵人賽 publisher skill，支援：

```text
import-drafts --all
import-drafts --day N

audit-drafts

repair-drafts --all
repair-drafts --day N

publish-day --day N
```

Skill 負責：

- Computer Use
- iThome 草稿操作
- audit
- repair
- publish
- Day 1 bootstrap identity 擷取與驗證
- bootstrap／audit／publish machine-readable state

其中 `import-drafts --all` 在賽前多草稿能力尚未實測通過前保持停用；這是安全閘門，不代表命令被刪除。

Repo 負責：

- Markdown
- payload
- canonical URL

## 12. Hermes watchdog

Hermes 與 Codex publisher 保持獨立。

環境：

- Hermes 安裝在 Mac 的 `hermes` 使用者。
- 主 macOS 使用者可以透過 Telegram 收到 Hermes 推播。

Hermes 不負責：

- 登入 iThome
- 操作 iThome
- 發文
- 修改草稿
- 判斷文章內容

Hermes 主要負責：

- 公開頁是否今日已發文的 watchdog。
- 接收 Codex audit 結果。
- 異常時透過 Telegram 通知。

### Day 1 bootstrap state

Day 1 發布並完成公開驗證後，Codex 以 atomic write 寫出最小必要狀態，建議共享路徑：

```text
/Users/Shared/ithome-ironman-bridge/state/series-bootstrap.json
```

核心欄位：

```json
{
  "schemaVersion": 1,
  "source": "codex-ithome-ironman-publisher",
  "repository": "gcake119/ithome-2026",
  "contest": "18th-ironman-2026",
  "bootstrapDay": 1,
  "status": "verified",
  "articleUrl": "https://ithelp.ithome.com.tw/articles/...",
  "seriesUrl": "https://ithelp.ithome.com.tw/ironman/...",
  "seriesId": "...",
  "publishedAt": "...",
  "verifiedAt": "...",
  "runId": "..."
}
```

只有 `status: "verified"` 的 state 可供 Day 2～30 與 Hermes 使用。失敗或不確定事件只寫 operation event，不得覆蓋既有 verified state。

Hermes 在 Day 1 正式發布前沒有 series URL，因此 19:00／22:30 watchdog 若仍讀不到有效 verified bootstrap state，必須通知人工確認，不能視為正常而靜默。取得 verified state 後，才改用 `seriesUrl` 監控公開系列頁。

## 13. Hermes 草稿 audit 通知

Codex `audit-drafts` 負責判斷：

```text
complete
missing
duplicate
mismatch
failed
```

Hermes 只接收 machine-readable state。

### complete

```text
30/30 complete
```

預設：靜默，不通知。

### missing

例如：

```text
iThome 草稿盤點異常

目前 28/30 篇
缺少：
- Day 07
- Day 19

可以執行 repair-drafts 補傳。
```

### duplicate

例如：

```text
iThome 草稿盤點異常

發現重複草稿：
- Day 12

未自動刪除任何內容，請確認。
```

### mismatch

例如：

```text
iThome 草稿盤點異常

內容不一致：
- Day 04

未自動覆寫，請確認。
```

### audit failed

例如：

```text
iThome 草稿盤點失敗

本次無法可靠完成草稿檢查。
請查看 Codex audit log。
```

## 14. Codex 與 Hermes 的安全邊界

必須維持：

```text
Codex
- 不取得 Telegram Bot credential
- 不直接發 Telegram
- 只產生 machine-readable state

Hermes
- 不取得 iThome session
- 不操作 iThome
- 只讀 bootstrap / audit / publish state
- 負責 Telegram notification
```

兩者只交換最小必要資訊。

## 15. 每日正式運作概念

開賽前：

```text
文章全部定稿
→ 同步 repo
→ 建立 Day 01～30 payload inventory
→ 用 Day 01、Day 02 驗證 iThome 多草稿能力
→ 通過才啟用 import-drafts --all
→ 未通過則只保留 Day 01 草稿，等待 bootstrap
```

Day 1：

```text
Codex
→ publish-day --day 1
→ 最多一次 publish click
→ 驗證公開文章
→ 從標題上方系列連結取得 seriesUrl / seriesId
→ 寫入 verified bootstrap state

Hermes
→ state 未就緒：19:00／22:30 提醒人工確認
→ state 已就緒：開始系列頁 watchdog
```

Day 2～30 每天：

```text
GitHub Pages
→ 依 publishDate 自動部署 Day N

Codex
→ 驗證 bootstrap state
→ publish-day --day N

Hermes
→ 公開頁 watchdog
→ 已發文：靜默
→ 未發文：Telegram 提醒
```

## 16. 目前文章同步慣例

之後每篇文章：

```text
專案內新對話討論 Day N
→ 審稿
→ 定稿
→ 產出 Markdown
→ 使用者說「同步到 repo」
→ 更新 gcake119/ithome-2026
```

單純上傳到 ChatGPT 專案「資料來源」：

> 不會自動同步 GitHub。

## 17. 目前待辦

1. 繼續完成 Day 6～30 文章。
2. 每篇定稿後由使用者明確要求同步 repo。
3. 以 Day 01、Day 02 草稿做不發布的 UI 能力測試，確認賽前多草稿是否成立。
4. 只有測試通過後才啟用 `import-drafts --all`；否則等待 Day 1 bootstrap 後再匯入 Day 02～30。
5. 完成共享 state 目錄最小權限設定與 Hermes 只讀整合。
6. Hermes 加入草稿 audit 異常 Telegram 通知。
7. Hermes 加入 Day 1 bootstrap state 缺失的 19:00／22:30 通知。
8. 正式 Day 1 發布後驗證文章、擷取系列連結並寫入 verified bootstrap state。
9. Day 2～30 發布前強制驗證 bootstrap state，Hermes 獨立監控公開系列頁。