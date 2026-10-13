## Context

Planning baseline: isolated local clone at c7a2fd537c85e7ff3f37eb9b9b2d468f8459e761, the parent checkout's local origin/main snapshot. This is not a freshly verified remote HEAD. The dirty parent and other chats' worktrees are preserved. Code graph indexing was rejected by automatic review; this plan uses repository specs, documentation and configuration, not symbol inspection.

Decision context: Level 2, publication monitoring, background jobs, credentials and notification evidence. No docs/decisions registry exists in this snapshot. Relevant sources are openspec/specs/series-scheduling/spec.md, openspec/specs/publishing-operations/spec.md, openspec/changes/integrate-durable-release-queue/specs/durable-release-queue/spec.md and its design.md, docs/publishing-cms-release-queue-spec.md, docs/editorial-release-policy-handoff.md, docs/publishing-cms-release-operations.md, and the current conversation. Current user decisions supersede historical statements that publication or Hermes notification is disabled. Existing activation is preserved, not re-proven by this plan. No archive backfill or commit occurs now; preserve these decisions in this change and reconcile the durable spec on later archive. A standalone ADR registry bootstrap is unnecessary for this bounded planning task.

Confirmed product policy: every series and standalone article, 60-minute polling, 60-minute overdue grace, two abnormal rounds to establish a silent anomaly, two healthy rounds for recovery, immediate notification once public evidence is confirmed, and one combined late-publication/recovery message. No onset notification for general anomalies. Repeated checks, content updates and restarts are silent for already-sent events.

Historical Hermes handoff, not live-verified here: job 550aaf17723d, gcake-editorial-rss-live, wrapper /Users/hermes/.hermes/scripts/gcake-rss-live.sh, implementation /Users/hermes/.local/lib/gcake-rss/rss_monitor.py, SQLite /Users/hermes/.local/state/gcake-rss/live.sqlite. Existing repo documentation instead describes scripts/hermes/rss_poller.py with JSON state. The production SQLite format and deployed implementation must be read-only inventoried before constructing an adapter; do not assume these are interchangeable. No secret file contents were read. Do not reuse the temporary D1 read token, retired Git journal, paused Codex heartbeat or nine uncreated one-shot jobs.

## Goals / Non-Goals

In scope: summary projection, universal observer, event policy, state compatibility, local verification and a separately authorized single-job rollout procedure.

Out of scope: implementing or running tests in this turn, publication writes, ingestion from monitoring, retrying workflows, queue resets, migrations, changing gates, editing article bodies/order, creating credentials, runtime installation, deploying, committing, pushing, adding a Telegram getUpdates poller, restarting the gateway, or CMS delivery-report integration.

## Decisions

### Formal summary remains a pure observer

Propose GET /api/v1/monitoring/publications in the existing Worker, reading a coherent D1 runtime document and a pinned complete Git catalogue through read-only adapters. Do not reuse GET /api/v1/releases: the handoff reports ingestion writes there. No ingestion, planner mutation, reservation or verification writer is allowed in the observer dependency boundary. Separate actual commitments from estimates; a future expected weekday derived from policy is never a commitment. If the queue does not yet hold a formal commitment for an article, its overdue status is unconfirmed even when its CMS estimate looks precise. If pre-commitment lateness monitoring is later required, amend the product contract explicitly rather than promoting estimates.

Return a bounded complete response or an explicit unavailable/incomplete error, never a truncated success. The canonical catalogue remains complete even if the feed contains only recent entries. Git membership/order is editorial context; D1 is the only formal operational authority. Article catalogue entries absent from D1 remain unscheduled/unconfirmed.

Proposed response: schemaVersion, generatedAt, gitRevision, queueVersion, complete, articles. Each article contains articleId, canonicalUrl, kind (series or standalone), seriesId and readingPosition when relevant, scheduleState (confirmed, estimate-only, unscheduled, paused, cancelled or unknown), and commitment with identity and offset-aware scheduledAt only for formal records. Do not export Markdown bodies, leases, retries, Telegram identity or private diagnostics. Existing queue-version changes unrelated to one article must not create new notification episodes.

### Restricted reading access and current-round evidence

Propose a dedicated monitor-reading credential whose only authority is the new GET endpoint. It is not a Cloudflare account token and is not the existing publishing automation secret. Provisioning and rollout are separate future authorization gates; no credential is created here. Public unrestricted schedule output was rejected as the default design because it unnecessarily exposes operational schedules; direct long-term D1 access grants broader authority than the consumer needs.

Absent or invalid authorization returns 401/403. Unavailable observations return 503 with a bounded reason code; incomplete, unsupported or malformed responses are unusable for overdue decisions. Disable caches with Cache-Control: no-store, and fetch a new summary each round. Validate generatedAt against that request/response observation window, not an arbitrary old cached snapshot. Read a pinned Git revision and D1 version and recheck them before returning; a coherence conflict fails closed. An unchanged queue version is valid when freshly read. Explicit cancellation/pause/change replaces the prior state; omission is unknown. Last good snapshots are diagnostic context only after a failed current read.

### Hourly event policy and evidence boundaries

One round is one scheduled invocation under the existing job, not each retry. Network reads use at most three attempts with 2-second and 5-second delays; only transport errors, 429 and transient 5xx are retryable. Authorization and malformed-content errors are not repeated blindly. Retries never call publication or deployment endpoints. Round IDs prevent manually repeated runs from adding extra consecutive observations. Use the job's existing schedule phase; do not create a second hourly schedule.

At currentTime >= scheduledAt + 60 minutes, one active confirmed commitment with readable current public observations and no verified canonical page can produce one overdue event. Absence requires a valid feed observation plus explicit page absence (404/410); a homepage, mismatched page, auth error, timeout or 5xx is unknown evidence. A canonical page already visible with missing RSS is an inconsistency; do not say unpublished. Only canonical page plus matching RSS identity permits the article notification. Do not depend on Actions history or an unrelated old deployment run for this routine decision.

Track streaks per feed, summary/catalogue source or applicable article evidence item. Future ready articles are not anomalies merely because they lack a public page. A successful observation resets a pending bad streak; a bad observation resets a recovery streak. A missed scheduled round breaks pending streaks while retaining an established anomaly. Two consecutive bad rounds establish a silent anomaly; two consecutive good rounds close it with one recovery event. Report the observations, not continuous health between samples. Monitor-process/host death cannot be detected live by that same process; after restart record the gap without pretending checks ran. Independent always-on host supervision is out of scope.

New article events are immediate upon full public verification. If an overdue notification was confirmed sent, add overdue-cleared text to that article event and suppress the corresponding article recovery event. Also consume same-item evidence-recovery intent in that combined notification; independent feed/summary outages retain their own recovery events. Explicit cancellation closes an overdue episode silently.

### Durable compatibility and notification identity

Use canonical article identity for one lifetime publication notification; resolve repository identity and feed/page GUID to the same canonical article. Overdue identity consists of canonical article plus the formal commitment episode, not global queue version. A rescheduled or cancelled-then-recreated commitment starts a new episode only when an explicit semantic change is observed. Persist that identity through unknown observations. Recovery identity consists of monitored item plus anomaly episode. Multiple eligible independent recoveries within one round can share one message with all event identities tracked; article and overdue messages retain their article context.

