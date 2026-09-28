import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EditorState,
  InMemoryPreferenceStore,
  loadSplitPreferences,
  renderImmediatePreview,
  saveSplitPreferences,
} from './editor-state';

test('one control cycles markdown → rendered → split → markdown without source or position loss', () => {
  const editor = new EditorState('# Title\n\nBody', 8, 240);
  assert.equal(editor.cycleView(), 'rendered');
  assert.equal(editor.cycleView(), 'split');
  assert.equal(editor.cycleView(), 'markdown');
  assert.equal(editor.source, '# Title\n\nBody');
  assert.equal(editor.cursorPosition, 8);
  assert.equal(editor.readingPosition, 240);
});

test('split preferences default to 50/50, clamp keyboard resize, and persist sync opt-out', () => {
  const storage = new InMemoryPreferenceStore();
  assert.deepEqual(loadSplitPreferences(storage), { ratio: 50, syncScroll: true });
  saveSplitPreferences(storage, { ratio: 68, syncScroll: false });
  assert.deepEqual(loadSplitPreferences(storage), { ratio: 68, syncScroll: false });

  const editor = new EditorState('text');
  editor.resizeSplit(200);
  assert.equal(editor.splitRatio, 80);
  editor.resizeSplit(-500);
  assert.equal(editor.splitRatio, 20);
});

test('immediate preview renders portable Markdown fixtures and reports unsupported MDX honestly', () => {
  const portable = renderImmediatePreview('# Heading\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n![alt](/image.webp)\n\n```ts\nconst wide = true;\n```');
  assert.equal(portable.limitations.length, 0);
  assert.match(portable.html, /<h1>Heading<\/h1>/);
  assert.match(portable.html, /<table>/);
  assert.match(portable.html, /<img src="\/image.webp" alt="alt">/);
  assert.match(portable.html, /<pre><code class="language-ts">/);

  const mdx = renderImmediatePreview('# Demo\n\n<InteractiveChart client:load />');
  assert.equal(mdx.limitations[0]?.code, 'UNSUPPORTED_MDX');
  assert.match(mdx.limitations[0]?.message ?? '', /正式 Astro 預覽/);
  assert.equal(mdx.source, '# Demo\n\n<InteractiveChart client:load />');
});
