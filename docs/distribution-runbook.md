# Substack 分發操作

先確認來源已公開且匿名 Pages 驗證符合精確版本，使用既有 distribution:inventory、distribution:all-plan 與 distribution:sync 入口。唯一可執行的分發目標為 substack；舊目標或混合政策會在讀取憑證、平台與狀態寫入前拒絕。

D1 保留 remote ID、來源版本與原始操作意圖。未知結果只查核，不重建、不重發、不補寄；來源更新沿用同一篇平台文章。

完整入口與恢复規則見 [同步腳本](distribution-scripted-runbook.md)。
