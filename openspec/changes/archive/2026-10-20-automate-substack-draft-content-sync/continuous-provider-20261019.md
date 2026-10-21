# 一般草稿持續同步驗收：2026／10／19

## 授權與範圍

使用者授權完成剩餘驗收後啟用持續寫入，並選定「先啟用既有 ID 自動同步，新建保持停用」。另明確允許在原未排程 ID 221099415／ithome-2026-template-hardening 暫存含測試圖片／alt 的驗收版本，再恢復目前 Git 全文。此例外只用於私有資格驗收；正常同步仍只採用符合資格的固定 main Git 原文。

所有階段保留原 ID／slug，不操作排程、公開文章、Continue／Publish／Send、測試寄信或訂閱者通知。新建能力未做真實資格驗收，allowCreate=false，不因既有草稿驗收而宣稱已支援自動新建。

## 本機候選

一般 round 已接上真實 Chrome CLI executor，不再等待人工 reply。控制程式獨立核對 request envelope、原 ID、來源、版本、操作意圖、實際 Chrome surfaces、完整 before／after 和 paste／Saved／離開／重載證據。Chrome 使用名稱，不跨程序沿用 inventory 數字。獨立程序沒有 D1 credentials，只操作自己的新分頁。嚴格內容 comparator 未變更。

新增實際 RED／GREEN：一般執行者接線兩項、禁止新建一項、未變更已排程／已發布來源保持安靜兩項。最後 Node／SQLite 草稿同步檔案 39 項通過。五項完整 gate 皆通過，證據在 /private/tmp/gcake-ordinary-r4-gates-20261019；候選 16 個受影響來源／測試檔雜湊固定。先前 r3 gate 在 quiet 修正期間輸入變動，標記 superseded，不作最後候選證據。

## 寫入前失敗保全

第一次實際嘗試在讀基準時，猜測 [name=title] 屬性導致 null；實際欄位只有對應的 accessibility name。九次 Chrome 呼叫沒有 fill／press／clipboard write，額外命令僅讀取 payload 與保存私人 stop evidence。保留所有失敗原件後，以 Chrome-only inventory 確認自有分頁關閉，核對確切操作雜湊後僅解除確認未送出的 owned intent，狀態為 inconclusive，沒有把失敗改稱通過。證據：/private/tmp/gcake-draft-media-qualification-20261019。

第二次在關閉 SEO 後，用固定 snapshot 字串判斷 Saved；畫面實際是「button: 已儲存」而非帶引號的同一文字，錯誤判為未儲存。十四次實際呼叫沒有編輯；完整 before digest 仍匹配原 Git。保存 writeEvidence=false 的原失敗結果、獨立確認自有分頁已關閉後，只解除確認未送出的 owned intent。修正為實際可見定位器／讀取等待，不修改驗收條件或內容 comparator。證據：/private/tmp/gcake-draft-media-qualification-r2-20261019。

兩個失敗的 request／intent 不重播。後續使用新目錄、新 request、新 intent 與新鮮基準。新的圖片資格驗收仍在進行，不因本機通過而宣稱 provider 通過。

## 停用候選安裝

2026-10-19T15:06:42.040Z 安裝 installed-draft-continuous-chrome-20261019，runtime pin 有 19,142 個 regular files，SHA256 為 c8b7fec26aef0dba6c2cab0f7ee876a87063042a1cf8c02f7080d11610430100。沿用同一 dev.gcake.distribution-sync、900 秒、RunAtLoad=false、KeepAlive=false 與既有 round lock；沒有 kickstart。

安裝時 draftSync.enabled=false／writeEnabled=false，scheduled.writeEnabled=false；沒有 qualification 憑證冒充已通過。預先保存的 planned scope 為 Chrome、既有未排程從未公開 ID、allowCreate=false、每輪最多 20 筆、單請求最多 600 秒、草稿階段最多 840 秒；目前仍未啟用一般寫入。後續須有圖片版本與 Git 恢復的完整真實證據，才可核發綁定此 pin 的資格與授權，最後以原計時器自然輪次完成盤點驗收。

## 待完成的實際證據

圖片／alt 保存及重載、Git 全文恢復、啟用設定及自然 ordinary 全清單驗收尚待實際結果。前台 HTTP API 未部署，排程變更的另一個 task 5.3 仍 pending。沒有 commit／push、Worker 部署或 D1 migration。