Keep one sender and one exclusive process lock, using a private local SQLite state alongside existing live records rather than a second notification owner. Before sending, persist intent; acknowledge success separately from human receipt. Network timeout after submission is unknown, not a retryable definite failure. Definite non-delivery remains eligible in a later scheduled round; unknown outcomes require human reconciliation. Crash after successful Telegram delivery but before recording acknowledgement remains unknown. Never promise exactly-once transport delivery.

Inventory live schema read-only; if using SQLite, mode=ro must see committed WAL, never immutable on an actively written database. Build migration/compatibility tests from sanitized schema and synthetic records, not copied secrets. Keep sent, unknown and baseline records; do not rebaseline a live installation or swallow articles appearing during transition. Missing, corrupt or unrecognized state fails closed with local diagnostics, not a new empty database or notification burst. Dry-run uses an isolated DB and disabled real sender.

## Implementation Contract

Planned locations are apps/admin-worker/src/publication-monitor-summary.ts and its test, scripts/hermes/publication_monitor.py and its acceptance/integration/unit tests. Existing Worker registration, adapters and live wrapper symbols are identified during implementation preflight through authorized code discovery; file locations here are not evidence of symbol compatibility. No dependency addition is planned: preserve the Python standard-library runtime and existing workspace tooling.

Acceptance-first sequence: finish all Given/When/Then scenarios before tasks; implement tests for every scenario against the real planned observer/monitor entrypoint with injected clock and local HTTP/Telegram transports; capture genuine product RED; derive focused integration and unit checks; implement to GREEN; then run the repository complete gate. Local fixtures exercise the actual product decision path and do not substitute a duplicate reference algorithm. Infrastructure, fixture parsing or missing interpreter errors do not count as product RED. Existing supported behavior is retained as green regression coverage, not forced to fail.

The future commands are pnpm test:hermes, pnpm test, pnpm check, pnpm build:all and pnpm release:dry-run, followed by git diff --check. Recheck these against the implementation baseline. Do not run release:dry-run until its documented local-only boundary has been verified in that future turn. Worker summary acceptance belongs in test:workspaces via the owning package's existing test discovery; verify that it actually executes before claiming the complete gate. No tests run now.

Required evidence: local acceptance RED/GREEN, integration results proving read-only authority and state persistence, full local gate, live read-only observations after deployment authorization, system send acknowledgement after Telegram-test authorization, and human receipt confirmation. Keep each separate. No normal-status report is sent to Telegram.

## Risks / Trade-offs

- Hourly sampling plus grace gives overdue observation roughly 60 to 120 minutes after scheduled time when all checks run and sources are readable; this is not a delivery deadline guarantee.
- Two good rounds delay recovery observation roughly 60 to 120 minutes after real recovery; this reduces flapping notifications.
- Permanent general source outage stays silent by confirmed user policy. Recovery-only notification does not provide an onset warning.
- Formal commitment unavailable until execution starts means estimate-based missed schedules remain unconfirmed. Preserve that limitation visibly in local diagnostics.
- No D1 writes in the GET route must be proved using a storage adapter that rejects every mutation plus before/after state comparison; HTTP GET alone is not proof.
- Production SQLite differs from repository historical JSON documentation; compatibility is tested before switching the sender.

## Migration Plan

This planning turn creates and parks artifacts only. During separately authorized implementation, recheck the current main revision and live job/schema without accessing or logging secret contents. Preserve the existing bot, job and state. Verify the new observer and state adapter locally before any live modification.

After separate rollout authorization, configure the dedicated reading credential privately and deploy the pure-read summary without changing publication gates. Read-test the live summary and public sources. Test the monitor in an isolated dry-run DB. Back up live state consistently, stage the new monitor and atomically change only the existing wrapper while keeping the same hourly job. Do not run old and new senders together. Do not replace the existing state with a new historical baseline. Verify through an approved test event or a natural future publication; no republishing or workflow rerun.

Rollback restores the prior wrapper while preserving the superset notification/state records; compatibility proof is required so already-sent events remain suppressed. If compatibility cannot be preserved, stop delivery and reconcile state instead of restoring an old backup that loses sends. Do not alter D1 or disable the currently authorized publishing pipeline.

## Open Questions

Product policy is settled. Implementation preflight must verify three facts, not ask the owner to rediscover requirements: the current Worker read-only route/adapters, the formal commitment timestamp semantics, and the live SQLite schema/job phase. Resolve them from authorized sources; if a contradiction requires changing acceptance behavior, stop and obtain clarification before implementation. The dedicated summary-reading credential is a proposed architecture choice, not authorization to provision it.

## Local cron integration follow-up, authorized 2026-10-12

### Explicit scheduler context and drift-safe rounds

The owner authorized suggestion B locally, including tests and consecutive-round repair. Stage changes only in the isolated Hermes source copy, preserve its source hashes and export a reviewable patch. Do not install into /Users/hermes, modify jobs, restart the gateway, deploy, commit or push.

The actual scheduler already passes job to _run_job_script_with_claim_heartbeat. Forward a validated per-invocation dict to _run_job_script through every branch; after the existing subprocess environment sanitizer and Windows overlay, clear inherited HERMES_CRON_JOB_ID, HERMES_CRON_EXECUTION_ID and HERMES_CRON_SCHEDULED_INSTANT and add these trusted values. Never mutate os.environ. Emit a canonical UTC ISO time from job._scheduled_instant, with an empty time for unscheduled/manual work. The monitor rejects empty scheduled context; it never uses the private external-worker marker or latest-execution guessing. CLI explicit --round-at remains a dry-run fixture input; real live mode requires scheduler context and any explicit time must match it.

For the existing sixty-minute interval, next scheduled times cannot be less than sixty minutes apart. A positive gap from 3600 seconds inclusive to 7200 seconds exclusive permits consecutiveness despite phase drift. Gaps at least 7200 seconds or less than 3600 seconds break pending streaks, retaining an established anomaly. This is conservative: a delay of an hour or more cannot prove uninterrupted hourly observations and requires two new healthy checks. This bound is derived from the existing interval, not an arbitrary jitter allowance. Do not change the hourly job or presume fixed calendar slots. Same occurrence timestamp is counted once even if execution ID changes; a reused execution ID with a different time or another job sharing the state fails closed. Persist job scope and invocation mapping alongside existing notification records; preserve legacy sent/uncertain/baseline and dry-run isolation.

Acceptance tests exercise the real monitor and actual owner-supplied script-runner functions in a local harness with subprocess-env/redaction services replaced by deterministic fixtures. Real temporary shell/Python subprocesses verify env propagation, concurrency isolation and heartbeat branches. This validates the runner boundary and local patch, not full gateway/provider startup or installed runtime activation. The snapshot fixture retains exact original function source and full-file SHA provenance for repeatable tests.

## Isolated full gateway verification, authorized 2026-10-12

