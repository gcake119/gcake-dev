import { createSearchService, approvedModel, type SearchPolicy, type Dependencies } from './service';
/** No positive budget, billing assertion, binding or execution authority ships by default. */
const disabledPolicy: SearchPolicy = { enabled: false, activeCorpusId: '', model: approvedModel, modelConfig: 'unverified', dimensions: 1024, format: 'plain', inputLimit: 0, billing: { model: approvedModel, id: '', validUntil: '', rate: 0, freeVerified: false, noChargeBoundary: false, account: '', providerResetVerified: false, windowId: '', services: [] }, limits: { requests: 0, tokens: 0, units: 0, vectorQueries: 0, storage: 0, worker: 0, admission: 0 }, paidOverage: 0, throttleSecret: '', qualityVerified: false, providerInputVerified: false };
const unavailable = async (): Promise<never> => { throw new Error('REMOTE_DISABLED'); };
export function createWorker(dependencies: Dependencies) {
    const search = createSearchService(dependencies);
    return { async fetch(request: Request) {
            const origin = request.headers.get('Origin');
            if (origin && origin !== 'https://gcake119.github.io')
                return Response.json({ code: 'ORIGIN_NOT_ALLOWED', fallback: 'keyword', retryable: false }, { status: 403 });
            const response = request.method === 'OPTIONS' ? new Response(null, { status: 204 }) : await search(request);
            if (origin) {
                response.headers.set('Access-Control-Allow-Origin', origin);
                response.headers.set('Vary', 'Origin');
                response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
                response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
            }
            response.headers.set('Cache-Control', 'no-store');
            return response;
        } };
}
export const disabledWorker = createWorker({ policy: disabledPolicy, admission: { reserve: unavailable }, manifest: unavailable, embed: unavailable, vectors: unavailable });

