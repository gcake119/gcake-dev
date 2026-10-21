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

### Requirement: Useful results and shareable filtering
Results SHALL provide article title, series or independent-article context, query-specific excerpts, safe highlighting, and a valid reading link. Query, topic, series, retrieval mode, and result page SHALL survive URL sharing and browser navigation. Filters SHALL narrow the same public corpus in lexical and semantic modes.

#### Scenario: Share filtered search
- **GIVEN** a reader filters RAG results by a topic and series and opens result page two
- **WHEN** another reader opens the copied URL or the first reader navigates back
- **THEN** the query, filters, mode, and page are restored without displaying results outside the selected filters

#### Scenario: Safe highlighted excerpt
- **GIVEN** a query or article includes HTML-like text
- **WHEN** an excerpt is highlighted
- **THEN** the text is displayed without executing markup or event handlers

### Requirement: Accessible bounded input and recovery
The existing header search SHALL remain the sole keyword input. The search page SHALL provide labelled filters, result count, keyboard-operable navigation, loading, empty, no-result, and retry states. Blank queries SHALL make no provider calls; queries over 200 Unicode code points SHALL be rejected before retrieval. Results SHALL display at most ten articles per page.

#### Scenario: Empty and excessive input
- **GIVEN** the reader submits whitespace or more than 200 code points
- **WHEN** search processes the query
- **THEN** it gives a useful prompt or length message without contacting a model or silently truncating the query

#### Scenario: No matches
- **GIVEN** no public article matches the query under the selected filters
- **WHEN** search completes
- **THEN** it displays the no-result state, offers clearing filters and evidenced vocabulary suggestions, and preserves the original query

#### Scenario: Index request fails
- **GIVEN** loading the static search index fails
- **WHEN** the reader uses retry after connectivity returns
- **THEN** the same query is searched successfully without requiring a new query or losing filters

#### Scenario: JavaScript unavailable
- **GIVEN** JavaScript is disabled
- **WHEN** the search page is opened
- **THEN** it provides working series and topic navigation and explains the search limitation

### Requirement: Explicit semantic search with current-release fallback
Semantic search SHALL require explicit selection before sending the query to the disclosed service. It SHALL merge semantic and lexical article rankings without duplicate articles, enforce the active public release, and retain keyword results on timeout, quota exhaustion, incompatible releases, or service failure. Old responses SHALL NOT overwrite a newer query or mode.

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

### Requirement: Local suggestions and search privacy
Any vocabulary suggestions SHALL derive from the current public corpus, remain keyboard accessible, and make no remote calls while typing. The application SHALL NOT persist raw queries, questions, IP addresses, or reader histories in its own telemetry. Remote modes SHALL disclose query transfer before the first request.

#### Scenario: Type a query before submit
- **GIVEN** the reader types a query without choosing a remote mode
- **WHEN** local suggestions are displayed
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
