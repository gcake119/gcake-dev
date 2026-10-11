# PR ＃7：測試模式安全邊界複審

審查日期：2026／10／11。起點為 base `883ee22b563480200d75524c28b3033c7e6069a2` 至 `fea6aafe910b4d9cc878f1f51f0d80bdaf8a5e58` 的完整 35 檔差異；修正候選為 `84d89c8c895a1f9140dcf7ada92e7958c935de00`。涵蓋 queue／CMS-shaped ingestion、Git writer、public revision、Actions、Hermes／mock transport、測試與交接文件，未擴張到整個 CMS 或供應商帳號。

起點 PR／push CI 都成功，但原有測試沒有涵蓋以下程式介面與狀態初始化缺口。Codebase Memory 連線中斷，先前私有索引亦被拒絕，本次使用本機檢視，沒有重新上傳索引。此次複審由單一代理完成，沒有沿用先前多人審查作為新證據。

## 發現、重現與修正

| 缺口 | 原本可觀察結果 | 現在的限制 |
|---|---|---|
| 正式 gate 只在 CLI | 直接呼叫 telegram_send 或建立 live Monitor，不需正式旗標；mock=True 的底層傳輸也沒有自行驗證目的地 | live 建立／poll、telegram_send 及底層正式傳輸各檢查旗標；mock 傳輸固定回環 URL、合成 bot method 與 chat 0 |
| 測試 sender 可被包裝替換 | test-delivery 只拒絕原函式 identity，包裝函式可通過 | 測試模式依 mock_api 自行建立 sender，拒絕注入自訂 sender，不讀真實憑證 |
| 拒絕 DB 前先寫入 | 不相容正式 DB 被新增 outbox 表、改成 600，之後才拒絕；缺少的預設 live.sqlite 可先被測試占用；status 會建立空檔 | 既有 scope 先唯讀檢查，拒絕時內容／權限／lock 不變；預設 live 路徑保留給 live，即使未建立；status 唯讀且不建檔 |

原本 CLI 已拒絕真實 Telegram API 作為測試端點，沒有重現公開 RSS 或 CLI 直接繞過成真實發送。上述傳輸缺口是在可 import Python 的可信呼叫者介面；DB 缺口則能由誤用 CLI 路徑觸發。測試把 HTTP client 替換成會失敗的攔截器，確認原程式嘗試開啟傳輸，沒有發出真實請求。不要把這些證據解讀成已發生真實推播、外部攻擊者取得憑證或遠端權限提升。

## 驗證證據

- TDD RED：7 項新回歸測試產生 8 個預期失敗，涵蓋傳輸、sender、開關與 DB；其後補上「拒絕時不建 lock」，再觀察 1 項失敗後修正。
- GREEN：Python 共 27 項，含 10 項 CLI／回環 HTTP 模擬驗收、9 項安全邊界測試、8 項既有通知／相容性測試。
- 正式旗標即使在測試程序中設為 true，test-delivery 仍只向模擬 server 送固定合成 method/chat；正式旗標從 true 轉 false 後，已建立的 live Monitor 也不能 poll／send。
- 站點／API 外部位址、混用模式、缺參數、proxy、redirect、mode/site 共用、預設 live 路徑、symlink／hardlink／父目錄別名均有查核。臨時移除 symlink/hardlink guard 的 mutation 被測試抓到，已還原。
- `pnpm test`：206 項 Node、27 項 Python 通過；`pnpm check`：131 檔零錯誤／警告／提示；`pnpm build`：32 頁成功。
- actionlint、Spectra validate、whitespace 與 `pnpm editorial:rehearse` 通過；演練沒有正式寫入或 Telegram 呼叫，六篇正文／章序不變。
- 新候選的精確 SHA 與線上 CI 結果記錄在 PR 說明，不能以起點 CI 成功代替修正後 CI。

## 剩餘人工驗收

以下仍未簽核／未執行，詳見 [人工清單](editorial-release-acceptance.md) 與 [擁有者步驟](editorial-release-user-setup.md)。mock 成功不勾選供應商或人工項目。

1. 畫面與內容：擁有者簽核隔離桌面／手機預覽、六篇正文、manifest 順序；實體手機／Safari 若需要，另行實測。
2. GitHub：決定 editorial-release reviewer、main ruleset、最小寫入身份與無人值守策略；另行授權真實權限及 Pages 版本驗證。GitHub App 認證目前未實作；不能以關閉保護或 force push 解決。
3. 運作決策：接受 Git journal 例外、部署競爭窗口、延遲與不補發策略；核對 CMS 衝突／pending 修復、首次 ingestion、停止／回滾與故障處理人。
4. Hermes：服務帳號本人確認版本／profile／路徑，安裝候選並手動 dry-run；核對唯一 job、固定 private DB、既有 daemon／getUpdates 不變。非預設自訂 live DB 必須先由本人確認用途並以正確 live mode 初始化，不會從尚未建立的任意檔名推測用途。
5. Telegram：私人普通 DM、憑證保管、真實 API／收訊與重啟對帳需另行授權。隔離站點到真實 Telegram 的接法仍未開放；目前只支援回環 mock。topic 未支援。
6. 最後分開授權合併、正式部署、兩個正式開關與排程啟用；本次全部保持停用。

Hermes OS 帳號／程式碼／設定的擁有者仍屬可信邊界；本修正不能防止該帳號刻意改 Python、HOME、旗標或 DB。正式 DB 的語意隔離與別名拒絕也不宣稱是對同帳號攻擊者的 filesystem sandbox。這次沒有操作 Hermes runtime、正式帳號、Telegram 憑證或 GitHub 設定。
