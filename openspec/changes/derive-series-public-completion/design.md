## Context

The owner selected explicit manuscript completion plus all planned installments publicly readable. The behind-the-scenes series has six published references on origin/main but active editorial state; the current checkout predates two releases. Preserve unrelated dirty work and publication history.

## Goals / Non-Goals

One shared local public-state derivation. No provider calls, external source policy changes, automatic publication, new dependencies or deployment authorization.

## Decisions

### Derive before visibility filtering

Use the original manifest references and the existing build-frozen public article set. Do not infer completeness from a list after unavailable entries have been removed. Preserve editorial status separately from derived publication state; consumers use publicationState. Keep the external ithome source path unchanged.

### Reuse existing schedule and pause semantics

Check pause first. Explicit manuscript completed or archived plus nonempty complete public membership are required before returning completed. Existing publicationStatus schedule eligibility remains an additional condition. No end date can manufacture public availability. An active manuscript remains active even with publication.status completed.

## Implementation Contract

Extend the existing publication module with a pure local-series resolver accepting editorial status, optional publication schedule, original planned references with slug/status, public slug set and build instant; return active/completed/paused. Compute it in loadSeriesManifests before filtering; carry publicationState to loadReadingCatalog so all existing reading surfaces and article endings consume one result. Preserve manifest.status as editorial input and retain original references for derivation. Missing, future, draft, ready or empty membership returns active unless paused. Explicitly finished archived manuscripts follow the same availability check.

Retain the owner-confirmed completed manuscript/chapter change for ithome-2026-extensions; do not overwrite the two publication statuses from newer main with stale local data. Work on current main for validation or isolate the patch. Local eligibility is not proof of provider publication or deployment.

Derive failing acceptance tests from every Gherkin scenario before implementation, then verify public rendered pages and existing publication tests. Extend existing cheap test layers; no new CI workflow or browser automation layer. A small rendered build check covers integration across shared surfaces. Before any future push, run the full affected-project required gates; no push is currently authorized.

## Risks / Trade-offs

Filtered lists can hide missing content → derive using original references. Open series can have no pending posts → require explicit editorial completion. Schedule clocks can drift → reuse publicationInstant. Existing imports have independent source proof → leave that path unchanged.

## Migration Plan

No database migration. Apply the code and content patch together after verification. Revert this isolated patch to roll back. Production delivery and public verification require separate task-specific authorization.

## Open Questions

None; the owner selected the completion condition on 2026-11-03.
