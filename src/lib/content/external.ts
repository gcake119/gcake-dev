import matter from 'gray-matter';
import { Marked, Renderer } from 'marked';
import snapshot from '@/data/external/ithome-2026.generated.json';

export interface ExternalArticle {
  slug: string;
  day: number;
  title: string;
  description?: string;
  publishedAt?: Date;
  canonicalUrl: string;
  sourceUrl: string;
  body: string;
  html: string;
  headings: Array<{ depth: number; slug: string; text: string }>;
}

function slugify(value: string, index: number) {
  const normalized = value
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
  return normalized || `section-${index}`;
}

export function ithomePublicationState(): 'active' | 'completed' {
  if (!('publicationState' in snapshot)) throw new Error('Sync source manifest first');
  return snapshot.publicationState as 'active' | 'completed';
}

export function loadIthomeArticles(): ExternalArticle[] {
  return snapshot.posts.map((post) => {
    const parsed = matter(post.markdown);
    const headings: ExternalArticle['headings'] = [];
    const renderer = new Renderer();

    renderer.heading = function ({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const slug = slugify(text, headings.length + 1);
      headings.push({ depth, slug, text: text.replace(/<[^>]+>/g, '') });
      return `<h${depth} id="${slug}">${text}</h${depth}>`;
    };

    const marked = new Marked({ renderer, gfm: true });
    const publishDate = parsed.data.publishDate ? new Date(parsed.data.publishDate) : undefined;

    return {
      slug: post.slug,
      day: post.day,
      title: parsed.data.title ?? `Day ${post.day}`,
      description: parsed.data.description,
      publishedAt: publishDate,
      canonicalUrl: post.canonicalUrl,
      sourceUrl: post.sourceUrl,
      body: parsed.content,
      html: marked.parse(parsed.content) as string,
      headings,
    };
  });
}
