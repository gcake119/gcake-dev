import test from 'node:test';import assert from 'node:assert/strict';
const origin='https://gcakedev.substack.com',url=origin+'/p/demo';
const html=(value:unknown)=>`<script>window._preloads = JSON.parse(${JSON.stringify(JSON.stringify(value))});</script>`;
test('public HTML identity binds original ID, publication and exact canonical without executing scripts',async()=>{
 const {parsePublicPostIdentity}=await import('./substack-public-identity');const good=html({post:{id:123,publication_id:11352259,canonical_url:url}});
 assert.equal(parsePublicPostIdentity(good,url,11352259).id,'123');
 for(const bad of [good+good,'<script>throw Error("executed")</script>',html({post:{id:123,publication_id:5,canonical_url:url}}),html({post:{id:123,publication_id:11352259,canonical_url:origin+'/p/other'}}),html({post:{id:1.5,publication_id:11352259,canonical_url:url}})])assert.throws(()=>parsePublicPostIdentity(bad,url,11352259),/IDENTITY/);
});
test('archive identity resolves only one matching original ID and never substitutes another article',async()=>{
 const {parsePublicArchiveIdentity}=await import('./substack-public-identity');const row={id:123,publication_id:11352259,canonical_url:url};assert.deepEqual(parsePublicArchiveIdentity(html({newPostsForArchive:{pub:[row]}}),'123',11352259),{id:'123',url});
 for(const rows of [[],[row,row],[{...row,id:124}],[{...row,canonical_url:'https://unrelated.example/p/demo'}]])assert.throws(()=>parsePublicArchiveIdentity(html({newPostsForArchive:{pub:rows}}),'123',11352259),/IDENTITY/);
});
test('native public identity policy is bound into Substack approvals',async()=>{const {reviewDigest}=await import('./run-distribution');const a={slug:'s',sourceRevision:'r',title:'t',description:undefined,body:'x',assets:[],canonicalUrl:'https://example.com/',publishedAt:'2026-10-12'};const identity={source:'anonymous-post-data' as const,publicationId:11352259};assert.notEqual(reviewDigest(a,'substack','macos-chrome',identity),reviewDigest(a,'substack','macos-chrome'));});
test('revoked current target rejects a previously matching controlled trial scope',async()=>{const {assertTrialScope}=await import('./run-distribution');const config={substack:{ui:{origin:'https://gcakedev.substack.com'}},unattended:{targets:[]},trial:{writeEnabled:true,slug:'s',sourceRevision:'r',substackOrigin:'https://gcakedev.substack.com',digests:{substack:'d'}}};assert.throws(()=>assertTrialScope(config as any,{slug:'s',sourceRevision:'r'} as any,'substack','d'),/TARGET_AUTHORIZATION_REVOKED/);});

const dataHtml=(value:unknown)=>`<script type="application/json" id="preloads-json">${JSON.stringify(value).replace(/</g,'\\u003c')}</script><script>window._preloads = JSON.parse(document.querySelector('script#preloads-json[type="application/json"]').textContent)</script>`;
test('current designated JSON identifies both original posts and archive without script execution',async()=>{
 const {parsePublicPostIdentity,parsePublicArchiveIdentity}=await import('./substack-public-identity');
 const rows=[{id:220011124,publication_id:11352259,canonical_url:origin+'/p/chatgpt-30'},{id:220473117,publication_id:11352259,canonical_url:origin+'/p/ce0'}];
 for(const row of rows){
  assert.deepEqual(parsePublicPostIdentity(dataHtml({post:row})+'<script>throw Error("MUST_NOT_EXECUTE")</script>',row.canonical_url,11352259),{id:String(row.id),url:row.canonical_url});
  assert.deepEqual(parsePublicArchiveIdentity(dataHtml({newPostsForArchive:{pub:rows}}),String(row.id),11352259),{id:String(row.id),url:row.canonical_url});
 }
});
test('designated JSON rejects duplicate mixed malformed and mismatched identity evidence',async()=>{
 const {parsePublicPostIdentity}=await import('./substack-public-identity');const row={id:123,publication_id:11352259,canonical_url:url};const good=dataHtml({post:row});
 for(const bad of [good+good,good+html({post:row}),'<script id="preloads-json" type="application/json">{broken}</script>','<script id="preloads-json" type="text/javascript">{}</script>',dataHtml([]),dataHtml(null),dataHtml({post:{...row,publication_id:1}}),dataHtml({post:{...row,canonical_url:origin+'/p/wrong'}}),good+'<div id="preloads-json">{}</div>'])assert.throws(()=>parsePublicPostIdentity(bad,url,11352259),/IDENTITY/);
});
