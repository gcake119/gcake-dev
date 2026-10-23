import type { Article, Connections } from './types';

/** Preserve existing candidate order while bounding public, distinct destinations. */
export function selectEndingRecommendations(
  articles: Article[],
  connections: Connections | undefined,
  excludedHrefs: string[],
  hasNext: boolean,
): Article[] {
  if (!connections) return [];
  const byId = new Map(articles.map(article => [article.articleId, article]));
  const seen = new Set(excludedHrefs);
  const selected: Article[] = [];
  const limit = hasNext ? 2 : 3;
  for (const candidate of [...connections.further, ...connections.related]) {
    const article = byId.get(candidate.articleId);
    if (!article || seen.has(article.href)) continue;
    seen.add(article.href);
    selected.push(article);
    if (selected.length === limit) break;
  }
  return selected;
}
