import { SearchFailure } from './diagnostics';
import { approvedModel, eligible, type SearchPolicy } from './service';
export interface EmbeddingBinding {
    run(model: typeof approvedModel, input: {
        text: string[];
    }): Promise<{
        data: number[][];
    }>;
}
export async function bgeEmbedding(ai: EmbeddingBinding, text: string, policy: SearchPolicy, signal: AbortSignal) {
    if (!eligible(policy, Date.now()) || signal.aborted || new TextEncoder().encode(text).length > policy.inputLimit)
        throw new Error('INADMISSIBLE_EMBEDDING');
    // Same plain formatting for documents/queries; real endpoint/tokenizer verification gates activation.
    const result = await ai.run(approvedModel, { text: [text] });
    if (signal.aborted)
        throw new Error('ABORTED');
    const v = result.data?.[0];
    if (result.data.length !== 1 || v?.length !== 1024 || v.some(n => !Number.isFinite(n)))
        throw new SearchFailure('invalid_response', 'INVALID_VECTOR');
    const norm = Math.hypot(...v);
    if (!norm)
        throw new SearchFailure('invalid_response', 'INVALID_VECTOR');
    return v.map(n => n / norm);
}
export interface VectorBinding {
    query(vector: number[], options: {
        namespace: string;
        topK: number;
        returnMetadata: 'all';
        filter?: Record<string, string | boolean>;
    }): Promise<{
        matches: {
            id: string;
            metadata?: Record<string, unknown>;
        }[];
    }>;
}
/** Topic boolean indexes (one per public topic) and series must be verified before staging. */
export function vectorMetadata(articleId: string, revision: string, topics: string[], series: string) { if (topics.length > 9 || topics.some(t => !/^[a-z0-9-]+$/.test(t)))
    throw new Error('UNSUPPORTED_METADATA_INDEX'); return { articleId, revision, series, ...Object.fromEntries(topics.map(t => ['topic_' + t, true])) }; }
export async function vectorRetrieval(binding: VectorBinding, vector: number[], corpusId: string, filters: {
    topic?: string;
    series?: string;
}, signal: AbortSignal) {
    if (signal.aborted || vector.length !== 1024 || vector.some(n => !Number.isFinite(n)))
        throw new SearchFailure('invalid_response', 'INVALID_VECTOR');
    const filter: Record<string, string | boolean> = {};
    if (filters.topic) {
        if (!/^[a-z0-9-]+$/.test(filters.topic))
            throw new Error('INVALID_FILTER');
        filter['topic_' + filters.topic] = true;
    }
    if (filters.series)
        filter.series = filters.series;
    const result = await binding.query(vector, { namespace: corpusId, topK: 50, returnMetadata: 'all', ...(Object.keys(filter).length ? { filter } : {}) });
    if (signal.aborted)
        throw new Error('ABORTED');
    return result.matches.slice(0, 50).flatMap(m => typeof m.metadata?.articleId === 'string' && typeof m.metadata.revision === 'string' ? [{ id: m.id, articleId: m.metadata.articleId, revision: m.metadata.revision }] : []);
}