Run the exported complete Hermes source, its locked Python 3.13 dependencies, real gateway main entry and real cron store/dispatcher/execution ledger. First require matching scheduler source hashes; never reuse installed secrets, config or jobs. Start with HOME, HERMES_HOME and XDG paths bound to a disposable owned home, no inherited provider/Telegram credentials, empty messaging platforms and local delivery. Disable kanban dispatch, heartbeats, external providers and automatic updates in fixture configuration. Use macOS sandbox-exec to deny external networking, writes outside the owned disposable run and reads under /Users/hermes. Verify this boundary before boot. Do not replace/force/stop an existing gateway; use the exported gateway's own duplicate-instance protection against its isolated home.

The test creates a delayed one-shot no-agent job with the actual create_job API, then lets the gateway ticker dispatch it without calling tick/run_one_job from a fixture. Compare child job/execution/original time with the durable execution record, require actual gateway running status, exercise the real monitor CLI with a local observation fixture and unchanged fixture DB. Baseline runs without the patch provide RED only when dispatch actually occurred and metadata mismatches; startup/dependency/config failures are infrastructure diagnostics. Repeat with the patch and separate homes to check scope isolation. This confirms full gateway-to-script startup/dispatch in the tested local topology; managed Linux systemd, production Telegram and deployed Worker reading remain outside this macOS offline verification.

A single lifecycle script owns preparation, process start, bounded waiting, graceful termination, evidence snapshots and finally cleanup. Track process group and children by exact PID/start-time and isolated home; never kill by fuzzy names. On failure/timeout/interrupt save diagnostics before cleaning, report cleanup errors and retain needed source/evidence independently. Disposable runtime/state is removed; exported source and locked dependency environment are review artifacts with explicit ownership. No Docker, deployment, installed runtime edits, formal job edits, commit or push.

## Wrapper cutover verification, authorized 2026-10-12

Generate a complete candidate shell wrapper with selected interpreter, explicit trusted library path, old notification env and new dedicated summary env. Capture the three scheduler fields before sourcing configuration; reject overwritten fields and an unexpected job. Use -I -B -S and a runpy bootstrap with the explicit library path. Dry-run disables delivery and preserves source state; live requires the existing activation flag. Rendering writes only a candidate, never an installed path.

Test the actual shell subprocess and monitor entry with private non-secret configuration fixtures. HTTP responses and delivery acknowledgement/lost-response are transport doubles, not a second event algorithm; kernel networking denies actual external access. Reuse the complete gateway lifecycle for real dispatch when exercising wrapper cutover. Restore an owner-supplied hash-verified original wrapper with only known installation/env/state paths mapped into the disposable home; never source its actual private env or print its commands. The original file is retained unchanged and hash checked. Same test job/state across cutover and rollback, preserve initialization and sent/uncertain/baseline plus new sent/unknown outcomes. Restore the original core in the isolated copy for complete rollback. Save wrapper/transport/DB/process evidence before finally cleanup; production remains untouched.


## Patch 跨自動更新保留方案（審閱草案，未採用）

２０２６－１０－１３。這是 engineering-design-review／spectra-discuss 的建議，不是新生效決策、正式安裝授權或已完成的更新保護實作。既有２３項任務與驗收結果維持原 scope；核准後才將新增行為轉成 requirement／Gherkin／tasks，先 acceptance RED 再實作。沒有部署、改正式 job、連正式 Telegram、commit／push。

#### 建議與取捨

建議採用「版本白名單＋隔離候選驗證＋受控切換」。patch 是獨立保存、可驗證的版本附件，不依賴 Hermes Git stash 當作部署方法。初期只允許已核准的 source SHA 與 patch／runtime 組合；新 upstream 版本先產生候選與證據，供 owner 審閱。未核准的新版不進正式環境，也不停現有 gateway。代價是新版需有人審閱，安全更新不能無限延後。

| 做法 | 判斷 |
| --- | --- |
| 沿用現有 update --yes 與自動 stash 恢復 | 不建議。恢復衝突、discard 設定與更新後的介面變動都可能使 patch 消失或失效；gateway 正常啟動不能證明接線正確。 |
| 受控切換已驗證版本（建議） | 能保留版本／patch／測試證據與上一版 runtime；未知版本先跳過，失敗有明確回復。需新增更新管理入口與本機驗收。 |
| 上游提供正式 metadata 介面 | 長期目標。經相同派送／ledger 驗收後可移除本機 patch；本輪不開 PR、不推送，也不假設未來上游已提供。 |

既有 `system/ai.hermes.auto-update` 每週三０４：３０（Asia/Taipei）的 label／排程擬保留。後續需**另行核准替換 `/usr/local/libexec/hermes-auto-update` 的更新流程**；保留 job 定義也會改變它的執行行為，不能當作已獲授權。本輪不改任何入口／plist。現有外層流程會在 update 後直接 restart，不能只在其後加一個驗證腳本就聲稱有保護；第一次正式安裝 core patch 前，保護流程必須先完成隔離驗收並另行導入。

#### 一、保留 patch 與已知可用版本

１．建立不含秘密的版本 manifest，包含 release ID、Hermes source Git SHA／package version、原檔 SHA、patched SHA、patch SHA、Python 版本與 runtime 路徑、uv.lock／依賴清單摘要、monitor／helper／wrapper SHA、驗證結果與日期。初始基準是 source 0.21.4／7ce190446e548e2e1c0ae6ba0225be0490d12fc2、gateway Python 3.11.15、monitor Python 3.9.6；正式已安裝依賴清單尚未逐項對帳，不由版本號推論等同隔離依賴。

２．patch／manifest／候選產物保存於 Hermes Git checkout 以外的受控目錄；擬由 root 管理更新工具及完整性 manifest，Hermes 可唯讀取用必要的非秘密產物。不能讓 upstream 更新順便刪除保護工具，亦不能從上游任意 hook 取得安裝命令。私有 env、job、DB、通知正文與憑證不進公開 repo／版本附件。

３．保留「目前可用版本」與「上一個已驗證可用版本」的程式／wrapper／Python 環境恢復材料；首版另保留原 core＋原 RSS wrapper 組合。只保存 source commit 不足以回復：未提交 patch、依賴、interpreter／外部共享 library 也須在恢復範圍中。venv 的絕對路徑／shebang 不可假設搬動後仍可用；要在隔離演練驗證恢復到原正式路徑布局的方式。這套完整 runtime 回復尚未實作，既有舊 wrapper 回復演練不能替代它。

４．保留範圍與期限明列：當前版本與至少一個上一版，在新版本驗收前不刪除。其他測試目錄由 lifecycle 腳本 finally 清理，避免每次更新永久累積完整 runtime。記錄磁碟預算、必要空間及精準清理清單。

#### 二、更新前在隔離環境建立候選

１．週三觸發時先取得更新管理的排他鎖；手動維護、排程更新與回復使用同一把鎖。鎖要有 owner／PID／時間及逾時診斷；不能遇到長時間鎖就自動刪掉。沒有已核准候選、來源／現況 hash 不符、非本次 patch 的未提交變更或空間不足時，記錄 skipped／blocked 並結束，保持現行 gateway。不得使用 Git stash 把不明修改一起捲入更新。

