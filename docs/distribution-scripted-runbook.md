# Substack 同步腳本

以下既有流程屬於 `pages-first-no-newsletter`；提前備稿的新政策見後段，兩者核准範圍分開。正式來源為 gcake119/gcake-dev main 的完整 Markdown。原文正常公開且匿名讀回內容、標題、日期、canonical、圖片與連結符合精確版本後，才可同步至 Substack。

使用已核准並釘選的 runtime 與 Git 外私人政策；unattended.targets 必須只有 substack。啟動入口仍為 scripts/publishing/sync-distribution.ts，參數保留 --config、--pin、--acceptance、--out、--lock；預設僅產生計畫，既有授權執行才加 --execute。憑證只以既有 env-file 載入，不讀回、列印或複製。

每輪使用共享鎖、D1 在途對帳、固定 main 快照與精確計畫。相同版本只唯讀驗證；更新沿用原 ID，不再次發布。Substack canonical 為平台文章，正文保留 Pages 原文連結；來源時間對應到使用者已接受的分鐘精度。

結果未知時保留原 ID、操作意圖與必要快照，不重播。不得依時間偷取鎖；故障恢復先證明執行者已停止，再查核在途資料。成功或已結束失敗輪次由既有腳本清理只屬該輪的快照。

Substack 操作使用使用者核准的 Chrome 與經驗收的介面契約。正式 runtime 的安裝／切換由 owning conversation 驗收，不因 repo 程式清理就自動替換 pin、啟用寫入或部署。電子郵件與 App 通知依已生效的精確授權及既有設定，不因普通更新、重試或查核重新寄送。

歷史操作紀錄保存於 docs/archive/publication-history，不能作為重啟舊平台或舊雙平台計畫的授權。

歷史安裝紀錄（不得作為重新啟用 Chrome 操作的指示）：2026／10／13，獨立 LaunchAgent dev.gcake.distribution-sync 已啟用，每 900 秒執行；政策位於 Git 外 native-substack-final-20261013，目標只有 substack，舊 Codex heartbeat 已停用。正式 runtime 保持釘選；repo 清理不直接替換已驗收的安裝版本。Chrome 需保持開啟，重啟後重新綁定驗證。

新文章首次發布最多寄送一次電子報的政策已確認，但正式寄信設定仍待啟用；既有關閉條件保持有效，普通更新、重試及既有文章不補寄，App 通知保持關閉。

## 提前備稿政策（本機候選，尚未啟用）

`schedule-substack-drafts-ahead` 新增 `scheduled-source-first-delivery-v1`，允許符合資格的 main Markdown 在 Pages 尚未公開時先備稿。首次 Substack 排程會啟用原有訂閱者的電子郵件與 App inbox 組合選項；裝置推播或訂閱者實際收信沒有證據時仍為 unknown。舊核准文件的 newsletter=skip 只適用舊政策。三篇既有文章沿用 ID，不補寄：`220011124`／`ithome-2026-chatgpt-writing-workflow`、`220473117`／`ithome-2026-publishing-toolchain`、`221069931`／`ithome-2026-astro-choice`。

本變更沒有修改已安裝 runtime、私人設定、pin、LaunchAgent、正式 D1 或 Substack。以下命令是另行啟用時使用的操作說明，不能解讀為本次已完成部署或介面驗收。新原生 transport 尚未合格；新政策只接受前景 attended handoff，不得退回背景 Chrome 或私有 API。

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

背景仍使用原 `distribution:sync` 輪次、固定來源快照、鎖及 Hermes 去重，沒有新 timer。新政策觀察設定必須明確為 observeEnabled=true、writeEnabled=false，並提供新政策版本的匿名 acceptance；不接受舊政策驗收文件直接啟用。背景沒有 authenticated provider port，不能讀取私人草稿或操作瀏覽器。到期前不查公開頁；到期後可匿名驗證，Pages 與 delivery 分別記錄。來源缺失、內容／時段漂移、公開內容不符或未決操作，保留原時間並要求前景；讀取失敗不得清空提醒。

另行核准 rollout 時依序：盤點現有鎖／意圖／三篇原 ID／provider Scheduled；備份 D1；按既有正式 migration 流程套用 **0007_substack_schedules.sql**；用新前景命令接納既有公開文章，匿名驗證並保留舊 delivery 紀錄；執行該候選的完整 gates；另選一篇未公開稿與未來時段驗收 prepare／arm／remove／rearm；最後才切換已核對完整依賴的 runtime、pin、私人設定與既有觀察排程。不能複製舊 pin 或宣稱本機 fixture 代表 provider 合格。

回復時先停用新增 arm，保留同 ID cancel 的前景能力；唯讀盤點 `publication_schedules` 所有 scheduled、reconciliation_required、未決 intent 與 observedTime，逐篇在 provider 解除並重讀確認。已公開項目保留 ID、原日期與寄送紀錄；未知或仍 armed 項目必須列為未完成。停用本機工作不會取消 provider。確認沒有未決承諾並查核舊程式／設定相容性後，才考慮回復舊 pin；保留加法式資料表，不以 drop table 或清空意圖作為回復。正式 SQL 與 runtime 安裝依既有擁有者流程執行，本次未執行。

### 2026／10／19 真實 UI 契約補充

目前前景驗收使用專用未發布草稿 ID `221081849`，不屬正式發文佇列。此輪只完成保存／重載、slug 與排程預覽；Scheduled 清單為空，不代表已驗證排程保存／取消。詳見 `openspec/changes/schedule-substack-drafts-ahead/ui-qualification.md`。

- 切換 email／App 後，排程核取方塊的可存取名稱會改變。以實際觀察的 `data-track-input="send_email"`、`data-testid="scheduled-at"` 及 `aria-checked` 核對，不使用動態整段標籤，也不讀取隱藏 native checkbox 的舊 checked 屬性。
- datetime-local 的 `value` property、HTML value 屬性與最終動作相對時間必須一致；單次 fill 並不充分。UI 顯示 GMT+8，還須獨立確認主機為 Asia/Taipei。輸入 min／max 是預覽限制，仍需原站已確認時段與實際 Scheduled 保存讀回才能宣稱 armed。
- `proof-schedule --evidence <preview-capture.json>` 讀取 `{html,audienceRadios:[{value,checked}],localTime,attributeTime,min,max}`。radio checked 取當前 DOM property；HTML 片段只含當前 dialog，不含帳戶、收件地址或 private-share token。此輸出為 `kind=schedule-preview, armed=false`，不能用於 `reply-schedule` 假裝排程已保存。
- 同一編輯器 session 取消後重開預覽可能保留記憶中的選項；離開並重新進入後，會回到「電子郵件和 Substack App」預設開啟。取消預覽不構成 provider 保存證據。每次最終操作前都要重新核對，不能沿用上一次預覽的勾選狀態。
