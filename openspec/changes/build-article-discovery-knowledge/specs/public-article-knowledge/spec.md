## Purpose

Provide one public, revision-bound article corpus for search, terminology, connections, and semantic retrieval while preserving authored sources and publication visibility.

## ADDED Requirements

### Requirement: Public source eligibility and identity
The discovery system SHALL index only articles eligible for public reading in the target site release. It SHALL preserve each article's source identity, canonical ownership, and source revision and SHALL distinguish identical slugs from different sources.

#### Scenario: Local and imported articles share a slug
- **GIVEN** two publicly readable articles from different sources have the same slug
- **WHEN** the public corpus is prepared
- **THEN** both articles remain independently searchable with their correct titles and reading links

#### Scenario: Draft and future article exclusion
- **GIVEN** a draft article and an article scheduled for tomorrow are present in the repository
- **WHEN** today's public release is prepared
- **THEN** neither article's title, passages, terms, nor recommendations appear in public discovery assets or provider uploads

### Requirement: Automatic publication lifecycle
A successful public site release SHALL automatically refresh the corpus, terminology, citations, backlinks, search, and recommendations for added, edited, renamed, withdrawn, and deleted articles. Merely saving or merging source SHALL NOT assert a live update. Semantic features SHALL use the same active public release or visibly fall back to the static release.

#### Scenario: Article becomes public
- **GIVEN** a scheduled article reaches its confirmed publication time and its site release succeeds
- **WHEN** a reader loads the new release
- **THEN** the article is discoverable without a separate editorial indexing action and articles it cites gain the corresponding backlinks

#### Scenario: Public article changes
- **GIVEN** an already public article has revised content and a changed title
- **WHEN** the revised public release succeeds
- **THEN** new searches, excerpts, terms, recommendations, and semantic retrieval use the revised content rather than cached passages from the old release

#### Scenario: Article is withdrawn or deleted
- **GIVEN** an article was previously public
- **WHEN** a public release removing that article succeeds
- **THEN** new searches, recommendations, backlinks, and retrieval results exclude the removed article and the semantic service cannot select an older release to restore it

#### Scenario: Publication fails
- **GIVEN** source has changed but the public site deployment fails
- **WHEN** a reader uses discovery
- **THEN** the service retains the last confirmed public release and does not claim the unpublished revision is live

#### Scenario: Article reading URL changes
- **GIVEN** a public article is renamed and the new release contains its replacement reading URL
- **WHEN** that public release succeeds
- **THEN** search results and generated recommendations use the replacement URL and no generated panel invents a redirect or preserves an obsolete target

### Requirement: Evidence-based terminology
The system SHALL automatically extract ranked terms and explicit synonym or acronym definitions from public article content with supporting passages. Ambiguous or unsupported synonym candidates SHALL NOT automatically become equivalent search terms. Term discovery SHALL NOT modify authored article text or the official topic taxonomy.

#### Scenario: Explicit acronym definition
- **GIVEN** a public article defines Retrieval-Augmented Generation as RAG
- **WHEN** terminology is regenerated
- **THEN** searches for the defined full expression and RAG can retrieve that article and the equivalence has an inspectable supporting passage

#### Scenario: Ambiguous token
- **GIVEN** unrelated public passages use the same short token without defining an equivalence
- **WHEN** terms are extracted
- **THEN** no synonym relationship is asserted solely from token co-occurrence

#### Scenario: No usable terms
- **GIVEN** a public article contains no extractable technical terms
- **WHEN** indexing completes
- **THEN** the article remains searchable by its content without invented keywords

### Requirement: Reproducible passage evidence
Every retrievable passage SHALL identify its article revision and a valid reading location. The same inputs and extraction configuration SHALL yield the same discovery release. Unsupported interactive content SHALL be excluded from passage extraction with an operator-visible diagnostic rather than executed to invent text.

#### Scenario: Click a retrieved passage
- **GIVEN** a result cites a section in a public article
- **WHEN** the reader follows its passage link
- **THEN** the correct article section opens or the article opens when no stable section anchor exists

#### Scenario: Identical source rebuild
- **GIVEN** unchanged public source content and extraction configuration
- **WHEN** discovery assets are regenerated twice
- **THEN** their content identities match and no duplicate article or citation is introduced

### Requirement: Growing source-grounded evaluation
Evaluation data SHALL derive from current public article evidence and grow as eligible articles and explicit definitions become available. Missing categories SHALL be disclosed without invented query slots or fixed quantity, split, panel-count or numerical retrieval-quality release thresholds. Empty samples SHALL report unavailable measurements rather than a pass, failure or fabricated score. Evidence validity, visibility and actual regression handling SHALL remain required.

#### Scenario: Sparse terminology evidence
- **GIVEN** the public corpus provides one explicit bilingual definition and no other supported aliases
- **WHEN** evaluation data is prepared and scored
- **THEN** only supported aliases are included, available category counts are reported, and evaluation is not blocked by a minimum alias count

#### Scenario: New public evidence
- **GIVEN** an additional public article contains an explicit acronym definition
- **WHEN** discovery is rebuilt and evaluation data is regenerated
- **THEN** the new article and supported definition enter the current sample without an editorial task to fill a quota

#### Scenario: No judged public sources
- **GIVEN** no eligible public source supports an evaluation query
- **WHEN** evaluation runs
- **THEN** it reports no judged data and unavailable rates without inventing queries or claiming quality acceptance

#### Scenario: Different article identities share one reading URL
- **GIVEN** two public articles with different identities resolve to the same reading URL after removing query, fragment and trailing slash
- **WHEN** the public corpus is prepared
- **THEN** preparation fails explicitly rather than creating two article results for one reading location; equal slugs with distinct reading URLs remain valid
