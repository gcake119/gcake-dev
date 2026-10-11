import { appendFile } from 'node:fs/promises';
/** Secret stays in process environment, never a command argument or log. */
const endpoint = process.env.RELEASE_WORKER_URL;
const secret = process.env.RELEASE_AUTOMATION_SECRET;
if (!endpoint || !secret) throw new Error('Release automation is not configured');
const url = new URL('/api/v1/release-automation', endpoint);
if (url.protocol !== 'https:') throw new Error('HTTPS Worker endpoint required');
const response = await fetch(url, {
  method: 'POST',
  redirect: 'error',
  headers: {
    authorization: 'Bearer ' + secret,
    'content-type': 'application/json',
  },
  body: '{}',
  signal: AbortSignal.timeout(120000),
});
if (!response.ok) throw new Error('Release orchestration failed: HTTP ' + response.status);
const payload = await response.json() as { release?: unknown };
if (Object.hasOwn(payload, 'release')) {
  const release = payload.release as { id?: unknown; state?: unknown; commitSha?: unknown } | null;
  if (!release || typeof release !== 'object') throw new Error('Invalid release response');
  if (release.state === 'awaiting-verification') {
    if (typeof release.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(release.id) ||
        typeof release.commitSha !== 'string' || !/^[a-f0-9]{40}$/.test(release.commitSha))
      throw new Error('Invalid committed publication identity');
    if (!process.env.GITHUB_OUTPUT) throw new Error('Actions output destination required');
    await appendFile(process.env.GITHUB_OUTPUT, `release_id=${release.id}\nrelease_sha=${release.commitSha}\n`);
    console.log('New publication committed; its exact revision is ready for Pages delivery.');
  } else if (release.state !== 'failed' && release.state !== 'verification-unknown') {
    throw new Error('Unexpected release state');
  }
}
console.log('Release orchestration request completed. Public evidence remains in CMS.');
