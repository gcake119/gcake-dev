import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { search, normalize } from '../../src/lib/discovery/search';
import type { Corpus } from '../../src/lib/discovery/types';
const m = JSON.parse(await readFile('dist/discovery-manifest.json', 'utf8')), c: Corpus = JSON.parse(await readFile('dist/' + m.assets.index.href.replace('/gcake-dev/', ''), 'utf8'));
c.passages = JSON.parse(await readFile('dist/' + m.assets.passages.href.replace('/gcake-dev/', ''), 'utf8'));
c.connections = JSON.parse(await readFile('dist/' + m.assets.connections.href.replace('/gcake-dev/', ''), 'utf8'));
const sample = JSON.parse(await readFile(process.argv[2] ?? 'test/discovery/retrieval-judgments-current.json', 'utf8'));
assert.equal(sample.corpusId, c.corpusId);
assert.equal(sample.configurationDigest, c.configurationDigest);
const scored = sample.queries.filter((q: {
    status?: string;
}) => !q.status).map((q: {
    id: string;
    split: string;
    q: string;
    judgments: {
        articleId: string;
        grade: number;
    }[];
}) => { const found = search(c, q.q).results.slice(0, 5); const relevant = q.judgments.filter(j => j.grade > 0); return { id: q.id, split: q.split, q: q.q, expected: relevant.map(r => r.articleId), returned: found.map(r => r.articleId), recall: relevant.filter(r => found.some(f => f.articleId === r.articleId)).length / relevant.length }; });
for (const no of sample.noMatch)
    assert.equal(search(c, no.q).total, 0);
const panels = c.articles.map(a => ({ articleId: a.articleId, title: a.title, description: a.description, groups: ['further', 'related'].map(kind => ({ kind, items: c.connections[a.articleId][kind as 'further' | 'related'].map(r => { const target = c.articles.find(a => a.articleId === r.articleId)!; assert.ok(r.evidence.length); assert.ok(r.evidence.every(id => c.passages.some(p => p.passageId === id && p.articleId === r.articleId)));const labels=r.reason.split('：')[1]?.split('、').filter(Boolean)??[];assert.ok(labels.length>0);assert.ok(labels.every(label=>r.evidence.some(id=>c.passages.some(p=>p.passageId===id&&normalize(p.text).includes(normalize(label)))))); return { articleId: r.articleId, title: target.title, description: target.description, reason: r.reason, evidence: r.evidence }; }) })) }));
const held = scored.filter((q: {
    split: string;
}) => q.split === 'held-out');
const categoryCounts = Object.fromEntries(['exact-technical', 'chinese-multiword', 'explicit-alias', 'paraphrase'].map(category => [category, sample.queries.filter((q: {category: string; status?: string}) => q.category === category && !q.status).length]));
const average = (values: {recall: number}[]) => values.length ? values.reduce((sum, q) => sum + q.recall, 0) / values.length : null;
const result = { corpusId: c.corpusId, configurationDigest: c.configurationDigest, previouslyObservedHeldOut: sample.previouslyObservedHeldOut ?? false, sourceGroundedQueries: scored.length, categoryCounts, judgedTargetRecall5: average(scored), heldOutEvaluated: held.length, heldOutRecall5: average(held), evaluationStatus: scored.length ? 'OBSERVATIONAL' : 'NO_JUDGED_DATA', metricsAreReleaseGates: false, measurementLimit: 'Only supplied expected targets are judged; historical observations are regression evidence, not fresh held-out acceptance.', providerEvaluation: 'NOT_RUN', independentHumanReview: 'NOT_RUN', scored, panels };
await mkdir('output/discovery', { recursive: true });
await writeFile('output/discovery/evaluation.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, scored: undefined, panels: undefined }));
