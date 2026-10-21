import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDiscovery } from '../../src/lib/discovery/build.ts';
import { search, tokenize, suggestions } from '../../src/lib/discovery/search.ts';
import type { PublicSource } from '../../src/lib/discovery/types.ts';
export const config = { now: '2026-10-21T00:00:00Z', sourceTree: 'fixture-tree', snapshotDigest: 'fixture-snapshot', baseUrl: 'https://gcake119.github.io/gcake-dev' };
export const source = (id: string, patch: Partial<PublicSource> = {}): PublicSource => ({ source: 'local', id, title: id, href: `/gcake-dev/posts/${id}/`, canonicalUrl: `https://gcake119.github.io/gcake-dev/posts/${id}/`, status: 'published', topics: ['workflow'], series: 'learning', html: '<h2 id="evidence">工作流程</h2><p>工作流程 自動化 錯誤恢復 排程</p>', ...patch });
test('Local and imported articles share a slug', () => {
    const c = buildPublicDiscovery([source('same'), source('same', { source: 'ithome', href: '/gcake-dev/series/ithome-2026/same/' })], config);
    assert.equal(c.articles.length, 2);
    assert.equal(new Set(c.articles.map(a => a.articleId)).size, 2);
    assert.equal(search(c, 'same').total, 2);
});
test('Draft and future article exclusion', () => {
    const c = buildPublicDiscovery([source('public'), source('secret', { status: 'draft' }), source('tomorrow', { publishedAt: '2026-10-22T00:00:00Z' })], config);
    assert.equal(c.articles.length, 1);
    assert.doesNotMatch(JSON.stringify(c), /secret|tomorrow/);
});
test('Identical source rebuild and matching passage anchors', () => {
    const a = buildPublicDiscovery([source('a')], config), b = buildPublicDiscovery([source('a')], { ...config, sourceTree: 'fixture-tree' });
    assert.deepEqual(a, b);
    assert.equal(a.passages[0].href, '/gcake-dev/posts/a/#evidence');
    assert.equal(a.passages[0].revision, a.articles[0].sourceRevision);
    assert.ok(a.passages.every(p => [...p.text].length <= 800));
});
test('Interactive MDX is excluded without execution or hidden text', () => {
    const c = buildPublicDiscovery([source('a', { interactive: true, html: '<Widget>secret()</Widget>' }), source('b', { html: '<p>visible</p><script>secret()</script><p hidden>secret()</p><style>secret()</style>' })], config);
    assert.ok(c.diagnostics.some(d => d.code === 'INTERACTIVE_CONTENT_EXCLUDED'));
    assert.doesNotMatch(JSON.stringify(c.passages), /secret/);
});
test('Article becomes public, edits, renames, withdrawals and deletions refresh the release', () => {
    const a = source('a', { html: '<p>oldword <a href="/gcake-dev/posts/b/">B</a></p>' }), b = source('b');
    const old = buildPublicDiscovery([a, b], config), edited = buildPublicDiscovery([{ ...a, title: 'newtitle', html: '<p>newword</p>' }, b], config), renamed = buildPublicDiscovery([source('renamed'), b], config), removed = buildPublicDiscovery([b], config);
    assert.notEqual(old.corpusId, edited.corpusId);
    assert.equal(search(edited, 'oldword').total, 0);
    assert.equal(search(edited, 'newword').total, 1);
    assert.doesNotMatch(JSON.stringify(renamed), /posts\/a\//);
    assert.equal(removed.connections['local:b'].incoming.length, 0);
    assert.equal(search(removed, 'oldword').total, 0);
    assert.equal(buildPublicDiscovery([source('future', { publishedAt: '2026-10-22T00:00:00Z' })], { ...config, now: '2026-10-23T00:00:00Z' }).articles.length, 1);
    // Failed candidates never mutate a last-confirmed immutable release.
    assert.throws(() => buildPublicDiscovery([source('bad', { href: 'javascript:alert(1)' })], config));
    assert.equal(search(old, 'oldword').total, 1);
});
test('Explicit acronym definition and ambiguous token', () => {
    const c = buildPublicDiscovery([source('a', { html: '<p>Retrieval-Augmented Generation（RAG）讓檢索有依據。</p>' }), source('b', { html: '<p>XYZ apple orange</p>' })], config);
    assert.ok(c.aliases.some(a => a.short === 'rag' && a.evidence));
    assert.equal(search(c, 'RAG').results[0].articleId, 'local:a');
    assert.equal(search(c, 'Retrieval-Augmented Generation').results[0].articleId, 'local:a');
    assert.ok(!c.aliases.some(a => a.short === 'xyz'));
});
test('No usable terms remains searchable and technical punctuation stays distinct', () => {
    const c = buildPublicDiscovery([source('a', { html: '<p>的了和</p>' }), source('cpp', { html: '<p>C++</p>' }), source('cs', { html: '<p>C#</p>' })], config);
    assert.equal(c.articles[0].terms.length, 0);
    assert.equal(search(c, '的了和').total, 1);
    assert.deepEqual(search(c, 'C++').results.map(a => a.articleId), ['local:cpp']);
    assert.ok(tokenize('C++ C# .NET').includes('c++'));
});
test('Citation creates backlink; recommendations never create citations', () => {
    const c = buildPublicDiscovery([source('a', { html: '<p><a href="/gcake-dev/posts/b/#evidence">B</a><a href="https://gcake119.github.io/gcake-dev/posts/b/">B</a><a href="/gcake-dev/posts/a/">self</a><a href="javascript:bad">bad</a><a href="/gcake-dev/posts/hidden/">secret</a><a href="https://example.com/ref">Reference</a></p>' }), source('b'), source('c'), source('hidden', { status: 'draft' })], config);
    assert.deepEqual(c.connections['local:a'].outgoing, ['local:b']);
    assert.deepEqual(c.connections['local:b'].incoming, ['local:a']);
    assert.equal(c.connections['local:c'].incoming.length, 0);
    assert.deepEqual(c.connections['local:a'].external, [{ title: 'Reference', href: 'https://example.com/ref' }]);
});
test('Complementary next reading, sparse candidates and current deterministic fallback', () => {
    const c = buildPublicDiscovery([source('a', { html: '<p>workflow automation decomposition</p>' }), source('b', { html: '<p>workflow automation decomposition</p>' }), source('c', { html: '<p>workflow automation recovery retries scheduling</p>' })], config);
    const a = c.connections['local:a'];
    assert.ok(a.further.some(r => r.articleId === 'local:c'));
    assert.ok(a.related.some(r => r.articleId === 'local:b'));
    assert.equal(new Set([...a.further, ...a.related].map(r => r.articleId)).size, a.further.length + a.related.length);
    for (const r of a.further)
        assert.ok(r.evidence.every(id => c.passages.some(p => p.passageId === id)));
    assert.equal(buildPublicDiscovery([source('alone')], config).connections['local:alone'].related.length, 0);
});
test('Title outranks incidental body mention, Chinese input, safe excerpt', () => {
    const c = buildPublicDiscovery([source('a', { title: 'RAG', html: '<p>RAG 自動發文</p>' }), source('b', { html: '<p>RAG &lt;img onerror=evil&gt;</p>' })], config);
    assert.equal(search(c, 'RAG').results[0].articleId, 'local:a');
    assert.equal(search(c, '自動發文').results[0].articleId, 'local:a');
    assert.equal(typeof search(c, 'RAG').results[1].excerpt, 'string');
});
test('Share filtered search, pagination, partial labels and bounded input', () => {
    const c = buildPublicDiscovery(Array.from({ length: 25 }, (_, i) => source(`a${i}`, { title: 'workflow', topics: [i < 22 ? 'a' : 'b'] })), config);
    const result = search(c, 'workflow', { topic: 'a', series: 'learning', page: 2 });
    assert.equal(result.total, 22);
    assert.equal(result.results.length, 10);
    assert.equal(result.page, 2);
    assert.equal(search(c, 'workflow', { page: 90 }).page, 3);
    assert.equal(search(c, ' ').total, 0);
    assert.throws(() => search(c, '中'.repeat(201)));
    assert.equal(search(c, 'xzznothing').total, 0);
    assert.equal(search(c, 'workflow unknown').partial, true);
});
test('Supported topic terms outrank incidental narrative words in recommendation reasons', () => {
    const c = buildPublicDiscovery([source('a', { html: '<h2 id="a">workflow automation</h2><p>workflow automation workflow</p>' }), source('b', { html: '<h2 id="b">recovery retries</h2><p>workflow automation recovery retries recovery retries incidentalword</p>' })], config);
    assert.ok(!c.articles.find(a => a.articleId === 'local:b')!.terms.some(t => t.term === 'incidentalword'));
    assert.ok(c.connections['local:a'].further[0].reason.includes('recovery'));
});
test('Field term frequencies reflect repeated evidence rather than vocabulary sets', () => { const c = buildPublicDiscovery([source('a', { html: '<p>recovery recovery recovery</p>' })], config); assert.equal(c.postings.recovery['local:a'].body, 3); });
test('Bilingual explicit aliases retain source evidence', () => { const c = buildPublicDiscovery([source('a', { html: '<p>檢索增強生成（RAG）使用公開段落。</p>' })], config); assert.ok(c.aliases.some(a => a.short === 'rag' && a.full === '檢索增強生成')); });
test('Invalid public metadata fails candidate instead of silently escaping the site', () => { for (const patch of [{ href: '/gcake-dev/../private/' }, { publishedAt: 'not-a-date' }, { title: ' ' }])
    assert.throws(() => buildPublicDiscovery([source('a', patch)], config)); });
test('Content-addressed extraction reuses unchanged HTML and discards incompatible config cache', () => { const cache = new Map(); const a = buildPublicDiscovery([source('a')], config, cache); const entries = cache.size; assert.ok(entries > 0); const b = buildPublicDiscovery([source('a'), source('b')], config, cache); assert.equal(cache.size, entries); assert.equal(b.articles.length, 2); assert.deepEqual(a.passages[0].text, b.passages[0].text); });
test('Compact keyword asset preserves ranking and excerpts after lazy passage hydration', async () => { const { lexicalAsset } = await import('../../src/lib/discovery/assets'); const full = buildPublicDiscovery([source('a', { html: '<p>workflow recovery recovery</p>' }), source('b')], config), compact = lexicalAsset(full); assert.ok(JSON.stringify(compact).length < JSON.stringify({ ...full, passages: [], connections: {} }).length); assert.deepEqual(search({ ...compact, passages: full.passages }, 'recovery'), search(full, 'recovery')); });

test('No-match suggestions offer evidenced vocabulary without replacing the query',()=>{const c=buildPublicDiscovery([source('a')],config);assert.equal(search(c,'xzzunknown').total,0);assert.ok(suggestions(c,'xzzunknown').length>0);assert.ok(suggestions(c,'xzzunknown').every(t=>c.articles.some(a=>a.terms.some(term=>term.term===t))));});
test('Every displayed recommendation term has its own supporting passage',()=>{const c=buildPublicDiscovery([source('a',{title:'workflow recovery',html:'<p>workflow recovery</p>'}),source('b',{title:'workflow recovery',html:'<p>workflow</p><p>workflow</p><p>recovery</p><p>recovery</p>'})],config);const related=c.connections['local:a'].related[0];assert.ok(related);for(const term of related.reason.split('：')[1].split('、'))assert.ok(related.evidence.some(id=>c.passages.some(p=>p.passageId===id&&p.text.toLowerCase().includes(term))),term);});

test('Reviewed bilingual definition is tied to its exact public revision and quotation', () => {
    const quotation = '我已經有一部分系統層級的理解（system-level understanding）。';
    const article = source('bilingual', { html: `<p>${quotation}</p>` });
    const before = buildPublicDiscovery([article], config);
    const correction = { articleId: 'local:bilingual', sourceRevision: before.articles[0].sourceRevision, full: '系統層級的理解', short: 'system-level understanding', quotation, reviewer: 'Codex public-source review' };
    const reviewedConfig = { ...config, reviewedAliases: [correction] };
    const after = buildPublicDiscovery([article], reviewedConfig);
    assert.equal(after.aliases.length, 1);
    assert.equal(after.aliases[0].origin, 'reviewed-public-definition');
    assert.ok(after.passages.some(p => p.passageId === after.aliases[0].evidence && p.text.includes(quotation)));
    assert.notEqual(after.corpusId, before.corpusId);
    for (const query of [correction.full, correction.short]) assert.equal(search(after, query).results[0].articleId, 'local:bilingual');
    assert.equal(buildPublicDiscovery([{ ...article, html: `<p>修訂後：${quotation}</p>` }], reviewedConfig).aliases.length, 0);
    assert.equal(buildPublicDiscovery([{ ...article, status: 'draft' }], reviewedConfig).aliases.length, 0);
    assert.equal(buildPublicDiscovery([article], { ...config, reviewedAliases: [{ ...correction, quotation: '不存在的原文' }] }).aliases.length, 0);
    assert.equal(buildPublicDiscovery([article], { ...config, reviewedAliases: [{ ...correction, full: '沒有出現的詞' }] }).aliases.length, 0);
});

test('Acronyms expand as technical words rather than substrings inside unrelated words', () => {
    const c = buildPublicDiscovery([source('api', { title: '介面約定', html: '<p>Application Programming Interface（API）</p>' })], config);
    assert.equal(search(c, 'capital').total, 0);
    assert.equal(search(c, 'api').total, 1);
    assert.equal(search(c, 'API使用方式').total, 1);
});
test('Narrative fillers cannot become recommendation explanations even in a heading', () => {
    const c = buildPublicDiscovery([source('a', {title:'工作流程',html:'<h2 id="a">幾乎 都會 足以 一串 原來 之後</h2><p>工作流程 工程決策 系統分工 幾乎 都會 足以 一串 原來 之後</p><p>工程決策 系統分工</p>'})],config);
    const terms=c.articles[0].terms.map(t=>t.term);
    for(const term of ['幾乎','都會','足以','一串','原來','之後']) assert.ok(!terms.includes(term),term);
    assert.ok(terms.some(t=>['工程','決策','分工'].includes(t)));
});
test('Shared narrative without a supported explanation does not create an empty recommendation',()=>{
    const c=buildPublicDiscovery([source('a',{html:'<p>幾乎 都會 足以 一串 原來 之後</p>'}),source('b',{html:'<p>幾乎 都會 足以 一串 原來 之後</p>'})],config);
    for(const group of Object.values(c.connections)){assert.deepEqual(group.related,[]);assert.deepEqual(group.further,[]);}
});


test('Distinct identities cannot share a normalized primary reading URL',()=>{
    for(const href of ['/gcake-dev/posts/shared/','/gcake-dev/posts/shared','/gcake-dev/posts/shared/?view=reading#section']){
        assert.throws(()=>buildPublicDiscovery([source('a',{href:'/gcake-dev/posts/shared/'}),source('b',{href})],config),/AMBIGUOUS_READING_URL/);
    }
    const valid=buildPublicDiscovery([source('same'),source('same',{source:'ithome',href:'/gcake-dev/series/ithome-2026/same/'})],config);
    assert.equal(new Set(valid.articles.map(a=>a.href)).size,2);
});
