## Context
已公開原 ID 221098688，slug ithome-2026-publishing-in-production；完整內容與 Git 相同，平台發布時間 2026-10-21T23:01:02.155Z，原定 23:00Z。既有消費者為 UID 502，sudo -n 無管理員認證。

## Goals / Non-Goals
修復唯讀驗證與 Hermes 通知。保留排程、ID、slug、訂閱者通知紀錄與 allowCreate=false。不得重新發布、重寄、修改 Git 原文、啟用排程寫入或新增 timer。

## Implementation Contract
### Public verification
公開身分與全文必須仍完整一致，實際時間必須可解析；保存 publicationEvidence 的 title、actualAt、confirmedAt、differenceSeconds。publicationMinute 代表實際分鐘，observedTime／slot 保留原承諾。原始 armedRevision 與寄送 unknown 保留。僅重新檢查既有公開驗證誤判；新證據不完整不得清除 hold，真正 ID／slug／canonical／內容差異仍失敗。
### Independent notification
既有完整 durable holds 決定待辦；部分文章失敗保留該篇舊待辦，不阻擋別篇已確認結果。schema 1 相容，schema 2 增加 publications，僅公開標題、身分、時間、版本，不含私人正文。成功事件以原 ID、armedRevision、實際時間持久去重；每次先提交 intent，僅有效 ACK 才 sent，未知結果不重送。實收仍 unknown。
### Permission diagnosis and rollout
消費者回報固定階段與 errno，不輸出例外正文、憑證。管理員診斷以實際 hermes 帳戶測試 feed／SQLite／receipt；僅修復已證明的精準權限缺陷，保留帳本。先更新相容消費者再更新 producer；無管理員認證時不可宣稱正式修復。
### API and UI
增加唯讀 actualTime、differenceSeconds，畫面分開顯示原定、實際與早／晚秒數，不將公開驗證視為訂閱者實收。

## Verification
延伸既有 Node/Python acceptance suites，先重現晚發布及 mixed round，再測去重重啟、unknown、無效證據與權限階段。不增加新測試層或 CI workflow。受影響完整本機 gate 後才部署；正式沿用自然 timer，實際 Hermes ACK 與人類實收分別記錄。

## Decisions
最新 main 2224ce8 已有 docs/decisions/index.md 與 ADR-001-cloudflare-semantic-search。此修復不變更搜尋、模型、額度、日誌或索引排程，遵守其隔離邊界。發布政策仍以 publishing-operations、quiet-background-distribution 與本 change 為準。使用者已授權時間差分離與成功通知；索引增加本變更參照，無需修改搜尋 ADR。


### Latest-main compatibility

原 cb9a9d3 候選的五項 gate 保存為歷史；最新 main 2224ce81f13a814e83c6349e9f64bebdc7f2827e 上逐檔三方合併，保留既有封存連結、搜尋更新與 PR48 原子測試標記。程式修復檔與 main 無競爭修改。正式資格採新的 Node 24 完整五項 gate，不以舊基底通過代替。安裝的 Computer Use runtime 仍使用原 Node 22，需另外通過受影響驗收；不更動 timer 或 Node 路徑。


### Replacement-file permission correction

第147自然輪次已產生真實成功事件，但新檔只帶繼承 ACL，UID502仍於feed-read EACCES。對現有檔加入明確帳戶 ACL 後，僅手動修復現有檔並不能保證後續替換。沿用 producer 既有 write-temp／rename，在正式固定路徑於 rename 前以系統 chmod 對該新檔設定同一 Hermes 帳戶的明確 read 權；失敗不替換、不宣稱 queued。只多一個至多10秒的本機程序／每輪，無依賴、service、timer 或CI層。測試既有快照的可觀察可見性與權限失敗保留；現場以次一自然輪次驗證替換後讀取。

### Selected-release correction
The October 22 natural event 6 hit the old consumer's exact selection check before imports, credential loading or transport. Pin the original consumer SHA256 and original daemon/selector timestamps before that receipt; root-authenticated repair alone may append a not_sent reconciliation while retaining event 6 unknown. Preflight the live selection before ledger intent, recheck at sender for races, and classify only typed pretransport rejection as not_sent. Preserve genuine unknown/no replay. Update only existing notification WatchPaths interpreter/code to the ready selected release, with RunAtLoad=false; no feed touch, seed, publication timer or gateway reload. Reuse existing Python tests, no new dependency or test layer.

### Faithful reader qualification
The administrator captures prove the same-inode raw diagnostic template can fail while the installed pinned read_snapshot succeeds. UID／UUID lookup did not improve the template, and its lower-level cold-start difference remains unresolved. Replace the duplicate feed-read implementation with exactly one call to the hash-verified installed reader; never retry it or invoke consume／sender. Preserve the other account／SQLite／receipt probes. The current installed and candidate read_snapshot bodies must match before qualifying a replacement. This extends the existing Python diagnostic acceptance tests, adds only standard-library module loading and SHA verification during administrator preflight, and adds no timer／dependency／CI layer. Test one invocation, invalid snapshot, changed reader pin and unchanged ledger. Real natural consumer evidence remains required for delivery qualification.

