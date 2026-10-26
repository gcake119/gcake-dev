## Context
The owner confirmed Substack Telegram receipt and separately reported the original-site notification's misleading time. The site preserved its intended 07:00 metadata despite Pages deploying after 09:10; the 09:25 Telegram time is also not exact first availability. The owner selected confirmed editorial schedule plus Hermes public confirmation.
## Goals / Non-Goals
In scope: original-site article notification labels and a timestamp captured by the existing public observer after each successful canonical-page verification, plus existing-flow acceptance and boundary tests.
Out of scope: changing article/RSS dates, retrieving deployment APIs, retroactively editing/reposting existing notifications, altering Substack success messages, Worker changes, new timers, ledger resets, credentials or bypassing managed runtime adoption.
## Decisions
### Capture public verification completion
PublicationObserver records observedAt on each successfully verified page and records a bounded publicWindow for that page-observation phase. The authenticated summary window and request-ID freshness checks remain unchanged. This requires no extra HTTP request or persistence schema.
### Keep time labels and historical identity separate
Article messages display title, URL, 原定發布時間（台北） and 公開確認時間（台北） with existing minute precision. The planned value comes only from a confirmed commitment; otherwise display 未提供. Confirmation comes only from a finite numeric page observedAt within the same publicWindow; otherwise display 未記錄. Existing article URL keys and stored message history remain unchanged.
## Implementation Contract
The public observer captures a page's observedAt after successful HTTP/canonical/metadata checks, using its existing injected clock. It separately brackets the page-observation phase with publicWindow, leaving summary window unchanged.
The notification renderer uses the formal commitment only when scheduleState is confirmed and uses only the bounded successful page-observation instant for confirmation. It does not substitute the round's now, RSS publishedAt, deployment time or sender time. Invalid/missing timing does not weaken public-identity verification or manufacture a timestamp; the message explicitly reports that timing is unavailable. The existing observer remains read-only, and the sender, deduplication keys, intent/ACK handling, hourly job and state schema remain unchanged.
Acceptance tests first reproduce the delayed 07:00/09:24:50/09:25 case. Integration tests verify injected-clock ordering after page validation and unchanged authenticated summary-window semantics. Boundary tests reject bool/nonfinite/out-of-window times and preserve sent/intent/unknown suppression. Existing Python suites are reused without a new dependency, test layer or CI workflow.
## Risks / Trade-offs
[Confirmation is an upper bound on first availability] → the selected label explicitly says confirmation, not actual first publication.
[Missing older observation timestamps] → display 未記錄 rather than inferring a time.
[Protected immutable library] → prepare a complete hash-pinned managed successor preserving Gateway code/runtime and original ledger/job; production adoption requires the existing owner administration process. Do not edit installed libraries in place.
## Migration Plan
Keep the existing selected release as rollback and preserve the original ledger. Validate the local Python change and selected Python runtime, then prepare a reviewable successor from the current installed baseline using the existing managed packaging/update workflow. The owner performs required administrator adoption. Without installation and pure installed readback evidence, report the candidate as local only. No test article or repeated production notification is authorized by this formatting request.
