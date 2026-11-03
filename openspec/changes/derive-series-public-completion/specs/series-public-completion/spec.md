## Purpose

Derive consistent public completion for explicitly finished local series without exposing unpublished content.

## ADDED Requirements

### Requirement: Confirmed public completion

A local series SHALL be completed only when its manuscript is explicitly completed or archived, its original planned list is nonempty, every listed installment is published and publicly readable at the build instant, and any existing schedule permits completion. Paused publication SHALL remain paused. An active manuscript SHALL remain active. Elapsed dates and publication-completed flags SHALL NOT bypass these conditions. Imported series SHALL retain their existing verified-source policy.

#### Scenario: Finished and fully public
```gherkin
Given a six-installment manuscript explicitly completed with every installment public
And no pause or unfinished schedule applies
When the website is built
Then the series is completed
```

#### Scenario: Open manuscript
```gherkin
Given an active manuscript with all currently listed installments public
When the website is built
Then the series remains in progress
```

#### Scenario: Incomplete public availability
```gherkin
Given a completed manuscript with a listed installment draft, ready, missing or future dated
When the website is built
Then the series remains in progress
And no unavailable title or link is exposed
```

#### Scenario: Exact publication boundary
```gherkin
Given a completed manuscript whose last installment becomes public at 2026-11-03T07:00:00+08:00
And every other installment is public with no pause or unfinished schedule
When built before that instant
Then the series remains in progress
When built at that instant
Then the series is completed
```

#### Scenario: Empty planned list
```gherkin
Given a completed manuscript with no listed installments
When the website is built
Then the series is not presented as completed
```

#### Scenario: Paused publication
```gherkin
Given a completed manuscript with all installments public and publication paused
When the website is built
Then the publication state remains paused
```

#### Scenario: Unfinished schedule
```gherkin
Given a completed manuscript with all installments public and a future scheduled ending date
When the website is built
Then the publication state remains in progress
```

### Requirement: Consistent reading surfaces

Homepage, series listing, detail and article ending SHALL share the derived state. Completed series SHALL show an ended period using the final public article date. Only the final public installment of a completed series SHALL claim completion. Derivation SHALL NOT modify publication records, publish content, send notifications or assert deployment verification.

#### Scenario: Completed reading journey
```gherkin
Given a local series satisfies confirmed public completion
When the reader opens its homepage entry, series listing, detail and final article
Then the series displays completion and an ended period
And the final article states it is the last installment
```

#### Scenario: Latest visible article is not the final planned article
```gherkin
Given a completed manuscript with its final installment unavailable
When the reader reaches the latest public installment
Then no final-installment completion message is shown
And rendering triggers no publication or notification
```
