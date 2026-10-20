# Substack 同步腳本

## 現行政策與已確認範圍（2026／10／19）

現行政策為 `scheduled-source-first-delivery-v1`，內容來源是 gcake119/gcake-dev main 已儲存、符合資格且釘選 revision 的完整 Git Markdown；Pages 不必先公開。原站預設週一、週四台北時間 07：00，仍須逐篇確認固定時段，佇列估算不能代替排程授權。舊 `pages-first-no-newsletter` 核准仍要求 Pages 完整公開驗證，不能授權新政策首次寄送。

已授權試行僅含 `ithome-2026-publishing-in-production`、原 ID `221098688`、2026／10／22 07：00 台北時間，首次電子郵件／App inbox 開啟；另兩篇 `221099415`、`221099763` 保留草稿。Substack 可在 Pages 失敗時獨立公開與首次寄送。3.1 的真實保存／Scheduled-list 讀回／解除／同 ID 重排已完成；5.3 仍待實際 provider 發布、其後普通背景輪次及獨立寄送證據，個別訂閱者實收無證據時仍為 unknown。詳見 [試行紀錄](../openspec/changes/schedule-substack-drafts-ahead/pilot-20261019.md)。

2026／10／20 到期前唯讀核對：原 ID `221098688` 仍為 10／22 07：00 台北時間排程，所有人、email／App 的既有承諾保留；Substack 畫面確認電子郵件，App 個別欄位由正式 D1 核對。這只是已安排寄送，平台寄送結果與真人實收均未知。任務 5.3 保持未完成；完整分層證據、缺口及待執行的發布後驗收步驟見 [唯讀核對紀錄](../openspec/changes/schedule-substack-drafts-ahead/schedule-readonly-221098688-20261020.md)。本次不重做排程／解除／重排，也不新增寄送或部署。

正式背景觀察為 anonymous-only，`observeEnabled=true`、`writeEnabled=false`；只讀 Git、D1 與匿名公開頁，不讀私人草稿、不操作 Chrome。通知修正已部署，詳見 [部署證據](../openspec/changes/schedule-substack-drafts-ahead/notification-false-positives-deployment.md)。草稿全文寫入已有另行授權的本機 Computer Use 實作，見 [草稿同步與前端 API](substack-draft-sync-api.md)；後續已另行授權完成既有 ID 的 Chrome 持續草稿同步與自然盤點，證據見文末「已核准的一般草稿持續同步補充」及其連結。匿名 observer 與草稿 worker 的權限分開；HTTP API 部署另行追蹤，本輪 Git 整理不重新驗收、啟用或部署。此政策文件不會自行啟用寫入。以下前景命令須逐次符合授權，不是可直接執行的 rollout 清單。

使用已核准並釘選的 runtime 與 Git 外私人政策；unattended.targets 必須只有 substack。啟動入口仍為 scripts/publishing/sync-distribution.ts，參數保留 --config、--pin、--acceptance、--out、--lock；預設僅產生計畫，既有授權執行才加 --execute。憑證只以既有 env-file 載入，不讀回、列印或複製。

每輪使用共享鎖、D1 在途對帳、固定 main 快照與精確計畫。相同版本只唯讀驗證；更新沿用原 ID，不再次發布。Substack canonical 為平台文章，正文保留 Pages 原文連結；來源時間對應到使用者已接受的分鐘精度。

## Substack 與原站 slug 一致（2026／10／19）

Substack 的正式網址必須是 `https://gcakedev.substack.com/p/<原站 slug>`，其中 slug 與權威 Git 原稿完全一致，原站對應路徑為 `/gcake-dev/posts/<slug>/`。新政策不要求該 Pages 路徑已公開；舊政策仍要求 Pages 驗證。沿用正式來源的 slug，不依文章標題重新生成，也不接受 Substack 自動產生的縮寫、隨機代稱或自動追加的數字。兩站的域名與路徑前綴不同，slug 必須相同；Substack canonical 仍指向平台自己的文章。

1. 前景 prepare 時，在同一草稿的「設定 → SEO 選項 → 文章網址」設定原站 slug。儲存並重新載入讀回；缺少控制項、儲存失敗、slug 被平台改寫或網址已被其他文章占用時，停止發布並保留原 ID 與診斷。不得另建文章或自動改用其他 slug。
2. 發布前再次核對已保存的 slug 與來源版本。發布後匿名驗證新網址的原文章 ID、刊物 ID、平台 canonical、全文、標題、原文連結、圖片與該政策已確認的發布分鐘；Pages 可用性與兩站日期差異另外記錄。其中任何一項不符，都不能記為 verified 或宣稱同步完成。舊網址可轉址不代表新 slug 已通過驗證。
3. 既有文章 slug 不一致時，只能在明確前景操作修改原 ID 的網址，不重新發布、不寄送電子郵件或 App 通知。先盤點 D1 狀態、鎖與 checkpoint；不覆蓋未知操作或其他 writer。修改後驗證新網址，再於持有該文章操作鎖時對帳 D1 remote URL，保留來源版本、原 ID、日期與寄送紀錄，並確認鎖與 checkpoint 已結束。
4. 修改既有網址可能使舊連結失效，逐篇記錄實際轉址或錯誤結果，不假設平台提供轉址。背景排程不得因 slug 不一致而開啟 Chrome、修改網址、重建或重發；保留原 ID，交由前景處理。

