## Purpose

Enable a separately qualified worker to arrange the first Substack publication of finalized Git articles at confirmed original-site times, while preserving existing identities and delivery history.

## ADDED Requirements

### Requirement: Original public identity reconciliation

The system SHALL bind an already-public original only after complete identity, exact slug, canonical and publication-time evidence. It SHALL preserve the original provider ID, public date and existing delivery history and SHALL NOT publish, schedule or send the original again. Under the explicit 2026-10-29 owner correction authorization, foreground work SHALL correct the same public original to the fixed authoritative Git content with resend disabled, preserving before evidence and saving an operation intent before mutation. Complete title, description, body, links and original media readback SHALL be required before declaring content verified. Conflicting identities, incomplete evidence or an unsettled operation SHALL stop further mutation and retain the unresolved evidence.

#### Scenario: Two public originals are adopted
- **GIVEN** two known public originals with complete matching authoritative evidence and no unsettled operation
- **WHEN** the operator reconciles their original IDs
- **THEN** the durable observations identify those exact originals as public, retain delivery history and no provider write or notification occurs

#### Scenario: Explicit same-ID public correction
- **GIVEN** the original identity is confirmed, its content differs and the owner explicitly authorizes correction
- **WHEN** foreground work updates the existing public original
- **THEN** its original ID and publication time remain unchanged, no email or App resend occurs, and complete saved/reloaded content evidence is required before declaring it verified

#### Scenario: Public identity or outcome is uncertain
- **GIVEN** conflicting IDs, missing evidence or an unsettled operation
- **WHEN** reconciliation is attempted
- **THEN** prior commitments and operation evidence remain intact and the uncertainty is reported without replay

### Requirement: Explicit approved native presentation

For the two explicitly authorized originals, the system SHALL accept only the owner-approved labelled table-row list projection bound to that original ID and source revision. Every column name, cell, paragraph, code block, link and original PNG byte identity SHALL remain verifiable. Acceptance SHALL be recorded as presentation_only, not raw HTML equality. Unapproved profiles, different originals or revisions, missing original media, changed labels, content or links SHALL NOT be accepted by that approval.

#### Scenario: Approved labelled lists preserve source
- **GIVEN** an exact original and source revision with the owner-approved labelled-list profile and original PNG hashes
- **WHEN** anonymous full content readback matches that projection and original media
- **THEN** presentation is accepted without republishing, resending or changing the original date

#### Scenario: Actual drift or unrelated approval
- **GIVEN** altered labels, cells, code, links or PNG bytes, or approval for another original or revision
- **WHEN** the public content is checked
- **THEN** the difference remains visible and no provider write or delivery occurs

### Requirement: Confirmed first publication only

A separately authorized, qualified and enabled worker SHALL prepare and arm only finalized eligible main sources with a current explicitly confirmed future original-site slot, within the existing three-calendar-month horizon, in Asia/Taipei, for everyone with email and App inbox enabled. Queue estimates SHALL NOT become commitments. The worker SHALL retain one original ID and complete saved/reloaded slug and content evidence. Already-public, already-armed, cancelled, conflicting, changed or unsettled originals SHALL NOT be republished, rescheduled or resent automatically. Genuine manual holds SHALL remain effective; an adopted public original SHALL resolve only its missing-identity preparation attention. After dispatch uncertainty the worker SHALL retain evidence and require reconciliation rather than replay.

#### Scenario: Future confirmed article is armed once
- **GIVEN** an eligible fixed main article, its confirmed future original-site time and an activated qualified worker
- **WHEN** the ordinary synchronization occurrence runs twice
- **THEN** the first occurrence saves one matching Substack schedule with the same original ID, exact slug, everyone audience and both delivery channels, and the second occurrence performs no further schedule or delivery mutation

#### Scenario: No confirmed future slot
- **GIVEN** a finalized article with an estimated, missing, paused, expired or more-than-three-month slot
- **WHEN** the worker evaluates it
- **THEN** it performs no provider mutation and does not invent a replacement time or publish late

#### Scenario: Source or commitment changes before mutation
- **GIVEN** a prepared first-publication request
- **WHEN** its authoritative source, confirmed slot, worker authority or original identity changes before a provider action
- **THEN** the action stops, the last confirmed commitment remains and no alternate identity or time is selected

#### Scenario: Existing public, armed or unsettled original
- **GIVEN** an original is public, armed, cancelled, genuinely held or has an unresolved operation
- **WHEN** a subsequent occurrence evaluates it
- **THEN** it performs no create, update, arm, remove, republish or resend for that original and preserves the existing evidence

#### Scenario: Missing acknowledgement after creation or arming
- **GIVEN** the provider action was dispatched
- **WHEN** its reply or full reload evidence is missing or invalid
- **THEN** the durable operation and private request are retained for reconciliation and later occurrences do not replay it

### Requirement: Separate activation and real acceptance

The worker SHALL share the existing occurrence and writer serialization, with bounded execution and precise owned-resource cleanup. The anonymous observer SHALL retain zero browser and provider-write authority. Activation SHALL require unexpired owner authorization and matching runtime/config provenance plus actual provider same-ID preparation/arm/removal/rearm readback, correct delivery selection and an unattended executor trial. Local fixtures, an empty eligible queue, historical different-worker receipts and a one-off manual publication SHALL NOT establish this qualification. Actual due-time provider publication and later anonymous verification SHALL be recorded separately; subscriber real receipt SHALL NOT be required. The operator SHALL be able to disable new automatic arming without clearing existing provider schedules or intents.

#### Scenario: Unqualified or disabled worker
- **GIVEN** absent, expired, mismatched or incomplete activation evidence, or a disabled worker
- **WHEN** an ordinary occurrence runs
- **THEN** no automatic first-publication provider access occurs and existing anonymous observation continues

#### Scenario: Empty eligible queue does not qualify activation
- **GIVEN** there is no unpublished eligible original with a confirmed future slot
- **WHEN** local tests and an empty natural round complete
- **THEN** the implementation is recorded separately from pending real acceptance and activation remains disabled

#### Scenario: One worker with cleanup
- **GIVEN** an activated worker in the existing occurrence
- **WHEN** work completes, fails, times out or is interrupted normally
- **THEN** only owned settled temporary data is cleaned, uncertain evidence is retained, no duplicate timer or concurrent writer is created, and existing user tabs remain available
