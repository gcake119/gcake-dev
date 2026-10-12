> 歷史紀錄：Paragraph 同步已於 2026／10／13 停止。本頁不得作為啟動或恢復授權。

# Pages 原文待核准版本，2026-10-12

使用者採用「正式開賽後，我怎麼知道自動發文真的完成了？」，指定原文日期 2026-10-12，僅授權準備變更與本機審閱，不授權提交、推送、部署、跨平台發布或寄信。

## 具體變更

1. `src/content/posts/ithome-2026-extensions/ithome-2026-publishing-in-production.md`：`status: ready` 改為 `status: published`，新增 `publishedAt: '2026-10-12'`。這是待部署 metadata；Git 工作副本的 published 不代表公開 Pages 已發布。正文、標題、摘要、topics 保持原樣。
2. `src/content/series/ithome-2026-extensions.yaml`：只把同一篇的目錄狀態改為 published，保留篇序、其他文章與 editorial 設定。否則文章頁／RSS 雖出現，系列總覽會漏掉此篇。

既有日期解析使用 Asia/Taipei，帶引號的日期表示台北 2026-10-12 00:00，即 ISO `2026-10-11T16:00:00.000Z`。RSS 的 UTC 日期雖顯示 10 月 11 日 16:00，與畫面的台北 10 月 12 日是同一時刻，沒有回填錯誤。

## 版本

以最新 main `f9e8d461e097f72e697e4d3da251b51d02d1f57b` 為基底準備獨立的兩檔 patch：

- 原文 sourceRevision：`sha256:f9b9647944bcdbcff8bd5df83308f65d085a4431fe9f9f3819731a22fb9d10bf`
- 系列 manifest SHA-256：`6feca8f1de712f4d20fff34d50904eb645b507083826c2bcf94f699039873f2a`
- 兩檔 patch SHA-256：`d007494f48a9d441322124e2b5e7d4ba389a69a24bd14b3ab8f4ed72efaaec68`
- patch：`/private/tmp/gcake-pages-review-20261012/pages-content.patch`
- 驗證報告：`/private/tmp/gcake-pages-review-20261012/verification.json`

沒有 commit SHA，因為尚未提交。先前 a85b33cf 開頭的無日期候選版本及 blocked review 已被這個待審閱版本取代，不得沿用舊授權。

## 本機證據

為避免將 PR #8 的舊 workflow 或跨平台實作混進原文發布，將最新 main 的精確 Git archive 放在隔離暫存目錄，只套用上述兩檔變更，以鎖檔離線安裝該快照依賴。初次借用舊 worktree 的 node_modules 導致缺工作區依賴／型別錯誤；完整依賴安裝後重新驗證通過，沒有修改程式碼或依賴鎖檔。

最新 main + 兩檔內容變更：`pnpm test:public` 38／38 通過，`pnpm check` 144 檔案零 errors／warnings／hints，`pnpm build` 35 頁成功。diff check 通過。確認正文與原始 main 完全一致、文章頁標題／canonical／日期正確、JSON-LD datePublished 正確、RSS 與系列總覽均包含文章。日誌在 `/private/tmp/gcake-pages-review-main-{test,check,build}.log`。

側邊瀏覽器已開啟真實本機渲染：`http://127.0.0.1:8769/gcake-dev/posts/ithome-2026-publishing-in-production/`，畫面日期 2026/10/12、系列 1／1，完整正文可閱讀。此為本機預覽，不是正式 Pages 公開驗收。

## 兩平台 dry run

使用原實作 worktree 的共用 CLI，對相同原文版本重新產生：

- `/private/tmp/gcake-article-final-review-20261012/paragraph-review.json`，digest `sha256:eed4530bf5a34e578bee5da2a7eaf0c4021406320b0ba09438bdf0a74085fe42`
- `/private/tmp/gcake-article-final-review-20261012/substack-review.json`，digest `sha256:dccd147da3a9841746d76c80207eec8631a3728ff9bda6a5b9ce986566e4be1d`

兩檔 externalWriteEnabled=false、approvalTemplate.approved=false，未授權任何草稿或正式寫入。Substack full-mirror 政策仍為平台 canonical + Pages 原文連結及發布後恢復原文日期。文章不含圖片，不能宣稱已完成真實圖片驗收。

## 核准後才可執行

先審閱兩檔 patch、日期與完整版本。若之後獲得 Pages 發布授權，再確認 main 未漂移，單獨提交／推送這兩檔內容，不把跨平台實作整包合併。最新 main 的 Pages workflow 僅 workflow_dispatch，build/deploy 均限定 main；人工核准後才觸發該 workflow。此處沒有重新加入 push 或 schedule 觸發器，也沒有自動合併 PR。

Pages 部署成功後，匿名驗證 canonical 文章 HTTP 200、標題、正文、日期、RSS、系列連結；這些公開證據通過，才能接續跨平台草稿／publish 的平台、操作及版本授權。D1 checkpoint、Substack 側邊執行銜接／控制驗收與 Paragraph gate 缺口仍依既有操作手冊處理。沒有新增排程、觸發 Hermes 或寄送電子報。

## 核准後的正式結果，2026-10-12

使用者已核准上述精確內容版本與 Pages 發布，並另外核准獨立 CI 修復。CI 修復 PR #13（最終僅暫存 fixture 一檔，validate 名稱已由並行 PR #12 完成）與兩檔內容 PR #11 均通過完整本機及 GitHub CI 後正常合併。原文與 manifest 雜湊仍與本文件版本一致；Pages 最終部署 SHA 26b304c5e6db9798890ed67703430606adc29878，人工 run 38161118291 成功。

正式網址 https://gcake119.github.io/gcake-dev/posts/ithome-2026-publishing-in-production/ 已 HTTP 200，全文與核准 Markdown 一致，canonical、台北 2026-10-12 日期、JSON-LD、RSS 單一 item、系列目錄連結全部通過。公開驗證 /private/tmp/gcake-pages-public-verification-20261012.json；完整本機 234 Node＋4 Python tests、145-file check 零診斷、全部 Build、發布模擬通過。Paragraph／Substack dry run 的核准仍 false，未執行平台發布或寄信；PR #8 未合併。
