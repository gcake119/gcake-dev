# local-slug-suggestions Specification

## Purpose

TBD - created by archiving change 'add-local-ai-slug-suggestions'. Update Purpose after archive.

## Requirements

### Requirement: Explicit local title-to-slug generation

The system SHALL generate a slug suggestion only after an authenticated Admin user explicitly requests it for a non-empty article title, and the generation action SHALL NOT save content or create a Git commit.

#### Scenario: Generate from a technical article title

- **GIVEN** the title `我怎麼把 Gherkin 加進現在的 SDD 流程`
- **WHEN** the user activates `產生 slug`
- **THEN** the local service returns a semantic English slug such as `add-gherkin-to-sdd-workflow` without saving the article

#### Scenario: Empty title

- **WHEN** the user activates the action with an empty or whitespace-only title
- **THEN** the Admin does not send a request and asks the user to enter a title

---
### Requirement: Deterministic safe output boundary

The local service MUST treat model output as untrusted, sanitize a single candidate to lowercase ASCII kebab-case, enforce 3 to 7 words, preserve necessary technical terms, and reject empty, ambiguous, numbered, dated, pinyin, or otherwise invalid output.

#### Scenario: Model returns fenced output

- **GIVEN** the model returns a single fenced candidate containing `Add-Gherkin-To-SDD-Workflow`
- **WHEN** the service validates the response
- **THEN** it returns `add-gherkin-to-sdd-workflow`

#### Scenario: Model returns explanation plus multiple candidates

- **WHEN** the model response contains prose or more than one distinct slug candidate
- **THEN** the service rejects the response and returns no suggestion

---
### Requirement: Optional failure behavior

The local service SHALL use a bounded timeout and SHALL convert unavailable Ollama, missing models, connection failures, invalid responses, and timeouts into a non-success response that does not prevent manual article editing.

#### Scenario: Ollama unavailable

- **WHEN** the Admin requests a suggestion while Ollama cannot be reached
- **THEN** the existing slug remains unchanged and the Admin displays `目前無法產生 slug，可以手動輸入。`

---
### Requirement: Server-side local configuration

The local service SHALL read the Ollama endpoint, Gemma model name, bind host, bind port, allowed Admin origin, and timeout from environment configuration with loopback-safe defaults; the UI SHALL NOT contain the Ollama endpoint or model name.

#### Scenario: Select an installed Gemma model

- **WHEN** the operator sets `OLLAMA_MODEL=gemma4:12b-mlx`
- **THEN** the local service requests that existing model without downloading any model or adding a cloud provider
