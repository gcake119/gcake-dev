# Tainan City 專案｜Git Commit 歷史與架構演進紀錄

> 用途：作為 2026 iThome 鐵人賽後半段規劃、Tainan City 專案回顧與後續跨對話討論的長期資料來源。  
> 整理日期：2026-09-01  
> 範圍：目前 GitHub 可讀取的 `tainan-city-coordination`、`tainan-city-frontend`、`tainan-city-backend`、`tainan-city-document-engine` commit history。  
> 注意：本文件把「Git 可直接證明的事實」「由 commit 序列可合理推導的工程演進」「不能只靠 Git 判斷的主觀學習轉折」分開記錄。

---

# 1. 專案與 Repo 範圍

目前主要 repo：

- `gcake119/tainan-city-coordination`
- `gcake119/tainan-city-frontend`
- `gcake119/tainan-city-backend`
- `gcake119/tainan-city-document-engine`

專案公開敘述建議維持：

> **合作單位委託的內部行政流程進度管理工具**

不要在公開文章中揭露不必要的：

- 真實組織名稱。
- 案件細節。
- 個資。
- 內部業務規則。
- 部署位址或憑證資訊。

---

# 2. 這份 Git 歷史應該怎麼讀

Tainan City 的 commit history 跟 Sim-sik 不太一樣。

Sim-sik 的早期主要是：

> 需求一個一個長出來 → 實作 → 撞到邊界 → 再重新理解問題。

Tainan City 從目前可讀歷史來看，很早就已經出現：

- workflow / case lifecycle
- 規格文件
- API contract
- repo responsibility
- verification
- trial readiness
- deployment evidence

因此這份歷史更適合用來觀察：

> **作者如何把前一個產品累積的問題意識，帶進一個真實委託案，並逐步形成更正式的工程協作與驗證方式。**

但仍要注意：

> Git commit 可以證明「做了什麼」「什麼先、什麼後」，不能單獨證明作者在某個 commit 當下「第一次理解了什麼」。

若要寫「我為什麼這樣決定」，仍需搭配：

- 當時討論紀錄
- proposal / design / specs
- 使用者本人回憶
- 實際需求訪談背景

---

# 3. 第一階段：從 Excel／零散工作收斂成「案件流程」

## 2026-05-25｜1999 派案 MVP

### `51b6c8c`
`spectra(plan-1999-dispatch-mvp): 封存 1999 派案 MVP 規格`

這表示 5 月下旬已經開始用正式 change / spec 的方式描述案件派送能力，而不是只用畫面或單一功能描述需求。

---

## 2026-06-04｜從 Excel 轉成案件核心與 workflow

### `0941b99`
`spectra(replace-dispatch-excel-with-case-file-workflow): 收斂 1999-dispatch 為案件核心與批次匯入流程`

### `b0c1ad4`
`spectra(replace-penalty-excel-ledgers-with-system-workflow): 建立裁罰追蹤 Excel 替代流程`

### `5716b19`
`補齊派案案件流程規格封存`

這組 commit 是非常重要的早期方向。

Git 可直接支持：

- 原本部分工作以 Excel / ledger 形式存在。
- 系統不是單純把 Excel 資料放進網頁。
- 工作開始被整理成「案件」以及案件在不同階段的 workflow。
- 規格與 QA 測試資料已經被一併保存。

### 工程／產品意義

這一段可理解成：

> **資料表不再只是資料表，開始被理解成一個會經過不同階段、由不同人處理的案件生命週期。**

這是 Tainan City 和 Sim-sik 一個很明顯的差別：

Sim-sik 早期常先長出功能；Tainan City 很早就從整條行政流程看問題。

---

# 4. 第二階段：只有「案件狀態」還不夠，節點本身也有工作內容

## 2026-06-05｜節點專屬工作欄位

### `7cedd65`
`改用節點專屬工作欄位`

### `b212c37`
`fix(case-tracker)：收斂節點提交按鈕文案來源`

### `5fff788`
`fix(case-tracker)：補齊結案摘要節點主按鈕`

### `fd5b454`
`fix(case-tracker)：強化文件模板代入安全性`

這一段顯示專案開始處理：

- 不同流程節點需要不同工作欄位。
- 不同節點有各自的提交動作。
- 結案節點不是一般節點的單純重複。
- 文件模板與節點工作內容有關。

### 工程／產品意義

這可以整理成：

