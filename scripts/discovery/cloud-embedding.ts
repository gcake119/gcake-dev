/** Foreground operator adapter. No credentials, retries or live defaults are persisted. */
export async function embedCloudBatch(texts: string[], token: string, reserve: (tokens: number, neurons: number) => Promise<boolean>, fetcher: typeof fetch = fetch) {
    if (!token || !texts.length || texts.length > 16 || texts.some(t => !t.trim() || new TextEncoder().encode(t).length > 4096)) throw Error('INVALID_CLOUD_BATCH');
    const bytes = texts.reduce((n, t) => n + new TextEncoder().encode(t).length, 0);
    const neurons = Math.ceil(bytes * 1075 / 1e6 * 1e6) / 1e6;
    if (!await reserve(bytes, neurons)) throw Error('FREE_BUDGET_EXHAUSTED');
    const response = await fetcher('https://api.cloudflare.com/client/v4/accounts/979a3735f8dfa269e7474135f348cfdf/ai/run/@cf/baai/bge-m3', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({text: texts})
    });
    if (!response.ok) throw Error(`BGE_HTTP_${response.status}`);
    const body = await response.json();
    const data: unknown = body.success === true ? body.result?.data : undefined;
    if (!Array.isArray(data) || data.length !== texts.length) throw Error('INVALID_BGE_RESPONSE');
    return data.map((value: unknown) => {
        if (!Array.isArray(value) || value.length !== 1024 || value.some(n => typeof n !== 'number' || !Number.isFinite(n))) throw Error('INVALID_BGE_VECTOR');
        const norm = Math.hypot(...value); if (!norm) throw Error('INVALID_BGE_VECTOR');
        return value.map(n => n / norm);
    });
}
