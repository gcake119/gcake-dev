import { site, socialLinks } from '../../data/site';

export interface ArticleStructuredDataInput {
  title: string;
  description?: string;
  canonical: string;
  publishedAt?: Date;
  updatedAt?: Date;
  topics?: string[];
}

export function articleStructuredData(input: ArticleStructuredDataInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.title,
    ...(input.description ? { description: input.description } : {}),
    ...(input.publishedAt ? { datePublished: input.publishedAt.toISOString() } : {}),
    ...(input.updatedAt ? { dateModified: input.updatedAt.toISOString() } : {}),
    ...(input.topics?.length ? { keywords: input.topics } : {}),
    author: { '@id': `${site.url}/about/#author` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': input.canonical },
  };
}

export function profileStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
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
