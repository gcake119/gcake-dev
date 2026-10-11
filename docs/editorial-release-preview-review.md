# PR ＃7 隔離預覽驗收紀錄

驗收日期：2026／10／11。候選完整 SHA：`02756f58c0d8ea6869258e4b3dcf94a8c96799d0`。代理已完成技術／畫面檢查，擁有者的視覺簽核與正式供應商驗收仍未完成。

## 隔離方式

從乾淨的候選 clone 複製三份至 `/private/tmp/gcake-editorial-visual-preview/`，不包含 `.git`。三份各自做真正的 Astro static build，再透過綁定 127.0.0.1 的 HTTP server 服務。沒有推 Git、啟用 flag、呼叫 Telegram、部署 Pages 或修改正式 source。

| 預覽 | 用途 | 驗證結果 |
|---|---|---|
| baseline：4179 | 原始六篇保持 ready | 六篇皆 404，RSS 沒有六篇 |
| first：4181 | 只在暫存副本將首篇改成 published | 首篇 200、其餘五篇 404；RSS 僅首篇；文章導覽未暴露後五篇 |
| complete：4180 | 只在暫存副本展示六篇已公開的版面 | 六篇均 200，章序、相鄰篇與系列總覽完整 |

展示日期統一使用過去的 2026／09／20，只用於畫面 fixture，不是排程時間、真實公開時間或 queue completed 證據。六篇正文 SHA-256 與交接證據逐一相同，正式六篇 status 仍為 ready，正式 manifest 的順序及內容未改。

## 瀏覽器與畫面查核

Chromium headed 真實瀏覽器。桌面 1440×900、手機寬度 390×844 各逐篇檢查六篇，共 12 組頁面；另補 375／320 寬度與 390×844 的行動裝置／觸控模擬。沒有使用實體手機，也沒有宣稱 Safari／iOS 已測。

- 六篇標題、段落、長標題換行、標籤、正文及頁尾均可讀；目錄／系列選單不遮住正文。檢視各篇頂部、正文尾部及桌面／手機總覽實際截圖。
- 所有文章沒有整頁水平溢出；圖片損壞數為零，browser pageerror 為零。
- 各篇相鄰導覽符合 manifest：第一篇僅下一篇、第二至五篇前後各一篇、第六篇僅上一篇。總覽章序為六篇原始順序。
- 鍵盤首次 Tab 聚焦「跳至主要內容」，Enter 到 `#main-content`；系列 summary 可用 Enter 展開。
- 點選系列選單由第一篇到第二篇，點上一篇返回第一篇，點返回系列總覽抵達正確頁面。
- 行動觸控模擬 `maxTouchPoints=1`，tap 展開選單並到第二篇成功。暗色主題及手機選單截圖也已檢視。
- 原始 ready／首篇展示副本的首頁截圖與 RSS／HTTP 結果已保存；這些不等於正式 Pages 部署或真實 Telegram 成功。

初次驗收腳本把總覽的「從第一篇開始」CTA 也當作章序項目，之後改為只核對章節列表；觸控腳本也補了等待跳頁完成。兩者都是驗收工具範圍／時序修正，未修改產品程式。

## 證據與可開啟的預覽

本機證據已保留於 `/Users/caiyijun/.codex/visualizations/2026/10/11/01a12aea-bc40-7451-9071-eeba41571736/editorial-pr7/`：`results.json`、38 張原始截圖／聯絡表及操作紀錄。原始截圖檔名包含 desktop／mobile、part-1～6、top／footer，方便核對每篇。

預覽服務在本機運行時可開啟：

- [六篇系列展示](http://127.0.0.1:4180/gcake-dev/series/ithome-2026-extensions/)
- [僅首篇展示](http://127.0.0.1:4181/gcake-dev/posts/ithome-2026-chatgpt-writing-workflow/)
- [原始 ready 候選首頁](http://127.0.0.1:4179/gcake-dev/)

這些 loopback URL 只在本機可用，不是雲端預覽或正式公開文章。服務停止後可按上述 www 目錄使用 `python3 -m http.server <port> --bind 127.0.0.1 --directory <preview-www-directory>` 恢復。

## 尚需人工完成

請擁有者確認畫面是否接受；Git journal 決策、部署競爭窗口、GitHub 權限與分支保護、Hermes runtime、真實私人 Telegram 與正式 Pages 都保持未驗收。逐步操作請見 [擁有者設定步驟](editorial-release-user-setup.md)，不要以這份預覽報告自動勾選所有人工驗收項目。

本次沒有修改產品程式。PR 未合併，GitHub 正式發文變數仍未建立，Hermes／Telegram 正式設定未接觸，兩個正式功能維持停用。
