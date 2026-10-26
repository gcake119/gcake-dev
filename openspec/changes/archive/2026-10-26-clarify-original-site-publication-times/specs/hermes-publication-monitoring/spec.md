## MODIFIED Requirements

### Requirement: Hourly quiet operation and verified article notification
Checks SHALL occur once per 60-minute scheduled round. Within-round retries SHALL count as one observation round. Normal checks SHALL send no message. A new article SHALL be notified in the first round that verifies matching RSS identity and canonical article page metadata. Mere HTTP success, editorial published status or deployment success SHALL NOT prove public identity. Updates of the same canonical article SHALL NOT create another publication notification.
The notification SHALL separately identify the formally confirmed scheduled publication time and the successful public-page verification completion time in Taipei. It SHALL describe the latter as public confirmation, not the exact first instant of public availability. An unavailable confirmed schedule or a missing, malformed or out-of-observation confirmation time SHALL be displayed as not provided or not recorded. RSS dates, round start, dispatch time and deployment completion SHALL NOT substitute for a successful public-confirmation timestamp. Existing delivered, pending and uncertain events SHALL NOT be replayed by this format change.

#### Scenario: Normal hourly check
- **GIVEN** healthy sources and no new publication, overdue event or established anomaly recovery
- **WHEN** an hourly check completes
- **THEN** no Telegram message is sent

#### Scenario: New public article and later update
- **GIVEN** an unnotified article with matching RSS identity and canonical page metadata
- **WHEN** the check completes and a later check observes updated content at the same canonical identity
- **THEN** one article notification contains its title, canonical link and separately labelled Taipei scheduled and public-confirmation times and the update produces no duplicate

#### Scenario: Wrong page or future article
- **GIVEN** an RSS entry pointing to a homepage, another article or a publication timestamp still in the future
- **WHEN** the page is fetched successfully
- **THEN** no article notification is sent and the evidence mismatch is recorded

#### Scenario: Delayed publication retains its real public-confirmation time
- **GIVEN** an article formally scheduled for 2026-10-26 07:00 Taipei retains 07:00 in RSS, and Hermes verifies its canonical page at 09:24:50
- **WHEN** the notification is delivered at 09:25
- **THEN** it displays scheduled publication 07:00 and public confirmation 09:24, without claiming either 07:00 or 09:25 as the exact first-publication instant

#### Scenario: Missing schedule or untrustworthy observation time
- **GIVEN** a publicly verified article lacks a confirmed schedule, or its public-confirmation timestamp is missing, nonnumeric or outside that observation
- **WHEN** its notification is prepared
- **THEN** unavailable values are explicitly marked unknown instead of being inferred from RSS or the notification time

#### Scenario: Existing notifications remain suppressed
- **GIVEN** a publication already has a sent, intent or unknown notification outcome
- **WHEN** the format changes or a later check records another public-confirmation time
- **THEN** its stored history remains intact and no duplicate message is sent
