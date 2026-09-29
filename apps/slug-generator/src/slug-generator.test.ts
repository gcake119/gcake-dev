import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSlugPrompt,
  createSlugSuggestionHandler,
  sanitizeSlugSuggestion,
} from './slug-generator';

test('sanitizes one plain or fenced candidate to lowercase kebab-case', () => {
  assert.equal(sanitizeSlugSuggestion('Add-Gherkin-To-SDD-Workflow'), 'add-gherkin-to-sdd-workflow');
  assert.equal(sanitizeSlugSuggestion('"add-gherkin-to-sdd-workflow"'), 'add-gherkin-to-sdd-workflow');
  assert.equal(sanitizeSlugSuggestion('```text\nadd-gherkin-to-sdd-workflow\n```'), 'add-gherkin-to-sdd-workflow');
});

test('rejects prose, multiple candidates, invalid word counts, dates, and meaningless numbers', () => {
  for (const value of [
    'Here is your slug: add-gherkin-to-sdd-workflow',
    'add-gherkin-to-sdd-workflow\ngherkin-sdd-guide',
    'too-short',
    'this-slug-has-far-too-many-words-for-a-useful-url',
    'add-gherkin-workflow-2026',
    'add-gherkin-workflow-42',
    '加入-gherkin-workflow',
  ]) assert.equal(sanitizeSlugSuggestion(value), undefined, value);
});

test('prompt keeps technical terms and asks for slug only', () => {
  const prompt = buildSlugPrompt('我怎麼把 Gherkin 加進現在的 SDD 流程');
  assert.match(prompt, /3～7/);
  assert.match(prompt, /gherkin.*sdd.*tdd.*astro.*codex/is);
  assert.match(prompt, /只輸出 slug/);
});

test('valid request calls configured Ollama model and returns a sanitized suggestion', async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const handle = createSlugSuggestionHandler({
    ollamaBaseUrl: 'http://127.0.0.1:11434',
    model: 'gemma4:12b',
    allowedOrigin: 'https://admin.example',
    timeoutMs: 500,
    fetch: async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return Response.json({ response: 'Add-Gherkin-To-SDD-Workflow' });
    },
  });
  const response = await handle(new Request('http://127.0.0.1:4319/api/slug-suggestions', {
    method: 'POST',
    headers: { origin: 'https://admin.example', 'content-type': 'application/json' },
    body: JSON.stringify({ title: '我怎麼把 Gherkin 加進現在的 SDD 流程' }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { slug: 'add-gherkin-to-sdd-workflow' });
  assert.equal(calls[0]?.url, 'http://127.0.0.1:11434/api/generate');
  assert.equal((calls[0]?.body as { model?: string }).model, 'gemma4:12b');
  assert.equal((calls[0]?.body as { think?: boolean }).think, false);
});

test('empty title and unapproved origin never call Ollama', async () => {
  let calls = 0;
  const handle = createSlugSuggestionHandler({
    ollamaBaseUrl: 'http://127.0.0.1:11434', model: 'gemma4:12b',
    allowedOrigin: 'https://admin.example', timeoutMs: 500,
    fetch: async () => { calls += 1; return Response.json({ response: 'unused-slug-value' }); },
  });
  const empty = await handle(new Request('http://127.0.0.1:4319/api/slug-suggestions', {
    method: 'POST', headers: { origin: 'https://admin.example', 'content-type': 'application/json' },
    body: JSON.stringify({ title: '   ' }),
  }));
  const forbidden = await handle(new Request('http://127.0.0.1:4319/api/slug-suggestions', {
    method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Valid title' }),
  }));
  assert.equal(empty.status, 400);
  assert.equal(forbidden.status, 403);
  assert.equal(calls, 0);
});

test('unavailable, missing model, timeout, and invalid model output are optional failures', async () => {
  const failures = [
    async () => { throw new TypeError('fetch failed'); },
    async () => Response.json({ error: 'model not found' }, { status: 404 }),
    async (_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }),
    async () => Response.json({ response: 'Here is your slug: invalid-output-example' }),
  ];
  for (const fetcher of failures) {
    const handle = createSlugSuggestionHandler({
      ollamaBaseUrl: 'http://127.0.0.1:11434', model: 'gemma4:missing',
      allowedOrigin: 'https://admin.example', timeoutMs: 5, fetch: fetcher,
    });
    const response = await handle(new Request('http://127.0.0.1:4319/api/slug-suggestions', {
      method: 'POST', headers: { origin: 'https://admin.example', 'content-type': 'application/json' },
      body: JSON.stringify({ title: '有效的文章標題' }),
    }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: { code: 'SLUG_SUGGESTION_UNAVAILABLE', message: '目前無法產生 slug，可以手動輸入。' } });
  }
});
