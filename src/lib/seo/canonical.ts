import { site } from '@/data/site';

export function localCanonical(pathname: string): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return new URL(`${site.basePath}${normalized}`, 'https://gcake119.github.io').toString();
}
