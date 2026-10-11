# Editorial release policy — implementation handoff (2026-10-11)

## Approved policy

- Timezone: Asia/Taipei. Release slots: Monday and Thursday at 07:00 (earliest eligibility); actual visibility after a successful site deployment, no exact-minute guarantee.
- One newly published article per slot. A ready standalone takes precedence over a currently running but unfinished series. Multiple standalones use first-ready-first-served.
- A series starts only when **all** planned installments are finalized, files exist, and statuses are `ready` (or already `published`). Manuscript order is dictated solely by `src/content/series/*.yaml`, never file creation order.
- When a series is interrupted by a standalone, it resumes at the next free slot, preserving internal order. Once begun, keep that series active ahead of other waiting series.
- A standalone uploaded after an already completed publishing run goes to the next unconsumed slot.
- Do not change article body or reading order.
- Failed builds never count as confirmed publications; preserve/restore delivery attempts safely without double-posting.
- RSS confirmation is evidence of a public publication; send Telegram once per **new canonical article**, with title and URL after confirming the article page responds successfully. Never send solely on Git commit, scheduled date, or workflow success.

## Partial implementation in branch `feat/editorial-release-queue`

- `src/lib/publishing/release-queue.ts` is a pure deterministic planning helper for Monday/Thursday slots and standalone priority.
- `src/lib/publishing/release-queue.test.ts` contains unit tests. **Neither file is connected to production.** No release has been armed.
- The planner requires all series items provided to be eligible **as a complete manifest-defined group**. Do not call it with a partial series: missing items cannot be detected from the supplied subset.
- The planner needs **durable `readyAt` metadata** from ingestion. Do not infer timestamps from current file mtimes or re-rank content on every build. It must exclude already completed releases and account for reserved commitments.
- Current `ready` articles intentionally remain unpublished.

## Codex integration tasks

1. Implement and test a durable ingestion/queue state contract. Persist the time a standalone entered the queue and the time a series became fully ready; make retries and repeated builds idempotent. Git remains the source of truth for Markdown, frontmatter and series ordering. Decide where operational queue state lives (the existing Cloudflare D1 operational state is one candidate), and how unattended GitHub Actions authenticates writes securely. Do not assume Cloudflare Admin production configuration is available.
2. Validate series completeness using full manifest post list, absence of planned/draft posts, file existence, and consistent frontmatter. Do not schedule incomplete series. Handle multiple queued series, content revisions, manual publish, deleted posts, late-arriving standalones, collisions and missed deployment windows.
3. Connect to publishing lifecycle safely. Existing public visibility requires frontmatter `status: published`, `publishedAt` and manifest post `status: published`. Today GitHub Actions has `contents: read` only and cannot persist frontmatter changes. Choose a secure write path with least privilege, protect against races with CMS/Codex writes, and ensure no two publishers consume one slot.
4. Existing `.github/workflows/deploy-pages.yml` runs at minute 37 every hour and deploys a static build. Date gates alone do **not** automatically rotate `ready` posts; integrate scheduling separately. Preserve the hourly deployment recovery. Consider 07:00+ normal delay acceptable.
5. Confirm blog feed at `/rss.xml` in the deployed canonical site. Hermes runs in a **separate local user**; repo access is not Hermes runtime access. Provide an installable RSS poller/skill or documented Hermes job: hourly check, persistent seen GUID/permalink store, baseline initialization that does not send historic posts, article URL fetch verification, exponential/backoff failures, deduplication across restarts and no credentials in Git.
6. Send Telegram success only on verified new article; include title, canonical/public URL, Taipei publication time. Add optional missed-publication alert comparing the expected queue head to RSS, but distinguish feed outages from publish failures. Keep Telegram credentials and Hermes user configuration private and outside repository.
7. Run `pnpm test`, `pnpm check`, `pnpm build`, explicit publishing queue tests and simulated production deployment; validate static site feed update and Telegram notification against a dry-run environment. Only then enable production writes and queue activation.

## First six installments

Series `ithome-2026-extensions` has six `ready` posts, with fixed manifest order. The first potential planned slot at policy approval (Sunday evening 2026-10-11 Taiwan) is Monday 2026-10-12 07:00, then Oct 15, 19, 22, 26, 29, **only if production orchestration is accepted and activated in time**. Do not backfill or silently declare any missed slot published.

## Acceptance scenarios

- A partial series is held even if its first chapter is ready.
- All six ready posts enqueue as a single ordered series when the entire manifest is complete.
- A standalone arrives mid-series, consumes the next unconsumed Monday/Thursday slot, and the series resumes afterward.
- Two standalones use FIFO ready timestamps, one per slot.
- A failed build is retried without losing articles or producing duplicate Telegram alerts.
- A GitHub push or CMS save cannot trigger early public visibility of a `ready` post.
- A new RSS article plus successfully fetched public page produces one Telegram message even across Hermes restart; a stale RSS item produces none.
