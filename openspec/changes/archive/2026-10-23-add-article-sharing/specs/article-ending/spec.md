## Purpose

Give readers a clear next reading choice at the end of every public local or imported article, using the owner-approved reading-first layout and public-site typography. This capability consolidates the presentation of existing deterministic recommendations without changing ranking, authored content or canonical ownership.

## ADDED Requirements

### Requirement: Reading-first ending sequence

Both public article templates SHALL render the same ending order: reading guidance, sharing, subscription, then collapsed factual references, followed by the existing site footer. Previous/next and series overview SHALL be inside reading guidance rather than repeated after subscription. The separate further-reading and related-reading presentation SHALL be replaced by one consolidated list. Empty optional groups SHALL be absent.

#### Scenario: Shared order on local and imported articles
```gherkin
Given a public local standalone, local series or imported article with recommendations and references
When the reader reaches the end of its authored body
Then "接著讀" precedes "分享這篇文章"
And subscription follows sharing
And "參考與引用" follows subscription and is initially collapsed
And no separate "延伸閱讀" or "相關文章" heading is presented
```

#### Scenario: No relevant recommendations or references
```gherkin
Given a standalone article with no suitable recommendations or factual references
When its ending is rendered
Then empty reading and reference groups are absent
And sharing and subscription remain available
```

### Requirement: Public next installment priority

A series article SHALL prioritize its next publicly readable installment using its full title, available source description and a forward SVG. Previous installment and series overview SHALL be grouped below it with full previous title. An absent previous installment SHALL produce no disabled placeholder. Standalone articles SHALL have no series controls. Only public catalog entries SHALL be used.

#### Scenario: Series middle installment
```gherkin
Given the reader is on "Day 8｜沒有告訴 AI 的事"
When the reader reaches "接著讀"
Then the primary link is "Day 9｜系統知道怎麼做，不代表使用者就該這樣做"
And the previous link names "Day 7｜一句「平常都這樣做」，後面藏了多少事情？"
And a "查看完整系列" link is grouped with the previous link
And additional recommendations follow those controls
```

#### Scenario: First and standalone articles
```gherkin
Given a first series installment or an article with no series
When reading guidance is rendered
Then the first installment has no previous placeholder
And the standalone article has no previous, next or series overview controls
```

#### Scenario: A later installment is not public
```gherkin
Given a series has no next publicly readable installment
When the ending is rendered
Then no unpublished title or link is exposed
And an active or paused series does not claim to be completed
```

#### Scenario: Confirmed series completion
```gherkin
Given the reader is on the final public installment of a series confirmed completed
When the ending is rendered
Then there is no next link
And a short message states that this is the last installment
And previous and series overview controls remain available
```

### Requirement: Consolidated bounded recommendations

Reading guidance SHALL combine existing further-reading candidates followed by related-reading candidates in their existing order, resolving only current public articles. It SHALL remove duplicate destinations, the current article, previous installment and primary next installment. It SHALL show at most two additional articles when a next installment exists, otherwise at most three. Each link SHALL use the source title and available source description, without fabricating educational prerequisites or filling with unrelated articles. No new model call, ranking change or reader-time service SHALL be added.

#### Scenario: Deduplication and next-priority limit
```gherkin
Given the candidates in order are current, next, previous, A, duplicate A, unavailable, B, C
And a public next installment exists
When recommendations are presented
Then only A and B are listed in their original order
And current, next, previous and unavailable are not listed
```

#### Scenario: Insufficient candidates without a next installment
```gherkin
Given no next installment exists and only A is a suitable public candidate
When recommendations are presented
Then only A appears
And the list is not padded to three items
```

### Requirement: Preserve sharing subscriptions and citations

Sharing SHALL retain its single SVG/text action, clean production reading URL, unsupported/error manual recovery and neutral cancellation. Its row SHALL say "這篇文章對你有幫助嗎？". Article subscription SHALL use "持續讀新的開發筆記" with existing newsletter and RSS destinations. Homepage subscription SHALL retain its current content. References SHALL keep outgoing, incoming and safe external links separate from recommendations and remain available even when a referenced article is recommended. Authored bodies, canonical, Open Graph URLs and original-version links SHALL remain unchanged.

#### Scenario: References and subscriptions preserve their destinations
```gherkin
Given an article has authored references and recommendations
When the reader opens "參考與引用"
Then authored outgoing links, incoming citations and external references remain distinguishable
And no recommended link is promoted into an authored citation
And the newsletter and RSS links retain their existing destinations
```

#### Scenario: Share fallback after rearrangement
```gherkin
Given native sharing is unsupported or fails
When the reader uses the ending
Then the full production reading URL is selectable after reading guidance
And no copying or publication success is claimed
```

### Requirement: Approved public typography and responsive layout

The approved design-source/index.html SHALL govern the ending layout together with docs/design-system.md and the public-site CSS. Root size SHALL remain 17px/1.8; prose 1rem/1.9; ending section headings 1.18rem/1.45; primary next title 1rem/700; other recommendation titles 1rem/400; descriptions and metadata .82rem; actions, series navigation and reference links 1rem. No mobile-specific reading-font reduction SHALL be introduced. Both themes SHALL retain semantic colors, visible keyboard focus, 44px controls and no horizontal overflow or content obstruction at desktop and 390px widths. No floating ending toolbar SHALL be added.

#### Scenario: Desktop and mobile keyboard reading
```gherkin
Given a desktop or 390px viewport in either theme
When the reader navigates the ending by keyboard
Then next, recommendations, sharing, subscriptions and references are identifiable and operable
And all ending text stays within the reading width without horizontal overflow
And type roles match the approved public-site sizes
```
