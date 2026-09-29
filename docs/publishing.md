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
→ Paragraph / Substack adapters
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

Paragraph and Substack are publication targets, never editing sources. A target failure does not roll back or invalidate successful publication to other targets.

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

## 2026 iThome posts

~~~text
Markdown in ithome-2026
→ old GitHub Pages
→ canonical = old page
→ rendered by gcake-dev
→ optionally synchronized to Paragraph using original publication date
→ Arweave permanent published snapshot
~~~

The original 30-day series keeps its existing ownership and canonical history. Multi-platform publishing begins with new gcake-dev content, starting with the iThome 2026 behind-the-scenes extension series.

Changes are always made in the owning Git repository and synchronized outward.

External writes remain disabled until the post-iThome production-enable gate. RSS is a reader feed, not a publication transport.
