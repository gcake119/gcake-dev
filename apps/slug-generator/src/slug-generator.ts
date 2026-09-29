export interface SlugGeneratorConfig {
  readonly ollamaBaseUrl: string;
  readonly model: string;
  readonly allowedOrigin: string;
  readonly timeoutMs: number;
  readonly fetch: typeof fetch;
}

const ERROR_PAYLOAD = {
  error: {
    code: 'SLUG_SUGGESTION_UNAVAILABLE',
    message: '目前無法產生 slug，可以手動輸入。',
  },
} as const;

export function buildSlugPrompt(title: string): string {
  return `根據以下繁體中文技術文章標題，產生一個簡短英文 URL slug。

規則：
- 3～7 個英文詞
- 全小寫
- kebab-case
- 保留重要技術名詞，例如 gherkin、sdd、tdd、astro、codex
- 表達核心語意
- 不逐字翻譯
- 不使用拼音
- 不加入日期或編號
- 只輸出 slug

標題：
${title.trim()}`;
}

export function sanitizeSlugSuggestion(raw: string): string | undefined {
  let candidate = raw.trim();
  const fenced = candidate.match(/^```(?:text|plaintext)?\s*\n?([a-zA-Z0-9-]+)\s*\n?```$/);
  if (fenced) candidate = fenced[1] ?? '';
  candidate = candidate.replace(/^['"`]|['"`]$/g, '').trim();
  if (!/^[a-zA-Z]+(?:-[a-zA-Z]+){2,6}$/.test(candidate)) return undefined;
  const normalized = candidate.toLowerCase();
  if (/\d/.test(normalized)) return undefined;
  return normalized;
}

function corsHeaders(origin: string): HeadersInit {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'Origin',
  };
}

function errorResponse(origin: string): Response {
  return Response.json(ERROR_PAYLOAD, { status: 503, headers: corsHeaders(origin) });
}

export function createSlugSuggestionHandler(config: SlugGeneratorConfig) {
  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') ?? '';
    if (origin !== config.allowedOrigin) {
      return Response.json({ error: { code: 'FORBIDDEN', message: '不允許的 Admin 來源。' } }, { status: 403 });
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== 'POST' || url.pathname !== '/api/slug-suggestions') {
      return Response.json({ error: { code: 'NOT_FOUND', message: '找不到此路徑。' } }, { status: 404, headers: corsHeaders(origin) });
    }

    let payload: { title?: unknown };
    try {
      payload = await request.json() as { title?: unknown };
    } catch {
      return Response.json({ error: { code: 'VALIDATION_FAILED', message: '標題格式不正確。' } }, { status: 400, headers: corsHeaders(origin) });
    }
    if (typeof payload.title !== 'string' || !payload.title.trim()) {
      return Response.json({ error: { code: 'VALIDATION_FAILED', message: '請先輸入文章標題。' } }, { status: 400, headers: corsHeaders(origin) });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await config.fetch(`${config.ollamaBaseUrl.replace(/\/$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          prompt: buildSlugPrompt(payload.title),
          stream: false,
          think: false,
          options: { temperature: 0.2 },
        }),
        signal: controller.signal,
      });
      if (!response.ok) return errorResponse(origin);
      const value = await response.json() as { response?: unknown };
      const slug = typeof value.response === 'string' ? sanitizeSlugSuggestion(value.response) : undefined;
      return slug
        ? Response.json({ slug }, { headers: corsHeaders(origin) })
        : errorResponse(origin);
    } catch {
      return errorResponse(origin);
    } finally {
      clearTimeout(timer);
    }
  };
}
