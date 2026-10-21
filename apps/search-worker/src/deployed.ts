import { manifestDeadlineMs, sourceDeadlineMs } from '../../../src/lib/discovery/deadlines';
import { SearchFailure } from './diagnostics';
import type { Corpus, Passage } from '../../../src/lib/discovery/types';
export const manifestUrl = 'https://gcake119.github.io/gcake-dev/discovery-manifest.json';
export async function sha256(text: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map(b => b.toString(16).padStart(2, '0')).join(''); }
async function textBounded(response: Response, limit = 8 * 1024 * 1024) {
    if (!response.ok || response.redirected)
        throw new SearchFailure('invalid_response', 'INVALID_DEPLOYMENT');
    const reader = response.body!.getReader();
    let text = '', size = 0;
    const decoder = new TextDecoder();
    try {
        while (true) {
            const r = await reader.read();
            if (r.done)
                break;
            size += r.value.length;
            if (size > limit) {
                await reader.cancel();
                throw new SearchFailure('invalid_response', 'ASSET_TOO_LARGE');
            }
            text += decoder.decode(r.value, { stream: true });
        }
        return text + decoder.decode();
    }
    finally {
        reader.releaseLock();
    }
}
interface Asset { href: string; digest: string; }
interface PublicManifest { corpusId: string; assets: Record<'index' | 'passages', Asset>; }
function validateDeadline(timeoutMs: number) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new Error('INVALID_DOWNLOAD_DEADLINE');
}
async function sourceOperation<T>(signal: AbortSignal, timeoutMs: number, operation: (bounded: AbortSignal) => Promise<T>) {
    const timeout = AbortSignal.timeout(timeoutMs), cancel = new AbortController();
    const bounded = AbortSignal.any([signal, timeout, cancel.signal]);
    try {
        if (bounded.aborted) throw new SearchFailure('timeout');
        return await operation(bounded);
    } catch (error) {
        if (signal.aborted || timeout.aborted) throw new SearchFailure('timeout');
        if (error instanceof SyntaxError) throw new SearchFailure('invalid_response');
        throw error;
    } finally {
        // Promise.all handles both rejections; cancel a sibling fetch/body on any failure.
        cancel.abort();
    }
}
async function publicManifest(fetcher: typeof fetch, signal: AbortSignal): Promise<PublicManifest> {
    const response = await fetcher(manifestUrl, { cache: 'no-store', redirect: 'manual', signal });
    const m = JSON.parse(await textBounded(response, 32768));
    if (!m || m.schemaVersion !== 1 || !/^\w{64}$/.test(m.corpusId) || !m.assets)
        throw new SearchFailure('invalid_response', 'INVALID_MANIFEST');
    // Validate both descriptors before starting either independent download.
    for (const kind of ['index', 'passages'] as const) {
        const a = m.assets[kind];
        if (typeof a?.href !== 'string' || !/^\w{64}$/.test(a?.digest)) throw new SearchFailure('invalid_response', 'INVALID_ASSET');
        let url: URL;
        try { url = new URL(a.href, manifestUrl); } catch { throw new SearchFailure('invalid_response', 'INVALID_ASSET'); }
        if (url.origin !== new URL(manifestUrl).origin || url.pathname !== `/gcake-dev/discovery/${m.corpusId}/${kind}.json` || url.search || url.hash)
            throw new SearchFailure('invalid_response', 'INVALID_ASSET');
    }
    return m;
}
function identity(m: PublicManifest) {
    return JSON.stringify([m.corpusId, m.assets.index.href, m.assets.index.digest, m.assets.passages.href, m.assets.passages.digest]);
}
/** Fresh metadata only, for the final request-local release check; never an asset cache. */
export function deployedManifest(fetcher: typeof fetch = fetch, timeoutMs = manifestDeadlineMs) {
    validateDeadline(timeoutMs);
    return (signal: AbortSignal) => sourceOperation(signal, timeoutMs, async bounded => {
        const m = await publicManifest(fetcher, bounded);
        return { corpusId: m.corpusId, sourceIdentity: identity(m) };
    });
}
export function deployedReader(fetcher: typeof fetch = fetch, timeoutMs = sourceDeadlineMs) {
    validateDeadline(timeoutMs);
    return (signal: AbortSignal) => sourceOperation(signal, timeoutMs, async bounded => {
        // Workers supports manual/follow only; textBounded rejects every 3xx.
        const m = await sourceOperation(bounded, timeoutMs > sourceDeadlineMs ? timeoutMs : Math.min(timeoutMs, manifestDeadlineMs), signal => publicManifest(fetcher, signal));
        async function asset<T>(kind: 'index' | 'passages'): Promise<T> {
            const a = m.assets[kind];
            const text = await textBounded(await fetcher(new URL(a.href, manifestUrl), { cache: 'no-store', redirect: 'manual', signal: bounded }));
            if (await sha256(text) !== a.digest) throw new SearchFailure('invalid_response', 'ASSET_DIGEST_MISMATCH');
            return JSON.parse(text);
        }
        const [corpus, passages] = await Promise.all([asset<Corpus>('index'), asset<Passage[]>('passages')]);
        if (!corpus || corpus.schemaVersion !== 1 || corpus.corpusId !== m.corpusId || !Array.isArray(passages))
            throw new SearchFailure('invalid_response', 'CORPUS_MISMATCH');
        corpus.passages = passages;
        return { corpusId: m.corpusId, corpus, sourceIdentity: identity(m) };
    });
}
