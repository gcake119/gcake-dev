/** Foreground local evaluation only. Never imported by the public site or Worker. */
export interface ModelProfile { name: string; dimensions: number; format: 'plain-title-text-v1' | 'gemma2-search-v1'; }
export const modelProfiles: ModelProfile[] = [
    { name: 'bge-m3:latest', dimensions: 1024, format: 'plain-title-text-v1' },
    { name: 'embeddinggemma-2:latest', dimensions: 768, format: 'gemma2-search-v1' },
];
export type PinnedModel = ModelProfile & { digest: string };
export function formatInput(profile: ModelProfile, kind: 'query' | 'document', text: string, title = '') {
    if (kind === 'query') return profile.format === 'gemma2-search-v1' ? `task: search result | query: ${text}` : text;
    return profile.format === 'gemma2-search-v1' ? `title: ${title || 'none'} | text: ${text}` : `${title}\n${text}`.trim();
}
export function normalizeVector(values: unknown, dimensions: number): number[] {
    if (!Array.isArray(values) || values.length !== dimensions || values.some(v => typeof v !== 'number' || !Number.isFinite(v))) throw Error('INVALID_VECTOR');
    const norm = Math.hypot(...values);
    if (!Number.isFinite(norm) || norm <= 0) throw Error('INVALID_VECTOR');
    return values.map(v => v / norm);
}
function allowedModel(profile: PinnedModel) {
    return /^[a-f0-9]{64}$/.test(profile.digest) && modelProfiles.some(p => p.name === profile.name && p.dimensions === profile.dimensions && p.format === profile.format);
}
export class OllamaEmbeddingClient {
    private origin: string;
    constructor(endpoint = 'http://127.0.0.1:11434', private fetcher: typeof fetch = fetch) {
        const url = new URL(endpoint);
        if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('LOOPBACK_ONLY');
        this.origin = url.origin;
    }
    private async request(path: string, body?: unknown, signal?: AbortSignal) {
        const response = await this.fetcher(this.origin + path, { method: body === undefined ? 'GET' : 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000) });
        const reader = response.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
        if (!reader) throw Error('OLLAMA_EMPTY_RESPONSE');
        try { for (;;) { const {done,value} = await reader.read(); if (done) break; size += value.length; if (size > 8 * 1024 * 1024) { await reader.cancel(); throw Error('OLLAMA_RESPONSE_LIMIT'); } chunks.push(value); } } finally { reader.releaseLock(); }
        const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
        const result = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
        if (!response.ok || result.error) throw Error(`OLLAMA_REQUEST_FAILED:${response.status}:${String(result.error ?? 'unknown')}`);
        return result;
    }
    async snapshot() { return { version: await this.request('/api/version'), tags: await this.request('/api/tags'), loaded: await this.request('/api/ps') }; }
    async show(profile: PinnedModel) { if (!allowedModel(profile)) throw Error('MODEL_IDENTITY'); return this.request('/api/show', {model:profile.name}); }
    async verify(profile: PinnedModel) {
        if (!allowedModel(profile)) throw Error('MODEL_IDENTITY');
        const tags = await this.request('/api/tags');
        const found = tags.models?.find((m: {name: string; digest: string}) => m.name === profile.name && m.digest === profile.digest);
        if (!found) throw Error('MODEL_IDENTITY'); return found;
    }
    async embed(profile: PinnedModel, input: string[], signal?: AbortSignal) {
        if (!allowedModel(profile)) throw Error('MODEL_IDENTITY');
        if (!input.length || input.length > 16 || input.some(text => typeof text !== 'string' || !text.trim())) throw Error('INVALID_EMBEDDING_INPUT');
        const start = performance.now();
        const result = await this.request('/api/embed', {model:profile.name,input,truncate:false,keep_alive:'2m'}, signal);
        if (result.model !== profile.name || !Array.isArray(result.embeddings) || result.embeddings.length !== input.length) throw Error('INVALID_VECTOR_RESPONSE');
        const vectors = result.embeddings.map((v:unknown) => normalizeVector(v,profile.dimensions));
        return {vectors: vectors as number[][], wallMs:performance.now()-start, providerDurationNs:result.total_duration ?? null, loadDurationNs:result.load_duration ?? null, tokens:result.prompt_eval_count ?? null};
    }
    async release(profile: PinnedModel) { if (!allowedModel(profile)) throw Error('MODEL_IDENTITY'); return this.request('/api/embed',{model:profile.name,input:[],truncate:false,keep_alive:0}); }
}
export interface VectorSpace { corpusId: string; modelConfig: string; dimensions: number; }
export interface LocalIndex { space: VectorSpace; items: {articleId:string;passageId:string;revision:string}[]; vectors: Float32Array[]; }
export function rankLocal(index: LocalIndex, query: {space:VectorSpace;values:number[]}) {
    if (index.space.corpusId !== query.space.corpusId || index.space.modelConfig !== query.space.modelConfig || index.space.dimensions !== query.space.dimensions || index.items.length !== index.vectors.length) throw Error('VECTOR_SPACE_MISMATCH');
    const q = normalizeVector(query.values,index.space.dimensions);
    const passages: {articleId:string;passageId:string;score:number;passageRank:number}[] = [];
    for (let i=0;i<index.items.length;i++) {
        const v=index.vectors[i]; if (v.length!==q.length) throw Error('VECTOR_SPACE_MISMATCH');
        let score=0;for(let j=0;j<v.length;j++){if(!Number.isFinite(v[j]))throw Error('INVALID_VECTOR');score+=q[j]*v[j];}
        passages.push({...index.items[i],score,passageRank:0});
    }
    // Mirror the service's top-50 passage pool and first valid passage per article.
    passages.sort((a,b)=>b.score-a.score||a.articleId.localeCompare(b.articleId)||a.passageId.localeCompare(b.passageId));
    const articles = new Map<string,typeof passages[number]>();
    for(const [rank,p] of passages.slice(0,50).entries())if(!articles.has(p.articleId))articles.set(p.articleId,{...p,passageRank:rank});
    return [...articles.values()];
}
export function fuseLocal(lexical: string[], dense: string[], passageRanks?:number[]) {
    const scores=new Map<string,number>();
    for(const [i,id] of [...new Set(lexical)].entries())scores.set(id,1/(60+i+1));
    const seen=new Set<string>();for(const [i,id] of dense.entries())if(!seen.has(id)){seen.add(id);scores.set(id,(scores.get(id)??0)+1/(60+(passageRanks?.[i]??i)+1));}
    return [...scores].map(([articleId,score])=>({articleId,score})).sort((a,b)=>b.score-a.score||a.articleId.localeCompare(b.articleId)).slice(0,50);
}

export function judgedMetrics(ids: string[], judgments: {articleId:string;grade:number}[]) {
    const relevant=judgments.filter(j=>j.grade>0);if(!relevant.length)return {targetRecall5:null,ndcg5:null,rank:null};
    const returned=ids.slice(0,5),gain=(grade:number,index:number)=>(2**grade-1)/Math.log2(index+2);
    const dcg=returned.reduce((sum,id,index)=>sum+gain(judgments.find(j=>j.articleId===id)?.grade??0,index),0);
    const ideal=[...relevant].sort((a,b)=>b.grade-a.grade).slice(0,5).reduce((sum,j,index)=>sum+gain(j.grade,index),0);
    const rank=ids.findIndex(id=>relevant.some(j=>j.articleId===id));
    return {targetRecall5:relevant.filter(j=>returned.includes(j.articleId)).length/relevant.length,ndcg5:dcg/ideal,rank:rank<0?null:rank+1};
}
