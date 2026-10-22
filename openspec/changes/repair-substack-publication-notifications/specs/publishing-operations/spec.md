## MODIFIED Requirements

### Requirement: Substack mirrors preserve the source slug

Every Substack mirror SHALL use exactly the slug of its authoritative Git original, with public URL shaped as `https://gcakedev.substack.com/p/<source-slug>`. Under the scheduled-delivery policy the Git original SHALL be finalized and revision-pinned without requiring a public Pages route. Under the legacy policy Pages verification SHALL remain required. The publication workflow SHALL set and persist the source slug on the existing draft before first publication and SHALL NOT derive another slug from the title, accept a platform substitute or append a collision suffix. The platform canonical SHALL identify that exact Substack URL. Complete public evidence SHALL match the authoritative source content and original article identity before public verification is recorded. Confirmed schedule time and actual public timestamp SHALL be preserved separately with their signed difference; a time difference alone SHALL NOT be classified as an identity mismatch. Original-site availability SHALL be reported independently.

After a verified foreground content correction, complete public evidence SHALL match that corrected authoritative source version at the original actual publication minute; the initial armed version and delivery history SHALL remain separately preserved.

#### Scenario: First publication uses the original slug
- **GIVEN** a finalized original with slug `ithome-2026-astro-choice` and an authorized Substack draft
- **WHEN** the operator prepares and schedules the mirror
- **THEN** the persisted draft slug and eventual public canonical use `ithome-2026-astro-choice`, and the mirror is publicly verified only after complete evidence matches that same article

#### Scenario: Slug cannot be saved or is already occupied
- **GIVEN** the source slug cannot be persisted, is changed by the platform, or belongs to another Substack article
- **WHEN** preparation checks the saved slug
- **THEN** scheduling stops with the existing identity and diagnostics preserved, without creating another article or choosing a substitute slug

#### Scenario: A public mirror has the wrong slug
- **GIVEN** a mirror has matching content but a different public canonical slug from its authoritative source
- **WHEN** public verification evaluates the mirror
- **THEN** it is not accepted as verified even if the old URL redirects successfully

#### Scenario: Existing mirror URL is corrected
- **GIVEN** an existing public mirror has a different slug and no unresolved operation or competing writer
- **WHEN** an authorized foreground operation changes the URL and verifies complete evidence at the source-slug URL
- **THEN** its ID, content, publication minute and delivery history remain unchanged, its durable remote URL records the verified new address, and no article is recreated, republished or redelivered

#### Scenario: Background work encounters a slug mismatch
- **GIVEN** a scheduled mirror requires a slug correction
- **WHEN** background work evaluates the correction
- **THEN** it preserves the original identity and defers the correction to foreground handling without accessing Chrome or mutating the article


#### Scenario: Provider publishes later than the confirmed time
- **GIVEN** the confirmed time is 07:00 and the original article becomes public at 07:01:02.155 with matching identity and complete content
- **WHEN** anonymous verification reads the article
- **THEN** public verification succeeds, both timestamps and a 62.155 second delay are shown, and no publication or subscriber delivery is repeated


#### Scenario: Existing actual publication evidence stays fixed
- **GIVEN** an original article already has a verified actual publication minute from a prior runtime
- **WHEN** a later public read reports a different publication minute
- **THEN** the earlier actual evidence is preserved and a time change is reported independently, rather than treating it as first-publication scheduling delay
