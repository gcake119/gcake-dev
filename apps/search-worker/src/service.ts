import { search } from '../../../src/lib/discovery/search';
import type { Corpus, SearchResult } from '../../../src/lib/discovery/types';
import { unitNames, type Admission, type Units } from './admission';
export const approvedModel = '@cf/baai/bge-m3';
export interface SearchPolicy {
    enabled: boolean;
    activeCorpusId: string;
    model: string;
    modelConfig: string;
    dimensions: number;
    format: string;
    inputLimit: number;
    billing: {
        model: string;
        id: string;
        validUntil: string;
        rate: number;
        freeVerified: boolean;
        noChargeBoundary: boolean;
        account: string;
        providerResetVerified: boolean;
        windowId: string;
        noChargeTerms?: string;
        services: string[];
    };
    limits: Units;
    paidOverage: number;
    throttleSecret: string;
    qualityVerified: boolean;
    providerInputVerified: boolean;
}
export interface Deployed {
    corpusId: string;
    corpus: Corpus;
}
export interface VectorMatch {
    id: string;
    articleId: string;
    revision: string;
}
export interface Dependencies {
    policy: SearchPolicy;
    admission: Admission;
    manifest(signal: AbortSignal): Promise<Deployed>;
    embed(text: string, signal: AbortSignal): Promise<number[]>;
    vectors(vector: number[], corpusId: string, filters: {
        topic?: string;
        series?: string;
    }, signal: AbortSignal): Promise<VectorMatch[]>;
    now?: () => number;
}
const error = (status: number, code: string) => Response.json({ code, retryable: status === 503, fallback: 'keyword' }, { status });
async function keyed(secret: string, value: string) { const enc = new TextEncoder(), key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value)))).map(b => b.toString(16).padStart(2, '0')).join(''); }
export function eligible(p: SearchPolicy, now: number) {
    return p.enabled === true && p.model === approvedModel && p.dimensions === 1024 && p.format === 'plain'
        && Number.isSafeInteger(p.inputLimit) && p.inputLimit > 0 && !!p.modelConfig
        && p.qualityVerified === true && p.providerInputVerified === true && p.paidOverage === 0 && !!p.throttleSecret
        && p.billing?.model === p.model && !!p.billing.id && !!p.billing.account && Date.parse(p.billing.validUntil) > now
        && Number.isFinite(p.billing.rate) && (p.billing.rate > 0 || p.billing.rate === 0 && !!p.billing.noChargeTerms)
        && p.billing.freeVerified === true && p.billing.noChargeBoundary === true && p.billing.providerResetVerified === true
        && p.billing.windowId === new Date(now).toISOString().slice(0, 10)
        && ['embedding', 'vector-query', 'vector-storage', 'worker', 'admission'].every(s => p.billing.services.includes(s))
        && unitNames.every(k => Number.isFinite(p.limits?.[k]) && p.limits[k] > 0);
}

