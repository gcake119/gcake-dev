import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { digest } from '../../src/lib/discovery/build';
import { search } from '../../src/lib/discovery/search';
import type { Corpus, Passage, Connections } from '../../src/lib/discovery/types';
const root = new URL('../../dist/', import.meta.url), m = JSON.parse(await readFile(new URL('discovery-manifest.json', root), 'utf8'));
const read = async <T>(kind: string): Promise<T> => { const text = await readFile(new URL(m.assets[kind].href.replace('/gcake-dev/', ''), root), 'utf8'); assert.equal(digest(text), m.assets[kind].digest); return JSON.parse(text); };
const c = await read<Corpus>('index');
c.passages = await read<Passage[]>('passages');
c.connections = await read<Record<string, Connections>>('connections');
assert.equal(c.corpusId, m.corpusId);
for (const p of c.passages) {
    const a = c.articles.find(a => a.articleId === p.articleId);
    assert.equal(a?.sourceRevision, p.revision);
    const html = await readFile(new URL(p.href.split('#')[0].replace('/gcake-dev/', '') + 'index.html', root), 'utf8');
    if (p.anchor)
        assert.ok(html.includes(`id="${p.anchor}"`), p.href);
}
const indexSize = gzipSync(await readFile(new URL(m.assets.index.href.replace('/gcake-dev/', ''), root))).length;
const passageSize = gzipSync(await readFile(new URL(m.assets.passages.href.replace('/gcake-dev/', ''), root))).length;
const size = indexSize + passageSize;
assert.ok(size <= 500 * 1024);
const result = { corpusId: c.corpusId, articles: c.articles.length, passages: c.passages.length, aliases: c.aliases, initialKeywordGzipBytes: size, indexGzipBytes: indexSize, passageGzipBytes: passageSize, assetDigestsVerified: true, allPassageAnchorsVerified: true, sample: c.articles.slice(0, 20).map(a => ({ articleId: a.articleId, title: a.title, terms: a.terms.slice(0, 5), connections: c.connections[a.articleId] })), smokeSearch: search(c, 'AI').total };
await mkdir('output/discovery', { recursive: true });
await writeFile('output/discovery/inspection.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, sample: undefined, aliases: c.aliases.length }));
