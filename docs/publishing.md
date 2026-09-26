# Publishing

## New posts

~~~text
Markdown / MDX in gcake-dev
→ Git commit
→ GitHub Pages
→ canonical = gcake-dev Pages
→ publication transform
→ Paragraph / Substack
→ independent verification and publication state
~~~

GitHub Pages is the canonical reading surface for new posts.

Plain articles are distributed as full text by default. Articles whose experience materially depends on interactive Vue/MDX content use an explicit compact external version with static fallback and a link back to the canonical interactive article.

Paragraph and Substack are publication targets, never editing sources. A target failure does not roll back or invalidate successful publication to other targets.

See docs/multi-platform-publishing.md for the current publishing architecture and implementation plan.

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
