## Purpose

Prepare finalized Git articles ahead of public Pages availability and let Substack publish them at confirmed times with first-publication email and App delivery. Preserve one remote identity and reconcile revisions, postponements and cancellations without replaying uncertain writes.

## ADDED Requirements

### Requirement: Finalized immutable source before public availability

The scheduled workflow SHALL prepare only finalized, portable Markdown from one immutable main snapshot. It SHALL retain the original-site canonical link and exact source slug without requiring the original page to be public. Incomplete series, missing assets, duplicate slugs and unfinalized sources SHALL block preparation. Public media required by the mirror SHALL be readable before arming a schedule. Draft preparation SHALL NOT make the source public or send a notification.

#### Scenario: Original is not yet public
- **GIVEN** a finalized eligible article with complete public media and no public Pages route
- **WHEN** foreground preparation is authorized
- **THEN** one unpublished Substack draft contains the complete approved content, original-site link and identical slug without sending email or App notifications

#### Scenario: Source cannot form a complete mirror
- **GIVEN** an unfinalized article, incomplete series, duplicate slug, unsupported source or unavailable required image
- **WHEN** preparation is evaluated
- **THEN** it reports the specific blocker before creating or changing a provider draft

### Requirement: Confirmed time and first-delivery commitment

The workflow SHALL arm provider publication only for an explicitly confirmed future original-site slot expressed in Asia/Taipei with its UTC equivalent. An estimated queue date SHALL NOT authorize publication. The scheduled instant SHALL be strictly after the operation time and within the provider's supported three-calendar-month horizon. Arming SHALL bind one source version, article identity, slug, confirmed slot, intended subscriber audience and enabled email/App inbox delivery. Substack SHALL be permitted to publish and initiate first delivery independently of Pages success. Repeated processing SHALL NOT create another publication or delivery commitment.

#### Scenario: Provider schedule is armed
- **GIVEN** a saved matching draft and a confirmed original-site slot of 2026-10-22 07:00 Asia/Taipei
- **WHEN** foreground scheduling confirms the saved time, subscriber audience and enabled email/App delivery
- **THEN** the same draft is scheduled for 2026-10-21T23:00:00Z and the result is reported as scheduled rather than publicly verified

#### Scenario: Date is estimated or unsupported
- **GIVEN** only an estimated queue date, a due or past instant, a time outside the supported horizon, or an ambiguous device timezone
- **WHEN** scheduling is requested
- **THEN** it remains an unpublished draft with an actionable reason and does not fall back to immediate publication

#### Scenario: Original deployment fails at the due instant
- **GIVEN** an armed Substack schedule with email and App delivery enabled
- **WHEN** its due instant arrives while the original site fails to deploy
- **THEN** Substack is allowed to publish and initiate delivery while original-site failure is reported separately without rearming or resending

### Requirement: Persistent identity and saved slug parity

Preparation and every schedule operation SHALL retain one original remote article identity per tracked source. Full discovery SHALL cover published, draft and scheduled articles before creation when no identity is known. The saved draft slug and eventual public canonical SHALL equal the source slug. Conflicts SHALL block rather than generate another slug or article. An existing published article SHALL never be treated as a new subscriber-delivery candidate.

#### Scenario: Duplicate processing or restart
- **GIVEN** a previously saved or scheduled article identity
- **WHEN** the same source and schedule are processed again after restart
- **THEN** the workflow reads that same article and does not create, publish or schedule a duplicate

#### Scenario: Wrong or occupied slug
- **GIVEN** the provider rewrites the requested slug or another article occupies it
- **WHEN** the saved draft or public canonical is checked
- **THEN** the workflow preserves the known identity and reports a conflict without arming publication or selecting a substitute slug

#### Scenario: Previously published mirror is adopted
- **GIVEN** a public mirror from the prior website-only policy
- **WHEN** the new policy is enabled
- **THEN** it retains its original identity and delivery history and receives no retrospective email, App notification or new publication

### Requirement: Revision changes disarm before replacement

A changed finalized source SHALL mark the saved or armed version as outdated without silently claiming the new version is synchronized. A foreground revision operation SHALL first confirm the article is still unpublished, remove and read back the old schedule, update the same draft and slug, verify the saved complete content, and rearm only against the current confirmed slot and delivery commitment. Removal of finalized eligibility, source deletion or a source-slug rename SHALL stop automatic rearming and require cancellation or explicit same-identity reconciliation. Once publication or delivery has started, corrections SHALL be website/App content updates only, without another email or notification intent.

Foreground reconciliation SHALL complete the applicable compare, edit and readback workflow rather than stop after recording an outdated marker. Published content differences SHALL be corrected on the same public article through the source-authoritative content synchronization requirement.

#### Scenario: Armed article content changes
- **GIVEN** version A is armed and finalized version B becomes authoritative before publication
- **WHEN** foreground revision reconciliation completes
- **THEN** the old schedule is confirmed removed before the same draft is changed, and only the verified version B is rearmed for the current confirmed slot