２．候選必須是不可變的 Git SHA 與固定 artifact hash。分支 main 會前進，不能把「核准 main」當作核准某一版；官方更新命令若不能鎖定該 SHA，就不直接對正式 checkout 執行 `hermes update --yes`。建議將固定 source＋鎖定依賴＋已驗證 patch 組成候選產物，正式階段只安裝該產物。不可在實際切換時再次拉取不同的 upstream HEAD。

３．在獨立 HOME／HERMES_HOME／env 建立候選。只接受 manifest 指定的原檔 hash，套用已審閱 patch；已是 patched hash 時視為同一版本，不重複套用。未知原檔、模糊匹配、衝突均停止，不自動三方合併或調整驗收條件。若上游已原生提供同等介面，經完整行為驗證後再審閱移除 patch。

４．驗證使用完整真實 gateway、ticker、測試 job 與 ledger；執行時 OS sandbox 封鎖正式檔案與 TCP，只有隔離 Unix IPC。安裝依賴的下載與測試執行網路權限分開。不得用正式 update 腳本或 launchctl 操作正式服務來測試；未來 updater 測試使用命令替身記錄擬執行的啟停／安裝動作，實際 gateway 測試只啟停本次擁有的程序。

５．必要驗證包含：延遲派送仍注入本輪原訂時間、三個 metadata 與同一 ledger 相符、env 不能覆寫、同輪重試不增加輪數、漏輪中斷連續證據、兩輪異常／兩輪恢復、dry-run 不改 DB、新舊 sent／uncertain／baseline／unknown 不重送、回復後新文章仍可處理。另要實際測試完整 runtime 版本切換與回復、成功／失敗／中斷／逾時的程序與磁碟清理。只有套 patch 成功或 Python import 成功不算通過。

#### 三、受控切換與更新後驗證

１．候選準備與耗時測試在停機前完成。正式切換須有已核准維護窗與平台重連授權；考慮所有聊天／job 的 catch-up／one-shot grace，不改 job 時間或補造原訂時間來補救漏執行。

２．drain 目前 sender，確認沒有送出中或未落盤的 invocation，再受控停止 `system/ai.hermes.gateway.boot`。KeepAlive 服務不能只殺 PID；需使用已核對 supervisor 的維護操作，避免它立即重生。若未能 drain，結束此次切換，保持原版本，不強殺後重送。

３．保存程式與 runtime 回復材料，以及**最新** DB／ledger 的一致性備份。安裝前再次比對現況及候選 hash／owner／mode；以 stage＋受控切換方式安裝 source／patch／env／wrapper 組合。多個目錄無法一次原子交換，管理流程須保存已完成步驟及 recovery journal，讓中斷後可辨識並回復，不留下混合版本還自動啟動。

４．先檢查完整性與 Python 相容性，才由原 supervisor 啟動；以 Unix identify／PID／HOME 確認啟動的是預期 runtime，先使用同一正式 job 的 dry-run wrapper。等自然 invocation，核對本輪 context 與 ledger，正式 DB 不變、沒有 Telegram 發送；手動 run-now 不能替代有原訂時間的驗收。此階段會恢復正式平台連線，須另外授權，不能在本輪執行。

５．首次 live 仍依原方案另行授權。已核准例行更新若要自動恢復先前的 live 模式，須在更新策略中明確授權；不能把「核准 source」當作「核准發送」。只有完整驗證通過才恢復 live 與寫入成功的 release receipt。

６．建議增加每輪啟動的完整性檢查：wrapper 核對受控 manifest 中的 source／monitor／wrapper／helper 身分及已核准啟用模式；不符就停止該 monitor invocation，保留 DB 並記錄本機故障，不假造 metadata、改用現在時間或切回盲目 sender。檢查失敗必須可見，不能當成「沒有新文章」的成功；缺 metadata 的拒絕行為保留。這項 guard 是未實作的新增行為，不能由既有 wrapper 驗收推論已存在。

#### 四、失敗回復

| 失敗位置 | 處理 |
| --- | --- |
| 未核准版本／原檔不符／候選驗證失敗 | 不停止正式 gateway、不安裝；保留必要證據，其餘 owned 暫存材料清理。 |
| drain 失敗／更新互斥鎖被持有 | 放棄本次切換；不強殺 runner、不刪 lock、不啟動第二個 sender。 |
| 安裝中失敗或中斷 | 在 gateway 停止狀態按 recovery journal 恢復上一組 source／Python 環境／wrapper；禁止啟動混合版本。 |
| 新 gateway 啟動／context／dry-run 驗證失敗 | 停止新 runtime，恢復上一組完整版本；保持最新正式 DB／ledger／state，不還原舊發送紀錄備份。 |
| 新版已產生發送或 unknown 結果 | 仍保留最新 DB，sent 不重送，unknown 不自動重試；先對帳。回復目標必須能識別這些狀態，migration 不相容時禁止自動回復。 |
| 上一版亦無法啟動或狀態不相容 | 保持受影響 sender 停止並記錄回復失敗，交由 owner 處理；不得無限 restart、重建 DB 或盲目補發。 |

回復成功也記錄 degraded／rolled_back，不能把此次更新當作 success。若退回原 RSS wrapper，需明列過期／恢復監控暫停，但既有 publication 去重仍保留。DB 備份只供對帳／另行核准的災難恢復，**一般軟體回復不覆蓋 DB**。

#### 審閱用驗收情境（草案，尚未成為已核准規格）

```gherkin
Scenario: 未核准新版保持現行服務
  Given 正式監控目前正常且發現一個未核准的新版
  When 排程更新開始檢查
  Then 現行 gateway 與 sender 繼續運作
  And 新版未安裝且留下待審閱紀錄

Scenario: 已核准候選通過才切換
  Given 候選已核准且隔離派送與回復驗證全部通過
  When 維護切換與自然輪次的 dry-run 驗證完成
  Then 實際執行的版本與核准候選相同
  And 只有在適用的發送授權下恢復 live 模式

Scenario: 原檔變更或 patch 衝突
  Given 候選準備遇到不認得的原檔或 patch 衝突
  When 更新流程判斷相容性
  Then 它不修改正式環境
  And 現行服務繼續運作且結果是 blocked

Scenario: 更新失敗保持已送出與未知結果
  Given 本次切換前後存在已送出與結果不明的通知
  When 新版本驗證失敗並回復上一版
  Then 這些紀錄仍保留且沒有再次送出
  And 回復後新的已核實文章仍可按授權處理

Scenario: 中斷或回復失敗
  Given 更新途中中斷或上一版不能恢復運作
  When 更新管理流程處理失敗
  Then 它不啟動混合版本或重建通知狀態
  And 保留可辨識的失敗紀錄並交由 owner 處理

Scenario: 直接變更繞過更新入口
  Given 現行程式已不符合核准版本
  When 下一輪監控啟動檢查完整性
  Then 該輪不發送且保留通知狀態
  And 留下故障結果而不是正常無新文章結果
```

#### 尚需審閱／另行授權