> **知道案件現在在哪一個狀態，還不足以讓使用者完成工作。**

同樣是「案件進度」，每個節點真正需要填寫、確認、上傳、產生的資料可能不同。

因此 workflow 不只是：

```text
A → B → C → D
```

還需要回答：

> **到了 B 之後，人到底要做什麼？**

---

# 5. 第三階段：從「顯示案件在哪裡」走向「現在可以做什麼」

## 2026-06-25｜今日工作台與單案工作台

### `2e21c26`
`spectra(add-today-workbench-actionability-projection): 封存今日工作台可接續判斷規格`

### `979d359`
`規劃單案節點優先工作台實作`

### `3cd38a5`
`規劃新增案件進入待派案`

### `903dc9e`
`更新新增案件實作計畫進度`

這組 commit 顯示產品開始從「追蹤」往「工作」前進。

關鍵詞是：

- actionability
- 今日工作台
- 單案節點優先
- 待派案

### 工程／產品意義

可以理解成：

> **知道案件現在在哪裡，不代表承辦人知道下一步該做什麼。**

系統開始需要進一步回答：

- 哪些案件現在可以處理？
- 哪些案件被卡住？
- 缺什麼條件？
- 現在最應該做哪一件？
- 進入單案後，當前節點需要哪些工作？

這是 Tainan City 很重要的一條產品思考線：

> **案件追蹤不是只顯示狀態，而是幫人接續工作。**

---

# 6. 第四階段：Frontend / Backend 開始需要共享同一套語意

## 2026-06-12｜案件工作台 API 規格收斂

### `5aa16b6`
`docs(api): 規劃案件工作台 API 實作`

### `b0dc5b8`
`spectra(api): 定義案件工作台 API 命名`

### `1790341`
`spectra(api): 收斂舊工作台端點規格`

### `4dd51d2`
`spectra(api): 移除舊工作台端點要求`

這些 commit 顯示 API 並不是只有「做一支 endpoint」而已，而是持續調整：

- 名稱
- 資料語意
- 舊 endpoint 是否還應存在
- 前後端對工作台的共同理解

### 工程意義

這裡可整理成：

> **畫面需要什麼，和後端提供什麼，不能只靠雙方各自猜。**

專案開始要求：

- 同一件業務事情有一致名稱。
- 舊語意退場時規格也要一起退。
- Frontend / Backend 不只是「串得起來」，還要對同一件事情有相同理解。

這是之後 API contract、cross-repo coordination 的前置基礎。

---

# 7. 第五階段：從單一程式問題走向跨 Repo responsibility

## 2026-07-07｜Verifier 與 repo ownership

### `f358124`
`規劃 SDD Verifier 階段`

### `828dd47`
`新增 Verifier manifest 驗證`

### `80c67a0`
`說明 Verifier repo ownership`

### `69c59b9`
`合併 SDD Verifier 階段`

這組 commit 很重要。

它顯示專案已經開始正式處理：

- 哪個 repo 負責什麼。
- 哪些驗證應在哪一層發生。
- 跨 repo 變更怎麼被追蹤。
- 規格與實作如何對照。

### 工程意義

這表示問題從：

> 「這段程式放在哪個檔案？」

逐漸變成：

> **「這項責任到底屬於哪個系統、哪個 repo？」**

目前四 repo 的正式分工可概括為：

### Coordination

負責：

- cross-repo specs
- architecture decisions
- migration / legacy
- implementation plans
- acceptance / evidence
- repo map

### Frontend

負責：

- Vue / Vite Web App
- browser UI
- workbench
- role-specific interaction
- browser E2E

### Backend

負責：

- NestJS API
- business rules
- authorization
- case state
- PostgreSQL
- external integration orchestration

### Document Engine

負責：

- FastAPI
- OCR / xlsx / docx / pandas
- internal-only document processing

---

# 8. 第六階段：Trial readiness——「本機能跑」不再是完成條件

## 2026-06-28｜Trial readiness 計畫

### `8652b55`
`docs: 保存 trial readiness 實作計畫`

commit 說明記錄：

> 2026-06-26 case-tracker trial readiness implementation design 與落地 plan。

---

## 2026-07-11｜Storage / backup / document service contract

### `e343b6c`
`更新 application boundary 最終驗證證據`

### `cd4980d`
`修正 Phase 1 儲存與備份契約`

### `cf5f1c3`
`固定 Phase 1 儲存掛載來源`

