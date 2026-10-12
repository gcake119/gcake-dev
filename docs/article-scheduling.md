# 文章排程與來源同步

## 完賽快照的現行政策（2026-10-13 已確認）

原始 30 篇使用已成功部署保存的 completed 完整快照，每次核對來源／revision、完整集合與逐篇 SHA-256，不再讀取來源清單或正文。快照無法讀取、內容不完整或雜湊不符時停止部署，保留既有線上版本；不得退回舊 19 篇資料或改抓來源。回滾也需保留 completed 快照。每次使用固定 revision，逐篇正文 SHA-256 與完整集合全部核對成功後才原子替換建置快照；任一步失敗即停止部署，不發布混合版本或部分結果。完賽前抓取來源的步驟只保留為歷史。完整規則見 [外部內容文件](external-content.md)。

## 既有連載排程與部署整合（2026-10-13 本機實作）

既有 Editorial Release 保留 cron `0 23 * * 0,3`（週一、週四台北 07：00）與 `7 * * * *`（每小時第 7 分鐘巡查）。D1 在到期且資格符合時取得一篇，Worker 以 GitHub App 原子更新文章 frontmatter 與系列 manifest；只有取得新的發文 commit SHA，該次 workflow 才建置並部署該固定 SHA。每小時無新發文的巡查不建立部署，也不重送文章。

普通 `deploy-pages.yml` 保留手動入口與受保護 Secret acceptance。先前準備的 push main＋每小時第 37 分鐘候選已由使用者撤回，屬 legacy，不啟用；不新增 workflow、writer 或排程。自動連載只有既有 editorial workflow 一個部署入口。人工 Pages 部署是另行授權的操作，不由每小時巡查觸發。

兩條 Pages 建置入口都先執行 `pnpm content:restore:ithome`：只讀部落格保存的 completed 快照，依 `ithome-2026.completed-manifest.json` 核對固定 revision 與 30 篇獨立 SHA-256，全部成功才原子替換本機建置快照。失敗立即停止建置與部署，保留既有網站；不得使用舊 19 篇或抓取已完賽來源。舊 `content:sync:ithome` 的 active 同步流程只保留為歷史工具，不是這兩條部署入口。

CMS 依實際 artifact SHA 查核普通 Pages 與 editorial workflow；GitHub job 名稱記錄該 SHA，不能拿 editorial run 的觸發 SHA 代替發文後產生的 SHA。觀察範圍為各 workflow 最近 100 次 main runs；超出範圍或無對應證據保持未知，不以其他最新 run 代替。成功巡查且部署略過，不算部署成功。重試仍受既有 Actions write 與 `RELEASE_DEPLOY_RETRY_ENABLED` 授權限制，只重跑同一 SHA 所屬失敗 run 的 failed jobs；不重新發文、不重跑整個 workflow。公開頁、正文摘要、日期與 RSS 驗證仍獨立，不能把 Actions 綠燈當成公開證據。

文章須已 published 且時間到期才可見；ready／draft 仍不公開。排程可能延遲或略過，實際公開須等待成功部署，不保證準點。原始 30 篇快照、幕後篇序與文章狀態／日期未因本次修補改動。本次僅本機實作與驗證，尚未提交、推送或部署新版 Worker／workflow，正式 D1 狀態仍需唯讀核對。

## 早期文章排程與同步紀錄（歷史）

本地文章以 Markdown frontmatter 的 status: published 與 publishedAt: YYYY-MM-DD 設定排程；系列 YAML 的對應 post status 也須為 published。draft／ready 不公開。無日期的 published 文章維持立即公開行為。日期依 Asia/Taipei 比較，尚未到期的文章不產生閱讀路由、不進入首頁、系列、主題或 RSS。

每小時第 37 分鐘的 GitHub Actions schedule、push main 及手動執行都重新同步並部署。先將正文及系列設定推送至 main。排程可能延遲或略過，長期無 repository 活動也可能被 GitHub 停用，不提供準點保證。

外部來源先成功部署 blog-sync.json，再按清單指定 Git revision 與 SHA-256 讀取全部公開篇目。缺檔、逾時、格式錯誤或雜湊不符會停止部署並保留既有線上版本，下次執行再嘗試。來源非草稿且台北日期到期才列入公開集合，30 篇皆公開才為 completed；此狀態不代表 iThome 平台發文成功。

完賽前，本地文章排程與外部同步共用部署流程；來源無法讀取時，本地新文章也會延後公開，這是防止發布不完整版本的選擇。可於 Actions 查看失敗原因並手動重跑。

此次只發布同步與排程工程，保留既有線上設計；本機重設計、搜尋、頁尾、關於頁不包含在本次發布。

## GitHub Actions 自動完賽收尾

每次建置先讀取部落格自己的 ithome-snapshot.json。尚未 completed 時才連線來源，逐篇核對後發布新的完整快照。公開30篇的 completed 快照成功部署後，下次及往後執行只核對並恢復這份快照，不再讀取來源清單或正文；每小時建置與本地草稿日期規則仍照常執行。沒有 Codex 排程參與，也不新增 contents: write 或跨 repo 秘密。

快照由成功的 GitHub Pages 部署持久保存，不依賴 Actions cache 或有期限的 artifact。完賽後來源網站故障不影響本地發布；部落格自己的快照若無法讀取或被破壞則停止部署，避免退回舊19篇快照。失敗時既有線上網站維持原版。人工移除／回滾快照可能重新啟動同步，因此回滾需保留 completed 快照。
