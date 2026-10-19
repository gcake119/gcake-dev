# Substack 前景 UI 證據，2026／10／19

來源：透過 CUA 操作既有登入的 Chrome，刊物 `gcakedev.substack.com`。此為特別建立的未發布驗收草稿，不是正式文章、既有鏡像的複本或寄送候選。

- 草稿 ID：221081849。
- slug：substack-ui-qualification-20261019。
- 已重新載入編輯器及 SEO 設定，讀回相同 ID、標題、副標題、全文與 slug。
- Drafts 列表含該 ID；Scheduled 列表為空。未確認發布、排程或測試電子郵件。
- email／App 共用一個 `data-track-input="send_email"` 核取方塊。新開預覽預設勾選；本次關閉它再檢查排程預覽，最後按取消。
- 排程 checkbox 的名稱隨寄送選項、選取狀態與日期而變，讀取契約採實際 `data-testid="scheduled-at"` 與 `aria-checked`，不以整段動態 accessible name 定位。
- 日期為 `input[data-testid="date-editor"][type="datetime-local"]`，UI 顯示 GMT+8。主機 `/etc/localtime` 實際指向 `/var/db/timezone/zoneinfo/Asia/Taipei`，不能僅憑 GMT+8 推定 IANA 時區。
- 真實日期輸入中，單純 fill 曾使 value=2026-10-22T07:00，而 value 屬性仍為舊日、最終按鈕仍顯示「1 天內」。實際鍵盤事件後 value／屬性一致，按鈕變為「3 天內」。這只能證明預覽已更新，不證明 provider 保存排程。
- radio 的 checked HTML 屬性與當前 DOM property 可能不同。`audienceRadios` 取自當前 DOM checked property；不可從序列化 HTML 的 checked 屬性猜測受眾。

`source.md` 是本次驗收內容；`saved-draft.json` 是真實重載後的讀回。Substack 會為簡單清單項加一層 paragraph，並可能把 code mark 巢狀包裝；對應測試只允許這些觀察到的包裝差異與一個 fence 結尾換行，仍保留多段落、內部空白、額外空行、URL 與結構差異。

所有 fixture 只包含本次作者自建內容、控制項與去除導覽／帳戶資料的片段。沒有 cookies、credential、private share token、訂閱者名單或測試收件地址。fixture 是當次 UI 契約證據，不是未來 UI 仍相容、已排程、已寄送或已部署的證明。

使用者已明確選擇不建立任何排程；Task 3.1 的 committed Scheduled-list 讀回依此保留待驗，不執行驗收草稿的暫存排程／立即取消，也沒有等待回覆的排程許可問題。Task 5.3 的正式首次雙通道試行另行保留。
