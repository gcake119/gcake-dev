## Purpose

Help readers find public articles using ranked Chinese-aware text search and optional semantic retrieval while retaining the static site's accessible navigation and privacy boundaries.

## ADDED Requirements

### Requirement: Ranked Chinese-aware lexical search
Keyword search SHALL normalize compatibility forms and case, support Chinese phrases without requiring spaces, preserve technical tokens, and rank exact title or phrase matches ahead of incidental body-only matches. It SHALL apply only evidenced aliases and SHALL NOT require a remote model.

#### Scenario: Title outranks incidental body mention
- **GIVEN** article A has RAG in its title and article B mentions RAG only in its body
- **WHEN** the reader searches for RAG with otherwise equal relevance
- **THEN** A precedes B and both show the matching text

#### Scenario: Natural Chinese query
- **GIVEN** an article discusses automatic publishing
- **WHEN** the reader searches for 自動發文 without inserting spaces
- **THEN** matching content is retrievable and more relevant matches precede incidental partial matches

#### Scenario: Technical punctuation
- **GIVEN** public articles discuss C++, C#, and AI agents
- **WHEN** the reader searches for C++
- **THEN** C++ matches are not treated as equivalent to C# solely because punctuation was removed

### Requirement: Useful results and shareable search
Results SHALL provide article title, series or independent-article context, query-specific excerpts, safe highlighting, and a valid reading link. Query and result page SHALL survive URL sharing and browser navigation. The reader page SHALL NOT expose topic, series, sorting or model-mode selectors. Legacy topic/series/sort parameters SHALL be removed without silently narrowing results; backend filtering contracts remain available for internal callers.

#### Scenario: Share simple search
- **GIVEN** a reader searches RAG and opens result page two
- **WHEN** another reader opens the copied URL or the first reader navigates back
- **THEN** the query and page are restored with no hidden topic or series restrictions

#### Scenario: Safe highlighted excerpt
- **GIVEN** a query or article includes HTML-like text
- **WHEN** an excerpt is highlighted
- **THEN** the text is displayed without executing markup or event handlers

### Requirement: Accessible bounded input and recovery
The existing header search SHALL remain the sole keyword input. The search page SHALL provide result count, keyboard-operable navigation, loading, empty, no-result, and retry states. Blank queries SHALL make no provider calls; queries over 200 Unicode code points SHALL be rejected before retrieval. Results SHALL display at most ten articles per page.

#### Scenario: Empty and excessive input
- **GIVEN** the reader submits whitespace or more than 200 code points
- **WHEN** search processes the query
- **THEN** it gives a useful prompt or length message without contacting a model or silently truncating the query

#### Scenario: No matches
- **GIVEN** no public article matches the query in the public corpus
- **WHEN** search completes
- **THEN** it displays the no-result state, invites another query without displaying vocabulary suggestions, and preserves the original query

#### Scenario: Index request fails
- **GIVEN** loading the static search index fails
- **WHEN** the reader uses retry after connectivity returns
- **THEN** the same query is searched successfully without requiring a new query or losing the query

#### Scenario: JavaScript unavailable
- **GIVEN** JavaScript is disabled
- **WHEN** the search page is opened
- **THEN** it provides working series and topic navigation and explains the search limitation

### Requirement: Explicit semantic search with current-release fallback
Remote semantic search SHALL require explicit authorization and disclosure before sending the query to its service. In the separately authorized local-only preview, submitting the single search form SHALL directly use the installed BGE-M3 endpoint without a model-mode choice; typing SHALL NOT call it. Until separately authorized activation passes account, provider and release verification, the public site SHALL keep its empty endpoint and local keyword search. After that activation, explicit form submission MAY send the query to the isolated BGE-M3 service; typing SHALL make no model calls. It SHALL merge semantic and lexical article rankings without duplicate articles, enforce the active public release, and retain keyword results on timeout, quota exhaustion, incompatible releases, or service failure. Old responses SHALL NOT overwrite a newer query or mode.

