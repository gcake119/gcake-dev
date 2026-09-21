# Sim-sik 專案｜Git Commit 歷史與架構演進紀錄

> 用途：作為 2026 iThome 鐵人賽連載與後續 Sim-sik 討論的長期專案資料來源。  
> 整理日期：2026-09-01  
> 範圍：目前 GitHub 可讀取的 `sim-sik-backend`、`sim-sik-frontend`、`sim-sik-coordination` commit history，並標記 Git 歷史缺口。  
> 注意：本文件把「Git 可直接證明的事實」與「由 commit 序列推導出的產品／工程意義」分開記錄。

---

## 1. 先讀這裡：歷史範圍與重要限制

目前可讀取的三個主要 repo：

- `gcake119/sim-sik-backend`
- `gcake119/sim-sik-frontend`
- `gcake119/sim-sik-coordination`

目前 GitHub 可回溯的 split-repo 歷史，最早集中在 **2026-07-04**。

### 1.1 這不等於 Sim-sik 是 7 月才開始

Sim-sik 在 7 月以前已經有一段更早的開發歷程：

1. 從諮商所預約／行政工作流觀察形成需求。
2. 最初嘗試使用 n8n 與 LINE 對話完成多步驟預約流程。
3. 流程複雜後，n8n 畫布與節點數量快速膨脹。
4. 開始理解狀態機，並判斷 n8n 不適合作為整套產品核心。
5. 改成完整 Backend，核心預約與業務邏輯由自己維護。
6. LINE Flex 功能繼續增加。
7. Mentor 指出櫃台端「太工程師了」，促使產品重新思考櫃台介面。
8. 之後才進入 2026-07 的 split-repo、Frontend 工作台與資料層重構階段。

### 1.2 GitHub 現況無法完整還原 7 月以前的 commit history

2026-07-04 coordination 初始文件保留了舊 repo 名稱：

- `counseling-booking-coordination`
- `counter-web`
- `mvp-backend-nestjs`

但目前這些舊 repo／路徑已無法從 GitHub 直接讀取。

因此：

- **n8n → 第一版 NestJS Backend**
- **早期 LINE Flex 功能累積**
- **mentor feedback 前後的完整 commit 序列**

不能只靠目前 GitHub commit history 還原。

這一段歷史後續應以以下來源交叉確認：

- 已定稿鐵人賽 Day 3–11
- 連載進度與銜接紀錄
- 舊規格／設計文件
- 使用者本人回憶
- 若之後找到本機舊 repo，再補回 Git commit 證據

---

# 2. 2026-07-04：產品重新畫邊界的明確起點

## 2.1 Coordination：先定義「櫃台需要完整 Web 工作台」

### `8298e9e`
**日期：2026-07-04**  
**訊息：** `建立櫃台前端協作規格`

這是目前可讀 coordination repo 的 root commit。

初始設計文件已明確記錄：

- mentor 建議櫃台端不應把複雜操作都塞進 LINE Flex。
- 既有 Backend 已承載多數櫃台業務邏輯。
- 這次不是重寫業務核心。
- 目標是把櫃台 LINE Flex 操作轉成更適合桌面／平板的 Web UI。
- 採 split-repo 架構。
- `counter-web` 使用 Vue 3 + Vite + TypeScript。
- `mvp-backend-nestjs` 繼續負責 Backend、業務規則、PII、LINE、Google、Email、DB。
- 個案功能維持 LINE 對話為主。
- 心理師是否需要獨立前端另案討論。
- 第一版心理師管理由櫃台 Web 承接。
- 櫃台 LINE 可保留登入、通知、告警、輕量入口或備援，但不再作為複雜行政操作的主要介面。

### 產品意義

這個 commit 證明：

**「櫃台需要 Web」不是後來做到預約列表時才逐漸想到，而是在 split repo 之前就已經成為明確產品方向。**

因此鐵人賽 Day 9／10 與後續文章的分界可理解為：

- Day 9／10：為什麼發現原本操作方式有問題。
- 7 月之後：這個發現如何實際改變產品架構與角色邊界。

---