### `b4a9dcb`
`修正 Phase 1 文件服務連線契約`

### 工程意義

到了準備讓真實使用者 Trial 的階段，問題已經變成：

- 檔案到底存在哪裡？
- container / VM 重啟後資料還在嗎？
- 備份怎麼做？
- Backend 是否真的能找到 Document Engine？
- deployment topology 是否和文件一致？
- 試用環境和本機開發環境的差異是什麼？

這表示：

> **「功能在開發機能跑」和「系統真的可以交給別人試用」之間還有一整層工程工作。**

---

# 9. 第七階段：開始把「完成」改成「有證據可以驗證」

Tainan City 後期 commit 中大量出現：

- verify
- evidence
- acceptance
- archive
- trial deployment
- completed change

這不是偶然命名，而是開發流程逐步形成的特徵。

## 代表例子

### `2079633`
`docs(ops): 回填今日工作台 Trial 部署證據`

### `13ee764`
`docs(spectra): 完成 Trial 唯讀案件驗收`

### `353c7ec`
`docs(spectra): 封存完整唯讀案件檢視`

### `468a094`
`docs(spectra): 完成稽查員交辦驗收紀錄`

### `270d151`
`docs(spectra): 封存稽查員交辦變更`

### 工程意義

可以整理成：

> **「AI 說完成了」或「畫面看起來可以用」逐漸不再等於完成。**

變更開始需要：

- spec
- implementation
- test
- browser verification
- deployment evidence
- acceptance
- archive

這是系列後半「可靠性」最重要的真實素材之一。

---

# 10. 第八階段：自動建案不只是「自動」，還要「安全」

## 2026-08-14

### `35aa67a`
`spectra(enable-automatic-official-document-case-intake): 讓 1999 派案 PDF 可安全自動建案`

commit 顯示 change：

> `enable-automatic-official-document-case-intake`

Tasks：

> `15/15 complete`

### 工程／產品意義

這個 commit 的用詞本身很值得保留：

不是：

> 「讓 PDF 自動建案」

而是：

> **「讓 PDF 可安全自動建案」**

代表進到正式委託案之後，自動化不只看：

> 能不能省人工。

還要看：

- 輸入資料是否可信。
- 失敗時會怎樣。
- 重複資料怎麼處理。
- 是否可能錯誤建案。
- 是否有足夠驗證。

這與 Sim-sik 早期「如果可以交給系統自己做」形成很好的成長對照。

---

# 11. 第九階段：介面持續因實際工作方式重新設計

## 2026-08-13｜今日工作台重設

### `994e629`
`chore(spectra): 封存今日工作台重設`

Change：

> `redesign-today-workbench-shell-and-priority-list`

commit 說明：

> Specs: synced 14 added requirements

### 工程／產品意義

即使「今日工作台」早已存在，後來仍然重新設計 shell 與 priority list。

這可證明：

> **產品不會因為第一版工作台已經做完，就代表對使用者工作的理解固定不變。**

Tainan City 的後續產品演進仍然是：

> 實作 → 使用／驗證 → 再重新定義工作介面。

---

# 12. 第十階段：Web App Only——已經做過的架構，也可以整體撤回

## 2026-08-20｜正式確立 Web App-only

### `cd16b73`
`docs(architecture): 確立 Web App-only 前端 runtime`

之後連續出現：

### `38d34b8`
`fix(governance): 封閉 Web-only 文件與流程繞過`

### `db3c4b4`
`fix(governance): 強化 Web-only runtime acceptance gates`

### `36ec29c`
`fix(governance): 封閉 Web-only verifier 第四輪繞過`

### `94eb64f`
`fix(governance): 收斂 Web-only inventory 與政策驗證`

### `9ccde3b`
`fix(governance): enforce final web-only gates`

### `a2368d5`
`fix(governance): 收斂第六輪Web-only閘門`

後續還有：

### `c378d76`
`fix(governance): align training spec with Web-only policy`

### `0749e01`
`fix(governance): 對齊 Web-only 設計契約`

---

## 12.1 這次架構決策的實際含義

正式 Frontend boundary：

> Browser Web App only

不再提供：

- Electron runtime
- Electron packaging
- Electron shell
- IPC
- preload

正式方向：

```text
Browser
→ Vue / Vite
→ NestJS
→ FastAPI
→ PostgreSQL / file storage
```

### 工程意義

這個案例和 Sim-sik 的 n8n 退場有相似處，但成熟度不同。

