## MODIFIED Requirements

### Requirement: Content attention requires confirmed meaningful drift

For an unchanged authoritative source revision, background observation SHALL NOT notify content synchronization for a description-only presentation difference or the observed provider-only code wrappers and terminal empty-line artifacts. It SHALL still detect title, body structure, non-terminal code whitespace, links, images and alt-text changes. A changed authoritative source with changed supported content, including description, SHALL remain pending foreground synchronization. Strict foreground content verification SHALL remain unchanged; ignored presentation differences SHALL NOT qualify complete content synchronization.

A failed or incomplete anonymous read SHALL record verification as inconclusive, preserve prior verified evidence and unresolved genuine holds, and SHALL NOT infer content drift or initiate an edit. Fresh complete evidence SHALL reassess a legacy generic public-verification content hold; presentation-only differences SHALL clear that false hold without provider writes. Confirmed meaningful drift, identity mismatches, changes to a previously verified actual publication timestamp and unknown mutation intents SHALL remain actionable. A difference between confirmed schedule and actual first publication time alone SHALL NOT be treated as identity/content drift. During a partial round, notification publication SHALL retain prior issues for affected and unobserved articles without inferring content drift, while independent complete observations SHALL advance their own notification results.

#### Scenario: Existing public originals have presentation-only differences

- **GIVEN** three previously published originals retain their authoritative source versions and public identities
- **WHEN** complete public reads differ only in descriptions, nested code presentation or terminal editor-generated empty lines
- **THEN** no content-synchronization notification or provider mutation occurs, legacy unconfirmed verification holds are cleared, and presentation-only evidence does not claim full synchronization

#### Scenario: A real source or provider content change remains actionable

- **GIVEN** an existing public article with a known original identity
- **WHEN** its authoritative supported content changes, or a complete public read confirms a changed title, paragraph, structure, inner code spacing, link, image or alt text
- **THEN** the original identity remains pending foreground content synchronization without a background edit or newsletter send

#### Scenario: An anonymous read cannot establish the current content

- **GIVEN** retained verified content evidence and any existing genuine pending actions
- **WHEN** a public read fails, is incomplete, or lacks a confirmed publication minute
- **THEN** verification remains inconclusive, prior evidence and pending actions are retained, and no content change or completed synchronization is asserted

#### Scenario: Strict foreground verification remains strict

- **GIVEN** presentation-only differences do not trigger a background content notification
- **WHEN** an explicit foreground synchronization verifies the complete source-owned content
- **THEN** its existing description, structure, link, media and meaningful code-whitespace checks still apply


#### Scenario: Another article has complete current evidence
- **GIVEN** one public read is inconclusive and another original article has complete matching public identity and full content
- **WHEN** a partial round publishes its notification snapshot
- **THEN** affected and unobserved prior holds remain, while the independently verified publication remains eligible for a success notification without any provider mutation