#### Scenario: Different wording finds same meaning
- **GIVEN** an active semantic release contains an article about converting repeated manual work into automation
- **WHEN** the reader explicitly searches semantically for 如何減少每天重複操作
- **THEN** relevant articles can be returned even without that exact sentence, with source-derived excerpts

#### Scenario: Service timeout and query race
- **GIVEN** a semantic query is pending and the reader submits a newer keyword query
- **WHEN** the old request completes or times out
- **THEN** only the newer query remains displayed and no stale result replaces it

#### Scenario: Provider release mismatch
- **GIVEN** the browser's site release differs from the semantic service's active release
- **WHEN** semantic search is requested
- **THEN** no passages from a different release are substituted and the page offers keyword results with a clear availability message

### Requirement: Search privacy without vocabulary suggestions
The search page SHALL display article results directly without vocabulary suggestion controls or links. Typing SHALL make no remote calls. The application SHALL NOT persist raw queries, questions, IP addresses, or reader histories in its own telemetry. Remote modes SHALL disclose query transfer before the first request.

#### Scenario: Type a query before submit
- **GIVEN** the reader types a query without choosing a remote mode
- **WHEN** the reader types without submitting
- **THEN** no model request is made and no query history is stored by the application

### Requirement: Bounded semantic execution
Remote semantic search SHALL enforce request-size, query-length, timeout, result-count, per-client throttling, and shared daily request/token budgets before provider execution. Missing budgets or unavailable admission control SHALL disable remote calls. It SHALL return article links and source-derived excerpts without calling a text-generation model or producing an answer.

#### Scenario: Budget exhausted
- **GIVEN** the shared daily semantic request or embedding-token budget is exhausted
- **WHEN** a reader requests semantic search
- **THEN** no new embedding call occurs and keyword results remain available with an availability message

#### Scenario: Semantic retrieval without generation
- **GIVEN** semantic search is enabled and public article vectors are ready
- **WHEN** a reader searches for a concept
- **THEN** the service uses a compatible embedding model, returns ranked existing articles and excerpts, and makes no text-generation call

#### Scenario: Admission unavailable
- **GIVEN** shared budget reservation cannot be confirmed
- **WHEN** a semantic request arrives
- **THEN** the service makes no model call and offers keyword fallback without an automatic retry

### Requirement: Approved model provenance with temporary BGE exception
Semantic retrieval SHALL prefer explicitly approved models with verified non-Chinese developer provenance. While Google's EmbeddingGemma free eligibility remains unverified, the system SHALL permit the user-authorized temporary exception only for the official @cf/baai/bge-m3 model, preserving its actual BAAI provenance rather than describing it as non-Chinese. Other Chinese-developed models, unknown provenance, and unapproved substitutions SHALL remain prohibited. The policy SHALL cover article/query embeddings and optional reranking without censoring authored article text. EmbeddingGemma SHALL remain a deferred replacement until its free eligibility, compatible index and quality are verified.

#### Scenario: Explicit temporary BGE configuration
- **GIVEN** EmbeddingGemma free eligibility remains unverified and the configured model is the official BGE-M3 under the recorded temporary exception
- **WHEN** all free-only and other activation conditions are satisfied and public passages or a reader query require embeddings
- **THEN** the service uses that BGE-M3 configuration and records its actual model provenance without approving other Chinese-developed models

#### Scenario: Prohibited or unidentified fallback
- **GIVEN** the approved model is unavailable and an alternative has unverified developer provenance or Chinese provenance outside the explicitly approved BGE-M3 exception
- **WHEN** the service handles semantic search or article indexing
- **THEN** it makes no call to that alternative and preserves current keyword search instead

#### Scenario: Article mentions a prohibited runtime model
- **GIVEN** a public article discusses BGE or Qwen as a technical subject
- **WHEN** that article is indexed using the approved embedding model
- **THEN** its authored content remains searchable without invoking the models it discusses

### Requirement: Verified embedding billing and quota evidence
Remote semantic activation SHALL require recorded current provider evidence for the exact embedding model's billing units, rates or explicit no-charge terms, applicable free allowance, and account plan, together with authorized usage ceilings. A missing public price, a beta label, or a platform-wide allowance alone SHALL NOT be accepted as proof that this model is free. Unresolved model billing SHALL leave remote calls disabled while deterministic search remains available.

