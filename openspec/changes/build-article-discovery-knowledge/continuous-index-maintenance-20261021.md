# 持續雲端索引維護（歷史紀錄）

此為建立本機任務時的歷史紀錄。後續已依使用者要求暫停 automation-2，改由 Cloudflare 執行；現況及停用證據見 [雲端自動同步驗收](cloud-hosted-sync-20261021.md)。下文 ACTIVE 與設定 JSON 保留當時快照，不代表目前仍啟用。

２０２６－１０－２１，使用者明確授權持續更新公開文章的雲端索引。採本對話每小時一次的 Codex 持續任務，沿用 [ADR-001](../../../docs/decisions/ADR-001-cloudflare-semantic-search.md)及[操作手冊](../../../docs/article-discovery-runbook.md)。維護需要本機 Codex 可執行與既有 Cloudflare 登入；這不是已部署的 Cloudflare cron。

## 已建立的持續任務

任務識別為 `automation-2`，名稱「持續更新文章雲端索引」，類型為本對話 heartbeat，狀態 ACTIVE，每小時執行。[設定收據](continuous-index-automation-20261021.json)保存核對結果；已透過 Codex 工具建立並顯示設定卡，且唯讀核對本機持久設定的識別、狀態與頻率一致。首次核對是本輪前景執行；下一次排程及首次新文章更新的實際結果仍須各輪保存，不能用 ACTIVE 取代執行成功證據。

## 每輪操作範圍

１．保護主工作目錄的其他修改，優先使用現有隔離 worktree 中已驗證的搜尋工具。先確認沒有另一個未結束的索引維護輪次，保存擁有者與本輪紀錄；有重疊或未知狀態就停止寫入。

２．只讀正式 Pages discovery-manifest.json 與既有 D1 active policy。當 corpus 相同且無待完成輪次，記錄 no_change 即結束，零模型呼叫、零索引／policy 寫入。操作者已停用正式語意服務時不改開關。

３．有新公開版本時，核實原帳戶仍為免費硬上限、有效期限、當期共享用量與所有 namespace 的實際儲存量。僅使用 @cf/baai/bge-m3、plain、１０２４維／cosine，沿用目前輸入限制與本站保守上限。不能只從本機時鐘或準備檔推定官方餘額。

４．新建 corpus／輪次專用證據目錄，保留舊 frozen plan、journal、未確認結果與收據。只有完整模型／格式／內容鍵一致的 cache 可重用；重新核對可用的真實公開評測來源，不補造資料或設定最低題數。先計算最壞請求、輸入 bytes、Neurons 與儲存成長，在既有共享 D1 額度中原子預留，使用可查回的唯一 reservation ID；不能以本機 journal 代替共享扣額，不能覆寫當日列補滿預算。既有 cloud-stage 準備工具的檢查仍必須通過；工具不足則停止並說明缺口，不在背景改程式或放寬條件。

５．只更新本搜尋索引的相容向量及修訂中繼資料。等待非同步索引完成，再完整讀回預期 IDs／namespace／revision／向量；重新取得正式 manifest，仍同版才更新 activeCorpusId。免費容量不容許保留完整雙份時，僅按既有流程清理確認歸屬且已過期的向量，不能刪除來源文章或其他索引。

６．保存實際供應商結果、預留與快取命中、提升與查詢驗證；未知結果不退額度、不盲目重播推論。失敗或版本再變時保留新版關鍵字搜尋。無權限、政策到期、額度不明或不足時只回報，不升級付費、不更換模型、不改開關或有效期限，也不推送、部署網站／Worker、修改發文排程或對外發訊。

## 首次核對

[首次核對 JSON](continuous-index-initial-check-20261021.json)記錄正式 corpus 與 activeCorpusId 一致，為 ebb16a407bbbf0c3f8ec2895b79d200f9603fc7c6254a6bddbdd5991ff3deefb。第一次 API 存取遇到認證錯誤，透過既有 Wrangler 正常刷新並確認同一帳戶後，唯讀核對成功。本輪沒有模型呼叫或雲端寫入。

免費／隱私證據仍於２０２６－１１－２０ UTC ００：００到期；每日額度自動重設不延長此期限。沒有新的公開文章版本可驗收，因此本次只證明首次 no-change 核對與排程設定，未宣稱首次變更文章的背景供應商更新已完成。
