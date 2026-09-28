import assert from 'node:assert/strict';
import test from 'node:test';
import { removedImageUrls, removedMediaRecords } from './media-cleanup';

test('removed image URLs exclude retained images and ordinary links', () => {
  const original = [
    '![封面](https://media.gcake.dev/posts/demo/cover.png)',
    '![保留](https://media.gcake.dev/posts/demo/keep.webp)',
    '[參考資料](https://media.gcake.dev/docs/reference.png)',
    '<img src="https://media.gcake.dev/posts/demo/inline.svg" alt="inline">',
  ].join('\n');
  const updated = [
    '![保留](https://media.gcake.dev/posts/demo/keep.webp)',
    '[參考資料](https://media.gcake.dev/docs/reference.png)',
  ].join('\n');

  assert.deepEqual(removedImageUrls(original, updated), [
    'https://media.gcake.dev/posts/demo/cover.png',
    'https://media.gcake.dev/posts/demo/inline.svg',
  ]);
});

test('duplicate references produce one cleanup candidate only after every image reference is removed', () => {
  const url = 'https://media.gcake.dev/posts/demo/reused.png';
  const original = `![一](${url})\n![二](${url})`;

  assert.deepEqual(removedImageUrls(original, `![二](${url})`), []);
  assert.deepEqual(removedImageUrls(original, ''), [url]);
});

test('cleanup candidates include only removed images that belong to the media library', () => {
  const library = [
    { id: 'cover', url: 'https://media.gcake.dev/posts/demo/cover.png' },
    { id: 'other', url: 'https://media.gcake.dev/posts/other/other.png' },
  ];
  const original = '![封面](https://media.gcake.dev/posts/demo/cover.png)\n![外部](https://example.com/external.png)';

  assert.deepEqual(removedMediaRecords(original, '', library), [library[0]]);
});
