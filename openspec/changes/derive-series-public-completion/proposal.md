## Why

The six-part behind-the-scenes series remains labelled active after publication because editorial and reader-facing completion are not reconciled. A reusable rule must require explicit manuscript completion and every listed installment to be publicly readable.

## What Changes

- Derive local series public completion from explicit editorial completion and complete public membership.
- Preserve paused status and existing schedule eligibility; an end date alone cannot prove publication.
- Use the same result on the homepage, series listing, series detail and article ending.
- Mark the owner-confirmed behind-the-scenes manuscript and chapter complete without changing article publication records.

## Capabilities

### New Capabilities

- `series-public-completion`: Consistent public completion for explicitly finished local series.

### Modified Capabilities

None.

## Impact

- Existing implementation: src/lib/content/publication.ts, src/lib/content/series.ts, src/lib/content/catalog.ts.
- Content: src/content/series/ithome-2026-extensions.yaml.
- Verification: src/lib/content/publication.test.ts and rendered public pages.
- No dependency, provider write, notification, deployment or external-series policy change.
