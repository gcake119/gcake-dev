import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSeries,
  deleteSeries,
  InMemoryGitRepository,
  renameSeries,
  RepositoryConflictError,
  deletePost,
  renamePost,
  saveRepositoryTransaction,
  updateSeries,
} from './git-writes';

test('stale article SHA returns conflict details and creates no commit', async () => {
  const repository = new InMemoryGitRepository({
    baseCommitSha: 'commit-current',
    files: { 'src/content/posts/post.md': { sha: 'blob-current', content: 'current' } },
  });
  await assert.rejects(
    saveRepositoryTransaction(repository, {
      expectedBaseCommitSha: 'commit-current',
      message: 'Update post',
      changes: [{ path: 'src/content/posts/post.md', expectedBlobSha: 'blob-old', content: 'draft' }],
    }),
    (error: unknown) => error instanceof RepositoryConflictError
      && error.code === 'ARTICLE_CONFLICT'
      && error.currentBlobSha === 'blob-current',
  );
  assert.equal(repository.commits.length, 0);
});

test('article and series update validate first and land in exactly one commit', async () => {
  const repository = new InMemoryGitRepository({
    baseCommitSha: 'commit-a',
    files: {
      'src/content/posts/new.md': { sha: 'post-a', content: 'old post' },
      'src/content/series/series.yaml': { sha: 'series-a', content: 'old series' },
    },
  });
  const result = await saveRepositoryTransaction(repository, {
    expectedBaseCommitSha: 'commit-a',
    message: 'Update article and series',
    changes: [
      { path: 'src/content/posts/new.md', expectedBlobSha: 'post-a', content: 'new post' },
      { path: 'src/content/series/series.yaml', expectedBlobSha: 'series-a', content: 'new series' },
    ],
  });
  assert.equal(repository.commits.length, 1);
  assert.deepEqual(result.paths, ['src/content/posts/new.md', 'src/content/series/series.yaml']);
});

test('deletion requires explicit confirmation and blocks unresolved series references', async () => {
  const repository = new InMemoryGitRepository({
    baseCommitSha: 'commit-a',
    files: { 'src/content/posts/post.md': { sha: 'post-a', content: 'post' } },
  });
  const referenced = await deletePost(repository, {
    path: 'src/content/posts/post.md', expectedBlobSha: 'post-a', expectedBaseCommitSha: 'commit-a',
    confirmed: true, seriesReferences: ['series-one'],
  });
  assert.equal(referenced.kind, 'blocked');
  assert.deepEqual(referenced.seriesReferences, ['series-one']);
  assert.equal(repository.commits.length, 0);

  const unconfirmed = await deletePost(repository, {
    path: 'src/content/posts/post.md', expectedBlobSha: 'post-a', expectedBaseCommitSha: 'commit-a',
    confirmed: false, seriesReferences: [],
  });
  assert.equal(unconfirmed.kind, 'confirmation-required');
  assert.equal(repository.commits.length, 0);
});

test('post rename creates the new path and removes the old path in one transaction', async () => {
  const repository = new InMemoryGitRepository({
    baseCommitSha: 'commit-a',
    files: { 'src/content/posts/old-slug.md': { sha: 'post-a', content: 'old source' } },
  });

  const result = await renamePost(repository, {
    oldSlug: 'old-slug', newSlug: 'new-slug', source: 'updated source',
    expectedBlobSha: 'post-a', expectedBaseCommitSha: 'commit-a',
  });

  assert.equal(repository.commits.length, 1);
  assert.deepEqual(result.paths, ['src/content/posts/new-slug.md', 'src/content/posts/old-slug.md']);
  assert.equal(await repository.getFile('src/content/posts/old-slug.md'), undefined);
  assert.equal((await repository.getFile('src/content/posts/new-slug.md'))?.content, 'updated source');
});

