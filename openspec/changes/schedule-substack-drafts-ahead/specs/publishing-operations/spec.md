## MODIFIED Requirements

### Requirement: Explicit publication operations

Prepare, publish, verify, retry, draft synchronization and newsletter intent SHALL be explicit operations naming target and policy. A Git save alone SHALL NOT grant provider-write authority. Only a separately qualified and activated standing unattended-draft-sync-v1 policy SHALL permit ordinary rounds to create or update eligible unscheduled never-published drafts. That authority SHALL NOT include schedule operations, publication, public corrections, email or App delivery. Foreground schedule and first-delivery operations SHALL retain their exact current source/identity/time/reservation/version/audience scope and readback requirements.

The scheduled-delivery policy SHALL additionally distinguish draft preparation, schedule arming, source revision reconciliation, postponement and cancellation. Saving Git content SHALL record a requested or outdated disposition without implicitly invoking an external provider write. Arming SHALL require an exact confirmed source/time/audience/delivery commitment; legacy Pages-first approvals SHALL NOT authorize scheduled email or App delivery.

#### Scenario: Save article only

- **GIVEN** no unattended draft activation exists
- **WHEN** the owner commits an article from the Editor
- **THEN** no Substack publication, email, newsletter or draft write starts automatically

#### Scenario: Explicit standing draft authority

- **GIVEN** an owner-selected qualified Computer Use integration and matching activated draft policy exist
- **WHEN** an ordinary round synchronizes an eligible source
- **THEN** one full unpublished unscheduled draft is saved under that authority without publication or subscriber delivery

#### Scenario: Draft authority does not arm or revise

- **GIVEN** a worker has draft authority and an article is scheduled or already public
- **WHEN** its source changes or its estimated time becomes due
- **THEN** it requests foreground action without editing, cancelling, rearming, republishing or sending

#### Scenario: Old foreground review becomes stale

- **GIVEN** a previous schedule approval has a different source or current queue version
- **WHEN** a foreground mutation is requested after draft synchronization
- **THEN** the old approval is rejected under the existing exact-scope checks

#### Scenario: Source save never arms or delivers
- **GIVEN** an article is edited in the source repository
- **WHEN** the owner commits it from the Editor
- **THEN** no Substack publication, schedule mutation, email or App delivery operation starts automatically

#### Scenario: Old approval is presented to the new policy
- **GIVEN** an approval covers only Pages-first website publication without delivery
- **WHEN** scheduled email and App publication is requested
- **THEN** the operation is rejected before provider writes

#### Scenario: Exact scheduled commitment is authorized
- **GIVEN** finalized content, a confirmed future slot and an explicit first-email/App delivery commitment
- **WHEN** the foreground controller arms the matching draft
- **THEN** only that article, version, audience and time are authorized, independently of original-site availability

### Requirement: Newsletter idempotency boundary

Newsletter and App delivery SHALL be explicit irreversible intent tied to the first authorized provider publication of the original article. An armed scheduled-publication commitment SHALL authorize that first provider-controlled delivery even when Pages fails. Ordinary source edits, verification, revision reconciliation, postponement, cancellation and retry SHALL NOT authorize an additional delivery. Previously published website-only articles SHALL NOT receive delivery backfill merely because the new policy is enabled. Provider submission, reported delivery and individual human receipt SHALL remain distinct evidence.

#### Scenario: Retry verified article update
- **GIVEN** a publication has already initiated its authorized delivery
- **WHEN** an article update or retry is requested
- **THEN** only the original article is updated or verified and no additional email or App notification is initiated

#### Scenario: Existing website-only article remains quiet
- **GIVEN** a prior article was published with delivery disabled
- **WHEN** the new scheduled-delivery policy is enabled
- **THEN** that article is not re-published or sent retroactively

#### Scenario: Delivery outcome is unknown
- **GIVEN** a first scheduled publication has occurred and delivery acknowledgement is unavailable
- **WHEN** the verifier revisits the article
- **THEN** it retains unknown delivery evidence without sending again or claiming individual receipt

### Requirement: Substack mirrors preserve the source slug

Every Substack mirror SHALL use exactly the slug of its authoritative Git original, with public URL shaped as `https://gcakedev.substack.com/p/<source-slug>`. Under the scheduled-delivery policy the Git original SHALL be finalized and revision-pinned without requiring a public Pages route. Under the legacy policy Pages verification SHALL remain required. The publication workflow SHALL set and persist the source slug on the existing draft before first publication and SHALL NOT derive another slug from the title, accept a platform substitute or append a collision suffix. The platform canonical SHALL identify that exact Substack URL. Complete public evidence SHALL match the armed source version and confirmed publication minute before public verification is recorded; original-site availability SHALL be reported independently.

After a verified foreground content correction, complete public evidence SHALL match that corrected authoritative source version at the original publication minute; the initial armed version and delivery history SHALL remain separately preserved.

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
