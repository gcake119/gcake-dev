import type { Corpus } from '../../../src/lib/discovery/types';
import { D1Admission, type AdmissionDatabase, type Prepared } from './admission';
import { deployedReader, manifestUrl, sha256 } from './deployed';
import { approvedModel, eligible, type Deployed, type SearchPolicy } from './service';
import { activateFreeWindow } from './runtime';
import { vectorMetadata, type EmbeddingBinding } from './provider';
export const syncBatchSize = 16;
export const syncModelConfig = 'cloudflare:@cf/baai/bge-m3:plain:1024:cosine:bytes4096:v1';
interface SyncStatement extends Prepared { bind(...values: unknown[]): SyncStatement; all<T>(): Promise<{results: T[]}>; }
export interface SyncDatabase extends AdmissionDatabase { prepare(sql: string): SyncStatement; batch(statements: SyncStatement[]): Promise<unknown>; }
export interface SyncVector { id: string; values: number[] | Float32Array | Float64Array; namespace?: string; metadata?: Record<string, unknown>; }
export interface SyncIndex {
    describe(): Promise<unknown>;
    getByIds(ids: string[]): Promise<SyncVector[]>;
    upsert(vectors: {id: string; values: number[]; namespace: string; metadata: Record<string, string | boolean>}[]): Promise<unknown>;
    deleteByIds(ids: string[]): Promise<unknown>;
}
export interface SyncBindings {
    INDEX_SYNC_ENABLED?: string; SEMANTIC_ENABLED?: string; THROTTLE_SECRET?: string;
    DISCOVERY_DB?: SyncDatabase; VECTOR_INDEX?: SyncIndex; AI?: EmbeddingBinding;
}
interface State { mutationId: string; nextAttemptAt: number; readbackAttempts: number; corpusId: string; previousCorpusId: string; cursor: number; status: string; }
interface Owned { namespace: string; metadataHash: string; id: string; articleId: string; revision: string; contentHash: string; modelConfig: string; corpusId: string; }
interface Saved {id: string; values: number[]; namespace: string; metadata: Record<string, string | boolean>;}
interface Pending {id: string; corpusId: string; payload: string; stage: string; created: number;}
const valid = (v: SyncVector) => v.values.length === 1024 && Array.from(v.values).every(Number.isFinite) && Math.abs(Math.hypot(...v.values) - 1) < 0.001;
const matches = (got: SyncVector | undefined, expected: Saved) => !!got && valid(got) && got.namespace === expected.namespace
    && Object.keys(got.metadata ?? {}).length === Object.keys(expected.metadata).length
    && Object.entries(expected.metadata).every(([k,v]) => got.metadata?.[k] === v)
    && Array.from(got.values).every((v,i) => Math.abs(v - expected.values[i]) < 1e-6);
