# Website design system

## Direction

The site uses a quiet editorial-notebook direction. Long-form reading is the priority; Series structure is explicit without turning the interface into a dashboard.

## Visual language

- Warm ivory page surface
- Deep ink body text
- Muted brick-red accent
- Fine rules instead of card borders and shadows
- Serif display hierarchy with sans-serif body and UI copy
- Generous whitespace and restrained metadata

The implementation uses system font stacks so the static site does not depend on a third-party font request.

## Page roles

### Homepage

Introduces the writing focus, then presents an active Series, latest posts, local Series, Topics and archived Series. Sections with no published content are hidden or use an honest empty state.

### Series

Shows reader-facing status, published count, chapter position and published posts only. Editorial-only `planned`, `draft` and `ready` entries are not exposed.

### Article

- Normal reading measure: about `44rem`
- Diagrams, Mermaid, figures and interactive islands may break out to about `64rem`
- Desktop table of contents sits in the right margin
- Mobile table of contents uses a native disclosure
- Mobile tables are transformed into labeled rows from their real headers

### Archived external Series

The 2026 iThome articles are synchronized at build time and rendered in the gcake.dev reading interface. Each article keeps the old GitHub Pages URL as its canonical URL and links to the original version.

## Responsive behavior

- The full desktop navigation becomes a compact native disclosure on small screens.
- Multi-column editorial layouts stack vertically rather than shrinking in place.
- Series chapters keep their number, title and ordered published posts.
- Wide code blocks remain horizontally scrollable.
- Images and diagrams fit the viewport on mobile; interactive content should provide an expanded view when required.

## Content constraints

- No fabricated published content is used to fill the homepage.
- Archived content remains visually secondary to new local writing.
- Section is only a Series-internal concept.
- Topic is a cross-Series discovery mechanism, not another hierarchy.
