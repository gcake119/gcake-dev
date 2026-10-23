## Why

Readers currently have no article-level shortcut for copying or sharing a post after reading it. The owner approved a minimal article-end control group that shares the current blog reading edition while preserving existing canonical ownership.

## What Changes

- Add article-end Copy link and conditionally available native Share article controls to every public local post and imported iThome reading edition.
- Copy the clean absolute blog article URL; pass the article title and the same URL to native sharing.
- Provide truthful copy success, selectable-URL recovery, share cancellation, and share failure feedback.
- Preserve existing canonical, Open Graph URL, original-version links, content ownership, and visual conventions.

## Capabilities

### New Capabilities

- `article-sharing`: Native sharing with reading-edition URLs and accessible manual recovery; historical copy scope is superseded below.
- `article-ending`: Approved reading-first ending, public-series navigation and consolidated existing recommendations.

### Modified Capabilities

None.

## Impact

- Affected specs: new article-sharing capability.
- Affected code:
  - New: src/components/ArticleShare.astro, src/lib/sharing/article-share.ts, test/article-sharing.acceptance.test.ts, test/article-sharing.rendered.test.ts.
  - Modified: src/pages/posts/[...slug].astro, src/pages/series/ithome-2026/[post].astro, src/styles/global.css, package.json.
- Documentation alignment:
  - docs/design-system.md
  - docs/decisions/index.md
- Reuse existing canonical URL builder without changing its behavior; no new dependencies, backend, platform SDK, tracking, authentication, deployment workflow, or required-check changes.
- Proposal-only authorization: no application implementation, commit, push, deployment, or external post in this phase.

## Owner revision — 2026-10-23

The owner now requests only 「分享文章」 with an SVG icon. Remove the separate copy action and clipboard operations. On unsupported browsers or sharing failure, display the complete reading URL for manual copying, as explicitly confirmed by the owner. The revised capability spec supersedes the original copy-button scope; completed tasks and the first verification record remain historical evidence. This revision authorizes local implementation and preview only, with the same no-commit/no-push/no-deployment/no-posting boundary.

## Approved reading-first ending — 2026-10-23

The owner approved the complete article-ending prototype and its public-site typography, and explicitly authorized updating Spectra plus local implementation/verification/preview. No commit, push, PR, merge, deployment or publishing is authorized in this revision.

New capability: `article-ending`, specified in specs/article-ending/spec.md. Add one shared reading-guidance presentation for both article templates: public next installment first, grouped previous/series links, consolidated existing recommendations (two with next, three otherwise), sharing, subscription and collapsed factual references. This supersedes the earlier share-before-reading placement and the two separate recommendation groups at presentation level; existing corpus/ranking and source ownership remain unchanged.

Additional affected files: src/components/ArticleReading.astro, src/components/ArticleConnections.astro, src/components/Subscription.astro, src/lib/discovery/article-ending.ts, test/article-ending.acceptance.test.ts and the existing built-article sharing checks. The approved source is preserved under design-source/; this source is a mockup, its article-body examples are not content edits and its placeholder links are not production destinations.

## Production acceptance and closeout — 2026-10-23

The owner subsequently authorized PR #67 merge and Pages deployment, then separately authorized protected production D1/Vectorize recovery. Both completed; [production acceptance](production-acceptance-20261023.md) records exact revisions, CI, provider readback, real browser results, earlier failures and remaining limitations. Earlier phase authorizations above remain historical. The current request authorizes evidence backfill, main-spec synchronization, archive, commit and a new PR only; no further merge or deployment. No normative acceptance condition is changed.
