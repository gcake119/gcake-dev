import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InvalidSeriesError,
  reorderSeriesPosts,
  validateAndSerializeSeries,
  type SeriesManifestInput,
} from './series-validation';

const manifest = {
  slug: 'agents', title: 'Agents', status: 'active',
  sections: [{ id: 'start', title: 'Start', status: 'active', posts: [
    { slug: 'one', status: 'published' }, { slug: 'two', status: 'planned' },
  ] }],
  editorial: { currentPost: 'one', nextPost: 'two' },
} satisfies SeriesManifestInput;

test('valid reorder changes YAML manifest order only', () => {
  const reordered = reorderSeriesPosts(manifest, 'start', ['two', 'one']);
  const result = validateAndSerializeSeries(reordered, { existingMarkdownSlugs: new Set(['one']) });
  assert.match(result.yaml, /- slug: two[\s\S]*- slug: one/);
  assert.deepEqual(result.pathsToWrite, ['src/content/series/agents.yaml']);
  assert.equal(JSON.stringify(result).includes('frontmatter'), false);
  assert.equal(JSON.stringify(result).includes('d1'), false);
});

for (const [name, mutate] of [
  ['duplicate section IDs', (value: any) => { value.sections.push({ ...value.sections[0] }); }],
  ['duplicate post references', (value: any) => { value.sections[0].posts.push({ slug: 'one', status: 'draft' }); }],
  ['missing Markdown', (value: any) => { value.sections[0].posts[0].slug = 'missing'; }],
  ['invalid editorial pointer', (value: any) => { value.editorial.nextPost = 'unknown'; }],
  ['invalid planning status', (value: any) => { value.sections[0].posts[0].status = 'unknown'; }],
] as const) {
  test(`${name} fails closed with INVALID_SERIES`, () => {
    const value = structuredClone(manifest);
    mutate(value);
    assert.throws(
      () => validateAndSerializeSeries(value, { existingMarkdownSlugs: new Set(['one']) }),
      (error: unknown) => error instanceof InvalidSeriesError && error.code === 'INVALID_SERIES',
    );
  });
}