## 2.2 Backend：既有後端被拆成獨立 repo

### `6c35f18`
**日期：2026-07-04**  
**訊息：** `初始化後端子專案基準`

這是目前 `sim-sik-backend` 可見歷史的 root commit。

重要判讀：

- 這不是「第一次建立 NestJS Backend」。
- root commit 已經是一個有既有業務邏輯的 Backend 基準。
- 因此不能把 2026-07-04 誤寫成「從 n8n 改成 Backend」的日期。

### `1ccdf59`
**訊息：** `整理後端子專案 CI 設定`

表示 split 後很快開始把 Backend 當成獨立可驗證、可部署的子專案管理。

---

## 2.3 Frontend：正式獨立建立櫃台 Web repo

### `e895df9`
**日期：2026-07-04**  
**訊息：** `初始化櫃台前端專案骨架`

這是目前 `sim-sik-frontend` 的 root commit。

### `04cc6b1`
**訊息：** `補齊櫃台前端測試設定`

### `a0b8b2e`
**訊息：** `修正櫃台前端端對端空測試檢查`

### 工程／產品意義

Frontend 一開始就被當成正式獨立產品介面，而不是臨時補一張預約頁。

---

# 3. 2026-07-04～07-07：資料層開始被重新整理

這一段主要發生在 `sim-sik-backend`。

## 3.1 Prisma 基礎與 schema parity

### `4cb75f7`
`更新 Prisma 資料層政策文件`

### `ee9b3bc`
`釐清 Prisma 遷移文件過渡狀態`

### `f590b20`
`補齊 Prisma 部署文件過渡註記`

### `3bb817c`
`修正 Prisma 部署文件章節層級`

### `1c5780b`
`建立 Prisma 資料層基礎`

### `400e011`
`補齊 Prisma schema 關聯與啟動容錯`

### `76f4ae2`
`驗證 Prisma 與 legacy schema parity`

### `abf1720`
`補強 schema parity 目標資料庫檢查`

### `da261ed`
`強化 schema parity 乾淨資料庫檢查`

### `92f3365`
`補齊 schema parity composite type 檢查`

### `da09d7e`
`新增 Prisma persistence 錯誤邊界`

### `01ec55a`
`收窄 Prisma persistence 錯誤判斷`

---

## 3.2 各業務資料逐步遷移

### `d7364e4`
`遷移系統設定與公休資料存取至 Prisma`

### `ebac599`
`遷移心理師與個案資料存取至 Prisma`

### `580da50`
`修正公休 repository 交易邊界`

### `4209d57`
`修正心理師費率交易邊界`

### `116cf96`
`遷移報表與診斷查詢至 Prisma`

### `57f13de`
`遷移預約交易資料層至 Prisma`

### `ca11a71`
`修正預約交易 Prisma 錯誤判斷`

### `972d6fc`
`補強預約交易外鍵錯誤測試`

### `c178ff0`
`遷移收費與對話 session 至 Prisma`

### `63ead08`
`補強收費交易主路徑測試`

### `0f99d7e`
`移除舊 DatabaseService production path`

### `81ce5dc`
`補上 Prisma parity 預設資料庫`

### `d043b61`
**日期：2026-07-07**  
**訊息：** `完成 Prisma 資料層遷移`

commit 說明指出：

- production data access 收斂到 Prisma-backed repository/data access boundary。
- 移除 legacy `DatabaseService` application path。
- 補 static gate、schema parity 與部署文件。
- 執行 build、test、E2E 與資料庫 parity 驗證。

---

## 3.3 可用於連載的工程意義

這批歷史能證明：

**「改用自己的 Backend」之後，仍然要繼續處理資料責任與系統邊界。**

可以觀察到的問題包含：

- 哪一層真正負責資料讀寫。
- 新舊資料結構是否一致。
- transaction 邊界。
- persistence error 如何被辨識。
- 舊資料存取路徑如何正式退場。

但不能只靠 commit 推論：

> 使用者是在某一個特定 bug 或事件後「突然理解」這些概念。

文章若要描述主觀學習轉折，仍需使用者回憶補證。

---

