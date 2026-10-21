import type { Corpus } from '../../src/lib/discovery/types';
import { digest } from '../../src/lib/discovery/build';
export interface StagingAdapter {
    embed(text: string): Promise<number[]>;
    upsert(corpusId: string, vectors: {
        id: string;
        values: number[];
        articleId: string;
        revision: string;
    }[]): Promise<void>;
    ready(corpusId: string, ids: string[]): Promise<boolean>;
}
/** Invoked only inside an authorized, admitted release operation; no network defaults. */
export async function stageRelease(corpus: Corpus, modelConfig: string, adapter: StagingAdapter, cache: Map<string, number[]>, remainingStorageDimensions: number, dimensions = 1024) {
    if (!modelConfig.trim() || !Number.isSafeInteger(dimensions) || dimensions <= 0 || !Number.isFinite(remainingStorageDimensions) || remainingStorageDimensions < 0)
        throw new Error('INVALID_STAGING_CONFIGURATION');
    if (corpus.passages.length * dimensions > remainingStorageDimensions)
        throw new Error('FREE_STORAGE_EXCEEDED');
    const vectors = [];
    for (const p of corpus.passages) {
        const key = digest([p.articleId, p.text, modelConfig, dimensions]);
        let values = cache.get(key);
        if (!values) {
            values = await adapter.embed(p.text);
        }
        if (values.length !== dimensions || values.some(n => !Number.isFinite(n)) || !values.some(n => n !== 0))
            throw new Error('INVALID_VECTOR');
        cache.set(key, values);
        vectors.push({ id: p.passageId, values, articleId: p.articleId, revision: p.revision });
    }
    await adapter.upsert(corpus.corpusId, vectors);
    return { corpusId: corpus.corpusId, modelConfig, dimensions, ready: await adapter.ready(corpus.corpusId, vectors.map(v => v.id)) };
}
export function promoteRelease(staged: {
    corpusId: string;
    ready: boolean;
    modelConfig: string;
    dimensions: number;
}, confirmedDeployedCorpusId: string, queryModelConfig: string, queryDimensions = 1024) {
    return staged.ready && staged.corpusId === confirmedDeployedCorpusId && staged.modelConfig === queryModelConfig && staged.dimensions === queryDimensions ? staged.corpusId : null;
}