Sim-sik：

> 原本方法真的改不動後，才開始換工具。

Tainan City：

> **已經存在的架構也會被重新檢查是否還有必要；決定移除後，還要建立 acceptance gate 證明它真的退出。**

因此這不只是：

> 「把 Electron 刪掉。」

而是：

> **架構決策本身也需要被驗證。**

---

# 13. 第十一階段：Training / QA data 開始成為正式工程問題

## 2026-08-24

### `46be053`
`chore(spectra): archive T07 training case cleanup`

### `c378d76`
`fix(governance): align training spec with Web-only policy`

已確認的測試資料策略包括：

- 使用 training / demo / QA 類型帳號。
- 測試資料需要配合角色與權限。
- 測試案件可以清理。
- production case 不允許使用測試清理流程。
- QA / training 資料本身也需要符合真實流程結構。

### 工程意義

測試不只是：

> 塞幾筆假的資料看畫面。

而是開始問：

> **我要怎麼準備一組能真的驗證角色、流程、個資顯示與例外情境的資料？**

這也是後續 testing / coverage / E2E 的基礎。

---

# 14. 第十二階段：權限開始從「畫面」一路追到正式操作契約

## 2026-08-31～09-01 Frontend

### `016f3bf`
`fix(dispatch): 收緊稽查員交辦權限與名冊來源`

### `3216479`
`test(dispatch): 校正正式派案瀏覽器契約資料`

### `7d2aa2b`
`fix(dispatch): 整合稽查員變更至上傳回條`

這表示到後期：

- 顯示哪些人可以被交辦。
- 哪個角色能執行操作。
- browser contract 使用什麼資料。
- 最後上傳回條的流程如何反映權限變更。

都不再是單一畫面問題。

### 工程意義

權限逐漸變成：

> **產品流程、資料來源、Frontend、Backend、E2E 驗證都需要一起對齊的工程契約。**

---

# 15. 四個 Repo 的角色演進

## 15.1 Coordination

從 commit history 可以看出它逐步成為：

- product / workflow spec SSOT
- cross-repo decision log
- migration / legacy record
- Spectra / OpenSpec change archive
- trial readiness
- deployment evidence
- verifier / acceptance
- governance
- architecture policy

它不是文件備份 repo，而是：

> **不同 repo 對同一套產品語意保持一致的協調層。**

---

## 15.2 Frontend

主要承擔：

- Vue / Vite
- 工作台 UI
- 今日工作台
- 單案工作台
- 案件列表
- role-specific interaction
- onboarding
- browser E2E
- responsive behavior
- Web-only runtime

後期可以看到 Frontend 的責任從：

> 「把資料顯示出來」

擴展到：

> **讓角色可以安全、清楚地完成實際工作。**

---

## 15.3 Backend

主要承擔：

- NestJS
- API
- case state
- transition
- role / authorization
- PostgreSQL
- files metadata
- notification
- document-engine orchestration
- trial / production behavior

後續工程線中，Backend 的角色更接近：

> **整套業務規則與權限的真正執行邊界。**

---

## 15.4 Document Engine

主要承擔：

- FastAPI
- OCR
- xlsx
- docx
- pandas
- 文件處理
- internal-only service

正式架構下：

> Browser 不直接呼叫 Document Engine。

而是：

```text
Browser → Frontend → Backend → Document Engine
```

這個 boundary 是「誰可以直接接觸哪一層」的重要例子。

---

# 16. 目前可確認的主要開發階段

## 階段 A｜把行政工作整理成案件與流程

代表：

- 1999 dispatch MVP
- Excel → case workflow
- penalty ledger → system workflow

核心：

> 不只搬資料，而是先理解整件工作怎麼流動。

---

## 階段 B｜把 workflow 拆成真正可工作的節點

代表：

- node-specific fields
- node action
- template
- closing summary

核心：

> 有狀態不代表有工作介面。

---

## 階段 C｜工作台開始回答「現在可以做什麼」

代表：

- today workbench
- actionability
- single-case node-first workbench

核心：

> 追蹤狀態 → 支援工作。

---

## 階段 D｜Front / Back / Docs 開始需要正式 contract

代表：

- API naming
- old endpoint retirement
- application boundary
- document service connection contract

核心：

> 不同程式不能各自解讀同一件業務。

---

## 階段 E｜進入 split repo / SDD / verifier

代表：

