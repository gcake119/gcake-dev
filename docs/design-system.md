# Website design system

## Approved direction

The accepted 2026-09-27 prototype is recorded in `docs/blog-redesign-approved.md`. The identity is 雞蛋糕的開發筆記, with the tagline 在 AI 協作開發中，邊做、邊學、邊想。 The voice is candid, concrete and inquisitive. Content discovery takes priority on the homepage; author context belongs on About.

## Visual language

- Mist blue light theme and night mist blue dark theme, using OKLCH tokens in `src/styles/global.css`.
- System sans-serif typography with clear size and weight hierarchy, fine horizontal separators and restrained accents.
- No decorative card grids, paper textures or colored side stripes.
- Theme follows the operating system initially; a manual choice persists locally. An inline head script prevents the wrong theme from flashing on page load.
- Home is an SVG icon; Series, About and Search pair SVG icons with text. Theme uses sun/moon icons with accessible names.

## Page roles

- Home: site name and tagline, ongoing series, recent articles, other series, all-series link. Three series maximum in total and three recent posts. Recent headings are subordinate to series headings.
- Series catalog: all readable series, grouped into ongoing and other series, ordered by latest published installment within each group.
- Series detail: central question, description, publication period, start-reading action, chapters and published articles in manifest order.
- Article: 44rem reading width, collapsible series navigation marked with the current article, separate collapsible article TOC, previous/next full titles and return-to-series link.
- Figures and diagrams may extend to 64rem on desktop; on mobile they fit the reading column. Code scrolls internally; tables become labeled rows using real headers.

## Content boundaries

Public rendering requires a published status and a publication date no later than the current Taipei calendar day. Undated published local posts retain their existing visibility. No prototype data is included. The external iThome source and its canonical URLs remain owned by the original repository.

Series publication status is separate from editorial/archive status. Prepared manuscripts and future schedules are not proof of public completion. Dates and status are evaluated at build time; a fresh static build is required to reveal each new installment.

## Search and author links

Static full-text search indexes only the public reading catalog, with article title, series and summary results. Empty and failed searches retain a series-catalog entry. About uses the approved three-section copy and full service links; footer uses labeled SVG shortcuts. Comment discussion remains specification only.

Search input lives in the global navigation. The standalone Search page displays results only. Mobile search occupies a second navigation row, with visible 搜尋文章 placeholder and an accessible submit icon.
