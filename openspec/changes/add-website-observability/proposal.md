## Why

The public GitHub Pages site has no verified traffic measurement or Search Console property. Add minimal observability without changing content ownership or distribution.

## What Changes

- Install the official Cloudflare Web Analytics beacon through the shared Astro layout, gated by an explicit production build setting and exact browser origin/path.
- Support an optional Google HTML verification tag and submit the existing sitemap after verification.
- Retain existing canonical, RSS, sitemap and source ownership rules; report the legacy canonical exception for owner clarification.

## Capabilities

### New Capabilities

- `website-observability`: Production-only traffic measurement and Search Console verification.

### Modified Capabilities

None.

## Impact

- Modified: `src/layouts/BaseLayout.astro`, `.github/workflows/deploy-pages.yml`, `.github/workflows/editorial-release.yml`, `package.json`.
- New: `src/components/WebAnalytics.astro`, `test/website-observability.test.ts`, `docs/website-observability.md`.
- Provider settings: Cloudflare Web Analytics site and GitHub build variables; Search Console property and sitemap.
- No new dependencies, database, content migration or hosting change.
