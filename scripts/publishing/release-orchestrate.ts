export {};
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
console.log('Release orchestration request completed. Public evidence remains in CMS.');