# 4. 2026-07-07～07-10：LINE 開始從「產品本身」被拆成 presentation layer

Backend 出現一系列 LINE presenter 重構。

### `5a55268`
`refactor: 收斂 LINE 訊息型別輔助`

### `ee36ce2`
`refactor: 拆分 LINE 預約訊息 presenter`

### `6fef612`
`docs: 建立後端服務重構地圖`

### `7c141c6`
`refactor: 拆分 LINE 收費與收據 presenter`

### `463be91`
`test: 補強收費操作 postback 契約`

### `477d555`
`refactor: 拆分 LINE 心理師 presenter`

### `e6d695d`
`refactor: 解耦心理師 presenter 型別來源`

### `385c70b`
`refactor: 拆分 LINE 排班與臨時休診 presenter`

### `adbd92a`
`docs: 更新 LINE 訊息服務重構量測`

### `eae2471`
`refactor: 收斂 LINE presenter 型別與共用格式化`

### `e4dc6de`
`docs: 修正 LINE presenter 重構狀態`

---

## 4.1 產品意義

早期產品思考比較接近：

> 「這件事情怎麼在 LINE 裡完成？」

這批 commit 顯示 Backend 開始把：

- 預約／收費／心理師／排班等業務語意

和：

- LINE 裡要如何呈現、如何回 postback

逐步拆開。

可用於後續文章的核心觀察：

**LINE 從「整套產品」逐步變成產品的一個互動介面。**

這條線與 Day 11「n8n 不等於產品核心」可以形成後續延伸：

- n8n 不再是核心。
- LINE 也不再等於產品本身。
- 業務核心逐步可以被不同介面共用。

---

# 5. 2026-07-09～07-11：先建立「櫃台工作環境」，不是先做一張預約頁

Frontend 在真正交付預約 Phase 1 前，先建立工作台本身。

## 5.1 Session 與 Frontend boundary

### `cdc59d2`
**日期：2026-07-09**  
`chore: 建立正式前端 session adapter 邊界`

### `935b0f3`
`test: 補強前端 session adapter 防護`

---

## 5.2 Counter 工作台 shell

### `0fac301`
**日期：2026-07-10**  
`設定 counter 工作台路由基底`

### `f6c4290`
`建立 counter 工作台 session shell 與報修表單`

### `4b09d7a`
`遷移 counter media settings routes`

### `e15681c`
`在 counter shell 顯示操作手冊`

### `9a4b0d0`
`完善操作手冊工作台導覽`

### `36fa275`
`建立櫃台功能存取規則`

### `6d70732`
`建立櫃台工作台共用存取殼層`

### `cd277e9`
`整合櫃台功能頁至共用殼層`

### `5cca895`
`修正櫃台首頁間距與檢視樣式`

### `2b44b24`
`依櫃台權限顯示工作台功能`

### `cc86dc9`
`修正櫃台首頁導覽名稱`

### `a1d83ab`
`補齊工作台存取狀態瀏覽器驗證`

### `77217c1`
`補強未授權頁返回連結驗收`

### `7a8f3a8`
`修正櫃台登入導向與路由權限定義`

### `8f43c0b`
**日期：2026-07-11**  
`建立櫃台工作台設計系統`

---

## 5.3 Backend 同期建立櫃台 principal/session contract

### `84f3b4a`
`修正情境診斷 repository 注入`

### `7aec57e`
`實作 counter principal session contract`

這表示 Web 工作台建立時，Backend 也開始明確定義：

- 現在操作的人是誰。
- 工作台如何取得 principal/session。
- 前端顯示與 Backend 權限判斷如何分工。

---

## 5.4 產品意義

這段歷史證明：

**mentor feedback 最後不是變成「多做一個網頁」，而是形成一個完整的櫃台工作環境。**

在真正把核心預約功能搬進來以前，就已經先處理：

- routing
- layout/shell
- session
- 登入
- 未授權
- 功能存取
- 操作手冊
- 報修
- media settings
- design system

後續連載可用的敘事重點：

> 原本 LINE 裡是一條一條功能；建立 Web 之後，開始思考的是「櫃台每天工作的地方應該長什麼樣子」。

