# 本機驗證與正式交付界線

本機候選位於 codex/add-cloud-index-alerts，基底 main4b8fa91。新功能來源、測試與設定12份的SHA256保存於 output/discovery/cloud-index-alerts-20261030/candidate-hashes.json；完整gate與瀏覽器驗收後再次比對完全相同。原工作目錄與本worktree其他dirty文件保留，不整包提交。

## 行為驗收

新增26項Node／真SQLite／前端狀態驗收通過：accepted baseline安靜、新完成候選去重、重疊實際lease、11頁有界backlog、來源轉換／有效等待、未續更紀錄、expiry零後續來源請求、runtime／歷史／讀取失敗保存checkpoint、Telegram拒絕／未知／回覆chat不符、sending重啟恢復、owner授權與零未授權存取、唯讀GET無初始化、缺migration503、頁面取消與舊時間、十秒間隔、格式白名單。啟用驗證旗標只有明確開啟時才產生一次標示測試的通知，普通baseline仍安靜。

observer-red.log保存最初會失敗的observable assertions。journal-failure-red.log實際重現Telegram回覆後CMS保存失敗導致第二則通知，修正後保留單一sending intent並停止，不聲稱供應商實收。cutover-boundaries-red.log保存啟用訊息尚未實作與過期後仍讀來源兩項失敗；final-boundaries-green.log為26項GREEN。沒有真實Telegram、搜尋或provider操作。

## 完整本機gate

Node24.19.0／pnpm10.17.1：pnpm test187.39秒、build:all6.70秒、release:dry-run12.89秒、editorial:rehearse12.89秒均exit0；pnpm check17.38秒以同一來源／設定／依賴的full-gates-v2綠燈重用。收據見full-gates-v3/results.json與toolchain.json，Spectra validate/analyze亦通過。

前次full-gates的test通過174.96秒，但check揭露9項新增測試型別錯誤，已修正；原紀錄保留。full-gates-v2通過check，但test在既有publishing handoff／瀏覽器／期限案例失敗，當時觀察主機load7.09／23.78／25.18；不以此當作已確立根因。原profile scan單獨3項通過，整組distribution保留原預設並行、期限與斷言單獨364項通過18.52秒。負載降低後相同完整test再通過187.39秒。沒有放寬assertion、拉長timeout、跳過測試或改CI；原失敗與環境不確定性保留。

pnpm全域入口曾改為12版並試寫受保護的manager快取而失敗；改用本機既有Corepack cache中的專案釘選10.17.1，無安裝／升級依賴。測試暫存借用連結由同一with-deps.py建立與finally清理，原依賴保留。

## 真實瀏覽器的本機假資料驗收

已驗收1280／390／320各明暗兩種，共6組；每組實測heading20px、body17px、metadata14px、分組margin24px、按鈕48.59px，無橫向溢出、控制均可見。空紀錄、503明確錯誤、unknown／sent／rejected不同文字及鍵盤focus2px通過。native工具一度遇到舊驗收分頁不回應，使用同一工具的原生Chrome介面關閉無編輯內容的本次舊頁，建立新專用頁後恢復正常控制；根因未確立，未操作其他工作內容。

metrics與6份原始畫面在 output/discovery/cloud-index-alerts-20261030/browser/。本機fixture不代表正式送達或雲端Cron成功。兩個本次驗收分頁1179172036／1179172038均已關閉，viewport已reset，原使用者分頁保留；臨時Vite由同一bootstrap finally關閉。原先沙箱listen EPERM及Vite新快取造成cleanup失敗保留於browser-preflight-failure.json；確認歸屬後只移除本次cache，後續改專用cacheDir並自動清理。沒有Docker。

## 正式範圍與尚缺授權／證據

尚未commit／push／PR、改正式Worker／資料庫／排程或配置Telegram憑證，原automation-3保持原狀。Telegram設定在受保護的Hermes帳號，只有metadata存取嘗試即PermissionError，未讀任何憑證值。新正式階段需就本候選核准：選擇沿用的既有bot與owner私訊、安全讀取並配置server秘密、additive0008、十五分鐘Admin Cron、exact candidate PR/main CI、一次啟用驗證訊息與兩輪自然排程及owner後台驗收。這些都不能由本機mock代替。

原搜尋Cron／模型／500額度／零付費超額與容量UTC2026-10-30T17:21:49.667084Z保持，不續期、不再送正式語意查詢。全部正式驗收完成才暫停heartbeat；否則保留並如實記錄尚缺項，不archive本change。

使用者已於本輪明確授權本change提交／PR／檢查後合併部署、通知資料表與Admin排程、既有Hermes bot與同一收件私訊、安全配置Cloudflare及一則啟用驗證訊息；兩輪自然雲端驗收後才暫停heartbeat。受保護憑證仍需系統管理員驗證，尚未讀值或配置。
