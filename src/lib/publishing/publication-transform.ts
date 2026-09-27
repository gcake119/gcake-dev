import matter from 'gray-matter';
import { localCanonical } from '../seo/canonical';
import { postFrontmatterSchema } from './publication-schema';

export interface PortableAsset {
  source: string;
  alt: string;
}

export interface PortablePublication {
  slug: string;
  title: string;
  description?: string;
  canonicalUrl: string;
  publishedAt?: string;
  updatedAt?: string;
  distributionMode: 'full' | 'interactive-summary';
  body: string;
  assets: PortableAsset[];
  sourceRevision: string;
}

export interface CreatePortablePublicationInput {
  slug: string;
  source: string;
  sourceRevision: string;
  canonicalUrl?: string;
}

const MDX_SOURCE_ONLY = [
  /^\s*(?:import|export)\s/m,
  /<[A-Z][\w.:-]*(?:\s|\/?>)/,
  /\bclient:(?:load|idle|visible|media|only)\b/,
];

function assertPortableFullBody(body: string): void {
  if (MDX_SOURCE_ONLY.some((pattern) => pattern.test(body))) {
    throw new Error('Full distribution contains MDX/site-only constructs; use interactive-summary with an authored fallback');
  }
}

function collectAssets(body: string): PortableAsset[] {
  const assets: PortableAsset[] = [];
  const image = /!\[([^\]]*)\]\((\S+?)(?:\s+["'][^"']*["'])?\)/g;
  for (const match of body.matchAll(image)) {
    assets.push({ alt: match[1], source: match[2] });
  }
  return assets;
}

function iso(date?: Date): string | undefined {
  return date?.toISOString();
}

export function createPortablePublication(input: CreatePortablePublicationInput): PortablePublication {
  if (!input.slug.trim()) throw new Error('Publication slug is required');
  if (!input.sourceRevision.trim()) throw new Error('Publication sourceRevision is required');

  const parsed = matter(input.source);
  const metadata = postFrontmatterSchema.parse(parsed.data);
  const canonicalUrl = input.canonicalUrl ?? localCanonical(`/posts/${input.slug}/`);

  let body: string;
  if (metadata.distribution.mode === 'interactive-summary') {
    body = `${metadata.distribution.fallback!.trim()}\n\n[閱讀含完整互動體驗的原文](${canonicalUrl})\n`;
  } else {
    body = `${parsed.content.trim()}\n\n[原文與最新版本](${canonicalUrl})\n`;
    assertPortableFullBody(body);
  }

  return {
    slug: input.slug,
    title: metadata.title,
    description: metadata.description,
    canonicalUrl,
    publishedAt: iso(metadata.publishedAt),
    updatedAt: iso(metadata.updatedAt),
    distributionMode: metadata.distribution.mode,
    body,
    assets: collectAssets(body),
    sourceRevision: input.sourceRevision,
  };
}
