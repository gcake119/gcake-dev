## ADDED Requirements

### Requirement: Series manifests remain canonical
The Series Editor SHALL read and write `src/content/series/*.yaml` directly through safe Git operations and SHALL NOT duplicate section IDs or reading order into post frontmatter or D1.

#### Scenario: Reorder planned posts
- **WHEN** the owner reorders unpublished items and commits the change
- **THEN** the YAML manifest contains the new order and no article frontmatter or D1 ordering copy is created

### Requirement: Series validation before commit
Series writes SHALL validate unique series slug, unique section IDs, unique post references, allowed planning statuses, existing Markdown for non-planned local posts, and valid editorial pointers.

#### Scenario: Duplicate post reference
- **WHEN** a proposed manifest contains the same post slug twice
- **THEN** the Worker returns `INVALID_SERIES` and creates no Git commit

### Requirement: Offset-aware CMS scheduling
New CMS-created schedules SHALL serialize `publishedAt` as an ISO date-time with explicit `+08:00` offset and SHALL display/edit date and time in `Asia/Taipei`.

#### Scenario: Schedule exact Taipei time
- **WHEN** the owner schedules an article for `2026-10-15 09:00` in the Admin
- **THEN** the committed frontmatter stores `2026-10-15T09:00:00+08:00`

### Requirement: Legacy date-only compatibility
Existing `YYYY-MM-DD` values SHALL remain valid and visible from the start of that Taipei calendar day, while date-time values SHALL become visible only at their exact instant.

#### Scenario: Date compatibility boundaries
- **WHEN** visibility is evaluated around a legacy date and an offset-aware timestamp
- **THEN** the following results apply

##### Example: Taipei visibility cases
| Source value | Evaluation instant | Visible |
| --- | --- | --- |
| `2026-10-15` | `2026-10-14T15:59:59Z` | no |
| `2026-10-15` | `2026-10-14T16:00:00Z` | yes |
| `2026-10-15T09:00:00+08:00` | `2026-10-15T00:59:59Z` | no |
| `2026-10-15T09:00:00+08:00` | `2026-10-15T01:00:00Z` | yes |

### Requirement: Shared public visibility predicate
Article routes, catalog, series, topics, RSS, search, and navigation SHALL use the same publication-time-aware visibility rule, and undated published content SHALL retain its approved backward-compatible behavior.

#### Scenario: Future timed article across surfaces
- **WHEN** a published article timestamp is still in the future
- **THEN** it has no public route and appears in none of the catalog, series, topic, RSS, search, or navigation outputs

### Requirement: Deployment-lag disclosure
The Admin SHALL state that public appearance occurs only after the due instant and a subsequent successful static deployment.

#### Scenario: Due but not rebuilt
- **WHEN** the schedule instant has passed but no successful post-instant deployment exists
- **THEN** the CMS reports the schedule as due and deployment as pending rather than publicly available
