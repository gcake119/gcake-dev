# main 正式部署與驗收：２０２６－１０－２２

本文件回填已完成的正式操作，不觸發推送、重新部署、模型呼叫或設定變更。時間以臺灣日期記錄；部署為 UTC ２０２６－１０－２１ １６：２６：２７，即臺灣２０２６－１０－２２ ００：２６：２７。

## 來源、CI 與部署

PR ＃５４已合併，來源 main 為 `c0e30ed54e4d922522a44e2b6151dac7f12bbfe4`；[main CI 39632905875](https://github.com/gcake119/gcake-dev/actions/runs/39632905875) 通過。該 main 與先前已驗證的 `07c4b2588644221c5b0c669448a76ea6bce5dc95` tree 一致，因此沿用其完整本機 gate 與精確 main CI，不重跑不變的行為測試。

搜尋 Worker `gcake-public-search-production` 已部署，版本為 `b8922dce-07de-4c8f-b52b-d4207ccea347`，流量１００％；部署 ID 為 `27dd7788-d62b-4e57-a69a-f552b015bfd1`。遠端入口程式逐 byte 比對此次 main 的 dry-run bundle 完全一致，SHA-256 為 `088e28c38e15467fe3e8fae128568ff693cff8346a894240a0d37cf1b1a30918`。本次更新 Cloudflare Worker，沒有重新部署 GitHub Pages。

## 保留的正式設定

部署前後 settings 與 D1 policy 完全相同。`SEMANTIC_ENABLED=true`、`INDEX_SYNC_ENABLED=true`、每分鐘 cron、原有加密 secrets 及 AI／D1／Vectorize 綁定均保留。模型仍為 `@cf/baai/bge-m3`，plain／１０２４維／cosine；Workers Free 硬上限、每日８０００ Neurons 等本站保守配置及 paidOverage=0 不變。每日 UTC 自動重設不補回已消耗額度，也不延長現有 `2026-11-20T00:00:00Z` 證據期限。

本機每小時任務 automation-2 維持 PAUSED，背景維護由 Cloudflare 自行執行。

## 實際驗收

- 部署後沒有人工呼叫同步入口，自然 cron 收據＃３９、＃４０分別於臺灣００：２６：３０．６６１與００：２７：３０．７７６產生，皆為 `no_change`。每輪推論 requests／tokens／units／新增儲存為零，只預留 Worker １及 admission ４０。
- 正式 corpus `ebb16a407bbbf0c3f8ec2895b79d200f9603fc7c6254a6bddbdd5991ff3deefb` 與 policy 相符，索引維持２６３３個１０２４維向量，沒有待處理 pending。
- 正式 API 回 HTTP ２００、hybrid 模式，測試語句得到３３篇，首篇為 Day 24。這是當時查詢觀察，不是固定結果數或品質門檻。
- Computer Use 在正式搜尋框送出相同語句，顯示「依意思搜尋結果」。３９０像素畫面 scrollWidth=３７５，３２０像素為３０５，皆無橫向溢出；１個搜尋框、０個下拉選單。下一頁顯示第２頁，點擊 Day 19 結果後到達正確文章與段落網址，文章主標題相符。驗收後已還原視窗尺寸。
- 驗收期間瀏覽器操作連線曾逾時並重建，初次畫面停在搜尋中，未計為通過；重新載入並確認實際搜尋請求２００、畫面結果、分頁及文章導覽後才通過。此為觀察經過，不推斷網站存在已定位的缺陷。

## 剩餘項目與證據界線

規劃仍為３０／３２項完成。１．１是無法事後補造的早期先紅後綠證據缺口；１２．２等待第一個自然變更公開版本的正式同步、完整讀回及提升紀錄。此次沒有新文章發布，只證明新部署下排程自行偵測無變更，不能以它完成１２．２；新增內容的 provider 流程沿用[先前隔離雲端實測](cloud-hosted-sync-20261021.md)，與自然增量驗收分開。免費／隱私證據到期仍需核實，不因部署而延長。

## 可攜證據

[收據 JSON](main-cloudflare-acceptance-20261022.json) 保存部署、程式 digest、原有政策、排程收據、API 摘要、手機尺寸及截圖 SHA-256；不含憑證、秘密值、向量 payload 或讀者原始 IP。搜尋語句是操作人員明確建立的驗收輸入，非讀者紀錄。原始操作紀錄保留於 `output/discovery/deploy-main-cloudflare-20261022/`，不將含完整操作環境的檔案整包加入 Git。

![手機３９０像素語意搜尋](evidence/main-cloudflare-20261022/mobile-390.jpg)

![手機３２０像素搜尋](evidence/main-cloudflare-20261022/mobile-320.jpg)

![手機文章導覽](evidence/main-cloudflare-20261022/mobile-article.jpg)
