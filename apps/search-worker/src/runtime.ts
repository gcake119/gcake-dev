import { unavailableResponse, failureReason, type FailureStage, type FailureReason } from './diagnostics';
import { D1Admission, type AdmissionDatabase } from './admission';
import { createWorker, disabledWorker } from './worker';
import { deployedReader } from './deployed';
import { bgeEmbedding, vectorRetrieval, type EmbeddingBinding, type VectorBinding } from './provider';
import { eligible, type SearchPolicy } from './service';
/** Minimal existing dependency contracts keep offline fixtures independent of platform classes. */
export type RuntimeBindings = Partial<{
    SEMANTIC_ENABLED: string;
    THROTTLE_SECRET: string;
    DISCOVERY_DB: AdmissionDatabase;
    AI: EmbeddingBinding;
    VECTOR_INDEX: VectorBinding;
}>;
/** Free-plan hard-limit renewal is an explicit operator decision; never inferred from local typing. */
export async function activateFreeWindow(db: AdmissionDatabase, policy: SearchPolicy, now: number): Promise<SearchPolicy> {
    if (policy.billing?.renewal !== 'verified-workers-free-utc') return policy;
    const day = new Date(now).toISOString().slice(0, 10);
    const active = { ...policy, billing: { ...policy.billing, windowId: day } };
    if (!eligible(active, now)) return policy;
    const expiry = Math.min(Date.parse(day + 'T00:00:00Z') + 86400000, Date.parse(active.billing.validUntil));
    const l = active.limits;
    await db.prepare(`INSERT OR IGNORE INTO discovery_windows (window,verifiedUntil,requests,tokens,units,vectorQueries,worker,admission,storage)
        VALUES (?,?,?,?,?,?,?,?,?)`).bind(day, expiry, l.requests, l.tokens, l.units, l.vectorQueries, l.worker, l.admission, l.storage).run();
    return active;
}
/** Policy is operator-written durable evidence, never caller input. */
export function createProductionWorker(fetcher: typeof fetch = fetch) {
    return { async fetch(request: Request, env: RuntimeBindings = {}): Promise<Response> {
        const unavailable = async (stage: FailureStage = 'configuration', reason: FailureReason = 'ineligible') => {
            const response = await disabledWorker.fetch(request);
            return response.status === 503 ? unavailableResponse(stage, reason, undefined, response.headers) : response;
        };
        if (env.SEMANTIC_ENABLED !== 'true' || !env.DISCOVERY_DB || !env.AI || !env.VECTOR_INDEX || !env.THROTTLE_SECRET)
            return unavailable();
        const origin = request.headers.get('Origin');
        if ((origin && origin !== 'https://gcake119.github.io') || request.method === 'OPTIONS' || request.method !== 'POST' || new URL(request.url).pathname !== '/v1/search')
            return unavailable();
        try {
            const record = await env.DISCOVERY_DB.prepare("SELECT policy FROM discovery_policy WHERE id='active'").first<{policy: string}>();
            if (!record) return unavailable('policy', 'ineligible');
            const policy = await activateFreeWindow(env.DISCOVERY_DB, { ...JSON.parse(record.policy), throttleSecret: env.THROTTLE_SECRET }, Date.now());
            if (!eligible(policy, Date.now())) return unavailable('policy', 'ineligible');
            const ai = env.AI, vectors = env.VECTOR_INDEX;
            return createWorker({policy, admission: new D1Admission(env.DISCOVERY_DB), manifest: deployedReader(fetcher),
                embed: (text, signal) => bgeEmbedding(ai, text, policy, signal),
                vectors: (vector, corpusId, filters, signal) => vectorRetrieval(vectors, vector, corpusId, filters, signal)
            }).fetch(request);
        } catch (error) {
            return unavailable('policy', failureReason(error));
        }
    }};
}
