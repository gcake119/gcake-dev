export type SlugSuggestionResult =
  | { readonly kind: 'empty-title' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'suggested'; readonly slug: string };

export async function requestSlugSuggestion(
  title: string,
  serviceUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<SlugSuggestionResult> {
  if (!title.trim()) return { kind: 'empty-title' };
  if (!serviceUrl.trim()) return { kind: 'unavailable' };
  try {
    const response = await fetcher(`${serviceUrl.replace(/\/$/, '')}/api/slug-suggestions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: title.trim() }),
    });
    if (!response.ok) return { kind: 'unavailable' };
    const payload = await response.json() as { slug?: unknown };
    return typeof payload.slug === 'string' && /^[a-z]+(?:-[a-z]+){2,6}$/.test(payload.slug)
      ? { kind: 'suggested', slug: payload.slug }
      : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}
