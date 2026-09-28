import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InMemoryGitRepository,
  RepositoryConflictError,
  deletePost,
  saveRepositoryTransaction,
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
