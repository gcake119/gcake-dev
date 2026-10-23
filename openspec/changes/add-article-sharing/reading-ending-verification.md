# 閱讀優先文章結尾：本機實作驗證（２０２６－１０－２３）

## 範圍與核准來源

使用者核准 http://127.0.0.1:4398/ 的完整文章結尾及後續公開站字級對齊，並明確授權更新 Spectra、開始本機實作、必要驗證及更新預覽；本輪不提交、推送、建立 PR 或部署。核准的 HTML／資料保存於 design-source/，正式文章未使用其示意正文或假連結。先完成 article-ending requirement／Gherkin、修訂 sharing 位置，再追加第６組 tasks，保留過往完成任務及證據。

- 基底：`53f1e69dd284ff865ede5c5d218078a4290fe36a`，分支 `codex/article-sharing`；產品、測試與文件仍未提交。
- 當前來源摘要：`evidence/reading-ending-source-digests.json`；保留既有其他工作的 `AGENTS.md` 修改，沒有編輯或重置。
- 決策檢核：Level 2，依核准版面覆寫篇尾順序與呈現，不改 ranking／provider／正文／內容權威；更新設計文件、決策索引及文章探索操作手冊，不新增 ADR，不封存。

## 實作結果

兩種文章模板共用 ArticleReading：公開系列下一篇的完整標題與摘要優先，上一篇及系列總覽集中；既有 further 然後 related 候選依序合併，只解析目前公開文章，排除自身、前篇、後篇及重複目的地。有下一篇時最多２篇其他推薦，沒有則３篇，不足不補齊。不存在可解析推薦時跳過，沒有閱讀內容的獨立文章不顯示空標題。

正文後依序為接著讀、分享、訂閱及收合的參考與引用；移除分散的篇尾 pagination／重複系列返回入口。已完成系列末篇才顯示末篇文案；連載最新一篇顯示中性「目前已讀到最新一篇」。分享維持原 SVG＋文字、clean reading URL、取消中性與完整網址復原；文章訂閱使用核准文字、既有連結，首頁訂閱內容不變。引用仍區分本文提及、引用本文及外部參考，不把推薦當引用。

字級量測符合核准公開站：根１７px、正文１rem／１．９、篇尾標題２０．０６px、下一篇１７px／７００、其他推薦１７px／４００、摘要１３．９４px、分享與訂閱操作１７px。沿用雙主題 token、４４px 控制及焦點。正文、canonical、Open Graph、原始版本連結與全站頁尾未改。

## 自動驗證與限制

| 檢查 | 結果 |
| --- | --- |
| 真正 RED | 舊 build 缺少 consolidated reading guidance，`evidence/reading-ending-red.log` 為實際斷言失敗。 |
| 公開 aggregate | `PATH=/private/tmp/gcake-sharing-pnpm-bin:$PATH pnpm test:public`：１０３／１０３，含既有 sharing 與新增３項穩定合併／排除／不足／失效目標邊界驗收；沒有 skip。 |
| 公開 build | 既有 `pnpm build`（含 content validation）通過，５２頁；最後一份 build 用於建置 HTML 與 browser 檢查。前次 build 後僅移除無作用 CSS，已重新建置讓來源一致。 |
| 建置 HTML 與既有訂閱 | `node --import tsx --test test/article-sharing.rendered.test.ts test/subscription.test.ts`：３／３，遍歷全部３６篇公開文章及首頁；驗證順序、數量、前後篇／推薦排除、原文 metadata、RSS／newsletter 與首頁訂閱。 |
| 完整 Astro check | 在既有本次工作專用的 `/private/tmp/gcake-article-sharing-verify-20261023` 複製同一候選來源、沿用已安裝相同依賴後，執行既有 `pnpm check`：２７８檔、０ errors／warnings／hints。沒有改 tsconfig 或 required gate。原目錄的歷史 output 型別錯誤仍保留，不把 scoped check 說成完整通過。 |
| Browser 版面 | Chrome 155.0.8059.86：系列中段 Day 8、已完成末篇 Day 30、獨立文章、連載最新本地文章，４情境×桌面１２８０／手機３９０×明暗主題，共１６組；computed font sizes、無水平溢出／遮擋、區塊順序、公開前後篇／完成狀態、鍵盤焦點及 Enter 實際跳轉均通過。 |
| Browser 復原與引用 | 實際以鍵盤展開引用，確認既有外部來源；分享錯誤以 capability double 驗證完整網址選取，取消保持中性；不支援及無 JavaScript 有手動網址，無 JavaScript 仍有下一篇連結。沒有 provider／社群發送。 |
| Spectra／diff | `spectra validate add-article-sharing` 通過；analyze 無 Critical／Warning，僅補 Example 建議；`git diff --check` 通過。 |

Browser 初輪在１６組版面檢查完成後，於引用名稱的精確比對失敗：既有可及名稱是「Spectra ↗」而非「Spectra」。保留該 log；僅調整測試 locator 並縮小範圍複查引用與復原，未修改產品、未重跑已通過的版面迴圈。兩階段結果分別在 `output/playwright/article-sharing/ending-layout-result.json` 及 `ending-recovery-result.json`，不是空矩陣的全通過。初版 HTML 相鄰元素斷言也已改成可觀察區塊順序，避免把不佔畫面的 Astro module script 誤當版面區塊；仍檢查所有實際區塊順序。

本機 logs：`output/article-sharing/ending-*.log`。Browser script、１６組截圖、復原圖及結果：`output/playwright/article-sharing/ending-*`。已檢視桌面明亮系列與手機暗色獨立文章截圖。沒有增加依賴、模型呼叫、CI workflow 或另一套測試層。

## 人工證據與交付界線

先前使用者已確認核准版面的方向／字級，及分享系統選單能開啟、取消後正常；這些是使用者提供的人工證據。新版實際頁面仍待使用者確認，瀏覽器 capability doubles 不代替原生選單或平台送達。本輪未重新發送分享，未做正式服務驗收，未提交／推送／PR／部署。

前一輪為準備 PR 而啟動的完整跨工作區測試，已在使用者改為重新規劃時中斷並保存，不算通過，也未為本輪重新執行無關 Hermes 測試。未來另獲提交／推送授權時，仍須依當時規則滿足完整 required local gate。

## 本機預覽

原文章預覽 listener PID `15965`，本聊天擁有，沿用 `127.0.0.1:4397`，更新 build 後已以瀏覽器確認真實新頁面。

- 系列中段：<http://127.0.0.1:4397/gcake-dev/series/ithome-2026/day-08/#article-reading-heading>
- 已完成末篇：<http://127.0.0.1:4397/gcake-dev/series/ithome-2026/day-30/#article-reading-heading>
- 獨立文章：<http://127.0.0.1:4397/gcake-dev/posts/ai-agent-development-workflow/#article-reading-heading>
- 連載最新：<http://127.0.0.1:4397/gcake-dev/posts/ithome-2026-publishing-in-production/#article-reading-heading>

保留供人工確認；停止前用 `lsof -nP -iTCP:4397 -sTCP:LISTEN` 核對歸屬，再執行 `kill -TERM 15965`。原版面提案 `4398` 仍保留供對照，僅本機開放。