- repo ownership
- SDD verifier
- manifest verification
- cross-repo evidence

核心：

> 責任開始被正式分配與驗證。

---

## 階段 F｜Trial readiness

代表：

- storage
- backup
- deployment
- document service connectivity
- trial evidence

核心：

> 本機能跑 ≠ 可以交給使用者。

---

## 階段 G｜可靠性與 acceptance

代表：

- verifier
- browser contract
- E2E
- evidence
- archive
- deployment verification

核心：

> 完成需要證據。

---

## 階段 H｜架構持續被重新評估

代表：

- Web App Only
- Electron removal
- policy gates
- cleanup verification

核心：

> 已經實作的架構也可能需要正式退場。

---

# 17. 與 Sim-sik 的主要對照

## Sim-sik

常見節奏：

> 先做 → 撞牆 → 才知道問題叫什麼 → 再換方法

代表：

- n8n → Backend
- LINE → LINE + Web
- Sheets → Web data view

## Tainan City

更常出現：

> **以前撞過的問題，開始變成實作前就會先問的事情。**

例如：

- 先整理 workflow。
- 先定義節點工作。
- 先定 API / contract。
- 先分 repo responsibility。
- 先寫 spec / acceptance。
- 先準備 QA / training data。
- 先建立 trial readiness。
- 架構改動後還要驗證 legacy 是否真的退出。

這是鐵人賽後半「第二個專案」最重要的成長對照。

---

# 18. 對鐵人賽系列可用的思考主題

注意：以下不是建議直接一項等於一篇，而是後續分配文章時的素材。

## 18.1 從功能變成工作流程

> 第一個產品時，我常常一個功能一個功能往下做；到了第二個專案，我開始比較早問「整件工作到底怎麼流動？」

Git 證據：

- Excel → case workflow
- 1999 dispatch MVP
- penalty workflow

---

## 18.2 狀態不是答案，下一步工作才是

> 知道案件在哪裡，不代表使用者知道接下來要做什麼。

Git 證據：

- node-specific fields
- actionability projection
- today workbench
- single-case workbench

---

## 18.3 同一個意思要跨 Frontend / Backend 保持一致

> 不是 API 能回資料就好；不同系統要共享同一個業務語意。

Git 證據：

- API naming
- endpoint retirement
- contract
- application boundary

---

## 18.4 「誰負責什麼」從檔案問題變成架構問題

Git 證據：

- split repo
- repo ownership
- coordination
- frontend/backend/document-engine boundary

---

## 18.5 做完後要能證明

Git 證據：

- verifier
- trial evidence
- acceptance
- browser contract
- archive

核心：

> **我怎麼知道 AI 說「完成」是真的完成？**

---

## 18.6 真正交付前，開發環境之外還有一整層問題

Git 證據：

- trial readiness
- storage / backup
- document service connection
- deployment evidence

---

## 18.7 架構也不是一次決定永久有效

Git 證據：

- Web-only
- Electron removal
- repeated acceptance gates

核心：

> **已經做過的架構，也需要有重新評估與正式退出的方法。**

---

# 19. 不能只靠 Git 下結論的地方

以下內容若要寫成第一人稱文章，必須再確認作者當時的真實想法：

1. 為什麼一開始選擇 Electron。
2. 什麼事件真正讓作者決定 Web-only。
3. 是哪一次需求訪談讓 workflow model 形成目前樣子。
4. 作者什麼時候第一次理解 API contract 的價值。
5. 作者什麼時候開始把 verifier / evidence 當成「完成」的一部分。
6. 測試資料策略是因為哪次 bug / demo / QA 經驗形成。
7. Security review / adversarial review 是由哪次風險或交付要求觸發。
8. Document Engine 拆成獨立 FastAPI service 的原始決策理由。
9. Frontend / Backend / Document Engine / Coordination 四 repo 的真正拆分時點與主觀考量。

Git 可以證明這些東西存在與演進，但不能單獨證明「作者為什麼這樣想」。

---

# 20. 關鍵時間線速查

