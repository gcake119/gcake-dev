# Design QA

## Reference

Approved desktop and mobile ImageGen concepts for:

- Homepage
- Series detail
- Long-form article

## Automated checks

- `pnpm check`: passed with 0 errors.
- `pnpm build`: passed; 36 static pages generated.
- Series validation: passed with 0 errors and 0 warnings.
- `git diff --check`: passed.
- Static internal-link scan: 36 HTML files checked, 0 broken `/gcake-dev` links.

## Implemented parity

- Warm ivory, ink and muted brick-red editorial palette.
- Serif display hierarchy paired with readable sans-serif UI/body copy.
- Shared desktop/mobile header, footer and navigation.
- Reading-first homepage without card grids or dashboard patterns.
- Series chapters, ordered published posts, status and archive treatment.
- Narrow article measure with wide-content breakouts, table, code and quote styling.
- Mobile menu and article table of contents use native interactive elements.
- Mobile tables are relabeled and stacked from their actual column headers.
- The 2026 iThome archive renders inside the new reading system while keeping external canonical URLs.

## Blocker

The local preview started successfully and the browser detected the site's `/gcake-dev` base path. The cloud browser then refused navigation to that local base-path URL with `ERR_BLOCKED_BY_CLIENT`. Because the rendered prototype could not be captured at matching desktop and mobile viewports, image-to-implementation comparison remains incomplete.

## Remaining visual risks

- Exact Chinese font rendering depends on platform-installed fonts.
- Line breaks and vertical rhythm have not been compared against the reference screenshots in a live browser.
- The homepage intentionally shows an honest empty state until local published posts exist, so its current content density is lower than the concept.

final result: blocked
