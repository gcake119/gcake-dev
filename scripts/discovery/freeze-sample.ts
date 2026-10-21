import { readFile, writeFile } from 'node:fs/promises';
import type { Corpus } from '../../src/lib/discovery/types';
const m = JSON.parse(await readFile('dist/discovery-manifest.json', 'utf8'));
const c: Corpus = JSON.parse(await readFile('dist/' + m.assets.index.href.replace('/gcake-dev/', ''), 'utf8'));
c.passages = JSON.parse(await readFile('dist/' + m.assets.passages.href.replace('/gcake-dev/', ''), 'utf8'));
type Judgment = { articleId: string; grade: number; evidence: string; sourceRevision: string; passageId?: string };
type Query = { id: string; category: string; split: string; q: string; judgments: Judgment[]; reviewer: string; status?: string; previousSplit?: string };
const queries: Query[] = [];
for (const a of c.articles) queries.push({ id: `title:${a.articleId}`, category: 'exact-technical', split: 'regression', q: a.title, judgments: [{ articleId: a.articleId, grade: 3, evidence: a.title, sourceRevision: a.sourceRevision }], reviewer: 'Automatic public title expectation; no independent relevance review' });
for (const alias of c.aliases) {
    const a = c.articles.find(a => a.articleId === alias.articleId);
    const p = c.passages.find(p => p.passageId === alias.evidence && p.articleId === alias.articleId && p.revision === a?.sourceRevision);
    if (a && p) queries.push({ id: `alias:${a.articleId}:${alias.short}`, category: 'explicit-alias', split: 'regression', q: alias.short, judgments: [{ articleId: a.articleId, grade: 3, evidence: p.text, sourceRevision: a.sourceRevision, passageId: p.passageId }], reviewer: alias.reviewer ?? 'Automatic explicit public definition expectation' });
}
// Historical judgments are reused only against their unchanged public evidence.
const previous = JSON.parse(await readFile(new URL('../../test/discovery/retrieval-judgments-v5.json', import.meta.url), 'utf8'));
for (const q of previous.queries as Query[]) {
    if (q.status || !q.judgments.length) continue;
    if (!q.judgments.every(j => {
        const a = c.articles.find(a => a.articleId === j.articleId && a.sourceRevision === j.sourceRevision);
        return a && (a.title.includes(j.evidence) || a.description.includes(j.evidence) || c.passages.some(p => p.articleId === a.articleId && p.text.includes(j.evidence)));
    })) continue;
    if (!queries.some(existing => existing.q.normalize('NFKC').toLowerCase() === q.q.normalize('NFKC').toLowerCase() && existing.judgments[0].articleId === q.judgments[0].articleId)) queries.push({ ...q, split: 'regression', previousSplit: q.split });
}
const noMatch = Array.from({ length: 10 }, (_, i) => ({ q: `xqzNoArticle${i}zzzz`, expected: [] }));
await writeFile('test/discovery/retrieval-judgments-current.json', JSON.stringify({ schemaVersion: 2, corpusId: c.corpusId, configurationDigest: c.configurationDigest, rankingTuned: false, previouslyObservedHeldOut: true, frozenBeforeScoring: true, policy: 'available-public-evidence-no-quota', assessor: 'Public title/definition expectations and revision-matched historical judgments; limited expected targets, not exhaustive relevance labels', queries, noMatch, hostile: ['javascript:alert(1)', '<img src=x onerror=evil()>', 'q'.repeat(201), '%E0%A4%A', '\u0000'] }, null, 2) + '\n');
console.log(`Frozen ${queries.length} source-grounded queries from ${c.articles.length} public articles and ${c.aliases.length} evidenced alias records; no quantity gate or invented slots. No scoring performed.`);
