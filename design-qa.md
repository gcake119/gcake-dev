# Design QA

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
