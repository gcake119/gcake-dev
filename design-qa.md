# Design QA

## 2026-09-27 approved redesign implementation

- Implemented the approved mist-blue light and night-mist-blue dark themes, site identity, SVG navigation, independent series index, series chapters and article disclosures.
- Formal production build preview: `http://127.0.0.1:4321/gcake-dev/`. Real source content only; prototype sample series were not imported.
- Desktop at 1280 px and mobile at 390 px were visually reviewed. An additional narrow IAB viewport reported 291 px; after the header spacing fix, its document had no horizontal overflow.
- Verified keyboard theme switching and persistence after reload, series index to series to Day 7, expanded series navigation with the current article marked, navigation to Day 8 with the disclosure closed, and article TOC heading-anchor navigation.
- Homepage uses the real ongoing series and recent Day 19, 18 and 17 articles. Multi-series behavior is implemented, but formal content currently contains only one readable series.
- `pnpm test`: 3 publication-date and lifecycle tests passed. `pnpm check`: 0 errors, 0 warnings, 10 existing schema deprecation hints. `pnpm build`: series validation passed and 25 pages built. Future articles were excluded. `git diff --check` passed.
- Home screenshot: `/private/tmp/gcake-redesign-home.png`.
- Publication visibility is calculated during a static build using the Asia/Taipei calendar date. The current deployment workflow does not run daily; scheduled dates require another build to become visible. No deployment workflow or remote state was changed.
- No real standalone local post exists yet. Rich code, tables and image fixtures were not rerun in this review. This is local implementation QA, not deployment acceptance or a complete accessibility audit.

## 2026-09-24 rendered review

The production build was served locally at `http://127.0.0.1:4321/gcake-dev/` with the GitHub Pages base path. Desktop was checked at 1280 px; mobile was checked at 390 px and 320 px. This is local rendered QA, not deployment or human acceptance.

### Pages checked

- Homepage: editorial hierarchy, honest latest-post empty state, archive entry, header and footer.
- Series list and iThome series detail: title wrapping, chapter order, article links and mobile stacking.
- Archived iThome article Day 11: title, metadata, desktop margin TOC, mobile disclosure TOC, heading anchors and previous/next navigation.
- Topics and About: empty state or body copy, responsive layout and footer.
- On mobile, the navigation disclosure and article TOC open with native controls. At 320 px and 390 px, the checked pages have no document-level horizontal overflow.

### Rich-content fixture

The current 30 archived articles contain headings and prose but no fenced code blocks, Markdown tables or images. A temporary page based on the built Day 11 article was placed only in `dist/qa-rich-content/` for rendered QA. It included a deliberately long code line, a three-column table and a 320 × 180 image with alt text and caption. At mobile width, code scrolls inside its block while the page stays within the viewport; table cells display labels from their actual headers; the image retains its intrinsic width and fits the reading column. The desktop table remains tabular. The fixture is not source content and is removed after QA.

### Fixes from this review

- Added a keyboard-visible skip link to the main landmark.
- Increased mobile TOC link targets to at least 2.75 rem high.
- Kept prose images at or below intrinsic width instead of stretching small images to the wide-content measure.
- Gave local articles without a Series a single-column heading layout, including at the mobile breakpoint.

### Automated checks

- `pnpm install`: completed with the lockfile unchanged; pnpm reported an ignored `esbuild` build script.
- `pnpm check`: 0 errors, 0 warnings, 10 deprecation hints from `astro:content` schema use of `z`.
- `pnpm build`: passed; Series validation had 0 errors and 0 warnings; 36 static pages built.
- The empty local `posts` collection produces expected build notices. No published local post exists yet, so the standalone local article layout has source-level and type-check coverage only.

### Remaining limits

- Chinese font appearance depends on locally installed fonts.
- The approved ImageGen concepts were not available in this review session for pixel-level comparison.
- Local preview and fixture checks do not establish GitHub Pages deployment or human acceptance.

## 2026-09-27 search and approved About copy

- Added independent static full-text search, navigation text retained on mobile, result title/series/summary, exact approved no-result message, retryable loading error and no-JavaScript fallback.
- Index contains the same 19 public articles as the reading catalog; article URLs retain `/gcake-dev/`. No prototype content or future local drafts were added. External canonical/body ownership remains with the source.
- Actual static preview at `http://127.0.0.1:4321/gcake-dev/`: keyboard Enter search for 驗證 returned Day 17, whose title/summary do not contain the term. Empty-result search showed the approved text and series link. Theme switched by keyboard and persisted after reload. Tab reached the visible skip link.
- Desktop 1280 px light search result reviewed. Mobile 320 px dark search/empty state and 390 px dark About reviewed; document widths stayed within viewport. About has all three approved sections and four full service links; footer SVGs expose service names.
- `pnpm test`: 6/6; `pnpm check`: 0 errors, 0 warnings, 10 existing deprecation hints; `pnpm build`: passed, 26 pages plus JSON endpoint, series validation 0 errors/warnings. Empty local collection warnings remain expected.
- Preview initially failed inside sandbox; approved local preview started successfully outside it. Playwright CLI package startup did not finish promptly, so rendered QA used the in-app browser's native controls and Playwright API.
- Limits: no standalone local article exists; no full accessibility audit, deployment, remote schedule or public endpoint validation. Multi-series/no-series conditions have not been rendered with formal source fixtures this round. Comment provider capability and hosting remain undecided.

### Follow-up: navigation search input and result-only page

- Replaced the Search nav link with a native GET search form, preserving `/gcake-dev/` and query text after navigation. Removed the duplicate form from the result page. Mobile search wraps onto a second row.
- Full local `pnpm test`, `pnpm check`, `pnpm build` and `git diff --check` passed again.
- The nav form was observed in the browser accessibility tree before the result-only follow-up. Final browser verification was blocked by debugger synchronization timeouts; the revised mobile layout and end-to-end nav submission are not claimed as rendered acceptance.

### Computer Use recheck and integrated candidate

- Completed native browser verification: homepage nav input + Enter opened the result-only page, retained query 驗證 and returned Day 17. Mobile 320 px dark layout displayed the nav input on a second row; document scroll width 305 px within 320 px viewport. A replacement query zzzz showed the approved no-result message and series entry. Keyboard Enter toggled light theme; reload preserved it. Desktop 1280 px light result page reviewed.
- Created an isolated filesystem candidate at `/private/tmp/gcake-design-candidate-20260927` from remote main `1320bdf1d7133e38f26602ec9063bb52954f3da8`, integrating local design/search changes. Original dirty checkout and the separately dirty sync-release checkout were preserved. Remote new article and extension manifest remain intact and ready/unpublished, hence excluded from public search.
- Resolved overlapping presentation changes and duplicate imports; retained remote series visibility filtering and source snapshot. Candidate full pnpm test 6/6, check 0 errors/0 warnings/10 existing hints, build 26 pages passed. Static index has 19 public entries, all article targets exist.
- Candidate preview `http://127.0.0.1:4323/gcake-dev/`: Computer Use verified nav submission, result content, and keyboard activation of Day 17 opened the article with separate series/TOC disclosures and canonical source link. Pointer activation in IAB did not navigate; keyboard activation did. This may be a browser-control limitation and is not promoted to pointer acceptance.
- No commit, push or deployment performed. Original checkout is still based on 54cf820; use the integrated candidate when preparing the next revision, not a direct push from that old base.

### Release preparation

Integrated against latest main 8f5f0f6 in an isolated Git checkout. Preserved durable iThome snapshot endpoint, completion freeze logic, SHA-256 records and unpublished extension content. Final full checks run before push; original dirty workspace remains preserved.
