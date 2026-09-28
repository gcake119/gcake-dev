import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InMemoryDraftStore,
  draftKey,
  recoverDraft,
  saveDraft,
} from './recovery';

test('autosave is keyed by repository, article slug, and base revision', () => {
  const store = new InMemoryDraftStore();
  saveDraft(store, {
    repository: 'gcake119/gcake-dev', slug: 'post', baseBlobSha: 'blob-a', source: 'working', savedAt: 10,
  });
  assert.equal(draftKey('gcake119/gcake-dev', 'post', 'blob-a'), 'gcake119/gcake-dev:post:blob-a');
  assert.equal(recoverDraft(store, 'gcake119/gcake-dev', 'post', 'blob-a').kind, 'recoverable');
});

test('older-base autosave enters conflict handling and never silently replaces repository source', () => {
  const store = new InMemoryDraftStore();
  saveDraft(store, {
    repository: 'gcake119/gcake-dev', slug: 'post', baseBlobSha: 'blob-old', source: 'local draft', savedAt: 10,
  });
  const result = recoverDraft(store, 'gcake119/gcake-dev', 'post', 'blob-new');
  assert.equal(result.kind, 'conflict');
  assert.equal(result.repositorySourceApplied, true);
  assert.equal(result.draft?.source, 'local draft');
});
