import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { buildPublicDiscovery } from '../../src/lib/discovery/build';
import { installSearch } from '../../src/lib/discovery/client';
const config={now:'2026-10-21T00:00:00Z',sourceTree:'fixture',snapshotDigest:'fixture',baseUrl:'https://example.org/gcake-dev'};
const article=(id:string)=>({source:'local',id,title:id+' workflow article',href:`/gcake-dev/posts/${id}/`,canonicalUrl:`https://example.org/${id}`,status:'published',topics:[],html:'<p>workflow recovery</p>'});
const old=buildPublicDiscovery([article('withdrawn'),article('kept')],config),fresh=buildPublicDiscovery([article('kept')],config);
async function until(predicate:()=>boolean){for(let i=0;i<300;i++){if(predicate())return;await new Promise(r=>setTimeout(r,2));}assert.fail('Expected observable state did not settle');}
function setup(kind:'409'|'manifest',unavailable=false){
    const {window,document}=parseHTML('<html><body><form class="nav-search"><input></form><p id="search-status"></p><ul id="search-results" data-manifest="/manifest" data-semantic="/semantic" data-local-semantic="true"></ul><nav id="search-pagination"></nav><button id="search-retry"></button></body></html>');
    const previous=Object.fromEntries(['window','document','location','history','fetch'].map(k=>[k,(globalThis as any)[k]]));
    let url=new URL('http://127.0.0.1/gcake-dev/search/?q=workflow'),live=old,published=false,calls=0;
    let delayed=false,delayStarted=false,release:()=>void=()=>{};
    Object.assign(globalThis,{window,document,location:{get href(){return url.href;},get search(){return url.search;}},history:{pushState(_a:unknown,_b:unknown,u:string){url=new URL(u,url);},replaceState(_a:unknown,_b:unknown,u:string){url=new URL(u,url);}}});
    globalThis.fetch=async(input,init)=>{
        const path=String(input);
        if(path==='/manifest'){
            if(published&&unavailable)return new Response('',{status:503});
            return Response.json({corpusId:live.corpusId,assets:{index:{href:'/index/'+live.corpusId},passages:{href:'/passages/'+live.corpusId}}});
        }
        const c=path.endsWith(fresh.corpusId)?fresh:old;
        if(path.startsWith('/index/')){
            if(delayed&&c===fresh){delayed=false;delayStarted=true;await new Promise<void>(resolve=>{release=resolve;});}
            return Response.json(c);
        }
        if(path.startsWith('/passages/'))return Response.json(c.passages);
        if(path==='/semantic'){
            calls++;
            if(published&&kind==='409')return new Response('',{status:409});
            if(published&&kind==='manifest')live=fresh;
            const sent=JSON.parse(String(init?.body)),responseCorpus=sent.corpusId===fresh.corpusId?fresh:old;
            return Response.json({corpusId:responseCorpus.corpusId,mode:'hybrid',total:responseCorpus.articles.length,page:1,results:responseCorpus.articles.map(a=>({articleId:a.articleId,passageId:responseCorpus.passages.find(p=>p.articleId===a.articleId)!.passageId}))});
        }
        throw Error('Unexpected fixture URL: '+path);
    };
    return {document,window,status:()=>document.querySelector('#search-status')!.textContent!,rows:()=>document.querySelector('#search-results')!.textContent!,calls:()=>calls,
        publish(){published=true;if(kind==='409')live=fresh;},
        retry(){(document.querySelector('#search-retry') as any).click();},
        navigate(q:string){url.searchParams.set('q',q);window.dispatchEvent(new window.Event('popstate'));},
        delayRefresh(){delayed=true;},delayStarted:()=>delayStarted,release:()=>release(),
        restore(){Object.assign(globalThis,previous);}};
}
for(const kind of ['409','manifest'] as const)test('Withdrawn results are replaced by current lexical fallback after '+kind,async()=>{
    const h=setup(kind);try{installSearch();await until(()=>h.status().includes('找到'));assert.match(h.rows(),/withdrawn/);
        h.publish();h.retry();await until(()=>h.status().includes('關鍵字結果'));
        assert.doesNotMatch(h.rows(),/withdrawn/);assert.match(h.rows(),/kept/);assert.match(h.status(),/找到 1 篇/);assert.equal(h.calls(),2,'No automatic semantic/model retry');
        assert.equal(h.document.querySelector('#search-pagination')!.children.length,0);
    }finally{h.restore();}
});
test('Unavailable current assets after conflict clear old rows and preserve retry/query',async()=>{
    const h=setup('409',true);try{installSearch();await until(()=>h.status().includes('找到'));h.publish();h.retry();await until(()=>!h.status().includes('搜尋中'));
        assert.equal(h.rows(),'');assert.match(h.status(),/搜尋暫時無法載入/);assert.equal((h.document.querySelector('#search-retry') as any).hidden,false);assert.equal((h.document.querySelector('input') as any).value,'workflow');assert.equal(h.calls(),2);
    }finally{h.restore();}
});
test('Superseded release recovery cannot overwrite a newer query',async()=>{
    const h=setup('409');try{installSearch();await until(()=>h.status().includes('找到'));h.publish();h.delayRefresh();h.retry();await until(h.delayStarted);
        h.navigate('kept');await until(()=>h.status().includes('找到'));h.release();await new Promise(r=>setTimeout(r,10));
        assert.equal((h.document.querySelector('input') as any).value,'kept');assert.doesNotMatch(h.rows(),/withdrawn/);assert.match(h.rows(),/kept/);
    }finally{h.release();h.restore();}
});
