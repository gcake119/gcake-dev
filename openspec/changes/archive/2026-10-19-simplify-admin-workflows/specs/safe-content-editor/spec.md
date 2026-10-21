## MODIFIED Requirements

### Requirement: Single cyclic view control
The Editor SHALL provide one SVG icon button cycling 原文 → 預覽 → 並排 → 原文. Its accessible name and tooltip SHALL identify the current and next view; adjacent text SHALL identify the current view. Switching SHALL preserve unsaved source, cursor and practical reading positions and SHALL NOT save, publish or start a website-preview build. Synchronization SHALL appear only in split mode and retain existing persistence.

#### Scenario: Complete a view cycle
- **GIVEN** an unsaved article in 原文
- **WHEN** the owner activates the view button three times by mouse or keyboard
- **THEN** 預覽, 並排 and 原文 appear in order with unchanged source and restored practical editing position

#### Scenario: Recognize the next view
- **GIVEN** any of the three views is active
- **WHEN** the owner focuses the view button
- **THEN** its accessible name identifies the current and next view and only one view button is available
