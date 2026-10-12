import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler'));
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire('miniflare');
const esbuild = wranglerRequire('esbuild');

async function nativeHistory(redirect: boolean) {
  const source = `import { GitHubAppReadClient } from ${JSON.stringify(new URL('./github.ts', import.meta.url).pathname)};
  export default {async fetch() {
    let calls=0; const post='---\\ntitle: Post\\nstatus: ready\\n---\\nBody';
    const client=new GitHubAppReadClient({installationTokens:{create:async()=> 'fixture-token'},fetch:async(input,init)=> {
      // The native runtime must construct the request before our isolated transport responds.
      const request=new Request(input,init);const path=new URL(request.url).pathname;
      if(path==='/graphql') {calls++; if(${redirect}) {if(request.redirect==='follow') {calls++;return Response.json({data:null});}return new Response(null,{status:302,headers:{location:'https://untrusted.invalid/'}});}
        return Response.json({data:{repository:{object:{oid:'head',committedDate:'2026-10-12T00:00:00Z',f0:{object:{__typename:'Blob',text:post}},parents:{nodes:[]}}}}});}
      if(path.endsWith('/gcake-dev'))return Response.json({full_name:'gcake119/gcake-dev',default_branch:'main',private:false});
      if(path.endsWith('/branches/main'))return Response.json({commit:{sha:'head',commit:{tree:{sha:'tree'}}}});
      if(path.includes('/git/trees/'))return Response.json({tree:[{path:'src/content/posts/post.md',sha:'blob',type:'blob'}]});
      return Response.json({encoding:'base64',content:btoa(post)});
    }});
    try {const snapshot=await client.releaseSnapshot();return Response.json({date:await snapshot.firstReadyAt(snapshot.posts[0]),calls});}
    catch(e){return Response.json({error:e.name+': '+e.message,calls});}
  }};`;
  const built = await esbuild.build({stdin:{contents:source,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'browser',write:false});
  const runtime = new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-09-28',script:built.outputFiles[0].text}));
  try {return await (await runtime.dispatchFetch('http://localhost/')).json() as {date?:string;error?:string;calls:number};}
  finally {await runtime.dispose();}
}

test('native Workers history request reads readiness without unsupported redirect mode', async () => {
  const result=await nativeHistory(false);
  assert.equal(result.error,undefined);
  assert.equal(result.date,'2026-10-12T00:00:00Z');
  assert.equal(result.calls,1);
});

test('native Workers history rejects redirects without following an untrusted destination', async () => {
  const result=await nativeHistory(true);
  assert.match(result.error??'',/GITHUB_API_FAILED: GitHub returned HTTP 302/);
  assert.equal(result.calls,1);
});
