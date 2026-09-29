## Context

The Admin already reads series manifests, edits sections and post order, validates YAML, and saves one existing manifest with blob and commit revisions. It does not create a manifest, rename its identity and filename together, or delete a manifest. Public membership is derived from manifests rather than post frontmatter, so removing a manifest naturally makes its local posts standalone when catalog loading tolerates the missing membership.

Constraints are repository-backed content, no second series database, no series slug in post frontmatter, one coherent Git transaction per mutation, and the existing Admin visual language.

## Goals / Non-Goals

**Goals:**

- Complete create, display-name edit, slug rename, and delete flows from the Series workspace.
- Preserve article membership, section content, and order during metadata edits and rename.
- Keep filename, internal slug, Admin route, public route, and derived membership consistent.
- Preserve optimistic concurrency and surface actionable duplicate, validation, and conflict errors.
- Keep posts and Markdown source untouched when deleting a series.

**Non-Goals:**

- Moving series data to D1 or another database.
- Writing series membership into post frontmatter.
- Deleting post Markdown or article bodies with a series.
- Redirecting an old series slug after rename or deletion.
- Redesigning the Admin design system.

## Decisions

### Use one lifecycle service over repository transactions

A focused series lifecycle service will translate create, update, rename, and delete requests into validated repository transactions. This keeps the router thin and makes atomic rename and delete behavior testable without HTTP. Direct router construction was rejected because it would duplicate path, validation, and conflict rules across endpoints.

### Represent rename as one atomic delete-and-create transaction

Renaming from `old-slug` to `new-slug` will validate the new manifest and commit two changes against one expected base commit: delete the old path with its expected blob SHA and create the new path only when it does not exist. The manifest's internal slug is serialized as the new slug. Sequential delete and create was rejected because a partial failure could lose the manifest or leave two identities.

### Use absence as the expected revision for creation targets

Repository changes already distinguish an absent file with an omitted expected blob SHA. Create and rename will check the target path is absent in the same transaction. Existing-target conflicts will use `SERIES_CONFLICT`. A preflight-only uniqueness check was rejected because it leaves a race before commit.

### Delete only the manifest

Series deletion will require explicit confirmation and remove exactly the manifest path with its expected blob and base commit revisions. Post files are not transaction changes. Because site membership and navigation are derived from loaded manifests, local posts remain in the general post collection and lose series navigation after the manifest disappears.

### Return parsed summaries for the Series list

Series list responses will include title and article count derived from each YAML manifest while retaining raw source and revisions for editing. This avoids an extra client-side parsing contract and gives the list a stable display shape without introducing a second data store.

### Preserve route semantics through canonical slug identity

The current filename-derived lookup and manifest `slug` must agree. After rename, only the new manifest exists, so `/series/new-slug` is generated and the old slug is absent from Admin reads and public static paths. No redirect is created in this scope.

## Implementation Contract

### Behavior

- The Series list displays every manifest with its title and number of referenced posts, and provides create, edit, and delete actions.
- Creating a series with a valid unique slug writes `src/content/series/<slug>.yaml` with an empty `sections` array and required defaults. Invalid or duplicate slugs produce a clear error and no commit.
- Editing a title changes only the manifest title and preserves sections, post references, statuses, editorial fields, and ordering.
- Renaming a slug changes both the manifest filename and internal slug in one commit. The new slug becomes the only valid Admin/public series identity; the old slug no longer resolves.
- Deleting requires a confirmation that explicitly states articles will not be deleted. The operation deletes only the manifest. Referenced local Markdown remains unchanged and becomes standalone content.
- Every mutation carries the expected base commit SHA. Updates, renames, and deletes also carry the expected source blob SHA. A stale base or blob returns HTTP 409 `SERIES_CONFLICT` and creates no commit.

### Interface and data shape

- `POST /api/v1/series` creates a series from `{ title, slug, expectedBaseCommitSha }`.
- `PUT /api/v1/series/:slug` updates or renames from `{ manifest, expectedBlobSha, expectedBaseCommitSha }`.
- `DELETE /api/v1/series/:slug` deletes from `{ expectedBlobSha, expectedBaseCommitSha, confirmed }`.
- `GET /api/v1/series` returns series sources including `title` and `postCount`.
- Git transactions use the existing repository writer; creation expects target absence, update expects the existing blob, rename deletes the old expected blob and creates an absent target, and delete removes only the existing manifest.

### Failure modes

- Invalid slug or manifest returns HTTP 400 with `INVALID_SERIES` or `VALIDATION_FAILED` and actionable issues.
- Missing explicit delete confirmation returns HTTP 400 `CONFIRMATION_REQUIRED`.
- Duplicate target slug, stale base commit, stale blob, or a rename target appearing concurrently returns HTTP 409 `SERIES_CONFLICT`; no transaction is committed.
- Missing source series returns HTTP 404 `SERIES_NOT_FOUND`.
- Unexpected GitHub failures remain HTTP 502 `GITHUB_API_FAILED`.

### Acceptance criteria

- Focused lifecycle, validation, router, contract, Admin helper, and catalog tests cover all requested create, rename, delete, standalone, and stale-revision cases.
- Public content validation, public tests, Astro check/build, Admin tests/build, Worker tests/build, and root full test/build commands pass.
- Static route generation contains the new slug only after rename and continues to build after series deletion.

### Scope boundaries

Only series-manifest lifecycle, related Admin controls, API contracts, derived public membership, tests, and documentation are in scope. Post source format, article bodies, R2 media, publication providers, authentication, and deployment are unchanged.

## Risks / Trade-offs

- [Risk] A rename target can appear after a list read. → Mitigation: enforce target absence in the atomic repository transaction, not only in UI preflight.
- [Risk] External series can reference posts owned by another repository. → Mitigation: deleting the manifest still deletes no post; public external entries disappear because the manifest is the only local membership source.
- [Risk] A deleted or renamed URL becomes a 404. → Mitigation: this is explicit scope behavior; tests assert no broken generated reference remains and no stale route is emitted.
- [Risk] Large manifests can be accidentally normalized by YAML serialization. → Mitigation: preserve all parsed unknown fields and validate behavior with membership/order regression tests.
