# 技術圖表：Mermaid → SVG

## 範圍與正式來源

本流程只管理隨程式碼維護的技術圖表。Mermaid `.mmd` 是正式可編輯來源，SVG 是網站閱讀產物；兩者連同 manifest 一起提交 Git，靠版本歷史追蹤與復原，禁止手改生成 SVG。CMS 媒體庫仍依 [media-library 規格](../openspec/specs/media-library/spec.md) 管理上傳圖片、R2 不可變網址與 D1 索引，本流程不新增上傳入口、不把一般圖片搬入 Git，也不更動媒體庫規則。

對應命名：

```text
docs/diagrams/blog-system-architecture.mmd
public/diagrams/blog-system-architecture.svg
```

可使用子目錄，轉檔時保留相同相對路徑。檔名建議小寫英文與連字號；不要使用 symlink。來源不放在文章內；Astro 現有 MDX／Vue／Shiki 設定沒有 Mermaid renderer，CSS 的 `.mermaid` 名稱本身不會渲染圖表。

## 安裝與轉檔

使用專案 pnpm １０．１７．１、Node ≥２２．１３（CI 使用 Node ２４），不用全域 Mermaid。CLI 固定 １２．０．０，Puppeteer 固定 ２５．１６．０，間接依賴由 pnpm-lock.yaml 鎖定。

```sh
PUPPETEER_SKIP_DOWNLOAD=true pnpm install --frozen-lockfile
# 優先使用本機已安裝的 Chrome；Linux 可指定 /opt/google/chrome/chrome。
export PUPPETEER_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
pnpm diagrams:render docs/diagrams/blog-system-architecture.mmd
# 批次處理所有 .mmd（遞迴、排序）。
pnpm diagrams:render:all
```

沒有相容 Chrome 時，才明確安裝 Puppeteer 對應的瀏覽器：

```sh
pnpm exec puppeteer browsers install chrome
# 移除前面設定的 PUPPETEER_EXECUTABLE_PATH，使用 Puppeteer 的下載版本。
unset PUPPETEER_EXECUTABLE_PATH
pnpm diagrams:render:all
```

Chromium 下載與快取可能佔數百 MB；不建立 Docker 或常駐服務。瀏覽器啟動失敗時確認路徑、Node／Chrome 相容性與作業系統相依套件，不自行加入 `--no-sandbox`。每張圖轉換上限１２０秒，依序執行。工具會先在臨時目錄完成所有指定圖的轉換與 SVG 基本驗證，全部成功才逐檔原子替換並寫入 manifest；解析／瀏覽器失敗會回報來源並保留舊圖與 manifest。磁碟寫入失敗或強制中止不保證整批交易回滾，但一致性檢查會拒絕未完成狀態；重跑轉檔即可復原。

## 文章引用與可讀性

```md
![系統架構：GitHub 保存內容，Cloudflare 提供後台與資料服務，GitHub Pages 提供閱讀網站。](/gcake-dev/diagrams/blog-system-architecture.svg)
```

沿用目前 Astro base `/gcake-dev`。替代文字要說明圖表用途與重點，不能只有「圖片」；文章原文是替代文字的權威。驗證會解析 Markdown／MDX 的一般與參照式圖片，以及靜態 HTML img，檢查技術圖表目標及非空 alt；不檢查遠端 CMS 圖片、不執行 MDX 動態運算。請使用靜態圖片語法。

共同轉檔設定在 `docs/diagrams/mermaid-config.json`：strict 安全模式、SVG 文字標籤、中文系統字型序列、固定 ID、白色不透明底。SVG 作為外部圖片不會繼承頁面深色文字色；保留白底與深色字，避免透明圖在深色主題失去對比。不要使用網路字型、外部圖示或不可信來源；生成前審查 `.mmd`。

依 [既有設計規範](design-system.md) 保持文章閱讀寬度與圖片等比例縮放。每次新圖或版面變更，檢視桌面與３９０px、明暗兩種主題，確認中文無缺字、無裁切或標籤重疊、箭頭方向及服務分組完整。密集架構圖縮到手機寬度無法讓每個字同時清楚，應提供充分 alt 與正文說明；讀者可長按／右鍵開啟原始 SVG 放大閱讀。未來新文章可用圖片外層連結提供全尺寸入口，不用新增互動套件。字型和 Chrome 版本差異可能改變排版，不宣稱跨作業系統位元完全相同。

## 更新與驗證

１．編輯 `.mmd`，必要時加 Mermaid 的 accTitle／accDescr。
２．轉換單圖或全部，檢視 SVG 與文章預覽。
３．執行以下驗證，提交來源、SVG 與 manifest。

```sh
pnpm diagrams:check
pnpm test:diagrams
pnpm build
```

manifest 保存來源、SVG 與轉檔輸入的 SHA-256，沒有時間戳或機器路徑。轉檔輸入包含設定、工具程式、package.json 與 lockfile；改動其中任一項需批次重產。這是有意採取的保守失效範圍，避免套件或參數升級後沿用舊圖。單圖轉換保留其他圖的證據；刪圖時手動刪除對應 SVG，再批次轉檔更新 manifest。驗證拒絕多餘 SVG，不自動刪除檔案。

`diagrams:check` 不啟動瀏覽器，偵測漏轉檔、遺失／額外輸出、SVG 被手改、文章圖片缺檔／缺 alt 與 Mermaid fence。雜湊只證明產物與記錄一致，不能證明圖意正確，也不能防止有人同時偽造 manifest；視覺與語意審查仍必要。

既有 `content:validate` 執行一致性檢查，`pnpm test` 納入４組臨時目錄驗收測試；既有 `build`／`build:astro` 在 Astro 後檢查 dist 圖片與已驗證 SVG 位元相同。沿用原 PR／main CI，不新增 job、不在 CI 轉圖；兩個驗證 workflow 明確跳過 Puppeteer 下載。CI 的既有 Chrome 仍只供原本 distribution fixtures 使用。

## 依賴升級與成本

２０２６－１１－０１查核 [npm 套件](https://www.npmjs.com/package/@mermaid-js/mermaid-cli) 的最新版本及 engines，並參照 [官方 CLI](https://github.com/mermaid-js/mermaid-cli)。Puppeteer 是 CLI 的 peer dependency，需明確固定。升級時查官方相容性／公告、更新 lockfile、批次重產並重做視覺檢視；不增加定期安全掃描工作。

本次 pnpm audit 的完整專案結果與新增路徑分開記錄於變更驗證文件。CLI 的 KaTeX ０．１６相依路徑有低風險 [prototype pollution gadget 公告](https://github.com/advisories/GHSA-238p-pmpm-9mq7)，修補版已跨至０．１８；不以未驗證的跨版 override 強換。此工具只處理 Git 審查過的本機技術來源，strict 模式、不提供公開上傳／即時渲染服務；不宣稱零漏洞。Puppeteer 使用支援範圍內較新固定版本，避免引入舊 Chromium BiDi／Zod ３鏈。主要長期成本為開發依賴、安裝空間、Chrome 相容性及升級後人工檢視；普通 CI 圖表驗證只讀取檔案與解析文章。