---

# 6. 2026-07-12：Phase 1 預約「唯讀」工作台

## Backend

### `6986da4`
**日期：2026-07-12**  
`feat(counter): 提供 Phase 1 預約唯讀投影`

## Frontend

### `4f88c6b`
**日期：2026-07-12**  
`feat(appointments): 交付 Phase 1 預約唯讀工作台`

### `8230107`
`chore(dev): 允許 Cloudflare 測試 tunnel host`

---

## 6.1 產品意義

完整櫃台工作台建立後，第一個真正搬進去的核心業務能力不是「所有預約功能」，而是：

**先讓櫃台用適合自己的介面看得到預約。**

這與早期 LINE／Sheets 的使用經驗形成明顯對照：

- LINE 適合互動，但一次能掌握的資訊有限。
- Sheets 可以看很多資料，但不是最適合完成操作的工作台。
- Web 工作台開始把「掌握資訊」本身視為櫃台工作的正式需求。

也可以看出遷移策略不是一次大搬家：

> 先建立工作環境 → 先讀 → 再逐步增加寫入／異動。

---

# 7. 2026-08-13～08-14：Phase 2 預約異動與 Calendar 投影

Frontend 與 Backend 在 Phase 1 之後隔了一段時間，再交付預約異動。

## Backend

### `d9e9a96`
**日期：2026-08-13 / 08-14（UTC 時間）**  
`feat(appointments): 交付櫃台預約異動與 Calendar 投影`

後續 CI／DI 修正：

### `09e8dca`
`fix(ci): restore backend verification pipeline`

### `de2b96d`
`fix(di): expose appointment mutation provider tokens`

### `ee6de50`
`fix(ci): generate Prisma client explicitly`

### `986e9d1`
`fix(di): wire scheduling case guard dependencies`

## Frontend

### `48620c0`
**日期：2026-08-13 / 08-14（UTC 時間）**  
`feat(appointments): 交付櫃台預約異動工作台`

## Coordination

同一階段有 Phase 2 規格與封存紀錄：

### `5d706e3`
`spectra(deliver-phase-2-appointment-mutations): 交付櫃台預約異動切片規格與證據`

### `e81ce8b`
`docs(workbench): 封存 Phase 2 預約異動切片`

### `b51bb21`
`docs(workbench): 回填 Phase 2 封存與推送證據`

---

## 7.1 產品意義

演進順序為：

1. 建立櫃台工作台。
2. 預約唯讀。
3. 預約異動。
4. 異動後持續投影到 Google Calendar。

這表示：

**有自己的 Web 工作台之後，外部工具不是全部退場。**

Calendar 仍然保留適合它的角色。

這對後續「邊界」主題很重要：

- Web 接手櫃台複雜行政操作。
- LINE 留下適合對話、通知、入口的工作。
- Calendar 留下行程檢視／同步。
- 工具是否保留，取決於它適合承擔什麼，而不是「產品有自己的前端後就全部自己做」。

---

# 8. Coordination repo 的角色

2026-07-04 root commit 已把 coordination 定義為 split-repo workspace 的協調層。

主要責任：

- 跨 repo 產品規格。
- 架構決策。
- 部署策略。
- onboarding。
- provider selection。
- 多機構 rollout。
- 跨 frontend/backend implementation plan。
- API contract 可在 coordination 描述，但 runtime code 不放這裡。
- UI flow 可在 coordination 描述，但 Vue 元件與測試放 frontend。

這表示到 7 月後，Sim-sik 不只產品架構變複雜，開發方式本身也進入：

**多 repo + 規格協調 + 明確 responsibility boundary。**

---

# 9. 三個 repo 的歷史起點

| Repo | 目前可見 root commit | 日期 | 意義 |
|---|---|---|---|
| `sim-sik-coordination` | `8298e9e` 建立櫃台前端協作規格 | 2026-07-04 | Web 工作台方向與 split repo 先被正式記錄 |
| `sim-sik-backend` | `6c35f18` 初始化後端子專案基準 | 2026-07-04 | 從既有 Backend 拆出獨立 repo，不是第一次建立 Backend |
| `sim-sik-frontend` | `e895df9` 初始化櫃台前端專案骨架 | 2026-07-04 | 正式建立獨立 Vue 櫃台 Web |