#### Scenario: Model price is absent from public documentation
- **GIVEN** the provider lists the embedding model but omits its rate and model-specific quota treatment
- **WHEN** the operator reviews activation readiness
- **THEN** the delivery records billing as unverified, makes no unsupported free-usage claim, and keeps remote processing disabled

#### Scenario: Model-specific evidence is obtained
- **GIVEN** current official provider evidence identifies the exact model's rate or no-charge terms and applicable allowance for the intended account plan
- **WHEN** the operator authorizes matching usage ceilings and the remaining quality checks pass
- **THEN** activation readiness records the evidence date and exact model configuration without treating research as deployment authorization

#### Scenario: Pricing or model identity changes
- **GIVEN** the service's approved pricing evidence no longer applies to its configured model or provider terms
- **WHEN** remote activation or continued eligibility is checked
- **THEN** the service requires renewed applicable evidence before making further calls and preserves keyword search during the interruption

### Requirement: Free-tier-only operation
The discovery service SHALL permit only operations confirmed to remain inside applicable free allowances, with zero authorized paid overage. This SHALL include article embedding, query embedding, vector storage and queries, and the supporting Worker and admission storage. Initial indexing, tests, retries, staging copies, and other consumers of shared account allowances SHALL count toward admission. Alerts alone SHALL NOT authorize or enforce free-only usage. Unverified free eligibility or remaining allowance SHALL prevent remote execution without changing the account's subscription or enabling paid fallback.

#### Scenario: Free allowance is exhausted
- **GIVEN** the applicable daily or monthly free allowance cannot cover a semantic request
- **WHEN** a reader requests semantic search
- **THEN** no new remote embedding or vector query is made and current keyword search remains usable without paid fallback

#### Scenario: Concurrent requests compete for the final free units
- **GIVEN** the verified remaining free allocation covers one request and two requests arrive concurrently
- **WHEN** admission is evaluated
- **THEN** at most one request reserves and consumes that allocation and the other uses keyword fallback

#### Scenario: Paid account has uncoordinated consumers
- **GIVEN** the account permits paid overage and other consumers can use the same free allowance without coordinated reservations
- **WHEN** remote activation or admission is evaluated
- **THEN** this service remains disabled unless an applicable provider-enforced no-charge boundary is verified, and an application-local counter is not reported as a zero-cost guarantee

#### Scenario: Index preparation exceeds free storage or compute
- **GIVEN** preparing a new article index including retained releases would exceed a free allowance
- **WHEN** publication preparation runs
- **THEN** remote enrichment stops without paid usage, the new static site can still publish current keyword assets, and no old article visibility is restored

#### Scenario: Provider reset has not been confirmed
- **GIVEN** a free allowance was exhausted and neither the provider's reset/current usage nor an applicable verified Workers Free hard-limit renewal policy can be verified
- **WHEN** a reader retries or the local calendar day changes
- **THEN** no local reset fabricates free capacity and keyword search remains available

#### Scenario: Replace temporary BGE only through a compatible release
- **GIVEN** EmbeddingGemma free eligibility and quality are later verified and an existing public index uses BGE-M3
- **WHEN** the replacement embedding release is prepared
- **THEN** article and query embeddings switch together only after the replacement index is complete and release-matched, and no query mixes the two models or vector dimensions


### Requirement: Isolated local embedding comparison
A foreground local evaluation SHALL support the explicitly authorized installed Ollama BGE-M3 and EmbeddingGemma 2 models through loopback-only embedding endpoints. It SHALL pin model digests, use model-appropriate document/query formatting, reject truncation and invalid output, and isolate vectors and caches by model, formatting, dimension and public corpus. Both models SHALL use the same frozen public passages and relevance judgments; retrieval quality and timing SHALL disclose sample, runner, quantization, cache state and limitations without a fixed numerical acceptance gate. The evaluation SHALL NOT change production model policy or enable remote execution, generation, automatic alternative models or downloads.

