import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { localPostSlugFromEntry } from './lib/content/local-posts';
import { postFrontmatterSchema } from './lib/publishing/publication-schema';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts', generateId: ({ entry }) => localPostSlugFromEntry(entry) }),
  schema: postFrontmatterSchema,
});

export const collections = { posts };
