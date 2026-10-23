## Context

The owner approved article-end copy plus conditional native sharing on 2026-10-23. The two existing article templates render local posts and imported iThome reading editions. Local posts use blog canonical URLs; imported iThome posts retain the old site's canonical and Open Graph URLs. Footer social links are author profiles, not article sharing.

Decision context: Level 2 for the durable distinction between reading URL and canonical ownership, following the existing DESIGN.md, docs/design-system.md, docs/blog-redesign-approved.md, docs/external-content.md, and docs/decisions/index.md. ADR-001 concerns search and is unaffected. No separate ADR or archive backfill is needed now; align the design documentation and decision ledger during authorized implementation. MCP ADR cache was empty, so repository sources govern. Other dirty files belong to unrelated work and must remain untouched.

## Goals / Non-Goals

Goals: one consistent article-end interaction, clean reading-edition URLs, truthful outcomes, accessible recovery, and existing visual conventions.

In scope: public standalone and local series posts plus imported iThome reading editions; browser copy/share operations and local feedback.

Out of scope: platform-specific destinations, SDKs, tracking, authentication, backend services, canonical or Open Graph changes, preview guarantees, article-content edits, publication automation, deployments, and CI workflow or required-check changes. This phase creates proposal artifacts only.

## Decisions

### Reading URL separate from canonical

Build the share URL from the known public route with the existing localCanonical helper, never from the canonical tag or the current address including query/fragment. Pass the raw article title rather than the document title with the site suffix. This retains blog navigation without changing historical ownership. Alternative: canonical-based sharing sends imported readers to the old site and conflicts with the approved scope. Keep existing Open Graph metadata; receiving platforms can consequently present the old primary edition.

### Shared article-end interaction

Use one ArticleShare Astro component accepting { title: string, url: string }, mounted immediately after the prose and before ArticleConnections further-reading placement in both templates. The component owns markup and a small browser controller in src/lib/sharing/article-share.ts; the controller owns capability detection and operation outcomes rather than forwarding through adapters. Removing it removes clipboard/share behavior, so no extra service boundary is warranted. Keep Copy link available; render Share article hidden until native support is confirmed. Use semantic buttons with text and existing SVG conventions, semantic color tokens, visible focus, and existing 44px target conventions. Do not add a floating toolbar or new button framework. Without JavaScript, provide a selectable reading URL for manual copying instead of a falsely functional control.

### Truthful browser outcomes

Write only the supplied URL using the Clipboard API after explicit activation. Report success only after resolution; on missing API, denial, or rejection, expose a labelled readonly selectable URL and the approved recovery message. Clear earlier feedback before each new action. Invoke native sharing directly from a reader activation with { title, url }; treat AbortError as neutral because browsers can use it for cancellation or no available target. Other errors get the approved copy fallback message. Native resolution gives no publication claim. Ignore new activations while an operation is pending to avoid overlapping outcomes, then restore controls. Use a polite status region and text feedback; do not read the clipboard or request permissions in advance. Alternative: legacy copy hacks and permissions preflights add maintenance without improving manual-copy recovery.

### Reuse verification tools

Concrete risk: missing route integration or a clipboard rejection could silently copy the wrong edition or claim false success. Existing subscription HTML checks cover neither interaction. Extend the existing node:test, linkedom, and installed Playwright tooling without adding packages or a CI job. Start with failing behavior acceptance tests using a DOM and browser-capability doubles for copy/share results; use the same tests after implementation. Add focused unit cases only for logic not already covered, and integration checks on built local/imported article HTML for placement and URL ownership. Browser checks cover responsive layout, focus, and actual clipboard where available; native OS chooser and receiving-platform delivery need separate human evidence. Cost is one bounded acceptance suite and a small local browser pass, with no new service or test layer. Cheaper source-string checks cannot prove clipboard data or error feedback. Verify effectiveness by recording genuine RED before implementation and GREEN after it; do not test mock setup as the result.

## Implementation Contract

Observable behavior is defined by all six requirements and their Gherkin scenarios in specs/article-sharing/spec.md. Component input uses the production reading URL and visible article title; no provider requests occur until a reader chooses a target outside the site. Success feedback is 「已複製連結」; copy recovery is 「無法自動複製，請手動複製下方連結」 plus the selectable URL; share error feedback is 「無法開啟分享，請改用複製連結」. Cancellation and browser share resolution do not claim posting or delivery. Copy does not include the title. No route-dependent canonical rewrite is permitted.

Acceptance tests in test/article-sharing.acceptance.test.ts must cover normal, failure, and boundary scenarios before implementation. Register the suite in the existing test:public aggregate without adding a workflow. Reuse one build for rendered integration and browser checks. Before a future push, read the then-current required local gate and run its full aggregate without separately rerunning included checks; this proposal authorizes no push. Record automated, native/manual, deployment, and human acceptance evidence separately. This proposal phase runs only Spectra artifact validation and analysis, not product tests.

## Risks / Trade-offs

- Native targets and title handling differ by browser/device → feature-detect and validate actual chooser manually without claiming platform delivery.
- Existing iThome Open Graph URL points to the old site → retain it as approved; document that social previews are outside the guarantee.
- Clipboard access denied → manual selectable URL recovery, no automatic permissions prompt.
- No JavaScript → selectable manual URL; no new polyfill.
- New feedback can be confused with an earlier action → clear status on activation and prevent overlapping operations.

## Migration Plan

No data migration or production change occurs in this phase. A future authorized implementation adds the component to both templates and updates local documentation. Deployment requires separate authorization. Rollback removes sharing integration and its styles/controller while retaining article content, source data, canonical metadata, and existing subscription/connection navigation.