此為同步操作與驗收規則。正式釘選 runtime 的自動欄位設定及 slug 專用阻擋，須另以實作與安裝證據確認；文件更新本身不代表已更換或升級正在執行的排程。

結果未知時保留原 ID、操作意圖與必要快照，不重播。不得依時間偷取鎖；故障恢復先證明執行者已停止，再查核在途資料。成功或已結束失敗輪次由既有腳本清理只屬該輪的快照。

Substack 操作使用使用者核准的 Chrome 與經驗收的介面契約。正式 runtime 的安裝／切換由 owning conversation 驗收，不因 repo 程式清理就自動替換 pin、啟用寫入或部署。電子郵件與 App 通知依已生效的精確授權及既有設定，不因普通更新、重試或查核重新寄送。

歷史操作紀錄保存於 docs/archive/publication-history，不能作為重啟舊平台或舊雙平台計畫的授權。

歷史安裝紀錄（不得作為重新啟用 Chrome 操作的指示）：2026／10／13，獨立 LaunchAgent dev.gcake.distribution-sync 已啟用，每 900 秒執行；政策位於 Git 外 native-substack-final-20261013，目標只有 substack，舊 Codex heartbeat 已停用。正式 runtime 保持釘選；repo 清理不直接替換已驗收的安裝版本。Chrome 需保持開啟，重啟後重新綁定驗證。

歷史寄送限制：舊政策為網站限定、不寄送電子郵件／App。後續試行的首次雙通道授權見本文件開頭，不能用舊限制否定已保存的試行承諾，也不能將單篇授權擴及其他草稿。普通更新、重試及既有文章不補寄。

## 提前備稿與前景操作政策

`schedule-substack-drafts-ahead` 新增 `scheduled-source-first-delivery-v1`，允許符合資格的 main Markdown 在 Pages 尚未公開時先備稿。首次 Substack 排程會啟用原有訂閱者的電子郵件與 App inbox 組合選項；裝置推播或訂閱者實際收信沒有證據時仍為 unknown。舊核准文件的 newsletter=skip 只適用舊政策。三篇既有文章沿用 ID，不補寄：`220011124`／`ithome-2026-chatgpt-writing-workflow`、`220473117`／`ithome-2026-publishing-toolchain`、`221069931`／`ithome-2026-astro-choice`。

新政策只接受已驗證的前景 attended handoff，不得退回背景 Chrome 或私有 API。單篇試行與唯讀觀察的已完成證據見開頭；不代表全面自動寫入或 5.3 已通過。原生 transport 的舊成功紀錄不能代替新政策驗收。

### 前景命令

沿用 `pnpm distribution:run <操作> <slug> substack`，操作為 `prepare-draft`、`arm-schedule`、`revise-schedule`、`postpone-schedule`、`cancel-schedule`、`reconcile-schedule`、`sync-content`。預設僅審閱；`--background` 一律拒絕。新增私人政策範例（實際使用前另行授權）：

```json
{
  "scheduled": {
    "policyVersion": "scheduled-source-first-delivery-v1",
    "writeEnabled": false,
    "transport": "attended",
    "sessionDirectory": "/private/tmp/owner-selected-substack-session"
  },
  "substack": {"ui": {"origin": "https://gcakedev.substack.com"}}
}
```

範例省略既有匿名 publicBody／publicTitle／publicDate／publicIdentity 契約，不能直接作為正式設定。source-root 必須是乾淨、固定為 origin/main 的獨立來源快照；私人 session、核准與審閱文件放在 Git 外。執行時另核對 GitHub main 沒有前進。正文只在私人審閱／handoff 中短暫使用，不能寫入 D1。

```sh
pnpm distribution:run prepare-draft article-slug substack --source-root /absolute/fixed-main --config /absolute/private-policy.json --out /absolute/private-review.json
```

已知文章 ID 應於審閱時帶入 `--remote-id <原 ID>`。固定身分為 `--schedule-id <原 scheduleId>`，預設 `substack:<首次 slug>`。改名必須同時指定原 scheduleId、原 remote ID 及 `--previous-slug <原 slug>`；不得用新 slug 建立另一文章。舊 slug 會保留為身分別名。

