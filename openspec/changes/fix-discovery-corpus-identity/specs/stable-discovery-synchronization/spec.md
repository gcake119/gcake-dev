## Purpose

Keep article discovery identity stable across equivalent rebuilds while preserving revision and visibility invalidation. Improve scheduled synchronization through bounded resumable work without weakening free-only admission or complete provider verification.

## ADDED Requirements

### Requirement: Stable search content identity
The discovery builder SHALL derive the search content identity from a deterministic, versioned projection of all eligible articles, source identities and article revisions, reader-visible search metadata and links, passage evidence, terminology, connections and retrieval-affecting configuration. It SHALL retain build provenance and source integrity evidence separately. Build timestamps, restoration timestamps and unrelated source-tree changes alone SHALL NOT change the search identity. Publication time SHALL still determine eligibility. Asset integrity verification SHALL remain mandatory even when search identities match.

#### Scenario: Equivalent completed snapshot restoration
- **GIVEN** the same verified completed snapshot, pinned source manifest, eligible articles and retrieval configuration
- **WHEN** the snapshot is restored and discovery rebuilt at two different times without crossing an eligibility boundary
- **THEN** search identities and searchable results match, build provenance remains inspectable, and no duplicate article or citation appears

#### Scenario: Unrelated deployment rebuild
- **GIVEN** only the build source tree or restoration timestamp changes while all effective search inputs remain equal
- **WHEN** the rebuilt public release becomes available
- **THEN** an already synchronized index requires no embedding, vector mutation or active-version update, and unfinished synchronization preserves confirmed progress and pending results

#### Scenario: Invalid source or asset integrity
- **GIVEN** a snapshot fails its pinned-source verification or a downloaded asset differs from its published integrity descriptor
- **WHEN** discovery preparation or synchronization validates the release
- **THEN** the invalid release is rejected without enrichment or promotion, even if its declared search identity matches a known release

#### Scenario: Provenance changes during asset download
- **GIVEN** two builds have equal search identity but different provenance-bearing asset digests
- **WHEN** a release changes its asset descriptors during a source read
- **THEN** the mixed read is rejected and no unverified result is promoted

### Requirement: Effective source changes invalidate identity
The discovery builder SHALL change search identity for effective article revisions, source identity, public membership, publication metadata, reader-visible retrieval metadata, reading or canonical links, aliases, passage evidence, terminology, connections and extraction or retrieval configuration changes. Semantic retrieval SHALL NOT represent a previous incompatible release as current. Withdrawn content SHALL NOT reappear through rollback.

#### Scenario: One effective input changes
- **GIVEN** a verified public release
- **WHEN** one effective input changes and a new release is prepared
- **THEN** the new search identity differs and its results reflect the new input rather than stale data

##### Example: Isolated changes
| Only changed input | Expected result |
| --- | --- |
| Article body revision | New identity and revised passage evidence |
| Article title or description | New identity and revised result text |
| Reading URL or canonical ownership | New identity and correct replacement links |
| Public date, topics, series or supported alias | New identity and revised search metadata |
| Extraction or retrieval configuration | New identity and compatible rebuilt evidence |
| Reordering keys or an unordered membership list | Equal identity and equal ordered retrieval output |

#### Scenario: Publication eligibility boundary
- **GIVEN** a future article remains excluded in two consecutive builds
- **WHEN** a later build crosses its confirmed public eligibility time
- **THEN** the first two search identities match and the later identity differs with the newly public article included

#### Scenario: Withdrawal with equal remaining passage text
- **GIVEN** a previously public article becomes a draft, is withdrawn or is deleted while remaining articles are unchanged
- **WHEN** the removal release succeeds
- **THEN** identity changes, current keyword results exclude that article, and incompatible semantic results cannot restore it

#### Scenario: No eligible passages
- **GIVEN** the public release has no eligible passages
- **WHEN** synchronization evaluates that release
- **THEN** it performs no embedding or promotion of an old release and the empty current keyword results remain available with an explicit synchronization reason

### Requirement: Bounded verified continuation
The hosted synchronizer SHALL retain the existing one-minute schedule and batches of at most sixteen passages. One execution SHALL verify at most one existing pending batch and prepare or upload at most one subsequent batch, subject to remaining execution time and atomically reserved resource budgets. Newly uploaded output SHALL await a subsequent execution for readback. The synchronizer SHALL NOT poll in a loop or claim latency or cost savings from theoretical scheduling counts alone. Every current passage SHALL receive complete provider verification before conditional promotion after a fresh public-source and operator-policy check.

