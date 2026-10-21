## Purpose

Automatically connect public articles through factual citations, incoming citations, related topics, and complementary reading without per-article manual selection.

## ADDED Requirements

### Requirement: Factual outgoing and incoming citations
The article page SHALL automatically distinguish links actually present in its authored body from recommendations. It SHALL derive incoming citations from other public articles, collapse repeated links to the same article, exclude self-citations, and preserve safe external reference links without crawling new content.

#### Scenario: Citation creates backlink
- **GIVEN** public article A links twice to public article B and once to itself
- **WHEN** the next public release is generated
- **THEN** A lists B once under articles mentioned and B lists A once under articles mentioning this article, with no self-citation

#### Scenario: Recommendation is not a citation
- **GIVEN** article C is recommended for A but A's authored body does not link to C
- **WHEN** connections are generated
- **THEN** C does not gain an incoming authored citation from A

#### Scenario: Hidden target and unsafe link
- **GIVEN** an authored link targets a draft or uses an executable URL scheme
- **WHEN** the connection panel is rendered
- **THEN** it reveals no draft metadata and offers no executable connection link

### Requirement: Distinct automatic related and further reading
The system SHALL automatically select up to three related articles by content relevance and up to three complementary further-reading articles by additional topical coverage. Further-reading reasons SHALL be supported by source passages. It SHALL NOT claim an educational prerequisite or author endorsement that the source does not establish.

#### Scenario: Complementary next reading
- **GIVEN** A explains workflow decomposition, B explains the same topic, and C explains error recovery within that workflow
- **WHEN** connections are generated with sufficient evidence
- **THEN** B is eligible for related reading and C is eligible for further reading with a recovery-specific explanation

#### Scenario: Insufficient candidates
- **GIVEN** only one suitable public article exists
- **WHEN** connections are generated
- **THEN** the system displays that article in only one recommendation group and does not pad the other group with unrelated content

### Requirement: Shared restrained reading layout
Both local and imported article pages SHALL expose the same labelled connection groups while preserving article text, canonical links, series navigation, and the established reading design. Recommendation groups SHALL exclude self and duplicates across the two recommendation groups; empty groups SHALL be absent. Factual citations SHALL remain available even when an article is also recommended.

#### Scenario: Local and imported reading
- **GIVEN** a local article and an imported article both have connections
- **WHEN** each page is opened on a phone or desktop with either theme
- **THEN** labelled links and reasons are readable, keyboard accessible, and do not obstruct article reading or series navigation

#### Scenario: No connections
- **GIVEN** an article has no citations, backlinks, or relevant recommendations
- **WHEN** its page is opened
- **THEN** no empty connection headings or inactive controls appear

### Requirement: Stable connection refresh without reader-time generation
Connection panels SHALL be precomputed per public release and SHALL work without reader-time model calls. A failed optional semantic enrichment SHALL retain current-release deterministic connections rather than stale recommendations.

#### Scenario: Semantic enrichment unavailable
- **GIVEN** the current release's text and topic evidence is available but embedding generation fails
- **WHEN** the public site is built
- **THEN** citations and evidence-qualified lexical recommendations remain available without including withdrawn articles
