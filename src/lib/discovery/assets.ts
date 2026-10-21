import type { Corpus } from './types';
/** Postings already retain per-field frequencies; do not ship their token arrays twice. */
export function lexicalAsset(corpus: Corpus): Corpus {
    return { ...corpus, passages: [], connections: {}, articles: corpus.articles.map(a => ({ ...a, fieldLengths: Object.fromEntries(Object.entries(a.fields).map(([k, v]) => [k, v.length])), fields: {} })) };
}
