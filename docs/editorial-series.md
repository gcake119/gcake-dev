# Editorial Series

Series manifests are both editorial planning records and website navigation sources.

## Rules

1. The Series manifest is the SSOT for sections and reading order.
2. Posts do not store section IDs or series order.
3. Planned posts may exist only in the Series manifest.
4. Create Markdown when drafting actually begins.
5. Unpublished content may be moved, merged, split or renamed as the series develops.
6. Published posts normally keep their established narrative position.
7. Actual finalized content takes precedence over an earlier outline.
8. Section structure may change while future posts are still unpublished.
9. Production pages show only published posts.
10. A completed series must not contain unfinished posts.

## Status

Series: `planned | active | completed | archived`

Section: `planned | active | completed`

Post planning: `planned | draft | ready | published`

## Responsibility

Series answers:
- Why do these posts belong together?
- What are the current sections?
- What is planned, drafting, ready or published?
- What comes next?

Post answers:
- What is the article?
- When was it published?
- What topics does it discuss?

## Public publication state

The existing `status` field describes editorial/archive management. Optional `publication` describes reader-facing lifecycle independently:

```yaml
publication:
  status: active # active | completed | paused
  endsAt: '2026-10-08' # optional, explicit final release day
```

When an explicit final release date exists, the series stays ongoing until that Taipei calendar day, then becomes completed. `paused` overrides this transition. Without an end date, an active series remains active regardless of inactivity. Do not infer completion from archive status when a publication schedule is present.

Only posts marked published and whose date has arrived appear in the reading catalog, series navigation or generated public routes. Series without readable posts are hidden. The period starts at the earliest readable installment; ongoing series show 至今, completed series end at the final readable installment, and paused series show the latest published date without an implication of completion.

This static site evaluates dates during build. A new build/deploy must run for scheduled articles to appear. The deployed source-sync workflow includes an hourly deployment schedule and durable completion snapshot. This design iteration preserves the latest main implementation; scheduler-event acceptance is separate. Search uses the same public catalog, so future and draft local content is excluded from its index.
