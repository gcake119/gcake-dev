## Context

GitHub Pages is the reading surface. Astro emits static HTML using BaseLayout. The site already generates sitemap and robots endpoints. Imported iThome articles retain source canonicals. No analytics or Google HTML verification was observed on production.

## Goals / Non-Goals

Goals: install production-only Cloudflare measurement, support Google verification, retain existing SEO and prove provider acceptance separately.
Non-Goals: new packages/databases, hosting migration, content changes, legacy canonical migration or distribution changes.

## Decisions

### Production-only beacon

Use the official module beacon from static.cloudflareinsights.com. Set WEBSITE_ANALYTICS_ENABLED=true only in both GitHub Pages build workflows. Read CLOUDFLARE_WEB_ANALYTICS_TOKEN from GitHub repository variables. A shared Astro component emits a module bootstrap with inert data attributes. Before inserting the official module script, compare location.origin exactly and require /gcake-dev or /gcake-dev/ descendants. Check for an existing official script before insertion. This also excludes localhost previews of built production files. Enabled builds reject missing/malformed tokens; disabled builds emit no bootstrap. Do not store actual token values in public documentation.

### Optional Google verification

Read GOOGLE_SITE_VERIFICATION at build time and emit one escaped HTML meta tag in BaseLayout only when nonempty. Add its repository variable to both deployment workflows. Select the Google account before configuring a URL-prefix property; preserve previous owners' verification tags. The provider-issued verification value is intentionally public HTML and is not an authentication credential.

## Implementation Contract

In scope: production HTML on all reading pages, exact origin/path guard, single official beacon, optional head verification, two production build workflows and existing node:test acceptance coverage. The test command builds production and disabled candidates and executes the emitted bootstrap in a bounded DOM stub; no provider requests occur in local tests. Required gates are pnpm test, pnpm check, pnpm build:all and pnpm release:dry-run. Provider evidence requires real production beacon requests, dashboard counts, Google ownership success, sitemap status and page inspection.

Out of scope: changing canonical ownership, sitemap selection, publishing adapters, Worker runtime or account permissions. Runtime beacon blocking retains a usable reading page and is reported as incomplete measurement. Build configuration errors fail closed without logging tokens. Provider delays remain pending.

## Risks / Trade-offs

Ad blockers can suppress beacons; do not bypass them. Same-host projects require the runtime path boundary. Data accumulation and indexing take time. GitHub Pages serves this project's robots endpoint under its base path; root robots is owned separately. Owner must resolve the imported article canonical exception before any SEO migration.

## Migration Plan

Set only public provider verification/build variables, review the isolated candidate, obtain release authorization if required, deploy via existing Pages workflow and observe provider results. Rollback by disabling measurement and rebuilding or reverting this isolated change; retain valid Google ownership proof while the property is in use.
