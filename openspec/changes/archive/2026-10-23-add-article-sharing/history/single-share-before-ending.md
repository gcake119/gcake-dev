## Purpose

Let readers natively share a public article using a single article-end action. Preserve the blog reading URL and canonical ownership, with a selectable URL when sharing is unavailable or fails. This supersedes the copy-button contract preserved in history/copy-and-share/spec.md following the owner's 2026-10-23 revision.

## ADDED Requirements

### Requirement: Article-end controls

Every public standalone post, local series post, and imported iThome reading edition SHALL provide one sharing group after the body and before further reading. Its only action SHALL be 「分享這篇文章」 with a decorative SVG icon and visible text, shown only when native sharing is supported. There SHALL NOT be a separate copy button. Desktop and mobile SHALL use the same non-floating placement.

#### Scenario: One share action on supported devices

```gherkin
Given a public standalone, local series, or imported iThome article on a browser supporting native sharing
When the reader reaches the end of the article
Then one "分享這篇文章" action with an SVG icon appears before further reading
And no "複製連結" action appears
```

#### Scenario: Native sharing is unavailable

```gherkin
Given the browser does not support native sharing
When the reader opens a public article
Then no unusable share action appears
And the complete reading URL is displayed and selectable for manual copying
```

### Requirement: Share the clean blog reading URL

Native sharing and manual recovery SHALL use the same absolute production reading URL without query or fragment. Native sharing SHALL receive the raw article title and that URL. Canonical, Open Graph URL and original-version links SHALL remain unchanged. Receiving platforms control previews; the site SHALL NOT promise identical previews.

#### Scenario: Standalone article payload

```gherkin
Given the reader opens "https://gcake119.github.io/gcake-dev/posts/ai-agent-development-workflow/?utm_source=example#workflow"
When the reader activates "分享這篇文章"
Then the supplied title is "AI Agent 協作開發工作流：讓規格、技能與驗證各司其職"
And the supplied URL is "https://gcake119.github.io/gcake-dev/posts/ai-agent-development-workflow/"
```

#### Scenario: Imported article preserves ownership

```gherkin
Given the reader opens "https://gcake119.github.io/gcake-dev/series/ithome-2026/day-01/?from=search#intro"
When the reader shares the article or uses manual recovery
Then the URL is "https://gcake119.github.io/gcake-dev/series/ithome-2026/day-01/"
And canonical and Open Graph URL remain "https://gcake119.github.io/ithome-2026/day/01/"
And the original-version link retains its original destination
```

### Requirement: Manual URL recovery

Without native sharing or JavaScript, the site SHALL provide a labelled readonly selectable full reading URL. Non-cancellation sharing failure SHALL show 「無法開啟分享，請手動複製下方連結」 with the same URL. Unsupported browsers SHALL show 「此瀏覽器不支援分享，請手動複製下方連結」. The site SHALL NOT automatically read or write the clipboard or claim copying success. A new sharing attempt SHALL clear previous feedback and recovery while pending.

#### Scenario: Sharing fails

```gherkin
Given native sharing is supported
When sharing fails for a reason other than cancellation
Then "無法開啟分享，請手動複製下方連結" appears
And the full clean reading URL is available for selection
And no copying or publication success is claimed
```

#### Scenario: A later attempt clears recovery

```gherkin
Given an earlier sharing failure displayed a manual URL
When the reader activates sharing again
Then the earlier feedback and recovery are cleared while sharing is pending
And additional activations do not open overlapping sharing operations
```

#### Scenario: JavaScript disabled

```gherkin
Given JavaScript is disabled
When the reader opens an article
Then the full labelled reading URL is available for manual selection
And no nonfunctional share action is shown
```

### Requirement: Native share outcome handling

Sharing SHALL open only on explicit activation. AbortError cancellation SHALL be neutral; other errors SHALL use Manual URL recovery. Browser resolution SHALL NOT claim posting or delivery. The site SHALL NOT choose a receiving destination or publish automatically.

#### Scenario: Open the system chooser

```gherkin
Given native sharing is supported
When the reader activates "分享這篇文章"
Then the system chooser opens with the article title and clean reading URL
And the reader chooses the receiving destination
```

#### Scenario: Cancel native sharing

```gherkin
Given the native chooser is open
When the reader cancels
Then the reader remains on the article without success or failure messages
```

#### Scenario: Browser reports completion

```gherkin
Given the reader activated sharing
When the browser reports completion
Then the reader remains on the article
And no publication or delivery success is claimed
```

### Requirement: Accessible controls and feedback

The group SHALL be readable and keyboard operable on desktop and 390px mobile in both themes, without horizontal overflow or content obstruction. The share action SHALL have visible text and focus. SVG SHALL be decorative to avoid duplicate announcements. Failure feedback SHALL be available to assistive technology without depending on color.

#### Scenario: Responsive keyboard operation

```gherkin
Given a desktop or 390px viewport in either theme
When the reader reaches "分享這篇文章" with the keyboard and activates it
Then focus is visible and the action is operable
And feedback is announced and readable without horizontal overflow
```

### Requirement: Minimal integration boundary

Sharing SHALL use browser capabilities without platform-specific entries, SDKs, tracking, login, backend services, clipboard operations or new CI workflows. Existing footer profile links SHALL retain their purpose.

#### Scenario: Sharing stays reader initiated

```gherkin
Given an article loads without a sharing activation
When loading completes
Then no share operation or clipboard operation occurs and no article is posted
And no platform-specific entry or login requirement appears
```