| 日期 | Repo | Commit | 事件 |
|---|---|---|---|
| 2026-05-25 | coordination | `51b6c8c` | 封存 1999 派案 MVP |
| 2026-06-04 | coordination | `0941b99` | Excel 派案流程收斂成案件核心與批次匯入 |
| 2026-06-04 | coordination | `b0c1ad4` | 裁罰 Excel ledger 改成系統 workflow |
| 2026-06-05 | coordination | `7cedd65` | 改用節點專屬工作欄位 |
| 2026-06-12 | coordination | `5aa16b6` | 規劃案件工作台 API || 2026-06-12 | coordination | `b0dc5b8` | 定義案件工作台 API 命名 |
| 2026-06-25 | coordination | `2e21c26` | 今日工作台 actionability projection |
| 2026-06-25 | coordination | `979d359` | 規劃單案節點優先工作台 |
| 2026-06-28 | coordination | `8652b55` | 保存 trial readiness 實作計畫 |
| 2026-07-07 | coordination | `f358124` | 規劃 SDD Verifier |
| 2026-07-07 | coordination | `828dd47` | 新增 Verifier manifest 驗證 |
| 2026-07-07 | coordination | `80c67a0` | 說明 Verifier repo ownership |
| 2026-07-11 | coordination | `cd4980d` | 修正 Phase 1 儲存與備份契約 |
| 2026-07-11 | coordination | `b4a9dcb` | 修正文件服務連線契約 |
| 2026-08-13 | coordination | `994e629` | 封存今日工作台重設 |
| 2026-08-13 | coordination | `2079633` | 回填今日工作台 Trial 部署證據 |
| 2026-08-14 | coordination | `35aa67a` | 1999 派案 PDF 安全自動建案 |
| 2026-08-20 | coordination | `cd16b73` | 確立 Web App-only runtime |
| 2026-08-20 | coordination | 多筆 | Web-only governance / verifier / acceptance gates |
| 2026-08-24 | coordination | `46be053` | 封存 training case cleanup |
| 2026-08-31 | frontend | `016f3bf` | 收緊稽查員交辦權限與名冊來源 |
| 2026-08-31 | frontend | `3216479` | 校正正式派案 browser contract data |
| 2026-09-01 | frontend | `7d2aa2b` | 整合稽查員變更至上傳回條 |
| 2026-09-01 | coordination | `270d151` | 封存稽查員交辦變更 |

---

# 21. 後續建議補查的 commit 主題

若之後要把本文件補得更完整，優先再搜尋：

## 21.1 專案最初期

- repo root commit
- 最初 proposal
- 最早 workflow diagram
- 最早角色模型
- 最早 UI prototype

## 21.2 Electron → Web-only

- Electron 最初導入 commit
- runtime / IPC / preload 建立
- 為什麼當時需要 Electron
- Web-only decision 前最後一批 Electron 使用案例

## 21.3 Testing / reliability

- coverage 導入
- missing behavior tests
- E2E baseline
- security review
- spectra audit
- adversarial review

## 21.4 Deployment / operations

- Docker
- Caddy
- PostgreSQL
- VM trial
- Gmail / LINE notification probe
- CI/CD

## 21.5 Data / privacy

- training data model
- PII display
- QA role
- audit log
- deletion / cleanup

---

# 22. 使用本文件時的判讀規則

後續新對話引用本文件時請維持：

1. **不要把 commit 順序直接當鐵人賽文章順序。**
2. **文章要寫「為什麼做這個決定」時，Git 只作事實與時序證據。**
3. **如果 Git 只證明有某項重構，不能直接寫成「我因此學會某概念」。**
4. **Tainan City 是第二個大型專案，重點應放在前一專案經驗如何轉移，而不是重新從零學一次同樣概念。**
5. **state machine 已在前文出現，後續更適合寫 workflow 如何轉成 actionability、contract、verification。**
6. **API、split repo、Verifier、Web-only 都是工程案例，不應自動變成技術教學篇。**
7. **後半系列真正有價值的成長線是：以前撞到才知道要問的問題，後來逐漸變成實作前會先問、做完會主動驗證的問題。**
8. **「完成需要證據」是 Tainan City 後期非常重要的共同特徵。**
9. **Web-only 是架構重新評估案例，不應簡化成 Electron 不好。**
10. **公開文章仍需匿名化真實業務與組織資訊。**

---

# 23. 一句話總結這段 Git 歷史

Tainan City 的開發歷程，從「把零散 Excel 與行政工作整理成案件流程」開始，逐步走向 **節點工作、actionability、API contract、跨 repo responsibility、Trial readiness、Verifier、acceptance evidence 與架構治理**；和 Sim-sik 相比，最大的差異不是技術更多，而是許多以前要撞牆後才想到的問題，開始在設計、規格、實作與驗收階段被提前提出並留下可驗證的證據。