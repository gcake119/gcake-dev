# 草稿驗證修正的獨立 PR（2026／10／20）

本次以最新已合併 main `f4ea22f097973f4978e7dccbbaddad87bb3c4ec7` 建立乾淨分支，只整理草稿清單驗證、Chrome 分頁生命週期、測試及相關規格／手冊。原工作區及先前後台 worktree 的混合修改保留。

## 相容性與範圍

共用驗證器同時接受 editor／published-detail 文章連結，依實際頁籤總數檢查三清單；子執行者與父控制器獨立驗證原 ID。父程序不信任子程序自行寫入的成功判決。不完整清單在讀取完成或寫入前裁決時均拒絕，保留原內容與未決意圖。原全文、圖片及 slug 比較標準不變。

保留 PR41 的原子裁決檔、有效政策替換拒絕、來源／main／結果圖片的整輪期限、改名公平輪替與沒有 intent 的 checkpoint 對帳；保留 PR42 新草稿狀態清除與過期查詢隔離。沒有從舊快照覆蓋整份最新 main 檔案，也沒有更動預設開關、CI、依賴或 migration。

沿用既有 Node／SQLite 驗收檔：原清單案例在修正前重現失敗；修正後 53 個聚焦案例通過，包含父程序拒絕偽造子判決及寫入前清單不足。新候選以 Node 22 執行五項完整既有 gate，精確結果與候選指紋見 [read-repair-pr-local-results.json](read-repair-pr-local-results.json)。

Spectra 在 Git worktree 會導向共同主專案。本次將本分支的 openspec 與設定複製到自有非 Git 規格快照，核對檔案位元組相同後執行 validate／analyze／apply 狀態檢查；不用主工作區舊規格充當本分支驗證。沒有建立或更新 MCP 索引。

## 證據界線

[原稿全文與自然輪次驗收](read-repair-20261020.md) 和 [原始機器摘要](read-repair-results.json) 是先前私人 pin `154d919567c7eccb6a47674ef88b21b401680d84893a6739f151cb97f44f32ae` 的歷史證據：原 ID 221099415、slug `ithome-2026-template-hardening`、自然 run 10、零內容寫入、正式後台已保存並驗證。該 runtime 與本次加入最新 main 修正後的候選不同，不能把它宣稱為本分支的全新 provider／無人輪次資格。

這次只提交與推送分支、建立 PR；CI 結果由 PR 的精確 head 檢查紀錄判定，不以本機通過取代 CI。沒有合併、部署、私人 runtime 安裝、Chrome provider 操作或 D1 寫入。站立設定仍保持新建停用、排程寫入停用，原 ID／slug、既有排程、已公開文章與訂閱者寄送承諾不因本次 PR 動作改變。
