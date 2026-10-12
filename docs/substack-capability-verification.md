# Substack canonical 與原文日期查核

查核日期：2026-10-11（Asia/Taipei）。沿用授權的不公開測試草稿 `219884438`。沒有建立第二篇、發布、寄信或提交排程；未更動文章內容。最終畫面為「已儲存」草稿。

## 直接觀察

| 項目 | 可驗證結果 | 判斷 |
| --- | --- | --- |
| 草稿文章設定 | 受眾、留言、標籤、測試郵件、草稿連結、社群預覽、SEO、刪除 | 沒有顯示發布日期欄位 |
| 展開 SEO | SEO 標題、SEO 描述、固定 `gcakedev.substack.com` 前綴的文章網址 | 是 slug，沒有外部 canonical 欄位 |
| 發布前日期 | 取消寄送後為「排程發佈時間」，時區 GMT+8 | 未來排程，不是回填原文日期 |
| 排程輸入 DOM | `datetime-local`，min `2026-10-11T23:57`，max `2027-01-11T23:57` | 當時 UI 不允許歷史日期；未提交 |
| 不寄信 | 取消「透過電子郵件和 Substack App 傳送」後可見「立即發佈」 | 可只發布到網站，但本次沒有點擊 |

截圖（本機、不含草稿私密連結）：`/private/tmp/gcake-substack-seo-20261011.jpg`、`/private/tmp/gcake-substack-schedule-20261011.jpg`。

## 官方文件

- [編輯已發布文章與顯示日期](https://support.substack.com/hc/en-us/articles/360039017132-How-do-I-edit-a-post-that-I-ve-published-on-Substack)：先開啟已發布文章的 Edit，再進 Settings 的 Displayed publication date，選擇不晚於當下的日期與時間並 Save。
- [手動匯入文章](https://support.substack.com/hc/en-us/articles/360037830351-How-do-I-import-my-posts-from-another-platform-such-as-Mailchimp-WordPress-Medium-or-Ghost)：手動貼上文章後，發布完成才修改日期以符合原始發布日期。
- [發布與不寄送](https://support.substack.com/hc/en-us/articles/360037831771-How-do-I-publish-a-new-post-on-Substack)：預設寄送電子郵件與 App inbox，需取消寄送選項。
- [官方 SEO 說明](https://support.substack.com/hc/en-us/articles/4407702258836-How-can-I-optimize-my-Substack-publication-for-SEO)：沒有記載逐篇外部 canonical 的設定方式。文件未記載不等於證明平台絕無此能力；目前標準編輯器及公開官方文件仍沒有可實作、可驗證的支援路徑。
- [Google canonical 文件](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)：HTML head 的 rel=canonical 或 HTTP canonical header 才是對應訊號。文章內的來源連結不可當成這項驗收證據。

## 可行日期流程及其限制

若未來取得單篇正式發布授權，日期可採「先網站發布、再修改同一文章日期、最後匿名讀回」的兩階段流程。第一次發布前仍須取消寄送；發布後保存原 remote ID，不可重新建立。日期修改失敗時保留 checkpoint 並標示尚未驗證；只能找回並更新同一篇文章。日期成功、內容與 canonical 也通過後才能 verified。

此流程會短暫讓公開文章呈現當下日期。是否接受這個短暫差異，需要使用者決定。這次沒有進行發布後實測，不能宣稱歷史日期、RSS／結構化日期或修改後公開頁已驗收。既有 adapter 仍保留發布前能力 gate，未改成先發布再補日期。

## 方案與決策

2. **Substack 改成摘要與原文連結（建議作為分發方案）**：GitHub Pages 保持完整原文與 canonical；從同一 Markdown 產生摘要，含原文日期與閱讀全文連結。Substack 摘要的頁面可有自己的 canonical，須明確變更驗收範圍，不可宣稱 canonical 指回 Pages。Substack 可使用摘要發布當日作平台日期，原文日期寫在正文；若仍要平台日期一致，另外選擇兩階段日期流程。需使用者確認摘要規則及日期政策後才修改規格與工具。
3. **接受 Substack 全文鏡像例外**：保留 Markdown 唯一來源與正文來源連結，但放寬 Substack HTML canonical 的要求。不能保證搜尋引擎選 Pages 為 canonical；兩階段日期仍需接受短暫差異與真實驗收。此方案不符合現行外部 canonical 驗收，未獲明確變更前不能實作或發布。

自訂網域是將刊物放到另一個網域，不能當作逐篇指向現有 `gcake119.github.io/gcake-dev/posts/...` 的 canonical 解法。匯入也沒有外部 canonical 成功證據，且可能直接公開文章，本次沒有試匯入。

選擇替代方案只授權規格與程式調整，不等於授權發布或寄送電子報。正式發布仍需逐篇／平台／版本授權。

## 使用者已選擇方案 3，2026-10-12

已接受 Substack 全文鏡像 canonical 例外及發布後回填原文日期，並接受短暫顯示當下日期。Pages 仍是完整原文與唯一內容來源；Substack 的 HTML canonical 不宣稱指回 Pages。程式與規格已依此政策調整，保留正式寫入關閉。詳見操作手冊的 finalize 恢復流程。這項選擇沒有授權本次發布、寄信或提交排程；現有測試草稿未在本次操作。
