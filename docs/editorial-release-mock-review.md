# PR ＃7：隔離 RSS 到模擬 Telegram 驗收

日期：2026／10／11。功能候選：`d1795036989f00021331824435c2654777913d61`。這份證據涵蓋真實 CLI 子程序與本機 HTTP 傳輸，不代表 Telegram 供應商、Hermes 服務帳號或正式 Pages 已驗收。

後續完整差異複審發現並修正底層 gate／sender 與 DB 初始化界線；最新結果為 27 項 Python 通過，詳見 [安全邊界複審](editorial-release-boundary-review.md)。以下 16 項紀錄保留為初次 mock 交付的歷史證據。

## 接法與重現

新增 `--test-delivery`，受控站點與模擬 API 都必須是 `http://127.0.0.1:<明確埠號>/`。站點可以有 `/review/` 等基底路徑；API 必須使用根路徑。測試模式必須明確指定 `--db`，不能與 `--live`／`--dry-run` 混用。

最簡單的重現方式，由測試自動啟動兩個回環 HTTP server、建立暫存 DB，完成後清理：

```sh
HERMES_RSS_NOTIFY_ENABLED=false EDITORIAL_RELEASE_ENABLED=false \
  python3 -m unittest discover -s scripts/hermes -p test_mock_delivery.py -v
pnpm test:hermes
```

要接自己的隔離靜態預覽與本機模擬 API，可在兩者啟動後使用以下介面。埠號依你的 fixture 替換；模擬 API 需接受 `/bot0:TEST_ONLY/sendMessage` 的 JSON POST 並回傳 `{"ok":true,"result":{"message_id":1}}`。不是把 localhost 轉送到真實 Telegram。

```sh
HERMES_RSS_NOTIFY_ENABLED=false python3 scripts/hermes/rss_monitor.py \
  --test-delivery --site http://127.0.0.1:4180/gcake-dev/ \
  --telegram-api http://127.0.0.1:4190/ \
  --db /private/tmp/gcake-rss-mock-test/test.sqlite
```

第一次成功讀 feed 只建立歷史基線；在同一站點新增測試文章，並提供吻合的 canonical HTML 後，再執行相同命令。模擬端收到標題、URL、台北時間；CLI 顯示 `Verified test article notification sent to loopback mock API`。加上 `--status` 可核對 baseline／sent／uncertain。埠號與基底路徑也是站點身份，變更時要另用測試 DB；不得拿正式 DB 試跑、刪除正式 DB 或修改正式六篇 metadata。

測試模式固定使用合成 bot token `0:TEST_ONLY`、chat ID `0`，不讀真實 Telegram 憑證。回環請求停用外部 proxy，所有 redirect 都拒絕；資料庫綁定 mode 與 site，poll 和 status 都拒絕跨模式／跨站點使用。既有未綁 site 的正式 DB 可在固定正式站保留去重資料，舊未綁站點的測試 DB 不自動升級。

非 live 模式亦拒絕預設 `$HOME/.local/state/gcake-rss/live.sqlite`，即使檔案未建立；既有 DB 先唯讀核對 scope，不能先改 schema／權限再拒絕。status 不建立缺少的 DB；DB／lock 的 symlink／hardlink 也拒絕。程式介面使用 `Monitor(..., test_delivery=True, mock_api=<回環 API>)`，不能在測試模式注入 sender。

## TDD 與測試結果

- RED：先補驗收情境及 CLI／HTTP acceptance tests；首輪 6 項中 5 項因尚無 `--test-delivery`／`--telegram-api` 而失敗，非法參數拒絕案例原本即通過。沒有把後來成功當作先前失敗證據。
- GREEN：加入測試接法，原有與新增測試全數通過；後續補參數、proxy、正式模式與舊 DB 相容性查核。
- 敏感度：暫時移除 site 綁定判斷，跨站點 status 測試失敗；還原後完整測試通過。
- 詳細記錄曾發現測試 helper 的 SQLite 連線未明確關閉；已補 closing，並用 `python3 -W error::ResourceWarning -m unittest discover -s scripts/hermes -p 'test_*.py' -v` 重跑，沒有資源警告。
- Python 共 16 項：原有 7 項，加上 8 項 CLI／HTTP 模擬驗收及 1 項舊正式 DB 相容性測試。
- 模擬驗收涵蓋：歷史零 POST、新文章一個 POST、內容與台北時間、重啟／GUID 去重、頁面 503／錯 canonical 零 POST、退避與恢復、回應遺失保留 uncertain、重啟零重送、站點／API redirect 不跟隨、參數與 mode／site 隔離。
- 完整 `pnpm test`：206 項 Node、16 項 Python 通過；`pnpm check`：131 個檔案，零錯誤／警告／提示；`pnpm build`：32 頁成功。
- `pnpm editorial:rehearse`：六篇 ready 隱藏、失敗重試同篇、RSS 一篇新增、五篇仍隱藏、canonical／來源版本與去重通過，六篇正文及閱讀順序不變。
- actionlint、Git whitespace、Spectra validate 通過。Spectra analyze 仍有原先四個需求名稱未逐字對應已完成 task 的 coverage warning；本次新增 Controlled mock delivery 有 task，沒有新增 consistency／ambiguity／gap 問題。

## 安全與驗收邊界

本次差異查核確認：正式 `--live` 仍只接受固定正式站，需 `HERMES_RSS_NOTIFY_ENABLED=true` 與私人憑證；`--telegram-api` 只在測試模式可用，無法覆寫正式 API。非法配置在 HTTP 前拒絕。真實憑證的替身值放入測試程序環境，模擬端仍只收到合成 token 與 chat；沒有新增真實訊息、正式設定、部署或 Hermes job。

完成的是「受控本機 RSS／HTML → 本機模擬 Telegram API」整合。尚未完成真實 Telegram、遠端受控測試站、Hermes runtime、人工畫面簽核與正式 Pages 驗收。`sent` 在 test-delivery DB 只表示模擬 API 已確認，不代表私人 chat 已收到。正式自動發文與推播維持停用，PR 不合併。
