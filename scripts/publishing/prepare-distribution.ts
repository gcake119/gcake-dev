import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPortablePublication } from '../../src/lib/publishing/publication-transform';
import { resolveLocalPostFile } from '../../src/lib/content/local-posts';
import { paragraphDryRunAdapter, substackDryRunAdapter } from '../../src/lib/publishing/dry-run-adapters';

export type DistributionTarget = 'paragraph' | 'substack';
export interface DistributionBundle {
  schemaVersion: 1;
  slug: string;
  sourceRevision: string;
  createdAt: string;
  canonicalUrl: string;
  sourceMarkdown: string;
  publishedAt?: string;
  newsletter: 'skip';
  mode: 'dry-run';
  targets: Record<DistributionTarget, {
    operation: 'create-draft' | 'update-draft';
    externalWriteEnabled: false;
    status: 'prepared';
    remoteId?: string;
    verificationRequired: true;
  }>;
  article: {
    title: string;
    description?: string;
    markdown: string;
    distributionMode: 'full' | 'interactive-summary';
    assets: { source: string; alt: string }[];
  };
}

function safeSlug(value: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(value) || value.includes('..')) {
    throw new Error('INVALID_POST_SLUG');
  }
  return value;
}

export async function buildDistributionBundle(
  slug: string,
  postsDir: string,
  remoteIds: Partial<Record<DistributionTarget, string>> = {},
  now: () => string = () => new Date().toISOString(),
): Promise<DistributionBundle> {
  const safe = safeSlug(slug);
  const sourcePath = await resolveLocalPostFile(postsDir, safe);
  if (!sourcePath) throw new Error('POST_NOT_FOUND');
  const source = await fs.readFile(sourcePath, 'utf8');
  if (matter(source).data.status !== 'published') throw new Error('UNPUBLISHED_POST_NOT_DISTRIBUTABLE');
  const sourceRevision = 'sha256:' + createHash('sha256').update(source).digest('hex');
  const publication = createPortablePublication({ slug: safe, source, sourceRevision });
  if (!publication.publishedAt) throw new Error('PUBLISHED_AT_REQUIRED_FOR_DISTRIBUTION');
  const createdAt = now();
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('INVALID_PREPARATION_TIME');
  if (Date.parse(publication.publishedAt) > Date.parse(createdAt)) throw new Error('FUTURE_POST_NOT_DISTRIBUTABLE');
  const [paragraph, substack] = await Promise.all([
    paragraphDryRunAdapter.prepare({ publication, newsletter: 'skip', remoteId: remoteIds.paragraph }),
    substackDryRunAdapter.prepare({ publication, newsletter: 'skip', remoteId: remoteIds.substack }),
  ]);
  if (paragraph.externalWriteEnabled || substack.externalWriteEnabled) throw new Error('DRY_RUN_REQUIRED');
  const target = (prepared: typeof paragraph, remoteId?: string) => ({
    operation: prepared.operation,
    externalWriteEnabled: false as const,
    status: 'prepared' as const,
    ...(remoteId ? { remoteId } : {}),
    verificationRequired: true as const,
  });
  return {
    schemaVersion: 1,
    slug: safe,
    sourceRevision,
    createdAt,
    canonicalUrl: publication.canonicalUrl,
    sourceMarkdown: matter(source).content.trim(),
    publishedAt: publication.publishedAt,
    newsletter: 'skip',
    mode: 'dry-run',
    targets: {
      paragraph: target(paragraph, remoteIds.paragraph),
      substack: target(substack, remoteIds.substack),
    },
    article: {
      title: publication.title,
      description: publication.description,
      markdown: publication.body,
      distributionMode: publication.distributionMode,
      assets: publication.assets,
    },
  };
}

export async function writeDistributionBundle(bundle: DistributionBundle, outputDir: string): Promise<string> {
  const absolute = path.resolve(outputDir);
  await fs.mkdir(absolute, { recursive: true });
  const output = path.join(absolute, bundle.slug + '.json');
  await fs.writeFile(output, JSON.stringify(bundle, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return output;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const slug = args[0];
  if (!slug || args.some((a) => a.startsWith('--') && a !== '--out')) {
    throw new Error('Usage: pnpm distribution:prepare <slug> [--out <directory>]');
  }
  const outAt = args.indexOf('--out');
  if (outAt !== -1 && (!args[outAt + 1] || outAt + 2 !== args.length)) throw new Error('INVALID_OUTPUT_ARGUMENT');
  if (outAt === -1 && args.length !== 1) throw new Error('INVALID_ARGUMENTS');
  const root = process.cwd();
  const bundle = await buildDistributionBundle(slug, path.join(root, 'src/content/posts'));
  const output = await writeDistributionBundle(bundle, outAt === -1 ? path.join(root, '.distribution-handoff') : args[outAt + 1]);
  console.log(JSON.stringify({ output, slug: bundle.slug, sourceRevision: bundle.sourceRevision, mode: bundle.mode, newsletter: bundle.newsletter }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
