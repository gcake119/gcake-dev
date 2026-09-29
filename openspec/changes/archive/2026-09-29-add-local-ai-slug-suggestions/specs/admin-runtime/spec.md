## ADDED Requirements

### Requirement: Ollama remains outside hosted runtimes

The Cloudflare Worker and public Astro site SHALL NOT call or depend on Ollama; local slug generation SHALL run as a separately started loopback helper used only by the Publishing Admin.

#### Scenario: Build hosted runtimes without Ollama

- **WHEN** Admin, Worker, and public-site tests and builds run without Ollama
- **THEN** all hosted runtime verification succeeds and normal article editing remains available

#### Scenario: Public site serves content

- **WHEN** a visitor loads the public site while the local helper is stopped
- **THEN** public routes render without attempting any local AI request