建議先核准此方向，再以本機隔離工作完成 updater guard／manifest／完整 runtime 回復的規格及 acceptance-first 測試。正式替換更新入口、備份／安裝／維護重啟、恢復平台連線、live 模式與 Telegram 驗收均另行核准。本輪不提供可直接操作正式服務的修改命令。

需決定：是否接受「未核准新版只記錄待審閱，現行服務繼續」，以及是否授權已核准例行更新在驗證後恢復原 live 模式。自動更新入口之外的人工 CLI／其他更新工具不能假設已受控；正式 rollout 要列出並限制這些維護路徑，並以每輪完整性檢查處理意外漂移。


## Approved local update safety implementation contract

The 2026-10-13 owner accepts the review direction; the prior draft remains historical context. In scope: local-only immutable release builder/manifest, explicit digest approval catalogue, nonblocking OS maintenance lock, bounded disk staging, durable switch/recovery journal, real isolated gateway verification, guarded wrapper identity and full self-contained runtime recovery. Out of scope: production installer, launchctl operations, changing official updater/job, unknown-release network download, production source/credential/state copy, real Telegram or auto-restoring live without authority. Do not change existing accepted monitor conditions.

Payload layout is code/, runtime/ (relocatable managed CPython 3.11.15 plus locked site-packages), library/ and versioned wrapper templates. No .env, state, job, logs or credential files enter payload. External symlinks and traversal are rejected; internal links remain relative. Actual standalone runtime relocation must be verified by Python/import/gateway execution, not assumed from a venv copy. Complete interpreter distribution and dependencies are hashed and recovered, not only source commits. Active payload is an owned current/ directory; notification/config/job home is outside current/. Approval catalogue binds canonical manifest digest. Lifecycle service calls are an explicit local adapter, never arbitrary manifest command strings and never a production default adapter. Existing release is backed up only after full integrity validation; unknown/failed preflight never invokes service lifecycle.

A staged directory and previous directory share the owned root; a durable journal records prepared, stopped, switching and verifying phases. Recovery unconditionally restores the verified prior payload after any post-stop failure; it verifies restart in dry-run and restores live only with separately recorded authority. Recovery itself failing stops the service, keeps evidence/journal, and never recursively retries. Entry recovery runs before any new update. Persist latest state outside release trees and never backup-restore it as part of software rollback. Every adapter method must check the target release, prevent second instances and implement exact owned process teardown. Ordinary interruption follows rollback; a hard-kill drill leaves a journal that a fresh process uses to recover. Receipt status distinguishes skipped, blocked, updated, rolled_back and recovery_failed.

Managed wrapper optional guard_root calls the local integrity checker before env loading or monitor I/O; it validates installed payload against approved active identity, pending recovery and requested mode. Unmanaged existing wrappers preserve their prior behavior. Self-contained runtime fixtures and safe command fakes provide acceptance first; a real gateway adapter then uses the same manager with sandboxed process/IPC and transport-only fixtures. Fixed release candidates are constructed from owner-exported source and dependency lock, never installed formal runtime. Tests require at least 4 GiB free, at most 4 GiB owned staging, one previous snapshot, and finally removal on successful/failed/timed-out/interrupted drills. Permanent retained input env/source expires 2026-10-19; managed release drill trees do not remain.

## 正式更新入口整合方案（２０２６－１０－１３審閱草案）

**狀態：建議方案，尚未核准實作或正式導入。** 本節不改已核准規格、驗收條件或已完成 tasks。本輪只修改隔離副本的設計文件；不部署、不修改正式 job、不連正式 Telegram、不 commit／push。下列正式路徑及操作均為未來方案，不是已執行事項。

#### 建議與目前證據

建議保留更新入口名稱與週三０４：３０（Asia/Taipei）排程，由 root 管理固定版本產物與切換；gateway 及監控仍由 hermes 執行。更新入口只接受已核准的 manifest 摘要，不在正式 checkout 呼叫 `hermes update --yes`。未知新版只留下去重的待審閱紀錄，現行 gateway 不停機。

來源為 owner 提供的２０２６－１０－１２唯讀快照：`predeploy-owner.json`、`auto-update-owner-review.json`。它們不是本輪正式環境的即時查核。隔離 `runtime-update-complete/runtime-summary.json` 已證明 Python 3.11.15 的完整 gateway／wrapper／runtime 回復及保留通知歷史；**同一使用者、隔離程序 adapter 的結果不能代替 root／hermes 分工或正式 launchd 驗收**。測試候選使用相同 Hermes 0.21.4 source，不代表未知新版相容。

#### 權限分工與固定目錄

| 工作／資料 | root 的責任 | hermes 的責任 |
| --- | --- | --- |
| 更新入口與系統服務 | 管理 `/usr/local/libexec/hermes-auto-update`、受控啟動器及指定 system 服務的啟停 | 不取得一般 launchctl／任意 sudo 權限 |
| 版本與核准紀錄 | 管理 `/usr/local/share/gcake-hermes-runtime/releases/<manifest-digest>/`、核准清單、active 選擇與切換日誌；root 擁有且不允許其他使用者寫入 | 唯讀程式／manifest，執行核准 Python 與 gateway |
| 候選驗證 | 核對固定摘要、檔案樹、來源與驗證證據後封存；不執行產物中的任意 root hook | 在專用隔離 HOME／HERMES_HOME 執行測試 job；不載入正式 env |
| 私有設定與通知狀態 | 不將秘密、job 或 DB 收進版本產物；備份另設受限目錄 | 沿用原 HOME、HERMES_HOME、私有 env、DB、ledger 的 owner 與權限 |
| 維護互斥 | 建立固定 lock，持有排他鎖進行切換／回復 | 以唯讀 fd 取得共享鎖；整輪監控持有租約，不能建立、刪除或替換 lock |
| 核准與發送 | 版本核准與 live 授權分開記錄；未授權預設 dry-run | 讀取受控模式，不能自行寫入核准或把 dry-run 改成 live |

建議 releases 目錄 root：wheel ０７５５；程式檔依用途０６４４／０７５５，不含秘密。root 私有切換日誌／備份清單另置０７００目錄；公開給 hermes 的非秘密狀態檔唯讀。維護 lock 可置於 root 管理的 `/var/run/gcake-hermes-update/maintenance.lock`，使用只授予 hermes 讀取的 ACL，不讓 hermes 寫入父目錄。ACL、唯讀 fd 的共享鎖及 `/var/run` 重建行為須實測後定案；不能只把現有０６００ lock 改成全員可寫。

**現有 guard 只接受 `/private/tmp`、相同 UID，且以 O_RDWR 開啟 lock。** 正式 adapter 必須另行實作 root 寫入／hermes 唯讀契約；不得刪除路徑與 ownership 檢查，或加一個任意路徑的繞過參數就當作完成整合。root 不 source hermes 的 env、不以 root 執行 hermes 可修改的腳本，也不信任 manifest 內的命令。候選封存後再由 hermes 測試，root 重新核對摘要；可寫候選或測試 receipt 本身不構成安裝核准。

#### 現有啟動路徑映射

