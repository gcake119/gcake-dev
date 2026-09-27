import path from 'node:path';
import { prepareParagraphDryRun } from './paragraph-prepare';

const slug = process.argv[2];

if (!slug) {
  console.error('Usage: pnpm paragraph:prepare <post-slug>');
  process.exit(1);
}

const prepared = await prepareParagraphDryRun(slug, path.resolve('src/content/posts'));

console.log(
  JSON.stringify(
    {
      ...prepared,
      note: 'Dry run only. Paragraph writes and newsletter delivery are disabled.',
    },
    null,
    2,
  ),
);
