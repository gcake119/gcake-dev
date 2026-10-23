## 1. Acceptance first

- [x] 1.1 Derive behavior tests for Article-end controls, Share the clean blog reading URL, and Minimal integration boundary from their Gherkin scenarios in test/article-sharing.acceptance.test.ts using existing test tools; register them in package.json test:public and record genuine failing assertions for missing controls, incorrect payloads, or missing integration before implementation.
- [x] 1.2 Derive failing acceptance tests for Truthful copy feedback and recovery and Native share outcome handling: assert clipboard payload, delayed success, unavailable/denied/rejected copy, later failure after success, chooser payload, cancellation, other rejection, and resolution without publication claims; record RED using node --import tsx --test test/article-sharing.acceptance.test.ts and assert observed results rather than mock configuration.

## 2. Deliver approved behavior

- [x] 2.1 Implement Reading URL separate from canonical by supplying clean production routes and raw article titles from both article templates; verify the URL acceptance cases turn GREEN for a standalone post, a local series post, and imported Day 1 with query/fragment inputs, and assert canonical, Open Graph URL, and original-version destination remain unchanged.
- [x] 2.2 Implement Shared article-end interaction in src/components/ArticleShare.astro and both article templates: exactly one group after prose and before further reading, Copy link always available when interactive, Share article conditional on native support, and selectable manual URL when JavaScript is disabled; verify built article integration checks for all three article categories and no unusable share control.
- [x] 2.3 Implement Truthful browser outcomes in src/lib/sharing/article-share.ts with the approved Traditional Chinese messages, clipboard-only URL, explicit user activation, neutral AbortError, copy fallback on other share failures, cleared stale feedback, and no overlapping operations; verify all outcome acceptance tests pass and add unit cases only for uncovered state/normalization logic.
- [x] 2.4 Deliver Accessible controls and feedback through existing semantic styles in src/styles/global.css, labelled controls, visible focus, and announced text results; verify desktop and 390px mobile in both themes for keyboard activation, selectable failure URL, no content obstruction, and no horizontal overflow, using the existing Playwright tooling.

## 3. Verify and record boundaries

- [x] 3.1 Apply Reuse verification tools: run the existing public-test aggregate and Astro checks/build, reuse the build for rendered integration and a bounded browser pass, and record commands, tested revision/dirty state, results, and limitations; before any separately authorized push, inspect and satisfy the then-current full required local gate without duplicate aggregate subchecks or new CI jobs.
- [x] 3.2 Verify native sharing on an available real supported device by opening the chooser and cancelling without publishing; record device/browser, supplied title/URL evidence where observable, cancellation, unsupported-browser manual URL recovery and failed-share manual URL selection; if a real device is unavailable, explicitly leave native/manual acceptance incomplete rather than treating simulated success as proof.
- [x] 3.3 Align docs/design-system.md and docs/decisions/index.md with article-end placement, reading URL separate from canonical, unchanged social-preview metadata, and evidence boundaries; review them against the spec and run spectra analyze add-article-sharing and spectra validate add-article-sharing without changing required checks, source ownership, or unrelated dirty files.

## 4. Owner revision — single SVG share action

- [x] 4.1 Derive RED acceptance and rendered tests from the revised Article-end controls, Manual URL recovery, Native share outcome handling, Share the clean blog reading URL, Accessible controls and feedback, and Minimal integration boundary scenarios: only one SVG/text share action, no copy action or clipboard calls, unsupported/error full selectable URL, neutral cancellation/resolution, and no overlapping operations. Record failures against the prior implementation.
- [x] 4.2 Implement Single SVG share action using the existing icon system, remove the copy action and clipboard code, retain clean reading URLs and canonical ownership, and show manual URL recovery on unsupported browsers or errors. Verify revised DOM acceptance and rendered integration GREEN.
- [x] 4.3 Update design documentation and ledger for the revised contract; run public aggregate, one build and scoped Astro diagnostics, then verify desktop/390px and both themes for SVG/text control, keyboard activation, no overflow, no-JavaScript and selectable URL recovery. Refresh preview and record native/manual limitations separately; run Spectra validate/analyze.

## 5. Approved label refinement

- [x] 5.1 Use the owner-approved visible label 「分享這篇文章」 with the existing SVG; align the current spec and design documentation, verify RED then GREEN with the rendered acceptance suite, rebuild and confirm the local preview exposes the new label.

## 6. Approved reading-first article ending

- [x] 6.1 Derive RED acceptance from Reading-first ending sequence, Public next installment priority, Consolidated bounded recommendations, Preserve sharing subscriptions and citations and Approved public typography and responsive layout. Verify real built article order fails before implementation and selection cases cover stable order, duplicates, excluded neighbors, missing public targets, empty groups and 2/3 limits. Preserve the RED log.
- [x] 6.2 Implement Reading-first ending composition and Consolidated existing recommendation presentation with shared ArticleReading and pure selection, public next priority, grouped full previous/series links, stable merged recommendations, truthful completed/latest state, and separate preserved references. Verify acceptance and built local/imported article checks GREEN.
- [x] 6.3 Match the approved typography/source: move sharing after reading guidance, align its question/action row, use the approved article subscription copy and spacing, keep references collapsed, preserve homepage and metadata. Verify existing subscription checks and desktop/390px both-theme browser checks including keyboard, fallback URL and layout.
- [x] 6.4 Apply Verification for approved ending: run existing affected public aggregate, Astro check and one public build reused for integration/browser evidence; align decision/design docs, record current source and limits, run Spectra validate/analyze, refresh local preview without commit/push/PR/deployment.
