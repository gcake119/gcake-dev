import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import { z } from 'zod';

export const manifestSchema = z.object({
  schemaVersion: z.literal(1), source: z.literal('gcake119/ithome-2026'),
  revision: z.string().regex(/^[a-f0-9]{40}$/), builtAt: z.iso.datetime(),
  publicationState: z.enum(['active', 'completed']),
  posts: z.array(z.object({ day: z.number().int().min(1).max(30), slug: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })).max(30),
}).superRefine((m, ctx) => {
  if (new Set(m.posts.map(p => p.day)).size !== m.posts.length || m.posts.some(p => p.slug !== `day-${String(p.day).padStart(2, '0')}`)) ctx.addIssue({ code: 'custom', message: 'Invalid or duplicate Day' });
  if ((m.publicationState === 'completed') !== (m.posts.length === 30)) ctx.addIssue({ code: 'custom', message: 'Publication state contradicts public count' });
});

export async function collectSnapshot(input: unknown, fetchText: (url: string) => Promise<string>) {
  const manifest = manifestSchema.parse(input);
  const posts = [];
  for (const entry of manifest.posts) {
    const sourceUrl = `https://raw.githubusercontent.com/${manifest.source}/${manifest.revision}/src/content/ironman/${entry.slug}.md`;
    const markdown = await fetchText(sourceUrl);
    if (createHash('sha256').update(markdown).digest('hex') !== entry.sha256) throw new Error(`Source hash mismatch: ${entry.slug}`);
    const parsed = matter(markdown);
    if (parsed.data.day !== entry.day || parsed.data.draft !== false || !parsed.content.trim() || typeof parsed.data.title !== 'string' || !Number.isFinite(new Date(parsed.data.publishDate).getTime())) throw new Error(`Invalid public article: ${entry.slug}`);
    posts.push({ slug: entry.slug, day: entry.day, sourceUrl, markdown, canonicalUrl: `https://gcake119.github.io/ithome-2026/day/${String(entry.day).padStart(2, '0')}/` });
  }
  return { generated: true, generatedAt: new Date().toISOString(), source: manifest.source, revision: manifest.revision, sourceBuiltAt: manifest.builtAt, publicationState: manifest.publicationState, posts };
}