#### Scenario: Two different embedding spaces
- **GIVEN** installed BGE-M3 and EmbeddingGemma 2 are explicitly authorized for local comparison
- **WHEN** the same public articles and queries are embedded
- **THEN** each model has a separate pinned index and observed dimensions, and no query is compared with another model's vectors

#### Scenario: Model is missing or changed
- **GIVEN** a requested local model is absent or differs from its pinned digest
- **WHEN** local evaluation starts or resumes
- **THEN** it stops with an explicit model identity error and does not download, substitute, call a cloud model or change production settings

#### Scenario: Overlong input or malformed output
- **GIVEN** local embedding input exceeds the model endpoint limit or returned vectors have invalid shape or values
- **WHEN** the endpoint is invoked with truncation disabled
- **THEN** the affected operation fails visibly without storing an incompatible vector or claiming a completed comparison

#### Scenario: Local results remain local evidence
- **GIVEN** both local models complete evaluation on available public source judgments
- **WHEN** results are reported
- **THEN** lexical, dense and hybrid rankings and observed costs in time and local storage are distinguished, while Cloudflare quality, billing, deployment and activation remain unverified and disabled

### Requirement: Foreground local BGE search preview
The existing built search page SHALL support explicitly authorized foreground loopback BGE-M3 preview using compatible cached public passages. Preview-only connection and privacy text SHALL NOT enable public semantic endpoints or cloud models.

#### Scenario: Actual local semantic search in the existing page
- **GIVEN** a compatible current public corpus and pinned installed BGE-M3 index
- **WHEN** the reader submits the sole search form in the local preview
- **THEN** actual local embeddings produce current source-linked hybrid results with shareable query, pagination and browser back behavior, while keyword search and typing make no model calls

#### Scenario: Local inference unavailable and recovered
- **GIVEN** the local semantic service is unavailable or exceeds its deadline
- **WHEN** the reader submits semantic search and later retries after recovery
- **THEN** the page first retains keyword results with a degraded message and then displays actual local semantic results after successful retry

#### Scenario: Incompatible local preview or invalid request
- **GIVEN** a stale corpus, changed model, incompatible cached vectors, nonlocal caller or invalid bounded input
- **WHEN** preview startup or search admission checks the request
- **THEN** the operation fails explicitly without cloud substitution, downloads, incompatible results or generation

#### Scenario: Local preview cleanup
- **GIVEN** this foreground preview owns its listener and loaded BGE-M3 only if it was not already loaded
- **WHEN** it stops, is interrupted or reaches its lifetime limit
- **THEN** it closes its listener and releases only its newly loaded model while retaining cleanup evidence and preserving shared Ollama and pre-existing loaded models

#### Scenario: Legacy filters do not hide articles
- **GIVEN** an old shared search URL includes topic, series or sort parameters
- **WHEN** the reader opens it in the simplified page
- **THEN** the query and page remain, obsolete filters are removed, and results cover all current public articles

### Requirement: Minimal reader search surface
The normal search surface SHALL display the existing header search form, result count and article list without an explanatory paragraph, repeated visible page heading or extra catalog links. Pagination and failure-only retry SHALL remain available when needed; no-JavaScript recovery SHALL remain accessible. Public remote execution SHALL remain disabled until the separately authorized account, provider and release checks pass.

#### Scenario: Search shows only the requested reader content
- **GIVEN** the reader submits a query in the existing header form
- **WHEN** search completes successfully
- **THEN** the result count and source article list appear directly, with no device-processing explanation, vocabulary suggestions, filter controls or repeated page heading

#### Scenario: Release conflict refreshes lexical fallback
- **GIVEN** a search page has an older article corpus and the current release withdraws one article
- **WHEN** semantic search returns a release conflict or the latest manifest changes during a successful response
- **THEN** fallback reloads the current static release and excludes the withdrawn article without automatically retrying a model request

#### Scenario: Current release cannot be loaded after conflict
- **GIVEN** the page detects a release conflict and the current static assets are unavailable
- **WHEN** recovery fails
- **THEN** old article results and pagination are cleared, the query is preserved, and an unavailable message and retry action appear

