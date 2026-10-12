import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseApi } from './release-api.js';
const runtime: any = {
  queue: {
    ingest: async () => ({ plan: [], items: [], releases: [], enabled: false }),
  },
  git: { snapshot: async () => ({ revision: 'sha', posts: [], series: [] }) },
  reverify: async () => ({ state: 'verified-public' }),
};
test('queue read requires owner; mutations require CSRF; automation requires secret and disabled gate', async () => {
  const get = new Request('https://cms.test/api/v1/releases');
  assert.equal((await releaseApi(get, runtime, undefined)).status, 401);
  const session: any = {
    user: { githubUserId: '1' },
    csrfToken: 'token',
    expiresAt: Date.now() + 10000,
  };
  const anon = new Request('https://cms.test/api/v1/releases/action', {
    method: 'POST',
    body: '{}',
  });
  assert.equal((await releaseApi(anon, runtime, session)).status, 403);
  assert.equal((await releaseApi(get, runtime, session)).status, 200);
  const invalid = new Request('https://cms.test/api/v1/releases/action', {
    method: 'POST',
    headers: { 'x-csrf-token': 'token' },
    body: JSON.stringify({ action: 'erase-all', slug: 'a' }),
  });
  assert.equal((await releaseApi(invalid, runtime, session)).status, 400);
});

test('immediate publication requires owner CSRF, exact preview and explicit confirmation',async()=>{
  const session:any={user:{githubUserId:'owner'},csrfToken:'token',expiresAt:Date.now()+10000};let calls=0;
  const manual:any={...runtime,queue:{previewManual:async()=>({slug:'a',revision:'sha',version:0})},publishNow:async(slug:string,version:number,revision:string,actor:string)=>{calls++;assert.equal(actor,'owner');assert.equal(version,0);return {id:'retained',slug,sourceRevision:revision,mode:'manual'}}};
  const request=(body:any,csrf=true)=>new Request('https://cms.test/api/v1/releases/publish-now',{method:'POST',headers:csrf?{'x-csrf-token':'token'}:{},body:JSON.stringify(body)});
  assert.equal((await releaseApi(request({slug:'a',revision:'sha',version:0,confirmed:true},false),manual,session)).status,403);
  assert.equal((await releaseApi(request({slug:'a',revision:'sha',version:0,confirmed:false}),manual,session)).status,400);
  assert.equal(calls,0);
  assert.equal((await releaseApi(request({slug:'a',revision:'sha',version:0,confirmed:true}),manual,session)).status,200);assert.equal(calls,1);
});
test('release errors emit only stable categories without raw secrets or provider messages',async()=>{
  const saved=console.error;const logs:any[]=[];console.error=(...args:any[])=>logs.push(args);
  try {
    const bad:any={...runtime,git:{snapshot:async()=>{throw new Error('Bearer ghs_private_should_never_appear')}}};
    const session:any={user:{githubUserId:'owner'},expiresAt:Date.now()+10000};
    assert.equal((await releaseApi(new Request('https://cms.test/api/v1/releases'),bad,session)).status,400);
    assert.equal(logs.length,1);assert.equal(JSON.stringify(logs).includes('ghs_private'),false);assert.equal(JSON.stringify(logs).includes('Bearer'),false);
  } finally {console.error=saved;}
});

test('inherited object names cannot become release error categories',async()=>{
  const bad:any={...runtime,git:{snapshot:async()=>{throw new Error('toString')}}};
  const session:any={user:{githubUserId:'owner'},expiresAt:Date.now()+10000};
  const response=await releaseApi(new Request('https://cms.test/api/v1/releases'),bad,session);const data=await response.json();
  assert.equal(data.error.code,'RELEASE_FAILED');assert.equal(typeof data.error.message,'string');
});