test('post rename rewrites every series post entry and editorial pointer in the same transaction', async () => {
  const seriesSource = [
    'slug: notes',
    'title: Notes',
    'status: active',
    'editorial:',
    '  currentPost: old-slug',
    '  nextPost: old-slug',
    'sections:',
    '  - id: start',
    '    title: Start',
    '    status: active',
    '    posts:',
    '      - slug: old-slug',
    '        status: ready',
    '      - slug: keep-slug',
    '        status: draft',
    '',
  ].join('\n');
  const repository = new InMemoryGitRepository({
    baseCommitSha: 'commit-a',
    files: {
      'src/content/posts/old-slug.md': { sha: 'post-a', content: 'old source' },
      'src/content/series/notes.yaml': { sha: 'series-a', content: seriesSource },
    },
  });

  const result = await renamePost(repository, {
    oldSlug: 'old-slug', newSlug: 'new-slug', source: 'updated source',
    expectedBlobSha: 'post-a', expectedBaseCommitSha: 'commit-a',
    seriesFiles: [{ path: 'src/content/series/notes.yaml', expectedBlobSha: 'series-a', source: seriesSource }],
  });

  assert.deepEqual(result.paths, [
    'src/content/posts/new-slug.md',
    'src/content/series/notes.yaml',
    'src/content/posts/old-slug.md',
  ]);
  const updated = (await repository.getFile('src/content/series/notes.yaml'))?.content ?? '';
  assert.doesNotMatch(updated, /old-slug/);
  assert.equal((updated.match(/new-slug/g) ?? []).length, 3);
  assert.match(updated, /slug: keep-slug/);
});

test('stale referencing series blocks the entire post rename', async () => {
  const seriesSource = 'slug: notes\ntitle: Notes\nstatus: active\nsections:\n  - id: start\n    title: Start\n    status: active\n    posts:\n      - slug: old-slug\n        status: ready\n';
  const repository = new InMemoryGitRepository({
    baseCommitSha: 'commit-a',
    files: {
      'src/content/posts/old-slug.md': { sha: 'post-a', content: 'old source' },
      'src/content/series/notes.yaml': { sha: 'series-new', content: seriesSource },
    },
  });

  await assert.rejects(renamePost(repository, {
    oldSlug: 'old-slug', newSlug: 'new-slug', source: 'updated source',
    expectedBlobSha: 'post-a', expectedBaseCommitSha: 'commit-a',
    seriesFiles: [{ path: 'src/content/series/notes.yaml', expectedBlobSha: 'series-old', source: seriesSource }],
  }), (error: unknown) => error instanceof RepositoryConflictError && error.code === 'SERIES_CONFLICT');
  assert.equal(repository.commits.length, 0);
  assert.equal(await repository.getFile('src/content/posts/new-slug.md'), undefined);
});

test('post rename rejects an existing target slug without creating a commit', async () => {
  const repository = new InMemoryGitRepository({
    baseCommitSha: 'commit-a',
    files: {
      'src/content/posts/old-slug.md': { sha: 'post-a', content: 'old source' },
      'src/content/posts/taken-slug.md': { sha: 'post-b', content: 'taken source' },
    },
  });

  await assert.rejects(renamePost(repository, {
    oldSlug: 'old-slug', newSlug: 'taken-slug', source: 'updated source',
    expectedBlobSha: 'post-a', expectedBaseCommitSha: 'commit-a',
  }), (error: unknown) => error instanceof RepositoryConflictError
    && error.code === 'ARTICLE_CONFLICT'
    && error.path === 'src/content/posts/taken-slug.md');
  assert.equal(repository.commits.length, 0);
  assert.equal((await repository.getFile('src/content/posts/old-slug.md'))?.content, 'old source');
});

test('create series expects an absent target and rejects duplicate or stale repository state', async () => {
  const repository = new InMemoryGitRepository({ baseCommitSha: 'commit-a', files: {} });
  const created = await createSeries(repository, {
    path: 'src/content/series/agent-workflows.yaml', source: 'slug: agent-workflows\nsections: []\n',
    expectedBaseCommitSha: 'commit-a',
  });
  assert.deepEqual(created.paths, ['src/content/series/agent-workflows.yaml']);

  await assert.rejects(
    createSeries(repository, {
      path: 'src/content/series/agent-workflows.yaml', source: 'duplicate',
      expectedBaseCommitSha: 'commit-1',
    }),
    (error: unknown) => error instanceof RepositoryConflictError && error.code === 'SERIES_CONFLICT',
  );
  assert.equal(repository.commits.length, 1);

  await assert.rejects(
    createSeries(repository, {
      path: 'src/content/series/other.yaml', source: 'slug: other\nsections: []\n',
      expectedBaseCommitSha: 'stale-commit',
    }),
    (error: unknown) => error instanceof RepositoryConflictError && error.currentCommitSha === 'commit-1',
  );
  assert.equal(repository.commits.length, 1);
});