#### Scenario: Source changes while no foreground controller is available
- **GIVEN** version A remains armed and source version B, source deletion or a return to draft is observed
- **WHEN** background observation detects the change
- **THEN** it reports the outstanding provider schedule and required foreground action without claiming the provider was updated or cancelled

#### Scenario: Slug changes after preparation
- **GIVEN** a tracked article receives a new source slug
- **WHEN** reconciliation evaluates it
- **THEN** it preserves the old article identity and blocks creation under the new slug until explicit same-identity mapping and slug-conflict checks succeed

#### Scenario: Publication wins the revision race
- **GIVEN** a revision operation begins near the due instant
- **WHEN** provider observation shows the article is already published or delivery has begun
- **THEN** it switches to reconciliation and reports that the prior version could already have been delivered, without creating another article or issuing another delivery

### Requirement: Postponement and cancellation preserve identity

A postponement SHALL first confirm removal of the previous schedule, then apply only a newly confirmed future slot to the same unpublished draft. Cancellation SHALL remove the schedule and retain the draft and identity; it SHALL NOT delete, unpublish or recall sent messages. A local request, pause or source save SHALL NOT be reported as a completed provider change without readback. Cancelling a schedule after publication has begun SHALL return a too-late or uncertain result and preserve publication and delivery evidence.

#### Scenario: Postponement succeeds
- **GIVEN** the same article is scheduled for 2026-10-22 07:00 Asia/Taipei and a replacement slot of 2026-10-26 07:00 is confirmed
- **WHEN** foreground postponement reads back removal of the old time and persistence of the replacement
- **THEN** only the replacement schedule remains armed on the original draft with its saved content and delivery settings unchanged

#### Scenario: Cancellation succeeds
- **GIVEN** an unpublished scheduled article
- **WHEN** foreground cancellation confirms it is no longer scheduled and remains a draft
- **THEN** the result is cancelled with the draft identity retained and no publication or delivery initiated by cancellation

#### Scenario: Cancellation races with publication
- **GIVEN** a cancellation request at or after the provider begins publication
- **WHEN** the result is already published, sending or unknown
- **THEN** the workflow does not claim successful cancellation or recall, and does not delete, republish or resend

### Requirement: Unknown outcomes are reconciled without replay

Every create, draft mutation, schedule arm, schedule removal and reschedule operation SHALL persist its exact intended identity, source version, time and delivery scope before dispatch and serialize against other writers. Timeout, lost acknowledgement, login failure or ambiguous controls SHALL preserve the intent and require read-only reconciliation. An uncertain schedule SHALL NOT be overwritten or replaced merely because its local lock is old. If no article identity is known after an uncertain create, complete discovery SHALL resolve it before another create is permitted.

Same-ID public content corrections SHALL use the same persisted-intent and serialization boundary, with no new publication or delivery authority.

#### Scenario: Schedule acknowledgement is lost
- **GIVEN** a provider schedule request whose response was lost
- **WHEN** the operation resumes
- **THEN** it observes the original draft or public article and reconciles the saved time and delivery configuration without repeating the schedule or publication request

#### Scenario: Old schedule removal is not confirmed
- **GIVEN** a revision or delay request with uncertain removal of the old schedule
- **WHEN** processing evaluates its next action
- **THEN** it does not update the draft or arm another schedule and reports that the old schedule could still publish

#### Scenario: Two operations compete
- **GIVEN** a schedule change owns the article operation lock
- **WHEN** another create, revision, postpone or cancel operation is requested for that article
- **THEN** the competing operation performs no provider write and cannot take over the active or unresolved operation

### Requirement: Separate publication and delivery evidence

Saved draft, armed schedule, public article verification, Pages availability and subscriber-delivery evidence SHALL be reported separately. Anonymous public verification SHALL match the original identity, exact slug/canonical, pinned full content, original-site link and media, and SHALL retain the confirmed schedule and actual publication timestamp with their signed difference. A time difference alone SHALL NOT be classified as an identity/content failure. A Pages outage SHALL not prevent Substack-only verification. Public HTML or enabled delivery settings SHALL NOT prove that a subscriber received email or a device notification. Missing provider delivery evidence SHALL remain unknown and SHALL NOT trigger a resend. A later source publication time SHALL NOT rewrite the already delivered Substack date merely to hide cross-platform drift.

Initial publication verification SHALL compare against the armed source version. After a verified foreground content correction, subsequent public verification SHALL compare against the corrected source version while preserving the first-publication version, original minute and delivery history. A corrected website or App article SHALL NOT be reported as a correction to previously delivered email.

#### Scenario: Public correction is observed after the first delivery
- **GIVEN** first-publication version A was delivered and a foreground correction to version B was verified on the same article
- **WHEN** a later public verification reads matching version B
- **THEN** current public content remains verified for B, the first delivery retains version A, and no email correction or resend is claimed

#### Scenario: Public content verifies while Pages is unavailable
- **GIVEN** the original Substack article matches its armed content and slug with a valid actual publication timestamp while Pages is unavailable
- **WHEN** anonymous verification completes
- **THEN** Substack is reported verified and Pages remains unavailable, with no claim that both sites completed

