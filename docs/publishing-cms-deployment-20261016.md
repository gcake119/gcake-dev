# CMS 正式部署與結案紀錄（２０２６－１０－１６）

本紀錄回填已完成的部署證據，不是重新部署指令或持續健康保證。證據來自本次本機私有 deployment receipt、Cloudflare 讀回、D1 查核與正式 CMS 介面查看；本次文件回填未重新存取或更動正式環境。

## 部署身分

| 項目 | 已確認結果 |
| --- | --- |
| 來源 | [PR ＃32](https://github.com/gcake119/gcake-dev/pull/32) 合併後的 main |
| 鎖定提交 | `6f02e56b1f19a6a9b28b9fcb6e865789934e3eb5` |
| Worker | `gcake-admin-worker-production` |
| Version ID | `ded9864d-4748-4143-96b4-87e80b73d871` |
| Deployment ID | `8aa00fb6-0aed-4e55-b52f-ec6c35051e1b` |
| Tag／流量 | `pr32-6f02e56`／１００％ |
| 部署／結案時間 | ２０２６－１０－１６　１６：４７：３１／１６：５２：０３，Asia／Taipei |
| 執行結果 | 僅部署一次，exit code 0；未重試或回復舊版 |

本機 Admin／Worker build 成功。部署使用 `--keep-vars`，並明確傳入 `RELEASE_WRITE_ENABLED:true`、`SUBSTACK_WRITE_ENABLED:false`；部署前後讀回確認所有既有 plain vars 一致。`RELEASE_WRITE_ENABLED=true`、`SUBSTACK_WRITE_ENABLED=false`、`PARAGRAPH_WRITE_ENABLED=false` 均保留，GitHub `RELEASE_AUTOMATION_ENABLED=true` 未修改。既有 D1／R2 bindings 與五個 secret 名稱清單一致；沒有讀取或回存 secret 值。

## D1 備份與發布狀態

部署前再次確認沒有進行中的發布／部署 workflow、release lock、distribution checkpoint 或不確定的 newsletter 意圖。七筆 migration 均已存在，本次未套用 migration。

先匯出 D1，再於記憶體 SQLite 測試還原，`integrity_check=ok`。SQL 共 17,246 bytes，SHA-256 為 `d4bfb59e89230c9e54e541d85ef01e6b01014567cdc70dbfb1e8b965a1c46dee`；備份檔權限 0600，私有目錄 0700。未對正式 D1 執行還原。

部署後原有兩筆 release 的身分、commit 與 `verified-public` 狀態均保留，沒有建立或重播 release：

- `ithome-2026-chatgpt-writing-workflow`。
- `ithome-2026-publishing-toolchain`。

部署後、查看介面前的 D1 runtime version 仍為 97。正常 owner 登入與排程讀回後為 98；登入可建立 session，佇列查看可更新 runtime metadata，因此不宣稱全程零資料庫寫入。兩筆發布紀錄仍相同，release lock 為零。

## 部署後驗證與證據界線

- `/health` HTTP 200，回傳 `status=ok`、`service=gcake-admin-worker`、`contractVersion=v1`。
- 正式 JS／CSS 與鎖定提交的本機建置雜湊完全相同：
  - `/assets/index-BGilYPFF.js`：`e24932b4cef039ec4d2591ee613e98cce9d06ea0bb305380500257d77aab5cae`。
  - `/assets/index-DyR-OeM1.css`：`dc11f9e1fcd3fcd9db18d40743a03250f38c980e5963de95810b8eacd9c27d2c`。
- 正常 GitHub owner 登入成功；正式介面顯示六篇文章、三組系列、新增系列表單與系列 metadata 編輯區。
- 已有發布承諾的系列維持 slug／篇序鎖定，刪除按鈕停用。未操作內容儲存、新增、改名、刪除或發布；不能把表單顯示與鎖定狀態當成全部 CRUD 正式寫入驗收。
- 排程顯示「正式發布已啟用」、需處理零篇；下一篇為〈當程式主要由 AI 寫，我怎麼決定網站要用什麼技術框架？〉，預計 １０／１９（週一）０７：００起，Asia／Taipei。這是當時估算，不是已發布證據。

沒有手動派送發文 workflow、補發文章或通知；沒有更動 Hermes runtime、憑證或排程，也沒有更動 Substack runtime 或排程。CMS 的外部通知狀態不能取代 Hermes 的人工收件紀錄。

## 保留證據與回復基準

本機私有保留區：`.git/codex-production-backups/pr32-cms-20261016-zp885i4z/`。

- `deployment-closeout.json`：部署結案 receipt。
- `before-backup.json`、`immediately-before-deploy.json`、`after-deploy.json`、`after-interface-login.json`：查核快照。
- `d1-backup-verification.json`、`provider-readback-verification.json`、建置與部署 logs：備份及版本驗證依據。
- `cms-production-before-pr32.sql`：完整私人 D1 備份，保持原處，不納入 Git。

本文件只回存必要摘要、版本 ID 與備份雜湊；沒有複製原始 SQL、session、OAuth state、token、secret 值、私人環境檔或完整原始 logs。上述路徑只供本機定位，不是 repo 內的備份副本；備份及私有 receipt 繼續保留，不由本紀錄授權刪除。

舊版回復基準為 `cb62580d-5c24-4fb1-8682-e3a98b23c88c`。本次沒有執行 rollback；若後續需要回復，須另行授權並重新核對開關、bindings、發布狀態與舊版相容性。程式回復不等於還原 D1，不可重建 release identity 或重播已完成文章／通知。