test('title update preserves the supplied manifest and checks the source blob', async () => {
  const source = 'slug: agents\ntitle: New title\nsections:\n  - id: start\n    posts:\n      - slug: one\n';
  const repository = new InMemoryGitRepository({
    baseCommitSha: 'commit-a',
    files: { 'src/content/series/agents.yaml': { sha: 'series-a', content: 'old' } },
  });
  const updated = await updateSeries(repository, {
    path: 'src/content/series/agents.yaml', source,
    expectedBlobSha: 'series-a', expectedBaseCommitSha: 'commit-a',
  });
  assert.deepEqual(updated.paths, ['src/content/series/agents.yaml']);
  assert.equal((await repository.getFile('src/content/series/agents.yaml'))?.content, source);
});

test('rename series atomically deletes the old identity, creates the new one, and preserves order', async () => {
  const source = 'slug: new-series\ntitle: Series\nsections:\n  - id: start\n    posts:\n      - slug: one\n      - slug: two\n';
  const repository = new InMemoryGitRepository({
    baseCommitSha: 'commit-a',
    files: { 'src/content/series/old-series.yaml': { sha: 'series-a', content: 'old' } },
  });
  const renamed = await renameSeries(repository, {
    oldPath: 'src/content/series/old-series.yaml', newPath: 'src/content/series/new-series.yaml', source,
    expectedBlobSha: 'series-a', expectedBaseCommitSha: 'commit-a',
  });
  assert.deepEqual(renamed.paths, [
    'src/content/series/old-series.yaml', 'src/content/series/new-series.yaml',
  ]);
  assert.equal(await repository.getFile('src/content/series/old-series.yaml'), undefined);
  assert.equal((await repository.getFile('src/content/series/new-series.yaml'))?.content, source);
  assert.equal(repository.commits.length, 1);
});

test('rename collision and stale source revision preserve both current manifests', async () => {
  const repository = new InMemoryGitRepository({
    baseCommitSha: 'commit-a',
    files: {
      'src/content/series/old-series.yaml': { sha: 'series-current', content: 'old' },
      'src/content/series/new-series.yaml': { sha: 'target-current', content: 'target' },
    },
  });
  await assert.rejects(
    renameSeries(repository, {
      oldPath: 'src/content/series/old-series.yaml', newPath: 'src/content/series/new-series.yaml', source: 'new',
      expectedBlobSha: 'series-current', expectedBaseCommitSha: 'commit-a',
    }),
    (error: unknown) => error instanceof RepositoryConflictError && error.code === 'SERIES_CONFLICT',
  );
  await assert.rejects(
    renameSeries(repository, {
      oldPath: 'src/content/series/old-series.yaml', newPath: 'src/content/series/unused.yaml', source: 'new',
      expectedBlobSha: 'series-stale', expectedBaseCommitSha: 'commit-a',
    }),
    (error: unknown) => error instanceof RepositoryConflictError && error.currentBlobSha === 'series-current',
  );
  assert.equal(repository.commits.length, 0);
  assert.equal((await repository.getFile('src/content/series/old-series.yaml'))?.content, 'old');
  assert.equal((await repository.getFile('src/content/series/new-series.yaml'))?.content, 'target');
});

test('series deletion requires confirmation and removes only the manifest', async () => {
  const repository = new InMemoryGitRepository({
    baseCommitSha: 'commit-a',
    files: {
      'src/content/series/agents.yaml': { sha: 'series-a', content: 'manifest' },
      'src/content/posts/one.md': { sha: 'post-a', content: 'article body' },
    },
  });
  assert.deepEqual(await deleteSeries(repository, {
    path: 'src/content/series/agents.yaml', expectedBlobSha: 'series-a',
    expectedBaseCommitSha: 'commit-a', confirmed: false,
  }), { kind: 'confirmation-required' });
  assert.equal(repository.commits.length, 0);

  const deleted = await deleteSeries(repository, {
    path: 'src/content/series/agents.yaml', expectedBlobSha: 'series-a',
    expectedBaseCommitSha: 'commit-a', confirmed: true,
  });
  assert.equal(deleted.kind, 'deleted');
  assert.equal(await repository.getFile('src/content/series/agents.yaml'), undefined);
  assert.equal((await repository.getFile('src/content/posts/one.md'))?.content, 'article body');
});