---

# 10. 目前可確認的整體架構演進

## 階段 A：n8n／LINE 為主要想像框架
**Git 證據不足，主要來自前文與使用者回憶。**

- 希望所有行政需求都可在 LINE 完成。
- 使用 n8n 串接多步驟互動。
- 功能與流程增加後畫布膨脹。
- 開始接觸狀態機。
- 判斷 n8n 不適合成為產品核心。

## 階段 B：完整 Backend 承接產品核心
**7 月以前已經發生。**

- NestJS Backend 承接預約、狀態與業務邏輯。
- LINE Flex 繼續作為主要操作介面。
- Google Workspace 各自承接資料檢視／行事曆／文件／郵件等工作。

## 階段 C：mentor feedback 促使櫃台介面重新定義
**2026-07-04 coordination root commit 已留下直接證據。**

- 複雜櫃台操作不應繼續塞在 LINE Flex。
- 決定建立完整櫃台 Web 工作台。
- 個案仍以 LINE 為主。
- 心理師獨立介面另案評估。

## 階段 D：產品核心、LINE、Web 開始分層
**2026-07。**

- Backend 資料層重構。
- LINE presenter 拆分。
- Frontend 建立自己的 shell、routing、session、權限與 design system。
- LINE 不再等於產品本身。

## 階段 E：功能逐步搬進 Web
**2026-07～08。**

- Phase 1：預約唯讀。
- Phase 2：預約異動。
- Calendar 仍作為投影／同步層留下。

---

# 11. 對鐵人賽文章的可用結論

以下是 Git history 能支持、適合後續文章使用的核心觀察。

## 11.1 Day 11 後不能再重寫「n8n 不適合」

Day 11 已經完成：

> 找到工具 ≠ 理解問題。  
> n8n 能串流程，不等於適合承擔完整產品核心。

後續的新發展應該往：

> Backend 建立之後，系統還有哪些邊界需要重新畫。

---

## 11.2 LINE 的角色有第二次重新定義

早期：

> LINE ≈ 產品本身。

後來：

> LINE = 產品的一個互動通道／介面。

Git 證據：

- 預約 presenter
- 收費 presenter
- 心理師 presenter
- 排班／臨時休診 presenter
- 共用 presenter 格式化

這條線適合寫成「產品核心與介面分開」的思考轉折。

---

## 11.3 「做 Web」真正改變的是角色工作環境

Git 證據顯示 Web 一開始先處理：

- session
- shell
- routing
- access rule
- manual
- unauthorized flow
- design system

之後才進入預約。

因此後續文章不應只寫：

> 我做了一個 Web 後台。

更準確的主題是：

> 我開始把「櫃台怎麼工作」當成一個完整介面問題。

---

## 11.4 「角色身分」與「可以做什麼」開始分開

Git 證據：

- counter principal session contract
- frontend session adapter
- access rule
- 依權限顯示功能
- route guard／unauthorized flow

可延伸為：

> 知道這個人是誰，和知道他能做什麼，是兩個不同問題。

---

## 11.5 重畫邊界不是大爆改，是逐步搬移

Git 序列：

> 建 shell → 唯讀 → 異動

而不是：

> 決定做 Web → 一次把 LINE 所有功能搬掉。

這可以支撐「邊界是逐步重新判斷」的文章主題。

---

## 11.6 自己做產品，不等於所有工具都要自己取代

Phase 2 仍保留 Calendar 投影。

因此目前至少能直接確認：

- Web 與 LINE 共存。
- Web 與 Calendar 共存。

Sheets／Drive／Mail 的最終角色變化，目前 post-split commit history 還不足以單獨還原完整時間線；後續若要寫，應再讀現有程式碼與文件。

---

# 12. 後續待補證的歷史

若之後要把本文件補成更完整的 Sim-sik development history，優先找：

## 12.1 n8n 階段

需要找：