| 項目 | 快照中的現況 | 建議正式整合後 |
| --- | --- | --- |
| 自動更新 | `system/ai.hermes.auto-update` → `/usr/local/libexec/hermes-auto-update` | label、入口路徑、週三０４：３０排程保留；入口內容改為受控更新管理器 |
| Gateway supervisor | `system/ai.hermes.gateway.boot`；UserName＝hermes、RunAtLoad／KeepAlive＝true | 保留同一 supervisor 與執行使用者；不建立第二個 gateway |
| Gateway ProgramArguments | `/Users/hermes/.hermes/hermes-agent/venv/bin/python -m hermes_cli.main gateway run --replace` | 擬改為 root 管理的 `/usr/local/libexec/hermes-gateway-managed`；以 hermes 身分解析固定 active 版本，切到該版 code，再 exec 該版 Python 與 CLI |
| WorkingDirectory | `/Users/hermes/.hermes/hermes-agent` | plist 指向穩定的 root 版本根目錄；啟動器再切到 `releases/<digest>/code`，避免使用活動中的 Git checkout |
| HOME／HERMES_HOME | `/Users/hermes`／`/Users/hermes/.hermes` | 保留原值，設定、正式 job 與 ledger 不搬入 release |
| Python 與依賴 | 正式 checkout 下的 venv，Python 3.11.15 | 固定版 `releases/<digest>/runtime`，完整 interpreter／鎖定依賴；不能用搬動 venv 代替驗證 |
| Monitor 與 wrapper | `.local/lib/gcake-rss` 與 `.hermes/scripts/gcake-rss-live.sh` | job 的 script 路徑保留；wrapper 成為受控 dispatcher，執行 active release 的 library／版本 wrapper；每輪先驗完整性及模式 |
| 狀態與秘密 | `.local/state/gcake-rss/live.sqlite`、`.config/gcake-rss/live.env` 等 | 路徑與權限保留，繼續由 hermes 存取；新監控私有 env 另行安裝核准 |
| 舊 GUI LaunchAgent | `~/Library/LaunchAgents/ai.hermes.gateway.plist` 存在；先前查詢不足以證明永久停用 | 導入前排除重複 poller；任何停用／變更另行核准，本輪不處理 |

active 選擇在受控根目錄原子替換，選擇內容綁定核准 manifest；每次 invocation 在租約內固定同一版本，不途中重新解析 active。舊 release 到所有使用者程序退出且新版本驗收完成前不刪除。啟動器需清理會改變 Python 載入路徑的環境，保留必要的既有 gateway 環境鍵；不能猜測哪些鍵可移除。

**這個建議需要未來修改 gateway LaunchDaemon 的 ProgramArguments／WorkingDirectory，也需要替換更新入口與既有 wrapper。** 「cron 監控 job 的名稱／排程／script 路徑不變」不等於「所有正式 job 都不用改」。本輪不作這些變更；正式導入須逐項核准。`--replace` 是否保留，須用完整 `hermes_cli.main gateway run` 路徑驗證後定案，不能讓它取代單一 supervisor／程序身分檢查。

人工更新／回復也走同一 root 入口，只接受固定子命令與核准摘要，不接受任意 shell、路徑或 hook。原 `.local/bin/hermes update`、舊 checkout 及其他維護工具不是已受控入口；導入前必須查明路徑、移除其對活動 runtime 的寫入可能及重複啟動風險。root 不從 hermes 可替換的 home 路徑執行 privileged 程式。

#### 備份與首次切換順序

１．**停機前準備。** 重新唯讀比對正式入口、plist、source／wrapper／helper、Python、權限與已核准快照；現況有漂移先 blocked。候選固定 source SHA、patch／依賴／產物摘要；完成隔離驗收、狀態向前／向後相容檢查、空間估算與版本核准。未知版本 skipped，不停止服務、不 fetch 移動中的 main。

２．**保留首次導入回復組。** 精確備份更新入口與 helper、兩份相關 system plist、原 wrapper／helper、完整原程式碼與 Python 環境，包含 owner／mode／ACL／symlink 與摘要；不假設 Git archive 等於正式現況。既有 venv 的首次回復目標是原絕對路徑，需演練驗證。備份中可能有秘密的部分限 owner 存取，不能進 repo 或審閱附件。

３．**獲核准後進入維護。** 取得同一維護鎖，先禁止新 sender invocation；等既有送出完成及落盤。取得鎖／drain 超時即中止切換，不強殺後重送。預先寫入可持久保存的切換日誌，再受控 bootout 唯一的 `system/ai.hermes.gateway.boot`；確認相關程序與 cron worker 都退出，避免 KeepAlive 重生。

４．**保存狀態對帳備份。** 靜止時由 hermes 取得 monitor DB／execution ledger 的一致性備份及必要 job／設定快照，owner 權限保留。DB 備份獨立於 runtime，不能用活躍中的 SQLite 檔案直接複製當一致性證據。一般軟體回復仍使用最新正式狀態；備份只供對帳或另行核准的資料災難恢復。

５．**封存與切換。** root 在受控根目錄封存完整 candidate，再核對 digest／owner／mode；以日誌記錄入口、啟動器、plist、wrapper 及 active 的每個步驟。首次安裝涉及多個目錄，不宣稱單次原子完成。具體替換順序由正式 adapter 演練定案，尚未全部完成時禁止 sender。後續例行更新只換完整 release 的 active 選擇，不再改 job 或 plist。

６．**啟動與驗證。** 由同一 system supervisor 啟動，核對 UID、實際 Python／code 路徑、Unix identify、HOME、唯一 gateway 及 ledger context；先 dry-run，核對自然輪次原訂時間與 DB 未改。正式 gateway 啟動會涉及平台連線，即使 monitor 是 dry-run，也須另行核准；目前驗證只能在隔離環境。完整 CLI 路徑／正式依賴差異不可由先前 `gateway.run` 測試推論通過。

７．**完成或回復。** 通過後記錄 root 管理的 release receipt；首次 live 必須另行核准。例行更新只有在策略明確允許時才恢復先前 live。保留當前、上一個已驗證版本與首次導入回復組；清理只刪記錄在清單且確認不用的產物，不掃描模糊名稱、不刪狀態備份。保留期限及完整磁碟預算於正式 adapter 驗收前定案；隔離４ GiB 預算不是正式備份峰值的證據。

#### 失敗回復與中斷後入口

| 失敗點 | 回復行為與完成條件 |
| --- | --- |
| 未核准、摘要／權限不符、空間不足 | 不停服務；留下 skipped／blocked，保留待審閱摘要 |
| drain 或服務停止失敗 | 不切換 active；核對原服務狀態，不能補啟第二個 gateway |
| 首次入口／plist／wrapper 切換失敗 | 根據日誌恢復原入口、helper、plist、wrapper 與原路徑完整 runtime，重核權限／摘要後只啟動原 supervisor |
| 例行新版本啟動或驗證失敗 | 停止新版，切回上一個完整已驗證 release；保留最新 DB／ledger，再 dry-run 驗證，結果標記 rolled_back |
| 中斷、SIGKILL、重開機 | root 入口先處理未完成日誌再接受更新；禁止把混合版本當 active。記錄的 PID 還須比對 UID、啟動時間、exe、工作識別與 Unix context，避免 PID 重用誤殺 |
| 回復版本不相容或亦啟動失敗 | 保留日誌、停止 sender、記錄 recovery_failed；不無限 restart、不重建 DB、不自動重試 unknown |

