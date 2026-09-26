# 文章排程與來源同步

本地文章以 Markdown frontmatter 的 status: published 與 publishedAt: YYYY-MM-DD 設定排程；系列 YAML 的對應 post status 也須為 published。draft／ready 不公開。無日期的 published 文章維持立即公開行為。日期依 Asia/Taipei 比較，尚未到期的文章不產生閱讀路由、不進入首頁、系列、主題或 RSS。

每小時第 37 分鐘的 GitHub Actions schedule、push main 及手動執行都重新同步並部署。先將正文及系列設定推送至 main。排程可能延遲或略過，長期無 repository 活動也可能被 GitHub 停用，不提供準點保證。

外部來源先成功部署 blog-sync.json，再按清單指定 Git revision 與 SHA-256 讀取全部公開篇目。缺檔、逾時、格式錯誤或雜湊不符會停止部署並保留既有線上版本，下次執行再嘗試。來源非草稿且台北日期到期才列入公開集合，30 篇皆公開才為 completed；此狀態不代表 iThome 平台發文成功。

本地文章排程目前與外部同步共用部署流程；來源無法讀取時，本地新文章也會延後公開，這是防止發布不完整版本的選擇。可於 Actions 查看失敗原因並手動重跑。

此次只發布同步與排程工程，保留既有線上設計；本機重設計、搜尋、頁尾、關於頁不包含在本次發布。