#### Scenario: A readable batch permits immediate continuation
- **GIVEN** sixteen saved passages are completely readable and another batch remains with sufficient time and reserved resources
- **WHEN** the scheduled execution verifies the saved batch
- **THEN** it persists confirmed progress and prepares at most the next sixteen passages in that execution without repeating previous inference or waiting solely for another schedule tick

#### Scenario: Provider visibility remains incomplete
- **GIVEN** one saved vector is missing or differs in values, revision or namespace
- **WHEN** the next scheduled execution reads the batch
- **THEN** it reports awaiting verification without advancing confirmed progress, starting another batch or promoting the release

#### Scenario: Remaining execution budget is insufficient
- **GIVEN** a batch has just passed complete readback but insufficient time or shared resources remain for further work
- **WHEN** the execution reaches the continuation decision
- **THEN** it saves verified progress and exits without additional inference or upload, and the next execution resumes from that progress

#### Scenario: Final partial batch completes
- **GIVEN** a release contains seventeen passages with sixteen already verified and the final saved passage is fully readable
- **WHEN** a scheduled execution verifies the last passage and confirms the current public release and operator policy with sufficient budget
- **THEN** only that complete current release is promoted and the next execution reports no change without embedding or vector mutation

#### Scenario: Source changes before promotion
- **GIVEN** all prepared passages passed readback
- **WHEN** the final public-source check reports a different release or cannot be completed
- **THEN** no promotion occurs and current keyword results remain available

### Requirement: Durable safe resumption and free-only admission
The synchronizer SHALL preserve one durable lease, shared atomic worst-case reservations across readers and synchronization, saved-output resumption, zero paid overage and the existing evidence expiry and operator switches. Unknown inference outcomes SHALL retain their reservation and SHALL NOT be automatically replayed. A changed target with pending work SHALL stop for reconciliation without discarding pending work. A stale owner SHALL NOT advance progress or promote a release.

#### Scenario: Same-content rebuild during pending work
- **GIVEN** a saved output batch is awaiting readback and the public site is rebuilt with only provenance changes
- **WHEN** synchronization resumes
- **THEN** the target remains equal and the saved batch is reconciled without resetting confirmed progress or repeating inference

#### Scenario: Real target change while output is pending
- **GIVEN** saved or unresolved inference output belongs to an earlier public release
- **WHEN** a genuinely different public release is observed
- **THEN** synchronization reports the source conflict, preserves pending output and reservations, and does not upload or promote the old output as the new release

#### Scenario: Real target change without pending work
- **GIVEN** a genuinely new public release and no unresolved pending work
- **WHEN** an eligible scheduled execution obtains ownership and validates the source
- **THEN** it starts progress for the new target and reuses only fully proven compatible vectors without treating earlier progress as verification of the new target

#### Scenario: Concurrent execution and interrupted owner
- **GIVEN** a scheduled execution owns synchronization
- **WHEN** a second execution arrives or the first owner loses its lease before a state transition
- **THEN** the contender cannot duplicate work under the active lease, the stale owner cannot advance or promote, and later recovery retains already committed progress and reservations

#### Scenario: Inference completion is unknown
- **GIVEN** an inference reservation was committed but no confirmed output was saved before interruption
- **WHEN** another scheduled execution resumes
- **THEN** it reports unknown inference, retains the consumed reservation and performs no automatic inference replay or promotion

#### Scenario: Saved output upload fails temporarily
- **GIVEN** confirmed compatible model output was durably saved before a provider upload error
- **WHEN** later scheduled executions resume the same public target
- **THEN** they reuse the saved output for idempotent upload and full readback without requesting the embedding again

#### Scenario: Shared quota competition
- **GIVEN** a reader request and index continuation compete for the last available shared allocation
- **WHEN** both attempt atomic worst-case reservation
- **THEN** total admitted costs never exceed the available allocation, denied work performs no uncovered provider operation, and no paid fallback or quota refill occurs

#### Scenario: Policy evidence expires or operator disables service
- **GIVEN** synchronization has made partial progress
- **WHEN** evidence expires or the operator disables synchronization or semantic service
- **THEN** no further uncovered inference, upload or promotion occurs, progress and consumed reservations remain inspectable, and current keyword search remains available without automatic evidence renewal