## 圖片差異、失敗保全與 Git 恢復

第三次資格請求（私人目錄 gcake-draft-media-qualification-r4-20261019）確實完成一次全文貼上、Saved、離開與重載，但嚴格比對回報 SUBSTACK_CONTENT_EVIDENCE_MISMATCH，未通過。實際來源為帶超連結的 PNG 圖片，Substack 託管相同原圖並更換顯示外框，但移除了來源擁有的圖片超連結；不能把這個失敗改稱為等價。

獨立讀取來源與 UI 所指向的 Substack S3 原圖，兩者均為 3,339 bytes、image/png，SHA256=088f5f545e0727dfa49af5ca82e982a4e8e2bdd7c5794fe6d742b6b2b95e2288，alt 相同。使用者其後明確核准原圖雜湊、順序、alt／連結保留的圖片等價驗證。新增 draft-only original-sha256-png-v1 投影，共用嚴格 comparator 不變；保留原始 UI HTML，圖片原圖由控制程式獨立取得並雜湊。僅支援獨立、未包超連結的 PNG，每篇最多 8 張、每張最多 8 MiB；來源圖片內嵌於文字、帶超連結、格式或大小不符時，在 authenticated editing 前停止。

另新增父程序 before-verdict：執行者保存實際 before 後，必須等待控制程式重新驗證來源、權限、版本、原圖與完整基準，取得綁定請求與 before 雜湊的正向判決才可貼上。缺失、拒絕或過期判決均不准編輯。現有 Node／SQLite 檔案 43 項測試通過，包含實際執行產生的 verifier 程序與負向拒絕；完整候選 gate 另記，不以單項取代。

恢復 Git 的新請求完成一次全文貼上與 Saved，但離開後的讀回等待失敗，保留未知 intent，沒有重貼。其後有來源 main 更新與 Chrome 初始快照逾時兩個唯讀失敗，均保存原件。最後以專用新 Chrome 分頁唯讀重載核對完整 Git：原 ID 221099415、slug 保留，圖片數 0，嚴格 digest=sha256:e0bf0977ae22ffe1d050ad9a51ebcada48dbf526ef332c596e617d5c21b16721，於 2026-10-19T15:34:16.167Z 完成精確舊 intent 對帳。D1 為 pending，明示 currentMainQualificationPending=true，未將人工唯讀恢復宣稱為無人資格驗收。

自動審核拒絕過一個會跨程序留下 D1 鎖的方案，該方案未執行。採用的替代方式是先無鎖唯讀 UI 查證，再以單一程序 try／finally 取得並釋放短鎖，僅解除吻合的舊 intent。所有歷史原件、未知結果與恢復證據保留在 Git 外，不重播原圖片請求。新資格必須使用獨立未包連結的 PNG 與全新請求。


## 已通過本機 gate 的媒體候選安裝

2026-10-19T15:44:12.812Z 安裝 installed-draft-continuous-media-chrome-20261019，18 個來源／測試檔候選已通過全部五項既有 gate。runtime pin 為 19,143 個 regular files，SHA256=057997a49c9cd76100de3501ec511ee8ab7d90c264b7e3cd87bd07aefaa6f430。舊 staged candidate 保留，不原地修改。仍為同一 900 秒 LaunchAgent，無 kickstart，draftSync.enabled=false／writeEnabled=false／allowCreate=false，scheduled.writeEnabled=false；候選 scope 到期時間為 2026-11-18T15:44:12.782Z。新圖片與還原請求在私人 gcake-draft-media-equivalence-20261019 中進行，安裝不代表 qualification 或啟用通過。


新媒體候選第一個請求在清單載入階段失敗，沒有進入編輯器。九次 Chrome 呼叫沒有 fill／press／clipboard，唯一 shell 命令只讀 request／payload；完整 raw observation 明示 edited=false，沒有 before 或正向 verdict。私人目錄 gcake-draft-media-equivalence-20261019 保留原件。其後另開專用 Chrome 做唯讀診斷，已見 Drafts 3／Scheduled 1／Published 3，原草稿在列，並確認失敗分頁已關閉。保存逐呼叫雜湊後以 finally 釋鎖流程解除確定未送出的精確意圖，qualificationPassed=false。新請求另存 gcake-draft-media-equivalence-r2-20261019，不重播舊請求。未據此修改內容規格或放寬查核。


