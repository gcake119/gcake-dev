## 1. 原身分與驗收準備

- [x] 1.1 完成 Original public identity reconciliation／原 ID 對帳只接納完整匿名證據：兩篇原 ID、canonical 及原日期確認後，使用原鎖及版本條件接納，依後續明確授權在同 ID 修正正文至固定 Git 版本且關閉 resend；保留 delivery 歷史，以 before／intent／saved/reload、公開催讀回、前後 D1 收據及零重發／補寄核對完成。
- [x] 1.2 依本次 Gherkin 先建立正常、失敗與邊界的 acceptance RED，重用既有測試層與生命週期，保存 failing result 與 scenario map；不新增 workflow 或多套驗證框架。

- [x] 1.3 完成 Explicit approved native presentation／明確核准的平台呈現：每個儲存格保留原欄名，原 ID／revision／原 PNG 雜湊綁定；以 acceptance RED／GREEN 證明核准轉換及實際欄位、文字、程式碼、連結、圖片漂移，僅標 presentation_only。

## 2. 首次排程 worker

- [x] 2.1 完成 Confirmed first publication only／首次排程共用既有 coordinator 與輪次：僅 current confirmed future slot 與固定 eligible main 進入首次 prepare/arm，保留同 ID、雙通道與零重播；以 SQLite acceptance 證明 restart、public/armed/cancelled/intent/manual hold、slot/source race 及超期邊界。
- [x] 2.2 完成受限 Computer Use 與啟用證據分離：只有 find/read/create/update-draft/first-arm，operation 前綁定 main/slot/authority/intent/generation，父程序驗證 actual before/after evidence；以 executor integration 驗證 identity/content/channel/expired/missing-readback 與未知操作保留，拒絕 public update/remove。
- [x] 2.3 完成 Separate activation and real acceptance／Browser-free background execution：新增獨立 policy/scope/pin/expiry/qualification 採用檢查，同一 round 串接獨立 worker；以 activation 與 sync-round acceptance 證明 disabled/unqualified 舊 draft-only 收據零 provider calls，原 anonymous observer 不取得寫入權。

## 3. 本機交付與後續啟用入口

- [x] 3.1 通過 affected 完整本機 gate、Spectra validate/analyze 與 diff 檢查，保存本機 candidate provenance、測試映射、啟用／停用／還原步驟及正式 disabled 狀態；以原工作目錄 dirty hashes 證明其他未提交工作保留。
- [ ] 3.2 等下一篇正式文章與原站 future slot 確認後，完成 same-ID prepare/arm/remove/rearm、雙通道及 unattended executor 真實驗收，再啟用原工作；保存 provider due-time 公開與後續 anonymous 自然輪次。依使用者最新指示，本項本輪保留未完成，不用 local fixture 或空隊列代替。
