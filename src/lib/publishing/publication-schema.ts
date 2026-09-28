import { z } from 'zod';
import { parsePublicationTime } from '../content/publication';

export const distributionSchema = z.object({
  mode: z.enum(['full', 'interactive-summary']).default('full'),
  fallback: z.string().trim().min(1).optional(),
}).default({ mode: 'full' }).superRefine((distribution, context) => {
  if (distribution.mode === 'interactive-summary' && !distribution.fallback) {
    context.addIssue({
      code: 'custom',
      path: ['fallback'],
      message: 'interactive-summary requires a source-controlled distribution.fallback',
    });
  }
});

export const postFrontmatterSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  publishedAt: z.preprocess(
    (value) => typeof value === 'string' ? parsePublicationTime(value).instant : value,
    z.date(),
  ).optional(),
  updatedAt: z.coerce.date().optional(),
  status: z.enum(['draft', 'ready', 'published']).default('draft'),
  series: z.string().optional(),
  topics: z.array(z.string()).default([]),
  distribution: distributionSchema,
});

export type Distribution = z.infer<typeof distributionSchema>;