排程前先用既有原站固定時段 preview／confirm 功能確認時段。新命令直接讀 D1 `release_queue_runtime` 已確認 overrides 與版本，沒有任意指定時間的 CLI 捷徑。預估、暫停、已過期、時區不符或超過三個曆月的時間不能排程。2026／10／22 07：00 台北時間對應 `2026-10-21T23:00:00Z`。

審閱文件內 `approvalTemplate` 的 digest 綁定操作、政策、固定身分、已知 remote ID、來源 commit／revision、slug、佇列 reservation／version、時間、訂閱者 audience 與雙通道設定。前景核准精確範圍後，將獨立核准文件的 approved 設為 true；正式開關仍須另行啟用。執行使用相同參數再加：

```sh
--execute --receipt /absolute/private-review.json --approval /absolute/private-approval.json
```

每次 provider 變更前，D1 先保存意圖。`attendedRequest` 輸出指向單次 request.json。用既有前景 Computer Use 檢查真實 Substack 介面；可用 `pnpm distribution:handoff inspect-schedule|proof-schedule|reply-schedule --request <request.json> --config <私人政策> --source-root <固定來源>`，回覆另加 `--evidence <觀察證據.json>`。檢查版本、意圖、來源及到期時間後才操作，操作後重新載入保存證據。v2 回覆必須保留 requestId、scopeDigest 與 expiresAt；不接受舊 v1 回覆。檢查命令不會自動操作瀏覽器。

證據採 `ScheduleObservation` 契約：相同數字 ID、保存成功、實際狀態與 slug、完整 title／description／HTML、每張圖片的 src／alt／loaded；排程另含 scheduledAt、timeZone=`Asia/Taipei`、audience=`everyone`、email=true、appInbox=true。必須從保存後重新讀取的內容取得；listEvidence 明確記錄 draft／scheduled 是否包含該 ID，不能只用編輯器標籤推定取消。確認同 ID 在 Drafts、Published、Scheduled 的身分及狀態；排程移除後須重讀 Drafts 並確認 Scheduled 不再保有舊時間。缺少控制項、儲存狀態不明或列表未讀全時停止，不編造證據。

`sync-content` 比對目前保存的實際內容；相同內容沒有 provider 寫入。已排程稿採「解除 → 重讀草稿 → 更新 → 重讀 → 依仍有效的時段重排」。公開文章採同 ID 更新，email／App resend 關閉、不改日期；匿名讀回完整正文後才確認。輸出 lastComparison 包含差異範圍、比對摘要、版本、編輯模式與驗證結果。原始 armed／deliveredRevision 與最新 contentVerifiedRevision 分開保存；網站修正不會改正先前寄出的郵件。

取消可在來源刪除或退回草稿後執行。取消只保留草稿；若已公開／寄送中，回報 too late。timeout 或未知 create／update／arm／remove 保留意圖，重啟不重播；先用 `reconcile-schedule` 唯讀檢查原 ID。無法證明結果則繼續保留未決狀態，不依鎖的年齡接管。私人 session 在未決期間保留；解決後只清理該次目錄，不刪除他人檔案。

### 背景觀察、遷移與回復

背景仍使用原 `distribution:sync` 輪次、固定來源快照、鎖及 Hermes 去重，沒有新 timer。新政策觀察設定必須明確為 observeEnabled=true、writeEnabled=false，並提供新政策版本的匿名 acceptance；不接受舊政策驗收文件直接啟用。背景沒有 authenticated provider port，不能讀取私人草稿或操作瀏覽器。到期前不查公開頁；到期後可匿名驗證，Pages 與 delivery 分別記錄。來源缺失、已確認的內容／時段漂移、身分不符或未決操作保留最後確認承諾，交前景處理。原稿未變時，僅摘要呈現與已知平台格式差異不通知；讀取失敗記為「驗證未完成」，不得當成內容變更或清空舊提醒。這不放寬前景完整內容保存／讀回。

背景以同篇 slug 及實際時刻判斷是否延期，單純 queueVersion 更新或 UTC／台北字串差異不通知，也不重寫原承諾版本。真實改期、時段消失或失去資格仍交前景處理；前景核准仍檢查完整版本、reservation 與時段。未決意圖或獨立錯誤不能因通知去誤報而解除。

以下是後續另行核准 rollout 的流程，不重做已完成試行：依序盤點現有鎖／意圖／三篇原 ID／provider Scheduled；備份 D1；先核對既有 migration 紀錄，僅在尚未套用且另獲授權時，依正式流程套用 **0007_substack_schedules.sql**；用新前景命令接納既有公開文章，匿名驗證並保留舊 delivery 紀錄；執行該候選的完整 gates；另選一篇未公開稿與未來時段驗收 prepare／arm／remove／rearm；最後才切換已核對完整依賴的 runtime、pin、私人設定與既有觀察排程。不能複製舊 pin 或宣稱本機 fixture 代表 provider 合格。