- 第一版 n8n workflow。
- 哪些流程造成畫布膨脹。
- 何時開始出現 session/state 問題。
- 何時正式決定不用 n8n 承擔核心。

## 12.2 第一版 NestJS Backend

需要找：

- 最早 NestJS repo／資料夾。
- 第一個 webhook。
- state machine 的最初實作。
- LINE Flex 如何從 n8n 搬進 Backend。
- DB 最初選型與 schema。

## 12.3 Google Workspace 角色變化

需要找：

- Google Sheets 最早負責什麼。
- 何時開始不再把 Sheets 當主要資料／報表層。
- Calendar 同步的版本歷史。
- Drive 電子收據備份的歷史。
- Gmail／Mail 每日摘要與收據寄送歷史。

## 12.4 Frontend 後續 Phase

目前已確認 Phase 1／2。

仍可補：

- Client management
- Therapist management
- Charging/receipt
- Scheduling
- Settings
- Reports
- onboarding
- deploy / multi-tenant

---

# 13. 使用本文件時的判讀規則

後續新對話若引用本文件，請遵守：

1. **不要把 2026-07-04 當成 Sim-sik 開始日期。**
2. **不要把 `初始化後端子專案基準` 當成第一次從 n8n 改 NestJS。**
3. **mentor feedback 發生在 Web repo 建立之前；7/4 文件是 feedback 已經轉成產品決策後的證據。**
4. **Day 9／10 已經寫過「櫃台操作方式有問題／需要重新思考介面」。**
5. **Day 11 已經寫過「n8n 工具選型暴露出對問題理解過度簡化」。**
6. **後續文章應聚焦 Day 11 之後的新理解，不重複前文。**
7. **Git commit 能證明實作順序，但不能單獨證明作者當時的主觀想法；涉及「我當時才發現／我因為某件事理解」時，需要作者回憶或其他文件支持。**
8. **Sheets／Drive／Mail 的角色變化目前不能只靠這份 commit history 下完整結論。**
9. **目前最明確可寫的新線索是：產品核心 vs 介面、角色工作環境、身分 vs 權限、功能逐步遷移、外部工具角色重分配。**

---

# 14. 關鍵時間線速查

| 日期 | Repo | Commit | 事件 |
|---|---|---|---|
| 2026-07-04 | coordination | `8298e9e` | 建立櫃台前端協作規格；正式記錄 mentor feedback 後的 Web 工作台方向 |
| 2026-07-04 | backend | `6c35f18` | 初始化既有 Backend 的 split-repo 基準 |
| 2026-07-04 | frontend | `e895df9` | 初始化獨立櫃台 Frontend |
| 2026-07-04～07-07 | backend | 多筆 | Prisma 資料層與 legacy DatabaseService 遷移 |
| 2026-07-07 | backend | `d043b61` | 完成 Prisma 資料層遷移 |
| 2026-07-09～07-10 | backend | 多筆 | LINE presenter 按業務領域拆分 |
| 2026-07-09 | frontend | `cdc59d2` | 建立正式 frontend session adapter boundary |
| 2026-07-10～07-11 | frontend/backend | 多筆 | counter shell、principal/session、access rule、route、manual、design system |
| 2026-07-12 | backend | `6986da4` | Phase 1 預約唯讀投影 |
| 2026-07-12 | frontend | `4f88c6b` | Phase 1 預約唯讀工作台 |
| 2026-08-13～14 | backend | `d9e9a96` | 預約異動 + Calendar 投影 |
| 2026-08-13～14 | frontend | `48620c0` | 預約異動工作台 |
| 2026-08-13～14 | coordination | `5d706e3` 等 | Phase 2 規格交付、封存與證據回填 |

---

# 15. 一句話總結這段 Git 歷史

2026 年 7 月以後的 Sim-sik，不是在「把功能繼續做完」而已，而是在把原本綁在 n8n、LINE、資料存取方式與單一操作流程裡的產品，逐步拆成 **業務核心、資料責任、角色工作環境、互動介面與外部工具分工**；這些邊界也不是一次決定完成，而是在實作過程中持續重畫。