### Shared original-site monitor migration
**Supersedes**: repair-substack-publication-notifications / Selected-release correction

**Supersedes**: repair-substack-publication-notifications / Faithful reader qualification

The user explicitly selected the working original-site Hermes private-message flow and declined the dedicated-group proposal. Earlier cold ACL failures and rejected hypotheses remain evidence; the exact OS cause is unresolved. Success delivery no longer depends on that cross-account feed. Existing completed local-feed work remains historical; existing foreground attention is retained.

In scope: add `substackPublications` to the existing authenticated `/api/v1/monitoring/publications` response, reuse the same scheduler context, existing original-site `send_notification` and `deliver_recorded`, and the same private `live.sqlite` notification ledger. Extend the production monitor entry with an explicit combined entrypoint while leaving the selected immutable Hermes runtime, gateway, credential files, job ID and cron schedule unchanged. Generic monitor entry defaults remain unchanged. No new group, dependency, service, D1 migration or CI workflow.

The API returns a separately complete bounded whitelist of verified scheduled publications. Each candidate must have matching source slug, remote ID, canonical URL, armed revision, current verified content markers, no pending intent/action, parseable actual/confirmed dates and consistent signed seconds. Verification must be within one hour, with at most five seconds future skew. Repeat SELECTs detect schedule changes during enumeration; a failed Substack read returns an incomplete Substack block without invalidating the original Pages summary. Draft/inconclusive rows cannot block other verified candidates. No private body, lease, intent, credential or edit URL is returned.

The combined entrypoint runs the existing Pages monitor and captures its fresh observation, then evaluates the Substack block independently of RSS/page health. It reuses `monitor_events` and `monitor_delivery_attempts`, with the existing original ID/armed revision/normalized actual-time publication key. Original-site events remain distinct. Persist intent before sending; require a positive integer Telegram ACK; unknown/intent/sent cannot replay. Record natural job/execution/round and implementation SHA in existing metadata. Missing/stale/malformed authority emits no Substack success. Local dry-run never writes the live ledger or sends.

Before activation, stop routing publication successes to the legacy local feed while retaining its foreground issues. Root preparation validates exact installed legacy code, original row and mismatching selection timestamps. Activation preserves all legacy rows, appends the already proven event-6 not-sent reconciliation, and copies publication suppression states to the shared ledger; only authenticated not-sent evidence is eligible to send again. State changes or unproven outcomes fail closed. Acquire the existing runtime maintenance lock for control installation; restore owned controls on failure. Preserve all original cron/outbox/credentials and all existing scheduler settings. The original timer naturally launches the combined monitor; no kickstart, feed touch or manual live run.

Cost and verification: extend current Worker and Python acceptance suites for whitelist/races, independent mixed results, exact-once ACK, historical unknown migration, wrapper selection and dry-run isolation. One existing summary response carries the extra block, with two bounded schedule SELECTs for consistency. No extra polling job. Source contracts and complete local gates qualify the candidate; root sender readiness is read-only; final success requires a new producer natural round and the original Hermes job's natural execution with positive ACK on the final pinned controls. Subscriber delivery and human receipt remain separate unknowns.


### Root handoff qualification observation

The production pipe metadata reported UID 502 after sudo handed input to the actual Hermes actor, so a pipe-owner UID-0 test incorrectly rejected a root-authorized invocation. Preserve that failure and the read-only live-schema copy reproduction. The installed correction keeps the FIFO and actor checks, then binds the exact proof and helper SHA to the root-owned preparation file and the existing root-owned temporary backup directory. The directory must be open for this handoff, nonwritable by the actor and created within sixty seconds; the existing finally block closes it on success or failure. This replaces the invalid authorization proxy without any group or ledger permission change, new service, timer or dependency. Existing installer acceptance tests cover foreign actors, forged authority, stale/closed handoff, unchanged originals and rollback.

The existing signal-timeout fixture also intermittently failed before its child PID marker appeared. A shell replacement passed Node 24 but failed under Node 22, disproving the proposed Node-specific remedy. The replacement was withdrawn; original timeouts, fixtures and assertions remain unchanged. Preserve both counterexamples and do not call a passing rerun a repair. The final unchanged fixture and final feature sources passed the complete gate; the intermittent startup mechanism remains unresolved and separate from the success-notification runtime.


### Three-line success messages

The owner explicitly requests the first three existing lines only. The current success formatter SHALL return the unchanged verification heading, authoritative title and original public URL, separated by two newline characters. Timing, identity and subscriber evidence remain in the read-only API and existing audit records. The formatter does not participate in the publication fingerprint, so installing this copy change SHALL not replay any sent, intent or unknown record. Existing original-site messages and foreground-attention text are outside scope.

Verification extends the current delivery acceptance assertions and the shared-monitor replay case, using the selected Python runtime. Installation replaces only the root-controlled shared formatter under the existing maintenance lock, after checking the old and new hashes. Preserve the original ledger bytes/rows, existing runtime selection, gateway, cron, producer pin and publication flags. Read back the installed pure formatter without invoking transport. No new test layer, timer, credential, provider operation or repeated live notification is required for this copy change.