#### Scenario: Public article is correct but delivery evidence is absent
- **GIVEN** an article is publicly verified with delivery enabled at scheduling time
- **WHEN** no provider delivery result is available
- **THEN** delivery remains unknown rather than received, and the workflow does not send again

#### Scenario: Content or actual publication evidence is invalid
- **GIVEN** public content, identity or canonical differs from the armed commitment, or the actual publication timestamp is unavailable
- **WHEN** verification runs
- **THEN** it reports the mismatch on the original article without re-publication, date repair or subscriber redelivery

#### Scenario: Actual publication differs from the confirmed schedule
- **GIVEN** the original ID, slug, canonical and armed full content match, with a confirmed 07:00 schedule and actual 07:01:02.155 publication
- **WHEN** anonymous verification runs after publication
- **THEN** it records verified publication with both times and a 62.155 second delay, preserves the original commitment and delivery history, and neither edits the date nor sends subscribers again

### Requirement: Source-authoritative content comparison and editing

The authoritative content SHALL be the latest saved, eligible Git source, not unsaved Editor text or a Substack-only edit. Foreground synchronization SHALL compare the actual persisted Substack draft or public article against one fixed source version, expose content differences, edit that same remote article when differences exist, and reload and verify the complete saved result before reporting content synchronized. Comparison SHALL cover title, full body including meaningful headings, lists, quotes and code, original-site link, other links, images and alternative text, plus explicitly mapped source-owned metadata. Only approved rendering normalization SHALL be ignored; source-owned text, structure, links or image differences SHALL NOT be hidden. Publication time, schedule and delivery settings SHALL retain their separate approved policy.

An unscheduled draft SHALL be updated and remain unpublished. An armed draft SHALL use the confirmed disarm, update and rearm sequence. An already published article SHALL be updated in place without unpublishing, recreating, scheduling another publication, resending email or triggering another App notification. The original remote ID and source-slug rule SHALL be preserved. A remote-only edit SHALL be shown as divergence and reconciled to Git under the authorized foreground synchronization scope, not copied back to the source. Equal normalized content SHALL perform no provider mutation. Both the source version and current remote content SHALL be rechecked before applying edits; a changed source, changed remote observation, unknown save or incomplete readback SHALL prevent a current-synchronized result until reconciliation succeeds.

#### Scenario: An existing unscheduled draft is updated
- **GIVEN** saved eligible source version B differs from its existing unscheduled Substack draft
- **WHEN** authorized foreground synchronization compares and edits the draft
- **THEN** the same draft contains verified version B with matching title, complete body, links and images, remains unpublished, and sends no notification

#### Scenario: An armed draft is updated rather than only marked stale
- **GIVEN** source version B differs from version A on an armed Substack draft and its future slot remains confirmed
- **WHEN** foreground synchronization processes the difference
- **THEN** the old schedule is confirmed removed, the same draft is edited and reloaded to verify version B, and the original first-delivery commitment is rearmed only after full content checks pass

#### Scenario: A public article is updated after its original changes
- **GIVEN** a saved original article has revised title, paragraphs, links or image alternative text after its Substack mirror was published
- **WHEN** authorized foreground synchronization compares the actual public content and applies the changes
- **THEN** anonymous readback verifies the new content on the same public ID and matching slug while its publication minute and delivery history remain unchanged and no second email or App notification is initiated

#### Scenario: Content already matches
- **GIVEN** actual persisted remote content matches the current source after approved rendering normalization
- **WHEN** foreground synchronization compares the article
- **THEN** it reports content verified without saving, disarming, rescheduling, republishing or sending anything

#### Scenario: Remote-only edits diverge from the source
- **GIVEN** Substack content differs from Git even though the saved source version has not changed
- **WHEN** authorized foreground synchronization reads and compares the actual article
- **THEN** it exposes the difference and restores the same remote article to the authoritative Git content with verified readback, without overwriting Git or issuing another delivery

#### Scenario: Source changes during synchronization
- **GIVEN** foreground synchronization begins from source B and source C becomes authoritative before the operation completes
- **WHEN** current-source checking observes C
- **THEN** it does not claim current synchronization for B or rearm B as current, retains the original article identity and reports the outstanding C reconciliation

#### Scenario: Remote content changes after comparison
- **GIVEN** a content difference was computed from a saved remote observation and the remote article changes before the planned edit
- **WHEN** the foreground controller checks the current remote content
- **THEN** it invalidates the old comparison and requires a fresh comparison without applying an edit based on the stale observation

#### Scenario: Saved content cannot be verified
- **GIVEN** a same-ID content edit times out, fails to persist, loses part of the body or changes a link or image unexpectedly
- **WHEN** readback cannot verify complete agreement with the pinned source
- **THEN** the article remains pending or uncertain on its original ID, any unconfirmed rearm stays blocked, and no replacement article or repeat delivery is initiated
