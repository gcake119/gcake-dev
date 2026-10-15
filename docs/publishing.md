# Publishing

## New posts

~~~text
Markdown / MDX in gcake-dev
→ Git commit
→ content validation
→ Astro build
→ SEO / AEO metadata
→ GitHub Pages
→ canonical = gcake-dev Pages
→ publication transform
→ portable publication
→ Substack adapter
→ independent publish, verification and publication state
~~~

GitHub Pages is the canonical reading surface for new posts.

New local articles only need editorial metadata in frontmatter. The site derives canonical URLs, Open Graph/Twitter metadata, BlogPosting structured data, author identity, breadcrumbs, topic routes, sitemap entries, RSS and the search index during build.

For a post that is **ready** or **published**:

- description is required.
- choose 1–3 topic IDs from src/data/topics.yaml.
- prefer existing topics; add a taxonomy entry only when the existing problem/development domains cannot reasonably cover the article and the new domain is expected to recur.
- topics describe what problem/domain the article discusses, not tools that merely appear in the implementation.
- updatedAt is optional and should be set when a published article receives a meaningful content update.
- image is optional and, when present, is used for social preview metadata.

Topic assignment is an editorial AI task: ChatGPT or Codex should read the finalized article and select the smallest useful set from the taxonomy before the article becomes ready. pnpm content:validate rejects unknown topic IDs and ready/published posts without topics or description.

Plain articles are distributed as full text by default. Articles whose experience materially depends on interactive Vue/MDX content use an explicit compact external version with static fallback and a link back to the canonical interactive article.

Substack is a publication target, never an editing source. A target failure does not roll back or invalidate successful publication to other targets.

See docs/multi-platform-publishing.md for the current publishing architecture and implementation plan.

## Search and answer-engine metadata

The Astro build owns technical SEO/AEO output:

- canonical URL
- meta description
- Open Graph and Twitter metadata
- BlogPosting JSON-LD for article pages
- ProfilePage/Person JSON-LD on /about/
- BreadcrumbList JSON-LD for article paths
- /sitemap.xml
- /robots.txt
- RSS
- topic aggregation pages

src/data/topics.yaml is the topic taxonomy SSOT. Article frontmatter stores stable topic IDs; pages render the bilingual labels from the taxonomy.

robots.txt allows normal crawling and explicitly allows OAI-SearchBot. No separate AI summary field or llms.txt is required by this site architecture.

## 流程摘要與分工

保留本機精簡說明：Git 是正文與編輯資料來源；Astro 驗證、建置並產生網站與搜尋資料；Pages 是本地文章的原文閱讀位置；共用 transform 產生可攜式內容，再交給 Substack 發布及驗證。平台執行狀態由 D1 保存，一個平台失敗不回滾其他已成功的結果。

網站的 Markdown／MDX 支援與平台分發能力是不同層次。純文字文章預設全文分發；依賴 Vue／MDX 互動的文章必須提供作者維護的靜態替代內容與原文連結。保留前述發布規則不代表本次已啟用任何尚未驗收的平台能力。詳細設計見 [多平台發佈文件](multi-platform-publishing.md)。

## 2026 iThome posts

```text
Markdown in ithome-2026
→ old GitHub Pages
→ canonical = old page
→ rendered by gcake-dev（原始 30 篇已完成同步渲染）
```

2026-10-13，使用者確認原始 30 篇的網站同步渲染已完成；正文與 canonical 仍由 ithome-2026 來源擁有。網站同步渲染與平台分發是不同工作；本文不以渲染完成推定平台分發已完成。

## 幕後系列現況

「2026 鐵人賽幕後」系列已全部完稿，並開始排程連載。完稿不代表所有篇目都已公開；尚未到公開時間的內容維持既有編輯狀態與排程。六篇幕後文章作為第一批平台驗證對象是早期階段規劃，後續平台同步仍依既有核准政策與精確範圍執行。

Substack is never an editing source. Changes are made in the owning Git repository and synchronized outward. A platform failure never rolls back another platform.

2026-10-13，使用者確認新系列已開始連載發佈。外部發布沿用已核准的受控同步流程，限於既有授權的平台、文章與精確版本；Substack 已允許對之後首次發布的新文章寄送一次電子報；既有文章、更新與重試不補寄。D1 保存各平台寄送意圖與結果，未知結果先核對、不重新寄送。Substack App 通知維持關閉。正式寄信設定尚未啟用；政策與啟用邊界見 [多平台發佈文件](multi-platform-publishing.md)。Markdown 進入 main 本身不構成平台發布或寄信授權。詳細流程見 [同步發文腳本操作手冊](distribution-scripted-runbook.md)。

早期「完賽與幕後系列開始前只做本機驗證」限制保留為歷史背景，不再作為現行全面禁令。RSS 仍是讀者訂閱來源，不是平台發布傳輸管道。