/** Fixed public origin, no caller URLs; the final check need not download the large corpus again. */
export async function currentPublicId(fetcher: typeof fetch = fetch) {
    const r = await fetcher(manifestUrl, {redirect:'manual', cache:'no-store', signal:AbortSignal.timeout(10000)});
    if (!r.ok || r.redirected || Number(r.headers.get('Content-Length') ?? 0) > 32768) throw Error('PUBLIC_MANIFEST_UNAVAILABLE');
    const text = await r.text(); if (text.length > 32768) throw Error('INVALID_MANIFEST');
    const m = JSON.parse(text); if (m.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(m.corpusId)) throw Error('INVALID_MANIFEST');
    return m.corpusId as string;
}
/** One bounded hosted step. D1 owns progress; no local files, OAuth token or public write route. */
export async function synchronizeIndex(env: SyncBindings, options: {read?: (signal: AbortSignal) => Promise<Deployed>; current?: () => Promise<string>; now?: () => number} = {}) {
    if (env.INDEX_SYNC_ENABLED !== 'true' || env.SEMANTIC_ENABLED !== 'true' || !env.DISCOVERY_DB || !env.VECTOR_INDEX || !env.AI || !env.THROTTLE_SECRET) return {status:'disabled'};
    const db = env.DISCOVERY_DB, index = env.VECTOR_INDEX, now = options.now ?? Date.now;
    const owner = crypto.randomUUID(), started = now(), signal = AbortSignal.timeout(45000);
    let retryAt = 0;
    const canContinue = () => !signal.aborted && now() - started < 15000; // Leave the existing 30s source/operation budget.
    const read = options.read ?? deployedReader(fetch,30000);
    const current = options.current ?? (options.read ? async () => (await read(signal)).corpusId : currentPublicId);
    const record = await db.prepare("SELECT policy FROM discovery_policy WHERE id='active'").first<{policy:string}>();
    if (!record) return {status:'ineligible'};
    const policy = await activateFreeWindow(db, {...JSON.parse(record.policy), throttleSecret:env.THROTTLE_SECRET}, now());
    if (!eligible(policy,now()) || policy.billing.account !== '979a3735f8dfa269e7474135f348cfdf' || policy.modelConfig !== syncModelConfig) return {status:'ineligible'};
    const claimed = await db.prepare('UPDATE discovery_sync SET owner=?,leaseUntil=? WHERE id=1 AND leaseUntil<? RETURNING id').bind(owner,now()+120000,now()).first();
    if (!claimed) return {status:'busy'};
    const namespace = await sha256(policy.modelConfig);
    let target = '', verifiedThisStep = 0;
    async function uploaded(saved: Saved[]) {
        const result = await index.upsert(saved);
        if (!result || typeof result !== 'object' || !('mutationId' in result) || typeof result.mutationId !== 'string' || !result.mutationId) throw Error('MISSING_MUTATION_ACK');
        await guard();
        await db.batch([
            db.prepare("UPDATE discovery_sync_pending SET stage='uploaded' WHERE corpusId=?").bind(target),
            db.prepare('UPDATE discovery_sync SET mutationId=?,nextAttemptAt=0,readbackAttempts=0 WHERE id=1 AND owner=?').bind(result.mutationId,owner)
        ]);
    }
    async function finish(status: string, detail = '') {
        if (status === 'quota_exceeded') retryAt = Date.parse(new Date(now()).toISOString().slice(0,10)+'T00:00:00Z')+86400000;
        await db.batch([
            db.prepare('UPDATE discovery_sync SET nextAttemptAt=? WHERE id=1 AND owner=?').bind(retryAt,owner),
            db.prepare('UPDATE discovery_sync SET status=?,detail=?,updated=? WHERE id=1 AND owner=?').bind(status,detail,now(),owner),
            db.prepare('INSERT INTO discovery_sync_receipts(created,corpusId,status,detail) VALUES(?,?,?,?)').bind(now(),target,status,detail),
            db.prepare('DELETE FROM discovery_sync_receipts WHERE created<?').bind(now()-30*86400000)
        ]);
        return {status, corpusId:target, detail};
    }
    async function guard() {
        if (signal.aborted || now() - started >= 45000) throw Error('STEP_DEADLINE');
        const lease = await db.prepare('SELECT owner,leaseUntil FROM discovery_sync WHERE id=1').first<{owner:string;leaseUntil:number}>();
        const latest = await db.prepare("SELECT policy FROM discovery_policy WHERE id='active'").first<{policy:string}>();
        if (lease?.owner !== owner || lease.leaseUntil <= now() || latest?.policy !== record!.policy) throw Error('OPERATOR_OR_LEASE_CHANGED');
        if (!eligible(policy,now()) || env.INDEX_SYNC_ENABLED !== 'true' || env.SEMANTIC_ENABLED !== 'true') throw Error('POLICY_EXPIRED');
        if (await current() !== target) throw Error('SOURCE_CHANGED');
        if (signal.aborted || now()-started>=45000 || !eligible(policy,now())) throw Error('STEP_DEADLINE');
    }
    async function capacity(uploadCount: number) {
        const evidence = policy.syncCapacity;
        if (!evidence || !(Date.parse(evidence.validUntil)>now()) || !Number.isSafeInteger(evidence.otherDimensions) || evidence.otherDimensions<0) return false;
        const info = await index.describe();
        // Count every uploaded value conservatively, including reused IDs. Never assume namespace moves are free.
        return !!info && typeof info==='object' && 'dimensions' in info && info.dimensions===1024
            && 'vectorCount' in info && typeof info.vectorCount==='number' && Number.isSafeInteger(info.vectorCount) && info.vectorCount>=0
            && evidence.otherDimensions+(info.vectorCount+uploadCount)*1024<=Math.min(4000000,policy.limits.storage);
    }
    try {
        const stateFields = 'corpusId,previousCorpusId,cursor,status,mutationId,nextAttemptAt,readbackAttempts';
        let state = (await db.prepare('SELECT '+stateFields+' FROM discovery_sync WHERE id=1').first<State>())!;
        target = state.corpusId;
        const admission = new D1Admission(db);
        const reserveRead = (key: string) => admission.reserve(policy.billing.windowId, key+':'+owner,
            {requests:0,tokens:0,units:0,vectorQueries:1,storage:0,worker:0,admission:3},policy.limits,now());
        if (!await admission.reserve(policy.billing.windowId, 'index-step:'+owner, {requests:0,tokens:0,units:0,vectorQueries:0,storage:0,worker:1,admission:40},policy.limits,now())) return await finish('quota_exceeded');
        // Waiting still executes a hosted tick and durable control reads.
        if (state.nextAttemptAt > now()) return {status:'waiting'};
        target = await current();
        const pending = (await db.prepare('SELECT id,corpusId,payload,stage,created FROM discovery_sync_pending ORDER BY id').all<Pending>()).results;
        if (state.corpusId && state.corpusId !== target && pending.length) return await finish('source_changed','Pending output preserved for operator reconciliation');
        if (pending.some(p=>p.stage==='reserved')) return await finish('blocked','UNKNOWN_INFERENCE: reservation retained; no automatic replay');
        if (target === policy.activeCorpusId && policy.activeVectorNamespace === namespace && !pending.length) return await finish('no_change');
        const deployed = await read(signal), c = deployed.corpus;
        if (deployed.corpusId !== target || c.corpusId !== target) return await finish('source_changed');
        validateCorpus(c,policy);
        if (state.corpusId !== target || !pending.length && target === policy.activeCorpusId && policy.activeVectorNamespace !== namespace) {
            await guard();
            await db.prepare("UPDATE discovery_sync SET corpusId=?,previousCorpusId=?,cursor=0,status='preparing',mutationId='',nextAttemptAt=0,readbackAttempts=0 WHERE id=1 AND owner=?").bind(target,policy.activeCorpusId,owner).run();
            state = {...state,corpusId:target,previousCorpusId:policy.activeCorpusId,cursor:0};
        }
        if (state.previousCorpusId !== policy.activeCorpusId) return await finish('blocked','ACTIVE_POLICY_CHANGED');
        if (pending.length) {
            const saved = pending.map(p=>JSON.parse(p.payload) as Saved);
            if (saved.some(v=>v.namespace!==namespace)) return await finish('source_changed');
            if (pending.some(p=>p.stage==='embedded')) {
                if (!await capacity(saved.length)) return await finish('capacity_exceeded');
                await guard(); await uploaded(saved);
                return await finish('uploaded');
            }
            if (!state.mutationId) return await finish('blocked','MISSING_MUTATION_ACK');
            const info = await index.describe();
            if (!info || typeof info !== 'object' || !('processedUpToMutation' in info) || info.processedUpToMutation !== state.mutationId)
                return await finish('awaiting_provider','Saved mutation not yet reported processed');
            if (!await reserveRead('index-readback')) return await finish('quota_exceeded');
            const got = await index.getByIds(saved.map(v=>v.id));
            if (!saved.every(v=>matches(got.find(g=>g.id===v.id),v))) {
                retryAt = now()+Math.min(1800000,60000*2**Math.min(state.readbackAttempts,5));
                await db.prepare('UPDATE discovery_sync SET readbackAttempts=readbackAttempts+1 WHERE id=1 AND owner=?').bind(owner).run();
                return await finish('awaiting_readback');
            }
            await guard();
            const statements = [];
            for (const v of saved) {
                const passage = c.passages.find(p=>p.passageId===v.id)!;
                statements.push(db.prepare("INSERT OR REPLACE INTO discovery_sync_vectors(id,articleId,revision,contentHash,modelConfig,corpusId,namespace,metadataHash) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM discovery_sync WHERE id=1 AND owner=? AND leaseUntil>?) AND EXISTS(SELECT 1 FROM discovery_policy WHERE id='active' AND policy=?)")
                    .bind(v.id,passage.articleId,passage.revision,await sha256(passage.text),policy.modelConfig,target,namespace,await sha256(JSON.stringify(v.metadata)),owner,now(),record.policy));
            }
            statements.push(db.prepare("DELETE FROM discovery_sync_pending WHERE corpusId=? AND EXISTS(SELECT 1 FROM discovery_sync WHERE id=1 AND owner=? AND leaseUntil>?) AND EXISTS(SELECT 1 FROM discovery_policy WHERE id='active' AND policy=?)").bind(target,owner,now(),record.policy));
            statements.push(db.prepare("UPDATE discovery_sync SET cursor=cursor+?,mutationId='',nextAttemptAt=0,readbackAttempts=0 WHERE id=1 AND owner=? AND leaseUntil>? AND EXISTS(SELECT 1 FROM discovery_policy WHERE id='active' AND policy=?)").bind(saved.length,owner,now(),record.policy));
            await db.batch(statements);
            verifiedThisStep = saved.length;
            state = {...state,cursor:state.cursor+saved.length};
            if (!canContinue()) return await finish('verified',`${verifiedThisStep} complete vectors; continuation deferred: time`);
            if (!await admission.reserve(policy.billing.windowId,'index-continuation:'+owner,
                {requests:0,tokens:0,units:0,vectorQueries:0,storage:0,worker:0,admission:40+2*syncBatchSize},policy.limits,now()))
                return await finish('verified',`${verifiedThisStep} complete vectors; continuation deferred: quota`);
        }
        const owned = (await db.prepare('SELECT id,articleId,revision,contentHash,modelConfig,corpusId,namespace,metadataHash FROM discovery_sync_vectors').all<Owned>()).results;
        const ids = new Set(c.passages.map(p=>p.passageId));
        const obsolete = owned.filter(v=>!ids.has(v.id)).slice(0,16);
        if (obsolete.length) {
            if (!await reserveRead('index-cleanup')) return await finish('quota_exceeded');
            const got = await index.getByIds(obsolete.map(v=>v.id));
            if (got.some(v=>{const ledger=obsolete.find(o=>o.id===v.id)!;return v.namespace!==(ledger.namespace || ledger.corpusId) || v.metadata?.articleId!==ledger.articleId || v.metadata?.revision!==ledger.revision;})) return await finish('blocked','FOREIGN_VECTOR');
            await guard();
            if (got.length) {await index.deleteByIds(got.map(v=>v.id));return await finish('cleaning');}
            await db.batch(obsolete.map(v=>db.prepare('DELETE FROM discovery_sync_vectors WHERE id=?').bind(v.id)));
            return await finish('cleaned');
        }
        // Verification is attached to a physical object, not a position in a release.
        const proofs = new Map(owned.map(v=>[v.id,v]));
        const remaining = [];
        for (const passage of c.passages) {
            const article = c.articles.find(a=>a.articleId===passage.articleId)!;
            const metadata = vectorMetadata(passage.articleId,passage.revision,article.topics,article.series);
            const proof = proofs.get(passage.passageId);
            if (!proof || proof.namespace!==namespace || proof.articleId!==passage.articleId || proof.revision!==passage.revision
                || proof.contentHash!==await sha256(passage.text) || proof.modelConfig!==policy.modelConfig
                || proof.metadataHash!==await sha256(JSON.stringify(metadata))) remaining.push(passage);
        }
        await guard();
        await db.prepare('UPDATE discovery_sync SET cursor=? WHERE id=1 AND owner=? AND leaseUntil>?').bind(c.passages.length-remaining.length,owner,now()).run();
        if (!remaining.length) {
            await guard();
            const promoted = await db.prepare("UPDATE discovery_policy SET policy=json_set(policy,'$.activeCorpusId',?,'$.activeVectorNamespace',?) WHERE id='active' AND policy=? AND EXISTS(SELECT 1 FROM discovery_sync WHERE id=1 AND owner=? AND leaseUntil>?) RETURNING id").bind(target,namespace,record.policy,owner,now()).first();
            return await finish(promoted?'promoted':'blocked',promoted?'Complete provider readback; current public release':'OPERATOR_POLICY_CHANGED');
        }
        // The base 40 covers control/readback. Only preparation needs 2N placeholder/payload writes.
        if (!verifiedThisStep && !await admission.reserve(policy.billing.windowId,'index-prepare:'+owner,
            {requests:0,tokens:0,units:0,vectorQueries:0,storage:0,worker:0,admission:2*syncBatchSize},policy.limits,now()))
            return await finish('quota_exceeded');
        const passages = remaining.slice(0,syncBatchSize);
        await guard();
        if (!await reserveRead('index-reuse')) return await finish('quota_exceeded');
        const got = await index.getByIds(passages.map(p=>p.passageId));
        const reuse = new Map<string,SyncVector>();
        for (const p of passages) {
            const old = owned.find(v=>v.id===p.passageId), vector=got.find(v=>v.id===p.passageId);
            if (old && old.articleId===p.articleId && old.revision===p.revision && old.modelConfig===policy.modelConfig && old.contentHash===await sha256(p.text)
                && vector && valid(vector) && vector.namespace===(old.namespace || old.corpusId) && vector.metadata?.articleId===p.articleId && vector.metadata?.revision===p.revision) reuse.set(p.passageId,vector);
            else if (vector) return await finish('blocked','UNPROVEN_VECTOR_COMPATIBILITY');
        }
        const missing = passages.filter(p=>!reuse.has(p.passageId));
        if (!await capacity(passages.length)) return await finish('capacity_exceeded');
        await guard();
        const bytes = missing.reduce((n,p)=>n+new TextEncoder().encode(p.text).length,0);
        const reservationId = crypto.randomUUID();
        const reserved = await admission.reserve(policy.billing.windowId,'index-batch:'+reservationId,{requests:missing.length,tokens:bytes,units:Math.ceil(bytes*policy.billing.rate*1e6)/1e6,vectorQueries:0,worker:0,admission:4,storage:passages.length*1024},policy.limits,now());
        if (!reserved) return await finish('quota_exceeded');
        await guard();
        // Reserved placeholders are committed before inference; interruption can never silently replay it.
        await db.batch(passages.map(p=>db.prepare('INSERT INTO discovery_sync_pending VALUES(?,?,?,?,?,?)').bind(p.passageId,target,'{}','reserved',reservationId,now())));
        let embedded:number[][]=[];
        if (missing.length) {
            const result=await env.AI.run(approvedModel,{text:missing.map(p=>p.text)});
            if (result.data?.length!==missing.length) throw Error('INVALID_EMBEDDING');
            embedded=result.data.map(values=>{if(values.length!==1024 || values.some(v=>!Number.isFinite(v)))throw Error('INVALID_EMBEDDING');const norm=Math.hypot(...values);if(!norm)throw Error('INVALID_EMBEDDING');return values.map(v=>v/norm);});
        }
        if (signal.aborted || now() - started >= 45000) throw Error('STEP_DEADLINE');
        const saved:Saved[]=passages.map(p=>{const article=c.articles.find(a=>a.articleId===p.articleId)!;return{id:p.passageId,namespace,values:Array.from(reuse.get(p.passageId)?.values??embedded[missing.indexOf(p)]),metadata:vectorMetadata(p.articleId,p.revision,article.topics,article.series)};});
        await db.batch(saved.map(v=>db.prepare("UPDATE discovery_sync_pending SET payload=?,stage='embedded' WHERE id=? AND corpusId=?").bind(JSON.stringify(v),v.id,target)));
        await guard(); await uploaded(saved);
        return await finish('uploaded',`${verifiedThisStep} complete vectors; ${missing.length} embeddings; ${reuse.size} reused; ${saved.length} uploaded`);
    } catch (e) {
        return await finish(String(e).includes('SOURCE_CHANGED')?'source_changed':'blocked',String(e).slice(0,200));
    } finally {
        await db.prepare('UPDATE discovery_sync SET owner=NULL,leaseUntil=0 WHERE id=1 AND owner=?').bind(owner).run();
    }
}
function validateCorpus(c:Corpus,p:SearchPolicy) {
    if (!c.passages.length || c.passages.length*1024>4000000 || new Set(c.passages.map(x=>x.passageId)).size!==c.passages.length) throw Error('INVALID_PUBLIC_CORPUS');
    for (const passage of c.passages) {
        const a=c.articles.find(a=>a.articleId===passage.articleId);
        if (!a || a.sourceRevision!==passage.revision || !passage.text || new TextEncoder().encode(passage.text).length>p.inputLimit) throw Error('INVALID_PUBLIC_PASSAGE');
    }
}
