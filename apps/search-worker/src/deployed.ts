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
export function deployedReader(fetcher: typeof fetch = fetch, timeoutMs = 2000) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new Error('INVALID_DOWNLOAD_DEADLINE');
    return async (signal: AbortSignal) => {
        const timeout = AbortSignal.timeout(timeoutMs), bounded = AbortSignal.any([signal, timeout]);
        // Workers supports manual/follow only; textBounded rejects every 3xx before reading it.
        try {
            const response = await fetcher(manifestUrl, { cache: 'no-store', redirect: 'manual', signal: bounded });
            const m = JSON.parse(await textBounded(response, 32768));
            if (m.schemaVersion !== 1 || !/^\w{64}$/.test(m.corpusId) || !m.assets)
                throw new SearchFailure('invalid_response', 'INVALID_MANIFEST');
            async function asset<T>(kind: string): Promise<T> {
                const a = m.assets[kind], url = new URL(a?.href, manifestUrl);
                if (url.origin !== new URL(manifestUrl).origin || url.pathname !== `/gcake-dev/discovery/${m.corpusId}/${kind}.json` || url.search || url.hash || !/^\w{64}$/.test(a?.digest))
                    throw new SearchFailure('invalid_response', 'INVALID_ASSET');
                const text = await textBounded(await fetcher(url, { cache: 'no-store', redirect: 'manual', signal: bounded }));
                if (await sha256(text) !== a.digest)
                    throw new SearchFailure('invalid_response', 'ASSET_DIGEST_MISMATCH');
                return JSON.parse(text);
            }
            const corpus = await asset<Corpus>('index');
            corpus.passages = await asset<Passage[]>('passages');
            if (corpus.schemaVersion !== 1 || corpus.corpusId !== m.corpusId)
                throw new SearchFailure('invalid_response', 'CORPUS_MISMATCH');
            return { corpusId: m.corpusId, corpus };
        } catch (error) {
            if (bounded.aborted) throw new SearchFailure('timeout');
            if (error instanceof SyntaxError) throw new SearchFailure('invalid_response');
            throw error;
        }
    };
}
