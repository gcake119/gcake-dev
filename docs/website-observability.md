# 網站流量與搜尋分析

正式閱讀網址為 https://gcake119.github.io/gcake-dev/，由 GitHub Actions 部署至 GitHub Pages，未設定自訂網域。

## Cloudflare Web Analytics

使用 Cloudflare 官方提供的 module Beacon。共用 Layout 引入 WebAnalytics，所有公開閱讀頁面均有相同入口，包含本地 Markdown 文章與匯入的 iThome 系列。

兩支正式 Pages 建置流程設定 WEBSITE_ANALYTICS_ENABLED=true，並讀取 GitHub repository variable CLOUDFLARE_WEB_ANALYTICS_TOKEN。只有明確啟用的 production build 才輸出入口；啟用但缺少有效 Token 時，建置會失敗且不輸出 Token 值。

即使把正式建置產物放在本機預覽，瀏覽器仍需同時符合 https://gcake119.github.io 及 /gcake-dev 路徑範圍，才會載入 Beacon。入口會檢查是否已有相同官方 script，以避免重複載入。一般 pnpm dev、pnpm build、pnpm preview 及 PR 檢查都不啟用正式量測。

Beacon Token 是供公開網頁辨識分析網站的值，不是 Cloudflare API Token。只將它存於 GitHub 建置變數與正式產出的 HTML；本文不列出實際值。帳號憑證與 API Token 不得用於這些設定。

在 Cloudflare Dashboard 選擇 Observability → 分析 → Web Analytics → gcake119.github.io，即可查看造訪與瀏覽次數、熱門路徑、來源、國家、裝置及瀏覽器。以 /gcake-dev/ 路徑篩選熱門文章，並選擇適當時間範圍。廣告阻擋工具會造成部分量測遺漏；資料不是完整伺服器存取紀錄。

官方設定方式：https://developers.cloudflare.com/web-analytics/get-started/

## Google Search Console

使用網址前置字元（URL Prefix）資源 https://gcake119.github.io/gcake-dev/，不需更動 github.io 的 DNS。將 Google 提供的 HTML meta content 值放入 GOOGLE_SITE_VERIFICATION repository variable。兩支正式建置流程均讀取此值，共用 Layout 僅在值非空時產生一個驗證標記。此值是公開擁有權驗證證明，不是登入憑證；驗證成功後仍需保留。

正式 Sitemap：https://gcake119.github.io/gcake-dev/sitemap.xml。直接在 Search Console 的 Sitemap 頁提交此完整網址。

專案 robots.txt：https://gcake119.github.io/gcake-dev/robots.txt，包含允許爬取與 Sitemap 位址。爬蟲只會讀取網域根目錄的 /robots.txt，該位置由其他 GitHub Pages 根站管理，目前是 404；這不等於禁止爬取，也不阻礙直接提交 Sitemap。

首頁、新文章及本地主要頁面的 canonical 指向 gcake-dev。匯入的 iThome 舊文章依既有來源歸屬，canonical 指向 https://gcake119.github.io/ithome-2026/，且不列入 gcake-dev Sitemap。這次不修改既有來源規則；若要遷移 canonical，需另外確認搜尋歸屬與原站處理方式。

在「成效／搜尋結果」查看 Google 搜尋點擊、曝光、點閱率、平均排名、查詢字詞及網頁；在「網址檢查」確認首頁與新文章的索引與 Google 選定 canonical。Sitemap 成功不代表所有網址已索引，流量資料與搜尋索引需要等待累積與處理。

官方驗證說明：https://support.google.com/webmasters/answer/9008080

## 驗證與發布

pnpm test:observability 會建置啟用／停用量測的真實 HTML，檢查全部產出閱讀頁面，並執行實際入口程式驗證正式 origin、路徑邊界、重複執行、Google 標記與無效 Token。測試僅使用固定假 Token，不呼叫第三方分析服務；臨時建置資料由測試 finally 區段清理。

部署前沿用 pnpm test、pnpm check、pnpm build:all、pnpm release:dry-run。正式流程原有 content:sync:ithome 負責還原完整系列快照，不將驗證時取得的 generated snapshot 納入這次修改。

部署後需分別記錄：Pages 成功部署版本、正式頁面實際載入 Beacon 與成功傳送、Cloudflare 收到測試流量、Google 擁有權驗證成功、Sitemap 接受狀態，以及網址索引狀態。不能用本機測試代替第三方驗收。

回復方式：移除正式建置的 WEBSITE_ANALYTICS_ENABLED=true 設定並重新部署，或回復這次隔離修改。維持已使用的 Google 驗證標記，避免意外喪失擁有權驗證。

## 2026-10-13 設定進度

已建立 Cloudflare 網站資源、儲存 Beacon repository variable，並建立 Google URL Prefix 未驗證資源。程式碼已在隔離候選版本整合。正式部署、Google 驗證、Sitemap 提交、Cloudflare 收到流量及索引檢查仍待完成；以下進度以 Spectra change 的 tasks.md 為準。
