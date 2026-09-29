import { site, socialLinks } from '../../data/site';

export interface ArticleStructuredDataInput {
  title: string;
  description?: string;
  canonical: string;
  publishedAt?: Date;
  updatedAt?: Date;
  topics?: string[];
  image?: string;
  series?: {
    title: string;
    url: string;
  };
}

function absoluteSiteAsset(value: string): string {
  return /^https?:\/\//.test(value)
    ? value
    : new URL(value.replace(/^\/+/, ''), `${site.url}/`).toString();
}

export function articleStructuredData(input: ArticleStructuredDataInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.title,
    url: input.canonical,
    inLanguage: 'zh-Hant',
    ...(input.description ? { description: input.description } : {}),
    ...(input.publishedAt ? { datePublished: input.publishedAt.toISOString() } : {}),
    ...(input.updatedAt ? { dateModified: input.updatedAt.toISOString() } : {}),
    ...(input.topics?.length ? {
      keywords: input.topics,
      about: input.topics.map((name) => ({ '@type': 'Thing', name })),
    } : {}),
    ...(input.series ? {
      articleSection: input.series.title,
      isPartOf: {
        '@type': 'CollectionPage',
        name: input.series.title,
        url: input.series.url,
      },
    } : {}),
    ...(input.image ? { image: absoluteSiteAsset(input.image) } : {}),
    author: {
      '@type': 'Person',
      '@id': `${site.url}/about/#author`,
      name: site.author.name,
      url: `${site.url}/about/`,
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': input.canonical },
  };
}

export function profileStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    inLanguage: 'zh-Hant',
    mainEntity: {
      '@type': 'Person',
      '@id': `${site.url}/about/#author`,
      name: site.author.name,
      url: `${site.url}/about/`,
      sameAs: [site.author.github, ...socialLinks.map((link) => link.href)],
    },
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbStructuredData(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface SeriesStructuredDataInput {
  title: string;
  description?: string;
  canonical: string;
  articles: Array<{
    title: string;
    url: string;
  }>;
}

export function seriesStructuredData(input: SeriesStructuredDataInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.title,
    url: input.canonical,
    inLanguage: 'zh-Hant',
    ...(input.description ? { description: input.description } : {}),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: input.articles.length,
      itemListElement: input.articles.map((article, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: article.title,
        url: article.url,
      })),
    },
  };
}
