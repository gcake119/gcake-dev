# Cross-platform distribution implementation handoff

Branch: `feat/cross-platform-publish-handoff-20261011`

## Implemented in this branch
- `scripts/publishing/prepare-distribution.ts` prepares a **local, write-disabled** bundle for a published local post.
- Uses the existing canonical Markdown/MDX portable transform and both existing dry-run adapters.
- Produces source revision, canonical URL, article body, assets, per-platform intent, and explicit `newsletter: skip`.
- Refuses unsafe slugs, missing articles, future-dated articles, and accidental output overwrite.
- Produces no remote writes, subscriptions or emails.
- Test: `node --import tsx --test scripts/publishing/prepare-distribution.test.ts`
- CLI: `node --import tsx scripts/publishing/prepare-distribution.ts <slug>`
- Default output: `.distribution-handoff/<slug>.json` (keep local; do not commit generated bundles).

## Codex implementation work remaining
1. Run project tests, check and build against current main; reconcile conflicts on a feature branch and obtain code review.
2. Implement a durable per-platform publishing coordinator connected to existing D1 publication state. Never infer successful publish from clicking a button or a successful HTTP response: read back public content, canonical and date, then mark verified.
3. Paragraph: reuse `ParagraphProductionService` and official REST client. Remove the single-post gate only following an explicit **new general-production authorization** and verified production configuration. Preserve remote IDs on failures; avoid duplicate create on retries; never send newsletter by default.
4. Substack: implement a replaceable Playwright browser adapter in a dedicated runtime (not Cloudflare Worker). Use user-authenticated persistent browser profile stored outside Git, with secrets excluded from logs/artifacts. Do not assume fixed DOM selectors: inspect current UI with Computer Use and pin role/text selectors, verify draft/save/publish/public-read with a controlled article. Treat unexpected login, CAPTCHA, UI changes and ambiguous publish confirmation as manual intervention, not success. No CAPTCHA bypass.
5. Make Playwright idempotent: retrieve stored remote URL/ID first, update an existing draft/post when present, never blindly create again after an uncertain result. Persist checkpoints before every irreversible action. Require explicit article-level authorization before publish, and separate authorization for newsletter delivery.
6. Add independent platform retries, locks/concurrency protection, duplicate prevention, screenshots on failure (redacted), and an operator review/approval screen. Git saves must remain independent of distribution writes.
7. QA full-text, images, links, interactive fallback, canonical, dates, draft updates, repeated runs, login expiry, failure isolation, and no-email behavior on a real test article for each platform.
8. No unattended production publication until an end-to-end result is publicly verified and the operator explicitly enables it.

## Known limitations
- The current `.github/workflows/sync-paragraph.yml` is manual prepare-only and does not publish.
- The current Substack adapter is dry-run only.
- The September 28 Paragraph controlled cohort proves one real publish, not general production authorization.
- This new CLI provides safe preparation only; its JSON is a handoff contract, **not a queue or a claim of publication**.
