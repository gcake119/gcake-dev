export interface PublicSource {
    source: string;
    id: string;
    title: string;
    href: string;
    canonicalUrl: string;
    status: string;
    publishedAt?: string;
    description?: string;
    topics: string[];
    series?: string;
    seriesTitle?: string;
    html: string;
    interactive?: boolean;
    sourceRevision?: string;
    aliases?: string[];
}
export interface ReleaseConfig {
    now: string;
    sourceTree: string;
    snapshotDigest: string;
    baseUrl: string;
    reviewedAliases?: ReviewedAlias[];
}
export interface ReviewedAlias {
    articleId: string;
    sourceRevision: string;
    full: string;
    short: string;
    quotation: string;
    reviewer: string;
}
export interface Passage {
    articleId: string;
    revision: string;
    passageId: string;
    heading: string;
    anchor?: string;
    href: string;
    text: string;
}
export interface Term {
    term: string;
    score: number;
    evidence: string[];
}
export interface Article {
    articleId: string;
    sourceRevision: string;
    title: string;
    href: string;
    canonicalUrl: string;
    description: string;
    topics: string[];
    series: string;
    seriesTitle: string;
    publishedAt: string;
    terms: Term[];
    fields: Record<string, string[]>;
    fieldLengths?: Record<string, number>;
    text: string;
    headings: string;
    code: string;
}
export interface Alias {
    full: string;
    short: string;
    evidence: string;
    articleId: string;
    origin?: 'explicit-pattern' | 'reviewed-public-definition';
    reviewer?: string;
}
export interface Recommendation {
    articleId: string;
    reason: string;
    evidence: string[];
    score: number;
}
export interface Connections {
    outgoing: string[];
    incoming: string[];
    external: {
        title: string;
        href: string;
    }[];
    related: Recommendation[];
    further: Recommendation[];
}
export interface Corpus {
    schemaVersion: 1;
    corpusId: string;
    configurationDigest: string;
    articles: Article[];
    passages: Passage[];
    aliases: Alias[];
    postings: Record<string, Record<string, Record<string, number>>>;
    connections: Record<string, Connections>;
    diagnostics: {
        articleId: string;
        code: string;
    }[];
}
export interface SearchOptions {
    topic?: string;
    series?: string;
    page?: number;
    sort?: string;
    limit?: number;
}
export interface SearchResult {
    articleId: string;
    title: string;
    readingHref: string;
    excerpt: string;
    passageId?: string;
    series: string;
    topics: string[];
    score: number;
}
