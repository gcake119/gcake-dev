# 設計系統實作對照

本文件是根目錄 [`DESIGN.md`](../DESIGN.md) 指定的設計系統文件，整理既有設計規範與目前程式碼的對照。根目錄文件提供入口摘要；產品決策以 [`已確認設計決策`](blog-redesign-approved.md) 為準，執行時的視覺值以 `src/styles/global.css` 為準。以下對照不新增或取代已確認的產品決策。

## 來源地圖

| 關注項目 | 正式來源 | 說明 |
| --- | --- | --- |
| 品牌與產品語氣 | `PRODUCT.md` | 站名、副標、讀者與內容原則 |
| 設計系統入口 | `DESIGN.md` → 本文件 | 根目錄摘要指向此處的既有規範與實作對照 |
| 已確認決策 | `docs/blog-redesign-approved.md` | 2026-09-27 原型與後續搜尋調整 |
| CSS token 與 selector | `src/styles/global.css` | 執行時的正式視覺值 |
| 全站框架與主題初始化 | `src/layouts/BaseLayout.astro` | 語言、meta、跳至內容、主題與表格標籤 |
| 全站導覽 | `src/components/SiteHeader.astro` | 首頁、系列、關於、搜尋與主題切換 |
| 頁尾 | `src/components/SiteFooter.astro` | 品牌、社群、RSS 與 GitHub |
| 系列入口 | `src/components/SeriesEntry.astro` | 狀態、期間、摘要與閱讀操作 |
| 系列文章導覽 | `src/components/SeriesNavigation.astro` | 章節、目前文章與區塊內捲動 |
| 訂閱入口 | `src/components/Subscription.astro`、`src/data/site.ts` | 共用文案、電子報／RSS 連結，文章使用精簡模式 |
| 驗證證據 | `design-qa.md` | 本機建置、響應式、鍵盤與已知限制 |

## Token 對照

### 色彩

所有正式色彩都集中在 `:root` 與 `:root[data-theme="dark"]`。元件應引用語意 token，不直接寫入新的 hex、rgb 或 oklch 值。

- `--paper`：頁面底色與目前項目表面。
- `--paper-deep`：引用、程式碼、展開區與 hover 次層表面。
- `--ink`：主要文字。
- `--ink-soft`：摘要與次要敘述。
- `--muted`：metadata、日期與輔助文字。
- `--rule`、`--rule-soft`：結構分隔與邊框。
- `--accent`：連結、焦點與主要操作。
- `--button-ink`：實心主要操作上的文字。

新增功能狀態色時，必須同時定義明亮與暗色 token，並提供非顏色線索；不能在單一元件內臨時加入一個只適用單一主題的值。

### 寬度與字體

- `--content: 62rem`：全站框架。
- `--reading: 44rem`：文章與簡單頁面。
- `--sans`：跨平台系統無襯線字體。
- 根排版：`17px / 1.8`；正文 `.prose`：`1rem / 1.9`。

目前沒有完整 spacing、radius、shadow token 表；既有值已整理在 `DESIGN.md`。若同一數值開始在多處承擔相同語意，再提升成 CSS custom property，避免為了「看起來像設計系統」而過早抽象化。

## 元件重用規則

### 導覽與圖示

圖示統一使用 `src/components/Icon.astro`。新增互動圖示時，由連結或按鈕提供可及名稱；不要讓圖示和父層重複朗讀。主要導覽必須保留 `aria-label`、`aria-current` 與鍵盤焦點。

### 操作層級

- 主要操作：`.primary-link`。
- 次要文字操作：`.text-link` 或一般語意連結。
- 只有圖示的正方形操作：沿用 `.theme-toggle` 或 `.social-link` 的 44px 目標模式。

不要新增沒有功能差異的按鈕變體。若操作只是導覽，優先使用 `<a>`；若會改變目前頁面狀態，才使用 `<button>`。

### 編輯式列表

系列、文章與主題列表以分隔線、留白和文字層級組成，不包成獨立浮動卡片。新列表應先沿用 `.reading-series`、`.post-row`、`.chapter-posts` 的形態，再決定是否真的需要新元件。

### 長文內容

所有 Markdown 正文放在 `.prose`。寬內容必須明確使用 `figure`、`.wide-content` 或 `.mermaid`；不能讓任意元素自行突破閱讀寬度。程式碼、表格與圖片的手機行為由全站樣式處理。

## 頁面組成

- 首頁：`home-intro` → 連載系列 → 最近文章 → 訂閱入口 → 其他系列 → 全部系列入口。
- 系列總覽：`index-header` → 依公開狀態分組的 `SeriesEntry`。
- 系列頁：`series-hero` → 章節與篇目 → 來源說明。
- 文章頁：breadcrumb → article header/meta → `SeriesNavigation` → 本篇目錄 → `.prose` → 精簡訂閱提示 → pagination。
- 搜尋頁：結果狀態與清單；搜尋輸入只存在全站導覽。

## 響應式與主題實作

- 主要 breakpoint 是 `700px`；`400px` 與 `360px` 只處理窄導覽微調。
- 主題使用 `data-theme="light|dark"`，初次進站跟隨 `prefers-color-scheme`，手動選擇儲存在 `gcake-theme`。
- 主題初始化放在 `<head>` 的 inline script；不要移到延遲載入的客戶端元件，以免出現錯誤主題閃爍。
- 手機表格由 `BaseLayout.astro` 依真實 `<th>` 填入 `data-label`；修改表格呈現時必須保留欄位語意。

## 已知缺口

- 尚未建立正式 success、warning、error 色彩。
- 尚未有真實的獨立本地文章可做完整 rendered QA。
- 多系列與無系列狀態已有程式邏輯，但最近一輪未用正式內容 fixture 完整渲染。
- 既有紀錄不是完整 WCAG 稽核，也不是公開部署或人工作品驗收。
