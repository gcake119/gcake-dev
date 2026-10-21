import type { Corpus, SearchOptions, SearchResult } from './types';
export const normalize = (s: string) => s.normalize('NFKC').toLowerCase();
const stops = new Set(['的', '了', '和', '是', '在', '我', '你', '也', '就', '都', '與', '或', '但', '不', '有', '要', '會', 'the', 'a', 'an', 'and', 'to', 'of', 'in', 'for', 'it', 'is', 'this', 'that', '什麼', '這個', '這些', '一個', '自己', '時候', '因為', '所以', '但是', '如果', '可以', '已經', '開始', '後來', '其實', '現在', '當時', '很多', '事情', '怎麼', '只是', '不是', '需要', '沒有', '覺得', '真的', '這樣', '那個', '比較', '這裡', '那些', '這次', '一樣', '知道', '可能', '開始', '一直', '一些', '還是', '還有']);
/** Counts are serialized by the builder; query terms use the same vocabulary. */
export function tokenOccurrences(text: string, includeBigrams = true): string[] {
    const tokens: string[] = [], remaining = normalize(text).replace(/c\+\+|c#|\.net|\b\d+(?:\.\d+)+\b/g, m => { tokens.push(m); return ' '; });
    if (typeof Intl.Segmenter === 'function') {
        for (const s of new Intl.Segmenter('zh-TW', { granularity: 'word' }).segment(remaining))
            if (s.isWordLike && !stops.has(s.segment))
                tokens.push(s.segment);
    }
    else
        for (const word of remaining.match(/[a-z][a-z0-9_-]*/g) ?? [])
            if (!stops.has(word))
                tokens.push(word);
    if (includeBigrams) {
        const counts = new Map<string, number>();
        for (const run of remaining.match(/[\p{Script=Han}]+/gu) ?? []) {
            const chars = [...run];
            for (let i = 0; i < chars.length - 1; i++) {
                const t = chars[i] + chars[i + 1];
                if (!stops.has(t) && !stops.has(chars[i]) && !stops.has(chars[i + 1]))
                    counts.set(t, (counts.get(t) ?? 0) + 1);
            }
        }
        for (const [t, count] of counts)
            for (let n = tokens.filter(v => v === t).length; n < count; n++)
                tokens.push(t);
    }
    return tokens;
}
export function tokenize(text: string, includeBigrams = true) { return [...new Set(tokenOccurrences(text, includeBigrams))]; }
function containsAlias(query: string, alias: string) {
    if (/[\p{Script=Han}]/u.test(alias)) return query.includes(alias);
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9_+#.-])${escaped}(?=$|[^a-z0-9_+#.-])`, 'u').test(query);
}
export function search(corpus: Corpus, query: string, options: SearchOptions = {}) {
    const q = normalize(query.trim());
    if ([...q].length > 200)
        throw new Error('INVALID_QUERY');
    const limit = Math.max(1, Math.min(10, Math.floor(options.limit ?? 10)));
    if (!q)
        return { total: 0, page: 1, partial: false, results: [] as SearchResult[] };
    const original = tokenize(q), expanded = new Map(original.map(t => [t, 1]));
    for (const a of corpus.aliases)
        if (containsAlias(q, a.short) || containsAlias(q, a.full))
            for (const t of tokenize(containsAlias(q, a.short) ? a.full : a.short))
                if (!expanded.has(t))
                    expanded.set(t, .5);
    const weights: Record<string, number> = { title: 5, headings: 3, terms: 2, description: 2, body: 1, code: .5 };
    const average: Record<string, number> = {};
    for (const f of Object.keys(weights))
        average[f] = corpus.articles.reduce((sum, a) => sum + (a.fieldLengths?.[f] ?? a.fields[f]?.length ?? 0), 0) / Math.max(1, corpus.articles.length) || 1;
    const candidates = corpus.articles.filter(a => (!options.topic || a.topics.includes(options.topic)) && (!options.series || a.series === options.series)).flatMap(a => {
        let score = 0, coverage = 0;
        for (const [t, boost] of expanded) {
            const posting = corpus.postings[t], fields = posting?.[a.articleId];
            if (!fields)
                continue;
            if (original.includes(t))
                coverage++;
            const df = Object.keys(posting).length, idf = Math.log(1 + (corpus.articles.length - df + .5) / (df + .5));
            for (const [f, tf] of Object.entries(fields))
                score += boost * (weights[f] ?? 1) * idf * tf * 2.2 / (tf + 1.2 * (.25 + .75 * (a.fieldLengths?.[f] ?? a.fields[f]?.length ?? 0) / average[f]));
        }
        const phrase = normalize(a.text).includes(q) || normalize(a.title).includes(q);
        if (!score && !phrase)
            return [];
        const full = phrase || original.length > 0 && coverage === original.length;
        if (phrase)
            score += 5;
        const tier = normalize(a.title) === q ? 2 : normalize(a.title).includes(q) ? 1 : 0;
        return [{ a, score, full, tier }];
    });
    const anyFull = candidates.some(c => c.full), matches = anyFull ? candidates.filter(c => c.full) : candidates;
    matches.sort((a, b) => (options.sort === 'newest' ? b.a.publishedAt.localeCompare(a.a.publishedAt) : b.tier - a.tier || b.score - a.score) || b.a.publishedAt.localeCompare(a.a.publishedAt) || a.a.articleId.localeCompare(b.a.articleId));
    const total = matches.length, page = Math.max(1, Math.min(Math.ceil(total / limit) || 1, Math.floor(options.page ?? 1) || 1));
    return { total, page, partial: !anyFull && total > 0, results: matches.slice((page - 1) * limit, page * limit).map(({ a, score }) => {
            const ps = corpus.passages.filter(p => p.articleId === a.articleId), p = ps.map(p => ({ p, score: [...expanded.keys()].filter(t => normalize(p.text).includes(t)).length })).sort((a, b) => b.score - a.score)[0]?.p;
            const text = p?.text || a.description || a.text, chars = [...text], lower = normalize(text);
            let start = 0;
            const positions = [...expanded.keys(), q].map(t => lower.indexOf(t)).filter(i => i >= 0);
            if (positions.length)
                start = Math.max(0, [...text.slice(0, Math.min(...positions))].length - 30);
            return { articleId: a.articleId, title: a.title, readingHref: p?.href || a.href, excerpt: (start ? '…' : '') + chars.slice(start, start + 120).join('') + (chars.length > start + 120 ? '…' : ''), passageId: p?.passageId, series: a.seriesTitle, topics: a.topics, score };
        }) };
}
export function suggestions(corpus:Corpus,q:string){
 const n=normalize(q),terms=[...new Set(corpus.articles.flatMap(a=>a.terms.map(t=>t.term)))],matches=terms.filter(t=>!n||normalize(t).includes(n));
 return (matches.length?matches:terms).slice(0,5);
}
