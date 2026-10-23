import { createHash } from 'node:crypto';
import { parseHTML } from 'linkedom';
import { normalize, tokenize, tokenOccurrences } from './search';
import type { Article, Corpus, Passage, PublicSource, ReleaseConfig, Recommendation } from './types';
export const digest = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
/** Stable object keys; arrays retain retrieval order unless explicitly normalized as sets. */
function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
    return value;
}
const narrativeTerms = new Set('幾乎 都會 足以 一串 原來 之後 做得 不動 出來 先看 平常 一句 後面 都要 找到 沒說 所有 交給 都能 就要 看見 做什麼 為什麼 到底 不算 一支 部分 看懂 主要 對了 我要 哪些 代表 必須 感受到 沿著 形成 變化 寫完 系統的 說的 一種 不要 方法 方式 只能 變成 還要 繼續 逐漸 實際 已有 這種 這份 大概 一次 另一個 第一個 第二個 更少 支持 接觸 月底 很喜歡 補完 看到 就好 應該 不用 一天 常常 有些 本來 很有 相信 什麼時候 就在 完整 一起 不同 每次 完全 不太 遇到 這時 前後 當下 進來 拿來 放在 從來 整個 這些 其他 另外 這一點 最後 接下來 再次 原先 我們 於是 而是 而且 甚至 好像 似乎 許多 通常 往往 先前 這份'.split(' '));
export const configuration = { schema: 1, termStopList: [...narrativeTerms].sort(), serialization: 'compact-field-lengths-1', connectionEvidence:'per-label-3-nonempty', extraction: 'html-evidence-terms3', normalization: 'nfkc-segmenter-han2-stop2', aliases: 'explicit-word-boundaries-2', ranking: 'bm25-tf-1.2-.75-fields-5-3-2-2-1-.5-connections-.7-.3-.15-1', segmenter: process.versions.icu };
const clean = (s: string) => (s ?? '').replace(/\s+/g, ' ').trim();
function safeUrl(value: string, base: string) {
    try {
        const u = new URL(value, base);
        return ['https:', 'http:'].includes(u.protocol) ? u : undefined;
    }
    catch {
        return undefined;
    }
}
interface Extracted {
    links: {
        title: string;
        href: string;
    }[];
    code: string;
    blocks: {
        tagName: string;
        id: string;
        text: string;
    }[];
    fallback: string;
}
function extract(html: string, key: string, cache: Map<string, Extracted>): Extracted {
    const reused = cache.get(key);
    if (reused)
        return reused;
    const { document } = parseHTML(`<html><body>${html}</body></html>`);
    document.querySelectorAll('script,style,noscript,template,iframe,[hidden],[aria-hidden="true"],[style*="display:none"],[style*="display: none"]').forEach(e => e.remove());
    const links = [...document.querySelectorAll('a[href]')].map(e => ({ title: clean(e.textContent ?? ''), href: e.getAttribute('href') ?? '' }));
    const code = [...document.querySelectorAll('pre')].map(e => { const text = e.textContent ?? ''; e.remove(); return text; }).join('\n');
    const duplicateIds = new Set([...document.querySelectorAll('[id]')].map(e => e.id).filter((id, i, ids) => ids.indexOf(id) !== i));
    const blocks = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,td')].filter(e => !e.parentElement?.closest('p,li,blockquote,td')).map(e => ({ tagName: e.tagName, id: duplicateIds.has(e.id) ? '' : e.id, text: clean(e.textContent ?? '') }));
    const value = { links, code, blocks, fallback: clean(document.body.textContent ?? '') };
    cache.set(key, value);
    return value;
}
export function buildPublicDiscovery(sources: PublicSource[], config: ReleaseConfig, extractionCache: Map<string, Extracted> = new Map()): Corpus {
    if (!Number.isFinite(Date.parse(config.now)))
        throw new Error('INVALID_RELEASE_TIME');
    for (const source of sources)
        if (source.status === 'published' && source.publishedAt && !Number.isFinite(Date.parse(source.publishedAt)))
            throw new Error('INVALID_PUBLIC_SOURCE');
    const configurationDigest = digest(canonical({ ...configuration, reviewedAliases: config.reviewedAliases ?? [] })), eligible = sources.filter(s => s.status === 'published' && (!s.publishedAt || Date.parse(s.publishedAt) <= Date.parse(config.now))).map(s => ({...s, topics: [...new Set(s.topics)].sort(), aliases: [...new Set(s.aliases ?? [])].sort()})).sort((a, b) => `${a.source}:${a.id}`.localeCompare(`${b.source}:${b.id}`));
    const c: Corpus = { schemaVersion: 1, corpusId: '', configurationDigest, articles: [], passages: [], aliases: [], postings: {}, connections: {}, diagnostics: [] };
    const links = new Map<string, {
        title: string;
        href: string;
    }[]>(), urlIds = new Map<string, string>();
    const identityUrl = (value: string) => {
        const u = safeUrl(value, config.baseUrl + '/');
        if (!u)
            return '';
        u.hash = '';
        u.search = '';
        return u.href.replace(/\/$/, '');
    };
    const readingIds = new Map<string, string>();
    for (const s of eligible) {
        const key = identityUrl(s.href), articleId = `${s.source}:${s.id}`;
        const existing = readingIds.get(key);
        if (existing && existing !== articleId)
            throw new Error('AMBIGUOUS_READING_URL');
        readingIds.set(key, articleId);
    }
    for (const s of eligible) {
        const articleId = `${s.source}:${s.id}`;
        if (c.articles.some(a => a.articleId === articleId) || !s.title.trim() || !s.href.startsWith(new URL(config.baseUrl).pathname + '/') || !new URL(s.href, config.baseUrl).pathname.startsWith(new URL(config.baseUrl).pathname + '/') || !safeUrl(s.href, config.baseUrl) || !safeUrl(s.canonicalUrl, config.baseUrl))
            throw new Error('INVALID_PUBLIC_SOURCE');
        const revision = digest({ source: s.sourceRevision ?? s.html, title: s.title, description: s.description, topics: s.topics, href: s.href, canonical: s.canonicalUrl, series: s.series, date: s.publishedAt });
        const html = s.interactive ? '' : s.html, extracted = extract(html, digest([html, configurationDigest]), extractionCache);
        if (s.interactive)
            c.diagnostics.push({ articleId, code: 'INTERACTIVE_CONTENT_EXCLUDED' });
        links.set(articleId, extracted.links);
        const code = extracted.code;
        const headings: string[] = [];
        let heading = '', anchor: string | undefined, overlap = '';
        const ps: Passage[] = [];
        for (const el of extracted.blocks) {
            const text = el.text;
            if (!text)
                continue;
            if (/^H[1-6]$/.test(el.tagName)) {
                heading = text;
                anchor = el.id || undefined;
                headings.push(text);
                overlap = '';
                continue;
            }
            const chars = [...text];
            for (let offset = 0; offset < chars.length;) {
                const prefix = offset === 0 ? overlap : '';
                const chunk = clean(prefix + ' ' + chars.slice(offset, offset + 800 - [...prefix].length - 1).join(''));
                offset += 800 - [...prefix].length - 1;
                const passageId = digest([articleId, revision, heading, anchor, ps.length, chunk]).slice(0, 32);
                ps.push({ articleId, revision, passageId, heading, anchor, href: s.href + (anchor ? '#' + encodeURIComponent(anchor) : ''), text: chunk });
            }
            overlap = [...text].slice(-120).join('');
        }
        if (!ps.length && extracted.fallback)
            for (let i = 0; i < [...extracted.fallback].length; i += 800) {
                const text = [...extracted.fallback].slice(i, i + 800).join('');
                ps.push({ articleId, revision, passageId: digest([articleId, revision, i, text]).slice(0, 32), heading: '', href: s.href, text });
            }
        c.passages.push(...ps);
        const text = ps.map(p => p.text).join('\n');
        const a: Article = { articleId, sourceRevision: revision, title: s.title, href: s.href, canonicalUrl: s.canonicalUrl, description: s.description ?? '', topics: [...s.topics].sort(), series: s.series ?? '', seriesTitle: s.seriesTitle ?? s.series ?? '獨立文章', publishedAt: s.publishedAt ?? '', terms: [], fields: {}, text, headings: headings.join(' '), code };
        for (const p of ps)
            for (const m of p.text.matchAll(/([A-Za-z][A-Za-z -]{4,80}?|[\p{Script=Han}]{2,30})\s*[（(]([A-Z][A-Z0-9+.#-]{1,12})[）)]/gu))
                c.aliases.push({ full: normalize(m[1].trim()), short: normalize(m[2]), evidence: p.passageId, articleId, origin: 'explicit-pattern' });
        a.fields = { title: tokenOccurrences(s.title), headings: tokenOccurrences(a.headings), description: tokenOccurrences(a.description), body: tokenOccurrences(text), code: tokenOccurrences(code), terms: [] };
        c.articles.push(a);
        c.connections[articleId] = { outgoing: [], incoming: [], external: [], related: [], further: [] };
        for (const href of [s.href, s.canonicalUrl, ...s.aliases ?? []]) {
            const key = identityUrl(href);
            if (readingIds.has(key) && readingIds.get(key) !== articleId)
                continue;
            const known = urlIds.get(key);
            if (known && known !== articleId) {
                if (href === s.href)
                    throw new Error('AMBIGUOUS_READING_URL');
                continue;
            }
            urlIds.set(key, articleId);
        }
    }
    // Reviewed corrections remain bound to the actual public passage, not a title match.
    for (const correction of config.reviewedAliases ?? []) {
        const full = normalize(correction.full.trim()), short = normalize(correction.short.trim());
        if (!full || !short || full === short || !correction.reviewer.trim() || !correction.quotation.trim()) continue;
        const quote = normalize(correction.quotation);
        if (!quote.includes(full) || !quote.includes(short)) continue;
        const passage = c.passages.find(p => p.articleId === correction.articleId && p.revision === correction.sourceRevision && p.text.includes(correction.quotation));
        if (passage) c.aliases.push({ full, short, evidence: passage.passageId, articleId: passage.articleId, origin: 'reviewed-public-definition', reviewer: correction.reviewer });
    }
    // Unsupported/ambiguous definitions never expand globally.
    const meanings = new Map<string, Set<string>>();
    for (const a of c.aliases) {
        if (!meanings.has(a.short))
            meanings.set(a.short, new Set());
        meanings.get(a.short)!.add(a.full);
    }
    c.aliases = c.aliases.filter(a => meanings.get(a.short)!.size === 1);
    const df = new Map<string, number>();
    for (const a of c.articles)
        for (const t of new Set(a.fields.body))
            df.set(t, (df.get(t) ?? 0) + 1);
    for (const a of c.articles) {
        const titleTerms = new Set(tokenize(a.title, false)), headingTerms = new Set(tokenize(a.headings, false));
        const termCounts = new Map<string, number>();
        for (const token of tokenOccurrences(a.text, false))
            termCounts.set(token, (termCounts.get(token) ?? 0) + 1);
        a.terms = [...termCounts].filter(([t, count]) => [...t].length > 1 && !narrativeTerms.has(t) && !/^\d+$/.test(t) && !['day', '篇', '上', '前面', '寫到', '一篇', '你們', '原本', '的是', '第一次', '第一', '這件事', '一件事', '做到', '某個', '幾', '其實', '一位', '兩次', '以外', '原封', '傳到', '剛剛'].includes(t) && (titleTerms.has(t) || headingTerms.has(t) || count >= 2 || !a.headings || /[+#.]/.test(t))).map(([term, count]) => ({ term, score: (1 + Math.log(count)) * Math.log(1 + c.articles.length / (df.get(term) ?? 1)) + (titleTerms.has(term) ? 10 : 0) + (headingTerms.has(term) ? 4 : 0), evidence: c.passages.filter(p => p.articleId === a.articleId && normalize(p.text).includes(term)).map(p => p.passageId) })).filter(t => t.evidence.length).sort((a, b) => b.score - a.score || a.term.localeCompare(b.term)).slice(0, 20);
        a.fields.terms = a.terms.map(t => t.term);
        for (const [field, tokens] of Object.entries(a.fields))
            for (const t of tokens) {
                c.postings[t] ??= {};
                c.postings[t][a.articleId] ??= {};
                c.postings[t][a.articleId][field] = (c.postings[t][a.articleId][field] ?? 0) + 1;
            }
        for (const l of links.get(a.articleId) ?? []) {
            const u = safeUrl(l.href, new URL(a.href, config.baseUrl).href);
            if (!u)
                continue;
            const target = urlIds.get(identityUrl(u.href));
            if (target && target !== a.articleId)
                c.connections[a.articleId].outgoing.push(target);
            else if (!target && u.origin !== new URL(config.baseUrl).origin)
                c.connections[a.articleId].external.push({ title: l.title || u.hostname, href: u.href });
        }
        c.connections[a.articleId].outgoing = [...new Set(c.connections[a.articleId].outgoing)].sort();
        c.connections[a.articleId].external = [...new Map(c.connections[a.articleId].external.map(l => [l.href, l])).values()];
    }
    for (const a of c.articles)
        for (const target of c.connections[a.articleId].outgoing)
            c.connections[target].incoming.push(a.articleId);
    for (const a of c.articles) {
        const own = new Set(a.fields.body), candidates = c.articles.filter(b => b.articleId !== a.articleId).map(b => { const common = [...new Set(b.fields.body)].filter(t => own.has(t)).length, union = new Set([...a.topics, ...b.topics]).size, topic = union ? a.topics.filter(t => b.topics.includes(t)).length / union : 0, lex = common / Math.sqrt(Math.max(1, own.size * new Set(b.fields.body).size)); return { b, common, relevance: .7 * lex + .3 * topic, newTerms: b.terms.filter(t => !own.has(t.term)), topic }; }).filter(b => b.common >= 2 && b.relevance >= .15);
        const used = new Set<string>(), covered = new Set<string>();
        const further: Recommendation[] = [];
        for (let i = 0; i < 3; i++) {
            const ranked = candidates.filter(x => !used.has(x.b.articleId) && x.newTerms.filter(t => !covered.has(t.term)).length >= 2).map(x => ({ ...x, score: .6 * x.relevance + .4 * x.newTerms.filter(t => !covered.has(t.term)).length / Math.max(1, x.b.terms.length) })).sort((x, y) => y.score - x.score || x.b.articleId.localeCompare(y.b.articleId));
            const x = ranked[0];
            if (!x)
                break;
            const terms = x.newTerms.filter(t => !covered.has(t.term));
            further.push({ articleId: x.b.articleId, reason: '延伸了解：' + terms.slice(0, 2).map(t => t.term).join('、'), evidence: [...new Set(terms.slice(0, 2).flatMap(t => t.evidence))], score: x.score });
            used.add(x.b.articleId);
            terms.forEach(t => covered.add(t.term));
        }
        c.connections[a.articleId].further = further;
        c.connections[a.articleId].related = candidates.filter(x=>!used.has(x.b.articleId)&&x.b.terms.some(t=>own.has(t.term))).sort((x,y)=>y.relevance-x.relevance||x.b.articleId.localeCompare(y.b.articleId)).slice(0,3).map(x=>{
            const terms=x.b.terms.filter(t=>own.has(t.term)).slice(0,2);
            return {articleId:x.b.articleId,reason:'共同主題：'+terms.map(t=>t.term).join('、'),evidence:[...new Set(terms.flatMap(t=>t.evidence.slice(0,1)))],score:x.relevance};
        });
    }
    // Complete effective search data, with provenance kept in the release manifest.
    // Do not hash config.now/sourceTree/snapshotDigest: eligibility is already reflected here.
    c.corpusId = digest(canonical({ domain: 'discovery-content-v2', configurationDigest,
        articles: c.articles, passages: c.passages, aliases: c.aliases, postings: c.postings,
        connections: c.connections, diagnostics: c.diagnostics,
        sourceAliases: eligible.map(s => [s.source, s.id, s.aliases]),
    }));
    return c;
}
