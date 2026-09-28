import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InMemoryMediaIndex,
  InMemoryObjectStore,
  MediaValidationError,
  createMediaKey,
  deleteMedia,
  replaceMedia,
  scanMediaUsage,
  uploadMedia,
} from './media';

const png = new Uint8Array([137, 80, 78, 71]);

test('immutable keys are deterministic in shape and unique by asset ID', () => {
  assert.equal(createMediaKey({ slug: 'agent-post', date: new Date('2026-09-28T00:00:00Z'), assetId: 'abc123', name: 'My Image!.PNG' }), 'posts/agent-post/2026/09/abc123-my-image.png');
  assert.notEqual(
    createMediaKey({ slug: 'agent-post', date: new Date('2026-09-28T00:00:00Z'), assetId: 'one', name: 'image.png' }),
    createMediaKey({ slug: 'agent-post', date: new Date('2026-09-28T00:00:00Z'), assetId: 'two', name: 'image.png' }),
  );
});

test('disallowed type and oversize input create neither R2 object nor D1 record', async () => {
  const objects = new InMemoryObjectStore();
  const index = new InMemoryMediaIndex();
  await assert.rejects(uploadMedia({
    objects, index, slug: 'post', name: 'payload.exe', mime: 'application/octet-stream', bytes: png,
    width: 1, height: 1, hash: 'hash', now: () => new Date('2026-09-28T00:00:00Z'), assetId: () => 'id',
  }), (error: unknown) => error instanceof MediaValidationError && error.code === 'MEDIA_TYPE_NOT_ALLOWED');
  assert.equal(objects.size, 0);
  assert.equal(index.records.length, 0);

  await assert.rejects(uploadMedia({
    objects, index, slug: 'post', name: 'huge.png', mime: 'image/png', bytes: new Uint8Array(10 * 1024 * 1024 + 1),
    width: 1, height: 1, hash: 'hash', now: () => new Date('2026-09-28T00:00:00Z'), assetId: () => 'huge',
  }), (error: unknown) => error instanceof MediaValidationError && error.code === 'MEDIA_TOO_LARGE');
  assert.equal(objects.size, 0);
  assert.equal(index.records.length, 0);
});

test('WebP, PNG, and SVG are accepted with matching immutable extensions', async () => {
  for (const [mime, extension] of [['image/webp', 'webp'], ['image/png', 'png'], ['image/svg+xml', 'svg']] as const) {
    const objects = new InMemoryObjectStore();
    const index = new InMemoryMediaIndex();
    const record = await uploadMedia({
      objects, index, slug: 'post', name: 'asset.input', mime, bytes: png,
      width: 1, height: 1, hash: mime, now: () => new Date('2026-09-28T00:00:00Z'), assetId: () => extension,
    });
    assert.equal(record.key.endsWith(`.${extension}`), true);
    assert.equal(objects.size, 1);
    assert.equal(index.records.length, 1);
  }
});

test('upload stores immutable bytes and operational metadata without article alt or caption', async () => {
  const objects = new InMemoryObjectStore();
  const index = new InMemoryMediaIndex();
  const record = await uploadMedia({
    objects, index, slug: 'post', name: 'screen.png', mime: 'image/png', bytes: png,
    width: 1200, height: 800, hash: 'sha256', now: () => new Date('2026-09-28T00:00:00Z'), assetId: () => 'asset',
  });
  assert.equal(record.key, 'posts/post/2026/09/asset-screen.png');
  assert.equal(record.url, 'https://media.gcake.dev/posts/post/2026/09/asset-screen.png');
  assert.equal('alt' in record, false);
  assert.equal('caption' in record, false);
  assert.equal(objects.size, 1);
});

test('replacement gets a new URL and preserves historical object', async () => {
  const objects = new InMemoryObjectStore();
  const index = new InMemoryMediaIndex();
  const original = await uploadMedia({
    objects, index, slug: 'post', name: 'screen.png', mime: 'image/png', bytes: png,
    width: 10, height: 10, hash: 'old', now: () => new Date('2026-09-28T00:00:00Z'), assetId: () => 'old',
  });
  const replacement = await replaceMedia(original, {
    objects, index, slug: 'post', name: 'screen.png', mime: 'image/png', bytes: png,
    width: 20, height: 20, hash: 'new', now: () => new Date('2026-09-28T00:00:00Z'), assetId: () => 'new',
  });
  assert.notEqual(replacement.url, original.url);
  assert.equal(objects.has(original.key), true);
  assert.equal(objects.has(replacement.key), true);
});

test('usage scan blocks deletion until references are resolved and confirmed', async () => {
  const objects = new InMemoryObjectStore();
  const index = new InMemoryMediaIndex();
  const record = await uploadMedia({
    objects, index, slug: 'post', name: 'screen.png', mime: 'image/png', bytes: png,
    width: 10, height: 10, hash: 'hash', now: () => new Date('2026-09-28T00:00:00Z'), assetId: () => 'asset',
  });
  const usage = scanMediaUsage(record.url, { 'src/content/posts/a.md': `![alt](${record.url})` });
  assert.deepEqual(usage, ['src/content/posts/a.md']);
  assert.equal((await deleteMedia(record, objects, index, usage, true)).kind, 'blocked');
  assert.equal((await deleteMedia(record, objects, index, [], false)).kind, 'confirmation-required');
  assert.equal(objects.has(record.key), true);
});
