function imageUrls(source: string): string[] {
  const urls: string[] = [];
  const markdownImage = /!\[[^\]]*\]\(\s*<?(https?:\/\/[^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
  const htmlImage = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const match of source.matchAll(markdownImage)) if (match[1]) urls.push(match[1]);
  for (const match of source.matchAll(htmlImage)) if (match[1]) urls.push(match[1]);
  return urls;
}

export function removedImageUrls(original: string, updated: string): string[] {
  const retained = new Set(imageUrls(updated));
  return [...new Set(imageUrls(original))].filter((url) => !retained.has(url));
}

export function removedMediaRecords<T extends { readonly url: string }>(
  original: string,
  updated: string,
  records: readonly T[],
): T[] {
  const removed = new Set(removedImageUrls(original, updated));
  return records.filter((record) => removed.has(record.url));
}