### Requirement: Capacity-safe legacy identity transition
The first release using stable content identity SHALL treat legacy search identities as distinct until compatibility and complete provider readback are proven. Capacity admission SHALL include existing, preparing, pending, retained and other account usage. Unknown capacity SHALL block preparation. The transition SHALL NOT assume two complete corpus copies fit free capacity, relabel an unverified index as current, delete unowned vectors or restore withdrawn content.

#### Scenario: Compatible legacy vectors fit verified capacity
- **GIVEN** a new stable identity, compatible owned legacy vectors and verified capacity for the actual provider transition semantics
- **WHEN** scheduled synchronization migrates using the existing lease and admission boundaries
- **THEN** compatible vector values are reused without embedding, every current vector is read back with its required identity and metadata, and only then is the new release eligible for promotion

#### Scenario: Capacity is insufficient or unknown
- **GIVEN** the existing and preparing vectors plus all other counted usage exceed the permitted free capacity or that usage cannot be established
- **WHEN** a legacy transition or new batch is evaluated
- **THEN** synchronization reports the capacity prerequisite without copying a full corpus, deleting unknown data, upgrading the plan or promoting incomplete data

#### Scenario: Unknown vector ownership
- **GIVEN** a provider vector lacks matching ownership and compatibility evidence
- **WHEN** synchronization attempts reuse or cleanup
- **THEN** it stops that operation without overwriting or deleting the unknown vector and reports the unmet prerequisite

### Requirement: Separate local and unattended acceptance evidence
Acceptance SHALL distinguish local behavior tests, actual provider verification, natural scheduled end-to-end synchronization and human search review. Efficiency comparison SHALL use equal source input, batch limits, provider visibility timing and resource policy, reporting execution counts, elapsed time and resource reservations separately from actual billing. Historical missing RED and first naturally changed-article acceptance SHALL remain uncompleted until their own evidence requirements are satisfied.

#### Scenario: Equal-input local efficiency comparison
- **GIVEN** original and candidate workflows use the same passages, sixteen-passage batches, clock and provider visibility sequence
- **WHEN** their local acceptance comparison runs
- **THEN** the candidate eliminates the mandatory idle tick after successful readback within available budgets while preserving full verification, bounded work and all admission failures, with measured counts reported as local evidence only

#### Scenario: Naturally new article completes without intervention
- **GIVEN** separately authorized implementation, deployment and acceptance with current free-only evidence and a genuinely new public article
- **WHEN** only hosted scheduled executions prepare, read back and promote that release
- **THEN** evidence links the public manifest, reservations, all batch receipts, complete provider readback, final source check, promotion and later no-change receipts, followed by separately authorized real search and human review results

#### Scenario: Foreground assistance or missing evidence
- **GIVEN** an operator fills passages, manually synchronizes or changes the active release, or the complete scheduled chain is unavailable
- **WHEN** final search recovery is recorded
- **THEN** the result is classified as mixed or incomplete evidence and does not close first fully natural changed-article acceptance or historical RED provenance

### Requirement: Complete local gate without weakened authority checks
The local verification gate SHALL check retained historical scripts with valid types and SHALL recover the isolated Hermes controller within its existing ten-second acceptance deadline. Authority validation SHALL inspect every required node's permissions and ACLs inside a bounded native child, SHALL NOT cache safety across validation calls, and SHALL reject any unsafe or changed node, incomplete inspection or timed-out child. Batching inspection SHALL NOT weaken the existing denied rights or root-user exception.

#### Scenario: Retained evaluation scripts are type checked
- **GIVEN** historical evaluation scripts remain in the local workspace
- **WHEN** the unchanged complete type-check command runs
- **THEN** those scripts remain present and type check without suppression or broader exclusions

#### Scenario: Recovery under bounded inspection startup overhead
- **GIVEN** an isolated controller crashed after replacing a slot and each ACL inspection process has a controlled additional startup delay of 150 milliseconds
- **WHEN** a fresh controller recovers under the original ten-second deadline
- **THEN** it restores all original slots and selection, preserves history, and completes without weakening authority checks