啟動器在未完成／回復失敗狀態只進入禁止派送的維護等待，不載入平台或啟動 ticker，避免 KeepAlive 造成失敗啟動迴圈。開機自動回復若要有獨立 root recovery service，屬新增正式 job，須另行設計及核准；本草案先採 owner 執行受控 recovery 入口，不假設週三排程會即時救援。`/var/run` 鎖重建時仍由持久日誌禁止派送。

不得回復舊發送歷史來取得「乾淨狀態」；sent／uncertain／unknown 必須保留。Hermes 設定及 ledger 的新版 migration 也需評估，僅 monitor DB 相容不夠。首版回復到原 RSS wrapper 時，原有去重沿用，但新的過期／恢復摘要功能暫停；這是功能降級，不能當新監控驗收成功。

#### 供審閱的驗收草案與缺口

以下尚未加入已核准 specs／tasks；審閱通過後再形成正式 adapter 的規格與測試。

```gherkin
Scenario: 權限分工不能被一般執行使用者改寫
  Given gateway 以 hermes 身分執行且有已核准版本
  When hermes 嘗試修改版本、核准紀錄或啟用模式
  Then 系統拒絕修改且既有核准資料保持不變
  And 正常監控仍可讀取必要的非秘密上下文

Scenario: 未知新版保持服務
  Given 現行 gateway 正常且新版未經核准
  When 每週或人工更新入口檢查新版
  Then 現行 gateway 繼續運作且新版未安裝
  And 重複檢查不產生重複待審閱項目

Scenario: 首次導入失敗恢復原啟動方式
  Given 已保存原更新入口、gateway 啟動設定與完整執行環境
  When 首次切換任一步驟失敗
  Then 原啟動方式與權限可恢復且只有一個 gateway
  And 已送出與結果不明的紀錄保留且不再次發送

Scenario: 重開機時仍有未完成維護
  Given 切換中斷且存在未完成維護紀錄
  When 機器重新啟動或 owner 進入回復入口
  Then 尚未完成回復前沒有平台連線或監控派送
  And 回復成功後才允許唯一的核准 gateway 啟動

Scenario: 回復失敗保持可診斷狀態
  Given 新版與上一版都無法通過啟動驗證
  When 回復入口完成一次回復嘗試
  Then sender 保持停止且留下回復失敗紀錄
  And 後續更新不啟動混合版本或覆蓋通知歷史
```

**尚需本機驗證：** 兩個實際 UID／ACL 與共享租約、root 封存與權限競態、固定 CLI 啟動器、假的 launchctl adapter 與單一 supervisor、每個首次替換步驟的 fresh-process recovery、完整原路徑 venv 恢復、持久程序身分與 KeepAlive 維護等待、其他 Hermes job／設定／ledger 相容性及完整磁碟預算。現有隔離驗證不關閉這些缺口。

**未來另行授權的正式操作：** 替換 root 更新入口／helper、建立 root 版本目錄及 ACL、修改 gateway plist、替換正式 wrapper、取得受限正式備份、維護啟停、恢復平台連線與 live。owner 本輪審閱不等於授權執行這些操作。


## Approved isolated update entry Implementation Contract

The owner accepts the prior review direction for local implementation only. In scope: authority/runner separation, immutable releases/<digest> selector, fixed isolated launchd adapter, first-entry backup and verified restoration, durable interrupted supervisor recovery, and a hash-bound privileged isolated drill. Out of scope: production paths/labels, official updater or job edits, secrets/platform access, account changes, production installation and commit/push. The historical review draft above remains a production proposal, not deployment authority.

Use updater_guard canonical manifest, tree validation and atomic durable record helpers; retain its same-UID local contract unchanged. A separate EntryStore validates an explicitly marked /private/tmp/gcake-entry-* authority root, uid and permissions for control files, readers and sealed artifacts. Writer uid is checked on every mutating public entry. Readers use existing O_RDONLY shared lock, no creation or path-based override. Root-private journal/backup and public read-only gate are separate. Normal invocations hold a shared lease throughout; verification while maintenance is exclusive permits dry-run only under the authority-written verification gate. The gateway launcher waits in maintenance before loading any gateway/platform code and selects one fixed release once. Gate selection must agree with approval and sealed manifest. Volatile lock recreation never overrides persistent maintenance state.

Releases use code/, runtime/ and library/; sealed directories and manifest are never writable to runner. First-entry slots are a fixed allowlist inside the owned workspace, never arbitrary production paths. Backups use platform cp -p and record bytes/digest/uid/gid/mode before service stop. First replacements are journaled; recovery restores them with the same metadata and verifies each restored hash before restart. Filesystem journal and gate updates sync file and parent directories. Latest synthetic history stays outside release trees and is not restored. Approval is an authority operation binding exact digest, never inferred from a test report or manifest passed=true. No candidate-supplied shell/hook commands are accepted.

LaunchdAdapter commands are fixed arrays: print, bootout and bootstrap for system/local.gcake.hermes-test.<32hex> and owned fixture plist only. Expected executable, isolated home and runner UserName are checked against the plist before bootstrap; print is parsed for state/pid and bounded stop confirms service absence. Fixed ProgramArguments avoid --replace; duplicate-start refusal is tested. Real gateway/CLI probes run as runner, never authority. Test launchctl uses a persistent fake for local crash-boundary tests; owner drill uses actual launchctl for its unique probe service. Neither authorizes official launchctl targets.

Transaction phases: prepared (complete old slot backup), stopping (durable before bootout), stopped, replacing (before each slot), switching (before active update), verifying (dry-run permit), committed (new selection verified), recovery_failed. Any unfinished pre-commit phase recovers old selector and slots, starts/verifies only old complete release and defaults dry-run. A fresh process recognizes committed before clearing journal; receipt errors do not reverse committed updates. Recovery failure stops and preserves maintenance gate; further update does not retry. Service identity checks use supervisor target plus launchctl-owned pid, expected UID and executable; no standalone PID killing. Hard-kill drill restarts a controller at every phase and uses persistent fake supervisor state; actual launchd owner drill separately exercises launchd plus cross-UID access.

Acceptance first: test_update_entry.py reproduces missing entry behavior with a product NotImplementedError seam, then covers approval skip, permission drift, read-only leases, mapping refusal, successful selection, all crash boundaries, first slot restoration, failed recovery and post-commit receipt errors. verify_update_entry_privileged.py runs with sudo only at owner request, seals code from exact hashes into a new root-owned temporary workspace, drops to existing hermes UID for probes and uses a network-denied test service. It saves sanitized JSON evidence to the invoking owner's requested isolated directory; it removes the exact test service and owned root in finally and reports any cleanup failure. No owner result means permission/real launchd tasks remain pending.

## Combined privileged gateway Implementation Contract

Historical isolation scope remains applicable to the completed combined drill. The following production authorization is a separate extension, not a weakening of that drill.

