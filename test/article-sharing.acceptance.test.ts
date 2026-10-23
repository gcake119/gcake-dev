import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { initArticleShare as init } from '../src/lib/sharing/article-share';
const url = 'https://gcake119.github.io/gcake-dev/posts/ai-agent-development-workflow/';
const title = 'AI Agent 協作開發工作流：讓規格、技能與驗證各司其職';
function setup(browser: any = {}) {
  const { document } = parseHTML(`<section data-article-share data-url="${url}" data-title="${title}"><div data-share-actions hidden><button data-share hidden><svg aria-hidden="true"></svg><span>分享這篇文章</span></button></div><p role="status" aria-live="polite" data-share-status></p><label data-share-recovery hidden>文章連結<input readonly value="${url}"></label></section>`);
  const root = document.querySelector('section') as unknown as HTMLElement;
  init(root, browser);
  return { root, share: root.querySelector<HTMLButtonElement>('[data-share]')!, status: root.querySelector('[role=status]')!, recovery: root.querySelector<HTMLElement>('[data-share-recovery]')! };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('unsupported sharing exposes selectable full URL without clipboard operations', () => {
  let writes = 0;
  const ui = setup({ clipboard: { writeText() { writes++; } } });
  assert.equal(ui.share.hidden, true);
  assert.equal(ui.recovery.hidden, false);
  assert.equal(ui.status.textContent, '此瀏覽器不支援分享，請手動複製下方連結');
  assert.equal(ui.recovery.querySelector('input')!.value, url);
  assert.equal(writes, 0);
  assert.equal(ui.root.querySelectorAll('[data-copy],a,iframe,form').length, 0);
});
for (const result of ['resolved', 'cancelled', 'failed']) test(`native share payload and ${result} outcome with only one action`, async () => {
  const payloads: unknown[] = []; let writes = 0;
  const ui = setup({ clipboard: { writeText() { writes++; } }, async share(payload: unknown) { payloads.push(payload); if (result !== 'resolved') throw Object.assign(new Error(), { name: result === 'cancelled' ? 'AbortError' : 'NotAllowedError' }); } });
  assert.equal(ui.share.hidden, false); assert.equal(payloads.length, 0);
  ui.share.click(); await flush();
  assert.deepEqual(payloads, [{ title, url }]);
  assert.equal(ui.status.textContent, result === 'failed' ? '無法開啟分享，請手動複製下方連結' : '');
  assert.equal(ui.recovery.hidden, result !== 'failed');
  assert.equal(ui.share.disabled, false); assert.equal(writes, 0);
  assert.equal(ui.root.querySelectorAll('button').length, 1);
});
test('new attempt clears stale failure, prevents overlap and restores the control', async () => {
  let calls = 0; let finish!: () => void;
  const ui = setup({ share() { if (++calls === 1) return Promise.reject(new Error('failed')); return new Promise<void>(resolve => { finish = resolve; }); } });
  ui.share.click(); await flush(); assert.equal(ui.recovery.hidden, false);
  ui.share.click(); ui.share.click();
  assert.equal(calls, 2); assert.equal(ui.status.textContent, ''); assert.equal(ui.recovery.hidden, true); assert.equal(ui.share.disabled, true);
  finish(); await flush(); assert.equal(ui.share.disabled, false); assert.equal(ui.status.textContent, '');
});