#### Scenario: A later authority node becomes unsafe
- **GIVEN** authority validation previously passed
- **WHEN** a later required node gains a forbidden write ACL or unsafe permissions
- **THEN** the next validation rejects the authority even if earlier nodes are safe

#### Scenario: Metadata changes before bounded inspection starts
- **GIVEN** initial permission metadata was safe
- **WHEN** a required node becomes writable before the native child inspects it
- **THEN** validation rejects the changed unsafe node instead of accepting an earlier observation

#### Scenario: Batched inspection cannot complete
- **GIVEN** native inspection stalls or returns an incomplete result
- **WHEN** the original inspection deadline is reached or the result is checked
- **THEN** authority validation fails closed and the timed-out child is reaped without any controller promotion


### Requirement: Release-independent verified vector objects
The synchronizer SHALL store vectors in a namespace derived from the approved model configuration, independently of public release identity. It SHALL persist complete provider-verification proofs for passage identity, revision, content, model configuration, namespace and retrieval metadata. An unchanged proof SHALL be reusable across releases without another provider read, embedding or write. Changed or legacy proofs SHALL require complete provider readback. Promotion SHALL require exact current membership, no obsolete owned entries or pending work, and final source and policy guards. During a public/active release mismatch, readers SHALL use current keyword results without a semantic provider call. This requirement supersedes the per-release namespace and per-release full reread clauses of Bounded verified continuation and Capacity-safe legacy identity transition for the new architecture candidate; historical evidence remains unchanged. Task 4.2's separately requested full audit remains mandatory.

#### Scenario: Nineteen additions preserve unchanged objects
- **GIVEN** 2,955 fully verified unchanged passages and nineteen newly public passages
- **WHEN** only the existing hosted schedule completes synchronization
- **THEN** exactly nineteen passages are embedded, uploaded and fully verified, the other 2,955 receive no provider reads or writes, and the new public release is promoted without foreground intervention

#### Scenario: Retrieval metadata changes without new passage text
- **GIVEN** a verified passage whose topics or series changes in the public source
- **WHEN** synchronization evaluates that release
- **THEN** its old metadata proof is not reused and the revised metadata is fully read back before promotion

#### Scenario: Withdrawal or interrupted delta
- **GIVEN** a changed release withdraws an owned passage or an execution stops after a batch was verified
- **WHEN** the next scheduled execution resumes
- **THEN** obsolete owned passages are confirmed absent before promotion, unchanged verified objects are retained, and completed inference is not repeated

#### Scenario: Legacy and foreign ownership
- **GIVEN** old verification records lack release-independent proofs or a provider vector has unproven ownership
- **WHEN** the additive migration and hosted transition are evaluated
- **THEN** old records are preserved for bounded complete verification and foreign vectors are neither overwritten nor deleted

### Requirement: Durable provider visibility and quota scheduling
The hosted synchronizer SHALL persist the provider mutation identifier and next eligible attempt before declaring an upload pending. It SHALL NOT spend vector-read reservations before that mutation is reported processed. A processed mutation still requires full value and metadata readback. Incomplete visibility SHALL retain output and schedule bounded exponential readback intervals from one to thirty minutes; unrelated schedule ticks SHALL perform no vector reads or inference. A quota denial SHALL preserve the job and schedule its next attempt at the next UTC day without replenishing the current window. Evidence expiry, unknown inference, source conflicts and operator switches SHALL continue to block work. The existing hosted schedule SHALL own continuation without chat messages. Limits and zero-paid-overage rules SHALL remain unchanged; application operation counters SHALL NOT be described as official billing dimensions.

#### Scenario: Provider has not processed the upload
- **GIVEN** a saved upload acknowledgement and an unprocessed provider mutation
- **WHEN** repeated hosted schedule ticks arrive
- **THEN** pending output remains durable and no vector read or additional embedding is performed

#### Scenario: Processed but incompletely visible output
- **GIVEN** the provider reports the saved mutation processed but complete readback fails
- **WHEN** schedule ticks occur before and after the persisted eligible time
- **THEN** early ticks do not read vectors and one eligible tick checks the saved output without repeating inference

#### Scenario: Next-day continuation without a conversation
- **GIVEN** a partially completed job has exhausted a shared daily resource while its evidence remains valid
- **WHEN** the existing hosted schedule reaches the next UTC day
- **THEN** the runtime creates the new window once and resumes saved work without a chat command, quota refill or replay of unknown inference