## 新 supported PNG 真實驗收與 Git 恢復通過

私人目錄 gcake-draft-media-equivalence-r2-20261019 的全新資格請求通過：16 次真實 Chrome CUA 呼叫，原 ID 221099415／ithome-2026-template-hardening，父程序 before-verdict=true，全文只貼上一次，Saved／離開／重載皆有實際證據。Substack S3 原圖與來源 PNG 均為 3,339 bytes，原圖 SHA256=088f5f545e0727dfa49af5ca82e982a4e8e2bdd7c5794fe6d742b6b2b95e2288，圖片數 1、alt 保留、正文驗收連結與完整原文／程式碼嚴格一致；draft-only canonical digest=sha256:52d33f035b7c2713a976ed455c4c6f707df25c46b57972f59bc5954d74b7eca9。這是使用者核准的新等價規則的成功，不改寫先前 linked-image 失敗。

接著以另一新 intent 恢復 Git，17 次真實 Chrome CUA 呼叫，before 重新獨立驗證 S3 原圖與 A 基準，全文一次貼上、Saved／離開／重載通過，實際圖片數 0。2026-10-19T15:54:16.344Z 的保存版本為 sha256:6bd00a9217daefa1d9775b93523e10d063231e1fba5c9f0fc02202391de7890b，全文 digest=sha256:e0bf0977ae22ffe1d050ad9a51ebcada48dbf526ef332c596e617d5c21b16721，來源 main 509d71b21e6261f5b674bdc77cb38deaf73d785d。六篇承諾欄位完全一致，intent／lock／checkpoint 均為 0；Chrome-only inventory 獨立確認四個本次已知自有分頁均已關閉。creationQualified=false，沒有新建草稿。

## 持續寫入已啟用，等待自然輪次

2026-10-19T15:54:47.369Z 原子更新已安裝媒體 runtime 的設定：draftSync.enabled=true／writeEnabled=true／allowCreate=false／mediaProfile=original-sha256-png-v1，scheduled.writeEnabled=false。資格與授權文件綁定 policy scope、pin digest 057997a49c9cd76100de3501ec511ee8ab7d90c264b7e3cd87bd07aefaa6f430、到期時間 2026-11-18T15:44:12.782Z；receipt 指向上述真實 PNG／Git 恢復證據。沒有 job reload、kickstart 或新增 timer。啟用時 runs=0，後續須等原 900 秒 timer 自然完整盤點；本段尚不宣稱該輪通過。


## 自然完整盤點通過（台北 2026／10／20 00：06）

2026-10-19T16:06:25.559Z 完成獨立驗收，原 timer runs=1、last exit=0，round status=completed。同一輪六筆 sync-draft 全部 observed：原 ID 221099763 與 221099415 皆完整重新讀回 verified，另外三篇已公開及一篇已排程均 excluded，未開啟 protected editor。兩個真正 Chrome 執行者共 25 次 CUA 呼叫，僅 draft-read，因 Git 內容相同而 provider writes=0；未把零寫入自然輪次冒充圖片 A／Git B 兩次實際寫入，兩種證據分列。

原 ID／slug／URL、provider 狀態、時段、email／App、armed／delivered revision 與公開歷史逐項比對六筆啟動前紀錄完全一致。來源快照清理為 removed，D1 intent／lock／checkpoint 均為 0，兩個自然輪次自有 Chrome 分頁亦獨立查核已關閉，沒有操作 Brave 或使用者既有分頁。runtime 全部 pin 再次匹配。全程無 kickstart，啟用時不 reload job；之後維持同一 900 秒 timer，allowCreate=false、scheduled.writeEnabled=false。授權至 2026-11-18T15:44:12.782Z（台北 11／18 23：44）。

機器摘要：continuous-provider-results.json；私人原件：installed-draft-continuous-media-chrome-20261019／natural-acceptance.json 及 rounds／round-B4Ipub，保留所有先前失敗及回復原件。前端狀態契約見 docs/substack-draft-sync-api.md，HTTP 路由尚未部署，未新增後台畫面。沒有 commit／push、Worker 部署或 migration；subscriberReceipt 仍 unknown，未操作訂閱者寄送。別的排程變更 task 5.3 仍 pending，不由本次草稿同步結案。