#### Scenario: New search supersedes release recovery
- **GIVEN** loading current assets after a release conflict is pending
- **WHEN** the reader submits a newer search and the old recovery later completes
- **THEN** only the newer query and its current-source results remain displayed

#### Scenario: Repeated preview runs preserve independent evidence
- **GIVEN** an earlier local preview has saved its start, status and finish receipts
- **WHEN** another foreground preview starts and saves its own receipts
- **THEN** each run exposes a distinct evidence location and the earlier receipts remain unchanged


#### Scenario: Authorized cloud binding is incomplete
- **GIVEN** the operator has authorized cloud activation but the model, atomic admission, verified policy or compatible index is absent
- **WHEN** the public search service receives a query
- **THEN** it makes no model call and the reader retains current keyword results

#### Scenario: Verified cloud release is active
- **GIVEN** the operator has authorized the verified free-only BGE-M3 release and the published privacy policy describes query processing
- **WHEN** the reader submits the existing search form
- **THEN** the cloud service returns source-linked current-release results using only BGE-M3, without adding controls, suggestions or explanatory paragraphs


#### Scenario: Verified free-plan daily renewal
- **GIVEN** the operator has approved the current Workers Free hard-limit evidence, zero paid overage and a conservative daily allocation
- **WHEN** the Cloudflare runtime enters a new UTC provider day
- **THEN** it atomically creates that day's bounded allocation once, never replenishes an existing consumed allocation, and preserves keyword fallback when provider capacity is exhausted or the evidence expires


### Requirement: Privacy-preserving semantic failure identification
Semantic service 503 responses SHALL preserve keyword fallback and retry behavior while exposing only a server-generated random request ID, a fixed stage code and a fixed reason code. Stages SHALL distinguish request input, unavailable configuration, policy storage or eligibility, initial public source, admission, embedding, vector retrieval, ranking and final public source verification. Reasons SHALL distinguish failure, timeout, invalid response and ineligible configuration/policy. Source download timeout and the overall semantic deadline SHALL identify the active stage; late or overlapping requests SHALL NOT change another response's identification. The service SHALL NOT log or persist new diagnostics, echo query text, raw or hashed IP, caller-supplied IDs, credentials, exception messages or stacks in diagnostic responses. Existing short-lived keyed admission accounting SHALL remain unchanged. Existing success, 400, 403, 404, 409, 429, CORS and no-store contracts, BGE-M3, free hard caps, deadlines and production switches SHALL remain unchanged. Diagnostics SHALL cover responses generated by this Worker, not platform failures that occur before it can respond.

#### Scenario: Distinguish dependency failures without leaking input
- **GIVEN** an authorized semantic query and an upstream failure whose message contains query, IP or secret-like text
- **WHEN** policy storage, initial source, admission, embedding, vector retrieval or final source fails
- **THEN** the 503 identifies only that fixed stage, a fixed reason and a fresh request ID, retains keyword fallback, and exposes none of the upstream text or caller identifiers

#### Scenario: Identify timeouts and preserve independence
- **GIVEN** a source download or semantic operation exceeds its existing deadline while another request also fails
- **WHEN** the service returns its failure responses and a late dependency subsequently settles
- **THEN** the timed-out response identifies its active stage with timeout, each request has a distinct ID and correct independent stage, and no late model or vector retry begins

#### Scenario: Preserve keyword recovery with diagnostics
- **GIVEN** the reader has a current public index and the semantic service returns a diagnostic 503
- **WHEN** search completes and the reader later explicitly retries after recovery
- **THEN** current keyword article results and the query remain visible with the existing retry action, no diagnostic details are added to the reader interface, and successful retry replaces them with semantic results

#### Scenario: Preserve free-only boundaries
- **GIVEN** semantic configuration is disabled, policy is ineligible or shared quota is exhausted
- **WHEN** a query is submitted
- **THEN** no model is called, existing rejection status and keyword fallback remain, and diagnostics neither replenish quota nor enable service or persist reader content