In scope: complete native CPython 3.11.15 and locked dependencies, owner-exported matching Hermes source with the existing context patch, root EntryStore authority, real hermes UID, actual unique test LaunchDaemon, EntryStore-managed wrapper, real due test job and occurrence ledger, synthetic legacy state and fixture-only HTTP/ACK. Out of scope: formal source/home/job/state, production plist or service, real Telegram, account changes, reboot and commit/push. Prior separate results remain historical evidence.

Preparation runs as the invoking main user and constructs old/new/bad immutable bundles with normalized readable modes and self-contained runtime. Fixture transport uses isolated HERMES_HOME dynamically; no private configuration enters payload. A prepared inventory binds module hashes and complete manifest digests; root copies modules and seals candidate bytes only after exact digest validation. No candidate code executes as root. Preparation/drill roots have a 4 GiB budget and exact lifecycle ownership; prebuilt fixture bundles expire 2026-10-19, no background process is retained.

EntryStore verification lease while root holds EX permits dry-run only when the public verifying gate and active approved digest match and EX is still held. Normal invocations hold O_RDONLY SH for their entire env/monitor child. An abandoned verification permit or live work during EX refuses before I/O. monitor renders its child with the pinned payload Python 3.11.15 and library. Full gateway profile permits only Unix IPC needed by control socket, keeps TCP denied and private user homes/formal libexec unreadable. Isolated HOME/HERMES_HOME/XDG/TMPDIR and bytecode prohibition are set before the selected interpreter runs.

The root controller registers only the existing fixed test-label adapter. The actual wrapper script dispatches through root-owned slot wrapper into EntryStore.monitor, captures scheduler context before env sourcing, and uses root-owned job identity. Runtime verification runs as hermes: actual version/prefix/dependency marker, Unix gateway identify and launchctl PID/UID, completed occurrence context, dry-state hash. Test jobs are created/rearmed in the fixture home only; full natural gateway ticker performs dispatch, never a fake dispatcher. Candidate updates and stopped/selected/verified SIGKILL boundaries use fresh controllers against the same home/job/DB. Recovery verifies the full old runtime; failed recovery persists its gate and stops the service. Fixture live is explicitly enabled outside maintenance to prove sent/unknown/baseline preserved and later new content handled once. No real Telegram transport is available.

One root lifecycle driver tracks direct owned child sessions and unique launchctl target. It preserves sanitized round/rollback/history/cleanup evidence, stops/reaps controlled helpers before service bootout and removes only its own root on success/failure/timeout/ordinary interruption. An owner report without passing round and teardown checks is not completion. Local tests first reproduce missing EX verification lease; profile, dispatcher and bundle construction are checked before requesting owner execution. The owner command file verifies driver digest and prepared inventory, avoids pasted multiline Python, and prints only the sanitized result. Telegram handoff instructs exact isolated scope and refuses unsupported sudo; Codex sends no message itself.

Combined maintenance authentication uses a protected Unix socket owned by the authority, authenticated by kernel LOCAL_PEERCRED/LOCAL_PEERPID and an exact generation nonce bound to the read-only lock record. The socket endpoint accepts only a read-only identity query, never commands; its directory is authority-only writable. Reader code does not spawn setuid ps or require unprivileged access to root process metadata. Kernel proc_pidinfo supplies the writer's own UID and microsecond start identity; normal release clears the record/socket, and SIGKILL closes the listener so abandoned verification refuses. This replaces cross-UID process-info assumptions in the combined contract without weakening live refusal or control-file ownership.

## Authorized production rollout Implementation Contract

Owner authorization on 2026-10-13 permits the Hermes patch, managed update entry, wrapper and existing gateway restart. After verified operation it permits changing the existing monitor job and committing/pushing this change. Preserve first-install originals and latest external state. It does not authorize Telegram test messages or replaying unknown outcomes. The production gateway's normal platform reconnection is part of the authorized restart; notification qualification remains dry-run.

Implement a distinct ProductionStore and fixed production supervisor mapping in production_entry.py. EntryStore's default path policy remains isolated; expose a class-level path policy so the production subclass can accept only /usr/local/share/gcake-hermes-runtime. Validate all authority ancestors and root ownership, reject symlink/writable ancestors, and bind runner to the existing hermes account. Production launcher /usr/local/libexec/hermes-gateway-managed uses only root-owned controls and retains /Users/hermes and /Users/hermes/.hermes. Preserve necessary original plist fields, replace only reviewed ProgramArguments/WorkingDirectory, and reject an unexpected Label/UserName/HOME/HERMES_HOME or missing KeepAlive/RunAtLoad. Preserve original plist bytes for recovery, including its existing plutil-compatible but strict XML parser-incompatible format. Parse a plutil JSON view for forward rendering; never normalize the backup.

Create a new production bundle from approved source/runtime and the real monitor library, with no transport fixture or synthetic helper. Never promote combined-gateway-inputs directly: its notification transports are fixtures. Pin whole-tree identity, source/patch/lock/test evidence and tool modules before owner execution. Formal source hashes match the owner's fresh inventory dated 2026-10-13 05:22:24 Taipei; recheck immediately before installation. Required originals include gateway/updater plist, updater/helper, wrapper/helper and source/runtime inventory. Existing source/venv are retained at their original paths, never updated in place during the first install, preserving a directly usable original runtime. Root-private backups preserve ACLs/modes and are excluded from Git. Quiescent SQLite backup uses hermes and SQLite backup API; ordinary recovery never rewinds DB/ledger.

Installer first acquires the existing updater exclusion and managed maintenance exclusion, blocks sender, checks drain and supervisor ownership, persists intent, then stops only system/ai.hermes.gateway.boot. Replacement sequence is root tools/release, updater entry, launcher, gateway plist and wrapper, followed by dry-run selection and restart. A durable first-install journal tracks every replacement; fresh owner recovery restores all originals before restarting the original supervisor. No independent recovery daemon is introduced. Root never sources private env or runs runner-writable hooks. Existing update schedule/label remain unchanged; an unapproved successor is retained once and skipped before any service operation. Candidate code runs only as hermes.

The new wrapper reads its restricted summary URL/credential from /Users/hermes/.config/gcake-rss/publication-monitor.env, which the fresh inventory reports absent. The owner does not know another location. Verify the candidate Worker summary route/configuration and existing deployment inventory before declaring this prerequisite ready; do not invent an endpoint, use account-wide credentials, expose a credential or substitute fixture observations. Missing prerequisites block activation before service stop. Private configuration is owner-readable only and never included in evidence/repository. Readiness includes read-only handler semantics, authentication and fresh canonical source identity.

After restart verify exact UID/interpreter/code digest, Unix gateway identity, one supervisor and a naturally dispatched existing-job dry round matching scheduled context, with production DB unchanged. Do not rearm the production job to simulate that round before qualification. Persist the receipt; only then apply the authorized existing-job correction and explicit live policy without identity/interval changes. Do not send a test message. Commit/push only the scoped repository change after all affected required gates, readiness and owner operation evidence pass. Do not claim completion for an unexecuted owner command or missing summary.
