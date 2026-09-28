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
  assert.match(css, /\.public-content\s*\{[^}]*font:\s*1rem\/1\.8\s*inherit/);
});

test('opening an article or series replaces the content overview with a focused workspace', async () => {
  const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8');

  assert.match(source, /<section v-if="workspaceMode === 'overview'" class="content-overview"/);
  assert.match(source, /workspaceMode\.value = 'post'/);
  assert.match(source, /workspaceMode\.value = 'series'/);
  assert.match(source, /@click="closeWorkspace">返回內容清單<\/button>/);
  assert.match(source, /<section v-if="workspaceMode === 'post' && selectedPost" class="editor-panel workspace-panel"/);
  assert.match(source, /<section v-if="workspaceMode === 'series' && selectedSeries && seriesManifest" class="editor-panel workspace-panel series-editor"/);
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

test('series sections expose editable fields and guarded structure actions', async () => {
  const source = await readFile(new URL('./App.vue', import.meta.url), 'utf8');

  assert.match(source, />新增章節<\/button>/);
  assert.match(source, /<span>章節 ID<\/span>/);
  assert.match(source, /<span>章節標題<\/span>/);
  assert.match(source, /<span>章節狀態<\/span>/);
  assert.match(source, /<option value="planned">規劃中<\/option>/);
  assert.match(source, /<option value="active">進行中<\/option>/);
  assert.match(source, /<option value="completed">已完成<\/option>/);
  assert.match(source, /:disabled="section\.posts\.length > 0"/);
  assert.match(source, /@click="removeSection\(section\.id\)"/);
});
