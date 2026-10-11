import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubAppReadClient } from './github';
test('first readiness uses pinned Git commit history, not the latest edit or ingestion clock', async () => {
  const seen: string[] = [];
  const client = new GitHubAppReadClient({
    installationTokens: { create: async () => 'test' },
    fetch: async (input) => {
      const url = new URL(String(input));
      seen.push(url.pathname + url.search);
      if (url.pathname.endsWith('/commits'))
        return Response.json([
          { sha: 'edited', commit: { committer: { date: '2026-10-11T01:00:00Z' } } },
          { sha: 'ready', commit: { committer: { date: '2026-10-10T01:00:00Z' } } },
          { sha: 'draft', commit: { committer: { date: '2026-10-09T01:00:00Z' } } },
        ]);
      const status = url.searchParams.get('ref') === 'draft' ? 'draft' : 'ready';
      return Response.json({
        encoding: 'base64',
        content: Buffer.from(`---\ntitle: Post\nstatus: ${status}\n---\nBody`).toString('base64'),
      });
    },
  });
  assert.equal(await client.firstReadyAt('src/content/posts/p.md', 'pinned-head'), '2026-10-10T01:00:00Z');
  assert.match(seen[0], /sha=pinned-head/);
  assert.equal(
    seen.some((u) => u.includes('ref=edited')),
    false,
  );
});
