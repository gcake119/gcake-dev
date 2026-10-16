## ADDED Requirements

### Requirement: Complete Series CRUD runtime

The Admin and Worker SHALL expose authenticated, CSRF-protected create, update, rename, and delete operations for repository-backed series manifests. The Admin SHALL use the existing visual tokens, responsive layout, focus behavior, and explicit labels.

#### Scenario: Use lifecycle operations from the Series workspace

- **WHEN** the authenticated owner opens the Series workspace
- **THEN** the owner can create a series, edit its name or slug, and start a clearly labeled delete flow without leaving the Admin

#### Scenario: Mutation lacks authentication or CSRF proof

- **WHEN** a caller invokes a Series mutation without an authenticated session or valid CSRF token
- **THEN** the Worker rejects the request before invoking a repository write

## MODIFIED Requirements

### Requirement: Public-site regression boundary

Introducing the Admin workspace and complete Series CRUD SHALL preserve existing public Astro content routes, filtering, search, RSS, theme behavior, and build output semantics. Renamed series SHALL generate only the new series route. Deleted-series posts SHALL remain in the general post collection without series navigation or broken series references.

#### Scenario: Existing Astro verification

- **WHEN** the Series CRUD changes are applied
- **THEN** the Astro test, check, content validation, and build commands pass without requiring Admin deployment

#### Scenario: Build after series rename

- **WHEN** a manifest identity changes from `old-series` to `new-series`
- **THEN** the public build emits the `new-series` route and emits no `old-series` route or navigation reference

#### Scenario: Build after populated series deletion

- **WHEN** a local series manifest is removed while its post Markdown remains
- **THEN** the public build succeeds, those posts remain in the general article list, and they render without series navigation
