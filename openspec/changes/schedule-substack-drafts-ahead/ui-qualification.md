# Task 3.1 真實介面驗收紀錄

## 範圍與結果

2026／10／19 使用前景 CUA 操作使用者現有 Chrome 的 `gcakedev.substack.com`。保留開始時全部 dirty 檔案與來源摘要，未 reset、stash、commit、push、部署、套用正式 D1 migration、更新私人 runtime／pin／LaunchAgent 或啟用正式排程。

建立一篇清楚標示「請勿發布」的專用驗收草稿：**ID 221081849**，slug `substack-ui-qualification-20261019`。此草稿刻意不接入正式 Git 發布佇列或 D1 排程紀錄。原三篇公開 ID 221069931、220473117、220011124 未編輯；公開文章總數維持 3。

| 驗收項目 | 證據與結果 |
| --- | --- |
| 真實草稿保存／重載 | 相同 ID、標題、副標題、原文連結、heading、list、code 內容已讀回 |
| slug 保存／重載 | SEO「文章網址」另有儲存按鈕；重載後固定 slug 相同 |
| audience | 當前 DOM radio checked property 為 everyone，沒有切換受眾 |
| email／App 組合控制 | 一個核取方塊，同時代表電子郵件及 Substack App；預設開啟，驗收預覽時關閉 |
| 未提交時間預覽 | 2026-10-22 07:00、GMT+8，對應 2026-10-21T23:00:00Z |
| 裝置時區 | 主機 `/etc/localtime` → Asia/Taipei，與 UI GMT+8 一致 |
| 日期限制 | 真實 datetime-local 的 min／max 相差三個曆月；未點擊最終排程 |
| 取消預覽 | 返回同一草稿，Drafts 含 ID 221081849，Scheduled 為空 |
| 實際 Scheduled 保存／重載 | **尚未執行**。預覽及空列表不能代替此證據 |
| 寄送 | 本輪未點擊「立即傳送給所有人」、最終「發佈…」或測試信的「傳送」 |

## 真實 DOM 找出的修正

1. 原本比較用的 block 分隔空白也被寫進輸出 HTML，會改動 preformatted code。現在只在文字比較副本中加入分隔空白，發布用 HTML 保持原本結構。
2. 保存的 Substack 編輯器會把單一 list item 的內容包在 paragraph，並可能巢狀包裝 code mark。已以真實讀回 fixture 重現 `SUBSTACK_CONTENT_EVIDENCE_MISMATCH`，再限定正規化這些包裝。多段落、內部空白、額外空行、連結與圖片差異仍不得消失。
3. 日期 fill 可能只改 input property，React 仍持有舊時間。新 preview proof 比對 property／attribute、UI min／max、主機時區及 GMT+8；不一致即拒絕。preview proof 固定為 `armed:false`，不能充當 schedule-arm 的回覆。
4. `proof-schedule --evidence <preview-capture.json>` 可解析目前控制項證據；`reply-schedule` 仍要求既有的已保存狀態及相同 ID／意圖／版本／列表證據，不接受 preview 當作已排程。

可重跑證據在 `scripts/publishing/fixtures/substack-ui-20261019/` 與既有 `distribution-attended.test.ts`。原始 CUA DOM／截圖與 RED／GREEN 紀錄在 Git 外 `/private/tmp/gcake-substack-ui-20261019/`；該暫存目錄可能由系統清理。

## 已確認的操作界線

使用者已明確選擇：「維持不建立任何排程，這項讀回保留待驗」。先前提出的驗收草稿暫存排程／立即取消方案不執行，草稿 ID 221081849 保持未排程。本輪不部署、不啟用正式排程、不寄送通知。

Task 3.1 要求的「saved-and-reloaded current UI … Scheduled-list readback」不能以預覽取代，因此依使用者決定保留待驗，不勾選完成；目前沒有等待回覆的排程許可問題。Task 5.3 的正式首次雙通道試行也不執行。

未來若另行授權驗收排程，UI 保存／取消證據仍須與 5.3 的正式 source-first 第一封 email／App 承諾及 provider 自行公開證據分開記錄，不可由本輪推論。