async function boundedBody(request: Request, signal: AbortSignal) {
    const reader = request.body?.getReader();
    if (!reader)
        throw new Error('INVALID_QUERY');
    const chunks: Uint8Array[] = [];
    let size = 0;
    const cancel = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener('abort', cancel, { once: true });
    try {
        while (true) {
            if (signal.aborted) throw new Error('DEADLINE_EXCEEDED');
            const { value, done } = await reader.read();
            if (done)
                break;
            size += value.length;
            if (size > 4096) {
                await reader.cancel();
                throw new Error('INVALID_QUERY');
            }
            chunks.push(value);
        }
        const joined = new Uint8Array(size);
        let i = 0;
        for (const c of chunks) {
            joined.set(c, i);
            i += c.length;
        }
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined));
    }
    finally {
        signal.removeEventListener('abort', cancel);
        reader.releaseLock();
    }
}
export function createSearchService(d: Dependencies) {
    return async (request: Request) => {
        if (new URL(request.url).pathname !== '/v1/search' || request.method !== 'POST')
            return error(404, 'NOT_FOUND');
        const now = d.now?.() ?? Date.now(), controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const operation = async () => {
                const input = await boundedBody(request, controller.signal);
                if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['q', 'corpusId', 'topic', 'series', 'page', 'sort', 'limit'].includes(k)) || typeof input.q !== 'string' || !input.q.trim() || [...input.q].length > 200 || typeof input.corpusId !== 'string' || input.page !== undefined && (!Number.isSafeInteger(input.page) || input.page < 1) || input.limit !== undefined && (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 10) || input.sort !== undefined && !['relevance', 'newest'].includes(input.sort) || ['topic', 'series'].some(k => input[k] !== undefined && typeof input[k] !== 'string'))
                    return error(400, 'INVALID_QUERY');
                const p = d.policy;
                if (!eligible(p, now))
                    return error(503, 'SERVICE_UNAVAILABLE');
                const deployed = await d.manifest(controller.signal);
                if(controller.signal.aborted)throw new Error('DEADLINE_EXCEEDED');
                if (input.corpusId !== deployed.corpusId || input.corpusId !== p.activeCorpusId || deployed.corpus.corpusId !== input.corpusId)
                    return error(409, 'CORPUS_MISMATCH');
                const c = deployed.corpus;
                if (input.topic && !c.articles.some(a => a.topics.includes(input.topic)) || input.series && !c.articles.some(a => a.series === input.series))
                    return error(400, 'INVALID_QUERY');
                // UTF-8 byte count is conservative; verified tokenizer/endpoint limits required before activation.
                const tokens = new TextEncoder().encode(input.q).length;
                if (tokens > p.inputLimit)
                    return error(400, 'INVALID_QUERY');
                const window = p.billing.windowId, minute = Math.floor(now / 60000), key = await keyed(p.throttleSecret, minute + ':' + (request.headers.get('CF-Connecting-IP') ?? 'unknown'));
                const cost = { requests: 1, tokens, units: Math.ceil(tokens * p.billing.rate * 1e6) / 1e6, vectorQueries: 1, storage: 0, worker: 1, admission: 4 };
                if (!await d.admission.reserve(window, key, cost, p.limits, now))
                    return error(429, 'QUOTA_EXCEEDED');
                // Unknown outcome retains the full conservative reservation; no automatic retry.
                if(controller.signal.aborted)throw new Error('DEADLINE_EXCEEDED');
                const vector = await d.embed(input.q, controller.signal);
                if(controller.signal.aborted)throw new Error('DEADLINE_EXCEEDED');
                if (vector.length !== 1024 || vector.some(n => !Number.isFinite(n)) || !vector.some(n => n !== 0))
                    throw new Error('INVALID_VECTOR');
                const remote = await d.vectors(vector, input.corpusId, { topic: input.topic, series: input.series }, controller.signal);
                if(controller.signal.aborted)throw new Error('DEADLINE_EXCEEDED');
                const lexical = Array.from({ length: 5 }, (_, i) => search(c, input.q, { topic: input.topic, series: input.series, page: i + 1, limit: 10 }).results).flat();
                const allowed = c.articles.filter(a => (!input.topic || a.topics.includes(input.topic)) && (!input.series || a.series === input.series)), ids = new Set(allowed.map(a => a.articleId));
                const ranks = new Map<string, {
                    score: number;
                    passageId?: string;
                }>();
                for (const [rank, r] of [...new Map(lexical.map(r => [r.articleId, r])).values()].entries())
                    ranks.set(r.articleId, { score: 1 / (60 + rank + 1), passageId: r.passageId });
                const seen = new Set<string>();
                for (const [rank, r] of remote.entries()) {
                    if (seen.has(r.articleId) || !ids.has(r.articleId))
                        continue;
                    const passage = c.passages.find(p => p.passageId === r.id && p.articleId === r.articleId && p.revision === r.revision);
                    const article = allowed.find(a => a.articleId === r.articleId);
                    if (!passage || article?.sourceRevision !== r.revision)
                        continue;
                    seen.add(r.articleId);
                    const old = ranks.get(r.articleId);
                    ranks.set(r.articleId, { score: (old?.score ?? 0) + 1 / (60 + rank + 1), passageId: passage.passageId });
                }
                const pool = [...ranks].sort((x, y) => y[1].score - x[1].score || x[0].localeCompare(y[0])).slice(0, 50);
                if (input.sort === 'newest')
                    pool.sort((x, y) => (allowed.find(a => a.articleId === y[0])!.publishedAt).localeCompare(allowed.find(a => a.articleId === x[0])!.publishedAt) || x[0].localeCompare(y[0]));
                const total = pool.length, limit = input.limit ?? 10, page = Math.max(1, Math.min(input.page ?? 1, Math.ceil(total / limit) || 1));
                const results: SearchResult[] = pool.slice((page - 1) * limit, page * limit).map(([id, rank]) => { const a = allowed.find(a => a.articleId === id)!, p = c.passages.find(p => p.passageId === rank.passageId); return { articleId: id, title: a.title, readingHref: p?.href ?? a.href, excerpt: [...(p?.text ?? a.description)].slice(0, 120).join(''), passageId: p?.passageId, series: a.seriesTitle, topics: a.topics, score: rank.score }; });
                const latest = await d.manifest(controller.signal);
                if (latest.corpusId !== input.corpusId)
                    return error(409, 'CORPUS_MISMATCH');
                return Response.json({ corpusId: input.corpusId, mode: 'hybrid', total, page, hasMore: page * limit < total, candidateLimited: ranks.size >= 50, results });
            };
            return await Promise.race([operation(), new Promise<Response>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(error(503, 'SERVICE_UNAVAILABLE')); }, 5000); })]);
        }
        catch (e) {
            return error(String(e).includes('INVALID_QUERY') || e instanceof SyntaxError ? 400 : 503, String(e).includes('INVALID_QUERY') || e instanceof SyntaxError ? 'INVALID_QUERY' : 'SERVICE_UNAVAILABLE');
        }
        finally {
            clearTimeout(timer);
        }
    };
}