## Open Questions

None for the approved scope. Real native chooser behavior and social previews remain verification limits, not permission to expand platform integrations.

## Owner revision — single SVG share action

**Supersedes**: add-article-sharing / Shared article-end interaction and Truthful browser outcomes, only for the copy action and recovery behavior. The preceding copy-related design records the earlier iteration; the revised spec and this contract govern current behavior.

### Single SVG share action

Reuse Icon.astro and icon-paths.ts for a share arrow icon, matching existing 24×24/currentColor/1.7 stroke conventions. Keep visible 「分享這篇文章」 text and a decorative aria-hidden SVG. Remove the copy action and Clipboard API dependency. Capability detection keeps sharing conditional; unsupported browsers display the labelled readonly URL plus 「此瀏覽器不支援分享，請手動複製下方連結」. Share failure displays 「無法開啟分享，請手動複製下方連結」 and the URL. AbortError stays neutral, browser resolution makes no publication claim, and pending operations prevent overlap. No-JavaScript manual selection remains. Production reading URL, placement, metadata ownership and themes remain unchanged.

## Revised Implementation Contract

Use the revised six requirements and their Gherkin scenarios. Acceptance tests must fail against the prior controller and built two-button UI before implementation. Update existing DOM and rendered suites instead of creating a new verification mechanism. Browser verification covers one SVG/text action, keyboard focus, unsupported/error manual URL selection, cancellation and completion with explicit capability doubles; actual system chooser evidence remains separate and incomplete. Reuse one updated build for rendered and browser checks. Preserve completed original tasks and append revision tasks only after the revised Gherkin is complete.

## Design Source — approved reading-first ending

The owner approved the prototype at http://127.0.0.1:4398/ and then its typography revision on 2026-10-23. Exact source and sample data are preserved in design-source/index.html and design-source/data.json. They define the approved layout; only actual public article content and existing production links are used in implementation. The prototype controls, sample body copy, phone frame and placeholder links are excluded from production.

| Role | Approved value |
| --- | --- |
| Root / prose | 17px / 1.8; 1rem / 1.9 |
| Ending heading | 1.18rem / 1.45 |
| Primary next title | 1rem / 700 / 1.8 |
| Other recommendation title | 1rem / 400 / 1.8 |
| Description / metadata | .82rem |
| Actions / navigation / reference links | 1rem |
| Width / touch target | existing 44rem reading width / 44px |
| Colors / SVG | existing public semantic OKLCH tokens; 24×24 currentColor, 1.7 stroke |

### Reading-first ending composition

**Supersedes**: add-article-sharing / Shared article-end interaction and Single SVG share action, for placement only. Current order is prose → ArticleReading → ArticleShare → compact Subscription → ArticleConnections references → existing footer. ArticleReading owns presentation of next/previous/overview plus one recommendation list. Both routes already supply the filtered public ReadingSeries and current neighbors; retain that source. No-next text is completion-specific only when publicationState is completed; active/paused without next gets neutral "目前已讀到最新一篇。". Unknown article destinations are ignored in recommendation presentation rather than exposing hidden metadata. References remain factual and separate.

### Consolidated existing recommendation presentation

Use a small pure selection function in src/lib/discovery/article-ending.ts to resolve further then related candidates, preserve stable order, deduplicate by href and exclude current/previous/next destinations; cap at two when there is a next, three otherwise. It hides actual selection behavior, not a forwarding adapter. Unit-like boundary cases live in the same acceptance suite. Corpus generation, scores, provider setup and existing automatic-article-connections artifacts remain untouched. ArticleReading renders actual source descriptions instead of generated reason text, matching the approved mockup. ArticleConnections retains references-only rendering at the article use sites; keep its unused further/related modes compatible rather than changing other consumers.

### Verification for approved ending

Concrete risk: rearrangement can duplicate or expose an unpublished next article, mislabel completion, lose factual references, or regress share recovery. Extend current node:test/linkedom tools: a bounded selection acceptance suite for normal/failure/boundary inputs, update built-article integration assertions for real placement and metadata, then one build reused for browser/layout checks. No package or CI job is added. Register selection acceptance in existing test:public; built checks run after build so clean pre-build CI remains valid. Use affected public aggregate, Astro check, public build and existing subscription check; do not rerun the unrelated interrupted Hermes aggregate. Browser checks cover three article contexts, both themes and desktop/390px, actual links/keyboard/details, and capability-double recovery. Previously user-confirmed native chooser/cancellation remains human evidence; don't claim receiving-platform delivery.

## Current ending Implementation Contract

specs/article-ending/spec.md and revised specs/article-sharing/spec.md are the current behavior contract. Keep completed historical tasks unchanged, append current tasks after Gherkin. Use the approved type scale exactly without changing the site-wide scale or homepage subscription. Compact Subscription may accept an ending variant to use the approved title/spacing while its other uses remain compatible. ArticleShare row includes the approved question and right-aligned SVG/text action; existing controller behavior stays unchanged. New section selectors are scoped to article endings, so existing body typography, site footer, header and unrelated screens retain their contracts. Formal sources and metadata must be byte-identical at their owning files. Current authorization ends at local preview; no Git writes or external effects.

## Production acceptance and closeout — 2026-10-23

The owner subsequently authorized PR #67 merge and Pages deployment, then separately authorized protected production D1/Vectorize recovery. Both completed; [production acceptance](production-acceptance-20261023.md) records exact revisions, CI, provider readback, real browser results, earlier failures and remaining limitations. Earlier phase authorizations above remain historical. The current request authorizes evidence backfill, main-spec synchronization, archive, commit and a new PR only; no further merge or deployment. No normative acceptance condition is changed.
