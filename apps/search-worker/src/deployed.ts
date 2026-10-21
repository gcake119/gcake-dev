import type { Corpus, Passage } from '../../../src/lib/discovery/types';
export const manifestUrl = 'https://gcake119.github.io/gcake-dev/discovery-manifest.json';
export async function sha256(text: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map(b => b.toString(16).padStart(2, '0')).join(''); }
async function textBounded(response: Response, limit = 8 * 1024 * 1024) {
    if (!response.ok || response.redirected)
        throw new Error('INVALID_DEPLOYMENT');
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
                throw new Error('ASSET_TOO_LARGE');
            }
            text += decoder.decode(r.value, { stream: true });
        }
        return text + decoder.decode();
    }
    finally {
        reader.releaseLock();
    }
}
export function deployedReader(fetcher: typeof fetch = fetch) {
    return async (signal: AbortSignal) => {
        const timeout = AbortSignal.timeout(2000), bounded = AbortSignal.any([signal, timeout]);
        const response = await fetcher(manifestUrl, { cache: 'no-store', redirect: 'error', signal: bounded });
        const m = JSON.parse(await textBounded(response, 32768));
        if (m.schemaVersion !== 1 || !/^\w{64}$/.test(m.corpusId) || !m.assets)
            throw new Error('INVALID_MANIFEST');
        async function asset<T>(kind: string): Promise<T> {
            const a = m.assets[kind], url = new URL(a?.href, manifestUrl);
            if (url.origin !== new URL(manifestUrl).origin || url.pathname !== `/gcake-dev/discovery/${m.corpusId}/${kind}.json` || url.search || url.hash || !/^\w{64}$/.test(a?.digest))
                throw new Error('INVALID_ASSET');
            const text = await textBounded(await fetcher(url, { cache: 'no-store', redirect: 'error', signal: bounded }));
            if (await sha256(text) !== a.digest)
                throw new Error('ASSET_DIGEST_MISMATCH');
            return JSON.parse(text);
        }
        const corpus = await asset<Corpus>('index');
        corpus.passages = await asset<Passage[]>('passages');
        if (corpus.schemaVersion !== 1 || corpus.corpusId !== m.corpusId)
            throw new Error('CORPUS_MISMATCH');
        return { corpusId: m.corpusId, corpus };
    };
}
