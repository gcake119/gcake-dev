import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { paragraphDryRunAdapter } from '../../src/lib/publishing/dry-run-adapters';
import { resolveLocalPostFile } from '../../src/lib/content/local-posts';
import { createPortablePublication } from '../../src/lib/publishing/publication-transform';

export async function prepareParagraphDryRun(slug: string, postsDir: string) {
  const sourcePath = await resolveLocalPostFile(postsDir, slug);
  if (!sourcePath) throw new Error(`Post not found: ${slug}`);

  const source = await fs.readFile(sourcePath, 'utf8');
  const sourceRevision = `sha256:${createHash('sha256').update(source).digest('hex')}`;
  const publication = createPortablePublication({ slug, source, sourceRevision });
  const plan = await paragraphDryRunAdapter.prepare({ publication, newsletter: 'skip' });
  return { sourcePath, publication, plan };
}
