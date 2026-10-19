import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { HEALTH_CONTRACT_VERSION } from '@gcake/admin-contract';

test('Admin consumes the shared API contract package', () => {
  assert.equal(HEALTH_CONTRACT_VERSION, 'v1');
});

test('given a 320px viewport, the Admin shell does not enforce horizontal overflow', async () => {
  const css = await readFile(new URL('./admin.css', import.meta.url), 'utf8');

  assert.doesNotMatch(css, /body\s*\{[^}]*min-width:\s*320px/);
  assert.match(css, /html,\s*body,\s*#app\s*\{[^}]*max-width:\s*100%[^}]*overflow-x:\s*clip/);
});

test('Admin headings and article preview inherit the project system sans typography', async () => {
  const css = await readFile(new URL('./admin.css', import.meta.url), 'utf8');

  assert.doesNotMatch(css, /Georgia|Noto Serif TC/);
  // Actual typography sizes and preview leading are verified in the browser.

});

test('the publication center follows content editing and preview', async () => {
  const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8');

  assert.ok(source.indexOf('class="editor-workspace"') < source.indexOf('class="publishing-center"'));
});

test('series ordering exposes a visible drag affordance and dragging state', async () => {
  const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8');
  const css = await readFile(new URL('./admin.css', import.meta.url), 'utf8');

  assert.match(source, /class="drag-handle"/);
  assert.match(source, /@dragend="draggedSeriesPost = undefined"/);
  assert.match(source, /'is-dragging': draggedSeriesPost\?\.sectionId === section\.id && draggedSeriesPost\?\.index === index/);
  assert.match(css, /\.drag-handle/);
  assert.match(css, /\.series-order li\.is-dragging/);
});

// Observable creation, lifecycle, recovery and wording cases now render the actual
// Vue templates in workflow-acceptance.test.ts; domain behavior remains covered
// by post-series, series-editor, media-cleanup and manual-release suites.
