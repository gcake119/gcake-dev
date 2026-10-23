## Purpose

Let readers copy or natively share a public article from its end without leaving the blog reading edition. Preserve canonical ownership and provide truthful, accessible feedback when browser operations succeed, fail, or are cancelled.

## ADDED Requirements

### Requirement: Article-end controls

Every public standalone post, local series post, and imported iThome reading edition SHALL provide one sharing group after the article body and before further reading. The group SHALL offer 「複製連結」 and SHALL offer 「分享文章」 only when native sharing is supported. Desktop and mobile SHALL use the same placement without a floating toolbar.

#### Scenario: Controls appear on every supported article category

```gherkin
Given a public standalone post, local series post, or imported iThome reading edition
When a reader reaches the end of its body
Then one sharing group appears before further reading
And the group contains a control named "複製連結"
```

#### Scenario: Native sharing is unavailable

```gherkin
Given the reader's browser does not support native sharing
When the reader opens a public article
Then "複製連結" is available
And no unusable "分享文章" control is shown
```

### Requirement: Share the clean blog reading URL

Copy and native sharing SHALL use the same absolute production blog reading URL for the current article, excluding query parameters and fragments. Copy SHALL contain only that URL. Native sharing SHALL receive the article title and that URL. Existing canonical, Open Graph URL, and original-version links SHALL remain unchanged. Receiving platforms control title rendering and preview behavior; the site SHALL NOT promise identical previews or override that behavior.

#### Scenario: Standalone article payload

```gherkin
Given the reader opens "https://gcake119.github.io/gcake-dev/posts/ai-agent-development-workflow/?utm_source=example#workflow"
When the reader copies the link
Then the clipboard contains only "https://gcake119.github.io/gcake-dev/posts/ai-agent-development-workflow/"
When the reader opens native sharing
Then the supplied title is "AI Agent 協作開發工作流：讓規格、技能與驗證各司其職"
And the supplied URL is "https://gcake119.github.io/gcake-dev/posts/ai-agent-development-workflow/"
```

#### Scenario: Imported article preserves ownership while sharing the reading edition

```gherkin
Given the reader opens "https://gcake119.github.io/gcake-dev/series/ithome-2026/day-01/?from=search#intro"
When the reader copies or natively shares the article
Then the supplied URL is "https://gcake119.github.io/gcake-dev/series/ithome-2026/day-01/"
And the canonical URL remains "https://gcake119.github.io/ithome-2026/day/01/"
And the Open Graph URL remains "https://gcake119.github.io/ithome-2026/day/01/"
And the original-version link remains available with its original destination
```

### Requirement: Truthful copy feedback and recovery

The site SHALL show 「已複製連結」 only after a successful clipboard write. A denied, unavailable, or failed copy SHALL show 「無法自動複製，請手動複製下方連結」 with the selectable full reading URL and SHALL NOT show success for that attempt. Feedback SHALL describe the current attempt instead of retaining an earlier success.

#### Scenario: Copy completes successfully

```gherkin
Given the browser allows clipboard writing
When the reader activates "複製連結" and writing succeeds
Then the clipboard contains only the current article's clean blog reading URL
And "已複製連結" appears
```

#### Scenario: Clipboard unavailable or rejected

```gherkin
Given clipboard writing is unavailable, denied, or fails
When the reader activates "複製連結"
Then "無法自動複製，請手動複製下方連結" appears
And the complete clean blog reading URL is displayed and selectable
And "已複製連結" is not reported for that attempt
```

#### Scenario: A later copy fails after an earlier success

```gherkin
Given a successful copy previously displayed "已複製連結"
When a new copy attempt fails
Then the feedback changes to manual-copy recovery
And the earlier success is no longer presented as the current result
```

### Requirement: Native share outcome handling

The site SHALL open native sharing only following the reader's activation of 「分享文章」. Cancellation SHALL leave the reader on the article without success or publication claims. Other sharing errors SHALL display 「無法開啟分享，請改用複製連結」 and retain the copy control. Completion of the browser sharing operation SHALL NOT be presented as proof of a social post or delivery. The site SHALL NOT publish automatically or choose a receiving platform for the reader.

#### Scenario: Open the system chooser

```gherkin
Given native sharing is supported
When the reader activates "分享文章"
Then the system sharing chooser opens with the current article title and clean blog reading URL
And the reader chooses the receiving destination
```

#### Scenario: Reader cancels native sharing

```gherkin
Given the native sharing chooser is open
When the reader cancels it
Then the reader remains on the article
And no sharing success, publication success, or failure warning is shown for that cancellation
```

#### Scenario: Native sharing fails

```gherkin
Given native sharing is supported
When opening or transferring the share fails for a reason other than cancellation
Then "無法開啟分享，請改用複製連結" appears
And "複製連結" remains usable
```

#### Scenario: Browser reports share completion

```gherkin
Given the reader activated native sharing
When the browser reports the sharing operation completed
Then the reader remains on the article
And the site does not claim the article was published or delivered to a social platform
```

### Requirement: Accessible controls and feedback

The sharing group SHALL remain readable and operable on desktop and mobile in both themes without obscuring content or causing horizontal overflow. Controls SHALL have readable accessible names and visible keyboard focus. Copy and failure feedback SHALL be available to assistive technology without depending on color alone.

#### Scenario: Responsive keyboard operation

```gherkin
Given a reader uses a desktop or 390-pixel mobile viewport in either supported theme
When the reader navigates to the sharing controls with a keyboard and activates them
Then the focused control is identifiable and operable
And the group does not obscure article content or overflow horizontally
And result feedback is readable and available to assistive technology
```

### Requirement: Minimal integration boundary

Article sharing SHALL use browser capabilities without adding platform-specific entries, third-party SDKs, tracking, login, or backend services. Existing footer profile links SHALL retain their purpose.

#### Scenario: Sharing stays reader initiated

```gherkin
Given a reader opens an article without activating sharing
When the article finishes loading
Then no sharing destination opens and no article is posted
And the sharing group contains no platform-specific entry or login requirement
```
