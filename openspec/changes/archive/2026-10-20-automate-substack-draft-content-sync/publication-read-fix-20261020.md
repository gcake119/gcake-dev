# 舊發布查詢修正與正式驗收

正式 version 099cf828-63ac-41c9-aadf-5ce8e4f1b707，deployment b18acf01-d304-4fe0-9803-37f1e42e4b4d，100％流量。回復基準 534184e5-b51c-4afe-a8d2-61a66ab53b8c 保留，未回復。

## 根因與最小修正

正式 Chrome 原稿查詢 `/api/v1/publications/ithome-2026-template-hardening` 在正常 owner session 下實際回 503、GITHUB_API_FAILED、「發佈中心尚未設定。」。Worker handleRequest 未提供 publications dependency，路由在查 D1 前就失敗；不是缺 OAuth／Substack 憑證，也不是資料表未建立。唯讀確認正式 publication_target_states 已有四筆歷史（Paragraph 一筆、Substack 三筆），沒有 Pages 紀錄。

在實際 production composition root 只接入既有 D1PublicationRepository 與 PublicationOperations.readStates，保留原身分、來源版本與 stale 判斷、過濾已退役 Paragraph。未接入 operate；production authenticated POST／PUT／PATCH／DELETE 仍拒絕 405，並在讀取前確認 owner allowlist。回應均 no-store，資料庫失敗為遮蔽診斷的 503 PUBLICATION_STATE_UNAVAILABLE，空歷史為正常 200 states=[]。

舊 readStates 的目標與 uncertain 回傳型別與共用契約失配，已明確縮窄實際存續目標，補上原本已存在的 uncertain 型別，不更改歷史資料或把 unknown 轉成成功。原退役目標測試改為驗證完整目標清單仍只有 github_pages，保護未弱化。

前端每次讀取先清除上一筆舊錯誤及舊文章狀態；成功後不殘留設定錯誤，真實讀取失敗仍顯示。沒有 Pages 歷史時呈現「尚無發布紀錄」，不推定缺少設定、未發布或已驗證。新 Substack 三狀態 API 與前景發布流程保持原有分工。

## 驗證層次

- 先有三個真實 RED：production entrypoint 503 而非 200、未設定 no-store、前端成功後殘留舊錯誤。另一個實際 Vue 模板 RED 證明空 Pages 歷史的錯誤呈現。聚焦最終 35 tests 通過。
- 完整五項本機 gate 通過：check、test、build:all、release:dry-run、editorial:rehearse。初次型別失敗與第二次契約失配 logs 原樣保留；修正後單項 check 通過且逐檔來源／依賴／設定未變，重用該次 check 繼續其餘完整 gate。Hermes 原有 SQLite ResourceWarning 若出現在測試 logs，未被吞掉，也不改稱測試失敗。
- 隔離候選沿用前一正式快照，只覆蓋本次八個來源／測試／契約檔與建置資產，所有 deployed Worker／contract source 比對實際通過 gate 的 worktree。production dry-run 後再查 current version，部署一次成功。
- 正式 Chrome 載入實際部署 HTML／JS／CSS，沒有 response override。原稿舊查詢從實測 503 修復為 200／no-store；畫面沒有「發佈中心尚未設定。」、Pages 顯示「尚無發布紀錄」。新 Substack 草稿同步／發布／寄送三欄與原 ID 同時可見；手機寬度無水平溢出，詳細 request 方法／回應及畫面條件見機器摘要。
- 正式匿名舊查詢與新 Substack 兩端點都 401／no-store，health=ok，三個資產逐 bytes SHA256 符合候選。503 storage failure、已登入 mutation 405 以本機 entrypoint 測試證明，未在正式注入失敗或發送 authenticated mutation。

## 保留與清理

正式 vars、bindings、secret 名稱及 runtime settings 與前版相同，只有 script etag 與前端資產更新。RELEASE_WRITE_ENABLED=true、SUBSTACK_WRITE_ENABLED=false、PARAGRAPH_WRITE_ENABLED=false 保留；沒有 migration、secret 設定或同步 runtime 安裝。

Chrome 驗收後六篇原 ID／slug／URL、observed／desired state、slot／時間、email／App、armed／delivered revision、公開歷史與 intent 均保留；同步私有設定 SHA256 相同、allowCreate=false、scheduled.writeEnabled=false。背景同步可自然更新查核 metadata，正常 session/read 可更新 CMS metadata，故不宣稱所有 D1 零寫入。

自建 Chrome 分頁關閉、viewport reset，主題恢復，未碰 Brave；無本機伺服器／Docker。本次程式留在已附加隔離 worktree，primary 只同步本次自身的後端修正與規格／文件，未覆蓋 primary 舊前端或其他 dirty 內容；無 commit／push／merge。

私有原件：/private/tmp/gcake-publication-read-fix-20261020。遮蔽後摘要 publication-read-fix-results.json。畫面：/Users/caiyijun/.codex/visualizations/2026/10/19/01a153a5-b815-7753-ac1f-b3b7f9318c2b/publication-read-fix-20261020。先前正式驗收文件保留為修正前歷史，不改寫舊失敗為通過。

最終 Spectra analyze 無 findings、validate 與 git diff --check 通過，31／31 任務完成。Chrome 文章載入曾超出定位器等待期限，實際網路仍在正常讀取；重新觀察已完成的同一請求後才操作，未重複點擊或改 provider。正式列表驗收時原稿可能自然顯示「同步處理中」，依當時 API 如實呈現，不把查詢 200 等同於每篇內容都已完成同步。
