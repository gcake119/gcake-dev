## Purpose

Answer explicit reader questions from current public article evidence, with inspectable citations, honest limits, and bounded remote execution.

## ADDED Requirements

### Requirement: Separate explicit question action
Answer generation SHALL be separately activated from keyword and semantic search. It SHALL require a reader action labelled as an AI answer and disclose that the question is sent to a remote service. It SHALL NOT run automatically on typing, search submission, or article viewing.

#### Scenario: Search without asking
- **GIVEN** a reader submits an ordinary article search
- **WHEN** results appear
- **THEN** no answer-generation call occurs

#### Scenario: Feature disabled
- **GIVEN** answer generation has not been activated
- **WHEN** a reader opens search
- **THEN** no unusable answer control appears and keyword search remains available

### Requirement: Current-public-evidence answers
Answers SHALL use only retrieved passages from the active public corpus, preserve source-specific uncertainty, and attach a valid passage citation to each factual assertion. Questions about content unsupported by the corpus SHALL receive an insufficient-evidence response rather than a fabricated answer. Answers SHALL distinguish article evidence from generated synthesis.

#### Scenario: Supported workflow question
- **GIVEN** current public articles explain workflow decomposition and publishing recovery
- **WHEN** the reader asks how those practices connect
- **THEN** the answer explains the connection with inspectable citations to those articles

#### Scenario: Unsupported factual question
- **GIVEN** the corpus contains no evidence about a requested event or private project
- **WHEN** the reader asks about it
- **THEN** the service states that the article library does not provide enough evidence and does not answer from general model knowledge

#### Scenario: Existing but unrelated citation
- **GIVEN** a generated factual assertion cites a retrieved passage that does not support it
- **WHEN** answer validation and quality evaluation occur
- **THEN** the answer fails the grounded-answer acceptance gate even though the link exists

### Requirement: Untrusted content and citation validation
Retrieved content and model output SHALL be treated as untrusted data. Embedded instructions SHALL NOT enable tools, change evidence scope, reveal system secrets, or cause outbound browsing. Only citations belonging to the current retrieved passage set SHALL be rendered; invalid output SHALL produce a safe failure instead of a partially trusted answer.

#### Scenario: Article contains hostile instructions
- **GIVEN** a retrieved article includes instructions to ignore the question and expose credentials
- **WHEN** the answer is generated
- **THEN** the service exposes no credentials, performs no tool action, and uses the article only as source data

#### Scenario: Invented citation
- **GIVEN** the model invents an article URL or passage reference
- **WHEN** its response is checked
- **THEN** the service returns no fabricated citation and offers the verified retrieved reading links

### Requirement: Bounded execution and independent failure
Remote requests SHALL enforce configured query length, request size, timeout, usage quota, and output limits before or during generation. Missing budgets or unavailable admission control SHALL disable remote calls. Errors SHALL preserve ordinary search and SHALL NOT trigger automatic repeated generation.

#### Scenario: Budget exhausted
- **GIVEN** the configured daily remote request or token budget is exhausted
- **WHEN** a reader asks a question
- **THEN** the service makes no new model call and returns an availability message alongside working article search

#### Scenario: Generation timeout
- **GIVEN** the generation service exceeds its request deadline
- **WHEN** the reader is waiting for an answer
- **THEN** waiting ends with a retryable message and verified search results remain usable

### Requirement: Independent model and public activation evidence
Semantic and answer features SHALL remain independently disabled until their exact model configuration, public-corpus release, quality results, privacy terms, budget, and explicit activation authorization are recorded. Synthetic tests SHALL NOT be reported as provider quality or human acceptance.

#### Scenario: Offline acceptance passes
- **GIVEN** mocked retrieval and generation pass contract tests
- **WHEN** implementation is reviewed
- **THEN** the delivery reports offline evidence only and remote features stay disabled without the separate provider acceptance and activation record
