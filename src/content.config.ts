import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { localPostSlugFromEntry } from './lib/content/local-posts';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts', generateId: ({ entry }) => localPostSlugFromEntry(entry) }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    publishedAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
    status: z.enum(['draft', 'ready', 'published']).default('draft'),
    series: z.string().optional(),
    topics: z.array(z.string()).default([]),
  }),
});

export const collections = { posts };