回復時先停用新增 arm，保留同 ID cancel 的前景能力；唯讀盤點 `publication_schedules` 所有 scheduled、reconciliation_required、未決 intent 與 observedTime，逐篇在 provider 解除並重讀確認。已公開項目保留 ID、原日期與寄送紀錄；未知或仍 armed 項目必須列為未完成。停用本機工作不會取消 provider。確認沒有未決承諾並查核舊程式／設定相容性後，才考慮回復舊 pin；保留加法式資料表，不以 drop table 或清空意圖作為回復。正式 SQL 與 runtime 安裝依既有擁有者流程執行，本文件整理不執行回復或正式寫入。

### 2026／10／19 真實 UI 契約補充

早期前景驗收使用專用未發布草稿 ID `221081849`，不屬正式發文佇列；當時只完成保存／重載、slug 與排程預覽，Scheduled 清單為空，原證據仍見 [UI 契約歷史](../openspec/changes/schedule-substack-drafts-ahead/ui-qualification.md)。後續正式授權以 ID `221098688` 完成保存／讀回／解除／同 ID 重排，見開頭試行紀錄；不改寫舊預覽為已排程，也不把它當成 5.3 通過。

- 切換 email／App 後，排程核取方塊的可存取名稱會改變。以實際觀察的 `data-track-input="send_email"`、`data-testid="scheduled-at"` 及 `aria-checked` 核對，不使用動態整段標籤，也不讀取隱藏 native checkbox 的舊 checked 屬性。
- datetime-local 的 `value` property、HTML value 屬性與最終動作相對時間必須一致；單次 fill 並不充分。UI 顯示 GMT+8，還須獨立確認主機為 Asia/Taipei。輸入 min／max 是預覽限制，仍需原站已確認時段與實際 Scheduled 保存讀回才能宣稱 armed。
- `proof-schedule --evidence <preview-capture.json>` 讀取 `{html,audienceRadios:[{value,checked}],localTime,attributeTime,min,max}`。radio checked 取當前 DOM property；HTML 片段只含當前 dialog，不含帳戶、收件地址或 private-share token。此輸出為 `kind=schedule-preview, armed=false`，不能用於 `reply-schedule` 假裝排程已保存。
- 同一編輯器 session 取消後重開預覽可能保留記憶中的選項；離開並重新進入後，會回到「電子郵件和 Substack App」預設開啟。取消預覽不構成 provider 保存證據。每次最終操作前都要重新核對，不能沿用上一次預覽的勾選狀態。


### 已核准的一般草稿持續同步補充（2026／10／19）

使用者已明確授權 Chrome 的既有 ID 持續草稿寫入，實際媒體 A 與 Git B 恢復均完成全文保存／離開／重載；新建仍停用。一般 worker 僅操作自己的新 Chrome 分頁，在原 timer／鎖／Hermes ledger 下執行，不擴大排程、公開或訂閱者寄送權限。匿名 observer 與此 authenticated draft executor 分開，舊 browser-free 要求仍適用於 observer。

圖片等價僅接受獨立未包超連結的 PNG，最多 8 張、每張 8 MiB；控制程式由 UI 實際指向的託管原圖獨立驗證 SHA256，順序、alt、正文連結、程式碼與其餘內容仍嚴格比對。帶圖片超連結的舊驗收失敗保留，不能用外框正規化掩蓋連結遺失。寫入前父程序重新驗證完整實際基準與權限，負向／缺失判決不得貼上。未知結果留 intent，先同 ID 唯讀對帳，不重貼。範圍、期限、pin、自然驗收及停用見持續驗收紀錄與 launchd runbook；本次沒有啟用任何 schedule write、發布或寄送。

2026／10／20 原草稿清單修正：已發佈清單的實際 `/publish/posts/detail/ID` 與草稿 `/publish/post/ID` 都必須計入，不可由執行者自行採單一網址過濾或固定篇數。原始三清單由同一確定性驗證器在子程序及父控制器檢查，缺漏／身分衝突仍停止；唯讀導覽逾時保留原分頁觀察，不能提前關閉而失去查核機會，也不能重貼。原 ID 221099415 的全文重載與第 10 次自然輪次、正式後台查核均完成，見 [修正驗收](../openspec/changes/archive/2026-10-20-automate-substack-draft-content-sync/read-repair-20261020.md)。沿用原內容與媒體比較標準，沒有新增內容寫入、排程／發布／訂閱者寄送或新建授權。
