import { createServer } from 'node:http';
import { createSlugSuggestionHandler } from './slug-generator.js';

const host = process.env.SLUG_GENERATOR_HOST ?? '127.0.0.1';
const port = Number(process.env.SLUG_GENERATOR_PORT ?? '4319');
const allowedOrigin = process.env.SLUG_GENERATOR_ALLOWED_ORIGIN ?? 'http://127.0.0.1:5173';
const handler = createSlugSuggestionHandler({
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
  model: process.env.OLLAMA_MODEL ?? 'gemma4:12b',
  timeoutMs: Number(process.env.SLUG_GENERATOR_TIMEOUT_MS ?? '15000'),
  allowedOrigin,
  fetch: globalThis.fetch.bind(globalThis),
});

createServer(async (incoming, outgoing) => {
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
  const request = new Request(`http://${host}:${port}${incoming.url ?? '/'}`, {
    method: incoming.method,
    headers: incoming.headers as HeadersInit,
    body: incoming.method === 'GET' || incoming.method === 'HEAD' ? undefined : Buffer.concat(chunks),
  });
  const response = await handler(request);
  outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, host, () => {
  console.log(`gcake slug generator listening on http://${host}:${port}`);
});
