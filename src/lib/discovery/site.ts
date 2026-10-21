import { getCollection, render } from 'astro:content';
import { Marked, Renderer } from 'marked';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { loadReadingCatalog } from '../content/catalog';
import { loadIthomeArticles } from '../content/external';
import { publicationInstant } from '../content/publication';
import { site } from '../../data/site';
import { buildPublicDiscovery, digest } from './build';
import type { PublicSource } from './types';
import reviewedAliases from '../../data/discovery/terminology-reviewed.json';
let pending: ReturnType<typeof build> | undefined;
async function build() {
    const { posts, series } = await loadReadingCatalog(), local = await getCollection('posts'), external = loadIthomeArticles();
    const sources: PublicSource[] = [];
    for (const post of posts) {
        const imported = post.href.includes('/series/ithome-2026/'), ext = imported ? external.find(a => a.slug === post.slug) : undefined, l = imported ? undefined : local.find(a => a.id === post.slug);
        let html = ext?.html ?? '', interactive = false;
        if (l) {
            interactive = l.filePath?.endsWith('.mdx') ?? false;
            if (!interactive) {
                const { headings } = await render(l);
                let i = 0;
                const renderer = new Renderer();
                renderer.heading = function ({ tokens, depth }) { const text = this.parser.parseInline(tokens), h = headings[i++]; return `<h${depth}${h ? ` id="${h.slug}"` : ''}>${text}</h${depth}>`; };
                html = new Marked({ renderer, gfm: true }).parse(l.body ?? '') as string;
            }
        }
        sources.push({ source: imported ? 'ithome' : 'local', id: post.slug, title: post.title, description: post.description, href: post.href, canonicalUrl: ext?.canonicalUrl ?? site.url + `/posts/${post.slug}/`, aliases: ext ? [ext.sourceUrl] : [], status: l?.data.status ?? 'published', publishedAt: post.date?.toISOString(), topics: ext?.topics ?? l?.data.topics ?? [], series: post.series, seriesTitle: series.find(s => s.slug === post.series)?.title, html, interactive, sourceRevision: digest(ext?.body ?? l?.body ?? html) });
    }
    const snapshotDigest = digest(await readFile('src/data/external/ithome-2026.generated.json', 'utf8'));
    const sourceTree = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const config = { now: publicationInstant().toISOString(), sourceTree, snapshotDigest, baseUrl: site.url, reviewedAliases };
    return { corpus: buildPublicDiscovery(sources, config), config };
}
export function loadDiscovery() { return pending ??= build(); }
