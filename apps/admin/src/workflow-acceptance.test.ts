import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { createSSRApp } from 'vue';
import ts from 'typescript';
import { renderToString } from 'vue/server-renderer';
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc';
import { parseHTML } from 'linkedom';
import { EditorState } from './editor-state';
import * as editorViews from './editor-state';
import {statusPresentation,emptyStatusState,type DraftStatus} from './substack-status';
import { iconPaths } from '../../../src/components/icon-paths';

// Render the actual Vue template, using synthetic state instead of production APIs.
async function render(file: string, overrides: Record<string, unknown> = {}) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8');
  const { descriptor } = parse(source);
  const script = compileScript(descriptor, { id: 'workflow-test' });
  const compiled = compileTemplate({ id: 'workflow-test', source: descriptor.template!.content, filename: file, ssr: true, ssrCssVars: descriptor.cssVars });
  assert.deepEqual(compiled.errors, []);
  const url = new URL(`.workflow-render-${file.replace(/\W/g, '')}-${process.pid}.mjs`, import.meta.url);
  await writeFile(url, ts.transpileModule(compiled.code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
  try {
    const { ssrRender } = await import(url.href + '?t=' + Date.now());
    const defaults = Object.fromEntries(Object.keys(script.bindings ?? {}).map(k => [k, undefined]));
    const state = {
      ...defaults, state: 'ready', workspaceMode: 'overview', overviewSection: 'articles',
      session: { authenticated: true, user: { login: '驗收作者' } },
      posts: [], filteredPosts: [], series: [], media: [], publicationStates: [], mediaActions: {}, queueActions: {}, recordActions: {}, knownFixed: {},
      iconPaths, nextEditorView: editorViews.nextEditorView, editorViewLabel: editorViews.editorViewLabel,
      preview: { html: '<p>未儲存的內容</p>', limitations: [] }, editorView: 'markdown',
      editorTitle: '驗收文章', editorSlug: 'acceptance', editorSource: '# 未儲存的內容',
      targetState: () => undefined, contentStatusLabel: (s: string) => s,
      releaseEstimate: () => '預計週四 07:00 起', eligibilityReason: () => '符合排程條件',
      publicationStatusLabel: () => '需人工處理', previewStatusLabel: () => '準備中',
      safeMessage: (s: string) => s, releaseLabel: () => '已排程',
      ...overrides,
    };
    const component = { ssrRender, setup: () => state };
    const app = createSSRApp(component);
    app.component('ReleaseQueuePanel', { template: '<section aria-label="發布摘要">下一篇</section>' });
    app.component('SubstackStatusPanel', { props:['slug'], template:'<section class="substack-mount" :data-scope="slug || \'list\'"></section>' });
    app.config.warnHandler = () => {};
    return parseHTML('<html><body>' + await renderToString(app) + '</body></html>').document;
  } finally { await unlink(url); }
}
const post = { title: '驗收文章', slug: 'acceptance', source: '# 未儲存的內容', status: 'ready', series: [], baseBlobSha: 'blob' };
const buttons = (el: any) => [...el.querySelectorAll('button')].map((b: any) => b.textContent.trim());

test('focused-navigation: articles are the default with distinct workspace links and no open creation form', async () => {
  const doc = await render('./App.vue');
  assert.ok(doc.querySelector('nav[aria-label="工作區"]'));
  assert.deepEqual([...doc.querySelectorAll('nav[aria-label="工作區"] a')].map(a => a.textContent), ['文章', '系列', '發布管理']);
  assert.equal(doc.querySelector('.new-post-form'), null);
  assert.equal(doc.querySelector('.new-series-form'), null);
});

test('two-button-editor: save alone and two accessible SVG tools replace duplicate preview', async () => {
  const doc = await render('./App.vue', { workspaceMode: 'post', selectedPost: post });
  assert.deepEqual(buttons(doc.querySelector('[aria-label="文章主要操作"]')), ['儲存文章']);
  const tools = doc.querySelector('[aria-label="文章編輯工具"]');
  assert.ok(tools);
  assert.equal(tools.querySelectorAll('button').length, 2);
  for (const button of tools.querySelectorAll('button')) {
    assert.ok(button.querySelector('svg'));
    assert.ok(button.getAttribute('aria-label'));
    assert.equal(button.textContent.trim(), '');
  }
  assert.equal(doc.querySelector('select[aria-label="檢視方式"]'), null);
  assert.doesNotMatch(doc.body.textContent!, /預覽文章|儲存至 Git|not_configured|manual_required|系列 YAML|Slug|章節 ID/);
});

test('settings-hierarchy: metadata has named sections and management is separate', async () => {
  const doc = await render('./App.vue', { workspaceMode: 'post', selectedPost: post, mediaOpen: true });
  const settings = doc.querySelector('[aria-labelledby="article-settings-title"]');
  assert.ok(settings);
  assert.deepEqual([...settings.querySelectorAll('h3')].map(h => h.textContent), ['基本資料','文章網址']);
  assert.equal(settings.querySelector('.danger-action'), null);
  const management = doc.querySelector('[aria-labelledby="article-management-title"]');
  assert.ok(management?.querySelector('.danger-action'));
  assert.match(doc.querySelector('[role="dialog"]')!.textContent!, /貼上圖片.*圖片拖入/);
});

test('two-button-disclosure: every real rendered action group remains bounded including recovery and media', async () => {
  const doc = await render('./App.vue', { workspaceMode: 'post', selectedPost: post, mediaOpen: true,
    recoveryConflict: { draft: '舊內容', repository: '新內容' },
    media: [{ id: '1', key: 'one.png', url: '/one.png', width: 20, height: 20, size: 10 }],
  });
  const groups = [...doc.querySelectorAll('[role="group"][aria-label]')];
  assert.ok(groups.length >= 4);
  for (const group of groups) assert.ok(buttons(group).length <= 2, `${group.getAttribute('aria-label')}: ${buttons(group)}`);
});

test('locked-series: numbered read-only articles replace draggable handles and movement buttons', async () => {
  const manifest = { title: '已連載系列', slug: 'series', sections: [{ id: 'one', title: '第一章', status: 'active', posts: [{slug:'acceptance',workingTitle:'驗收文章',status:'ready'}] }] };
  const doc = await render('./App.vue', { workspaceMode: 'series', selectedSeries: {slug:'series'}, seriesManifest: manifest,
    selectedSeriesStarted: true, availableStandalonePosts: [], selectedSeriesProgress: {ready:1,total:1,published:0},
  });
  assert.ok(doc.querySelector('.drag-handle') === null, 'locked list exposes no drag handle');
  assert.ok(doc.querySelector('.order-actions') === null, 'locked list exposes no movement controls');
  assert.ok(doc.querySelector('.post-ordinal'));
  assert.deepEqual(buttons(doc.querySelector('[aria-label="系列主要操作"]')), ['新增章節','儲存系列']);
});

test('cyclic-view: one transition cycles through all views and preserves source and positions', () => {
  const state = new EditorState('# 未儲存內容', 8, 240);
  const { nextEditorView, editorViewLabel } = editorViews;
  for (const expected of ['rendered','split','markdown'] as const) {
    state.setView(nextEditorView(state.view));
    assert.equal(state.view, expected);
    assert.ok(editorViewLabel(expected));
  }
  assert.equal(state.source, '# 未儲存內容');
  assert.equal(state.cursorPosition, 8);
  assert.equal(state.readingPosition, 240);
});

const queueItem = {slug:'acceptance',title:'驗收文章',seriesSlug:'series',order:0,state:'queued',contentStatus:'ready',estimatedAt:'2026-10-22T07:00:00+08:00'};
const queueState = {enabled:true,items:[queueItem],plan:[{slug:'acceptance',releaseAt:queueItem.estimatedAt}],blockedSeries:[],releases:[]};

test('queue-summary: compact mode keeps next article and attention without complete action list', async () => {
  const doc = await render('./ReleaseQueuePanel.vue', {props:{compact:true},queue:queueState,plannedItems:[queueItem],needsAttention:[],seriesGroups:[]});
  assert.match(doc.body.textContent!, /驗收文章/);
  assert.ok(doc.querySelector('.release-list') === null);
  assert.ok(doc.querySelector('a'));
});

test('queue-action: per-article and series actions have independent scope with no more than two buttons', async () => {
  const doc = await render('./ReleaseQueuePanel.vue', {props:{compact:false},queue:queueState,tab:'預計發布',plannedItems:[queueItem],needsAttention:[],
    seriesGroups:[{slug:'series',title:'驗收系列',paused:false}],selectedQueueSlug:'acceptance',isFixed:()=>false});
  const groups=[...doc.querySelectorAll('[role="group"][aria-label]')];
  assert.ok(groups.length >= 2);
  for(const g of groups)assert.ok(buttons(g).length<=2, g.getAttribute('aria-label')!);
  assert.equal([...doc.querySelectorAll('button')].filter(b=>b.textContent.includes('暫停整個系列')).length,1);
  assert.ok(doc.querySelector('option[value="cancel"]') === null, 'unknown fixed status offers no cancellation');
  assert.match(doc.body.textContent!, /尚無固定時間的確認結果/);
});

test('plain-copy: unknown state and technical failures stay honest and do not expose internal values', async () => {
  const presentation = await import('./workflow-presentation');
  assert.equal(presentation.contentStatusLabel('ready'),'已定稿');
  assert.equal(presentation.publicationStatusLabel('future_internal_state'),'狀態待確認');
  assert.doesNotMatch(presentation.safeMessage('SQLITE_ERROR revision deadbeef','操作未完成，請稍後再試。'), /SQLITE|revision|deadbeef/);
});

test('creation-forms: explicitly opened article and series forms use plain editable labels and create/cancel pairs', async () => {
  const article = await render('./App.vue', {createPostOpen:true});
  assert.ok(article.querySelector('.new-post-form input[required]'));
  assert.deepEqual(buttons(article.querySelector('[aria-label="新增文章操作"]')),['建立無系列草稿','取消']);
  assert.match(article.body.textContent!, /文章標題|網址代稱/);
  const series = await render('./App.vue', {overviewSection:'series',createSeriesOpen:true});
  assert.deepEqual(buttons(series.querySelector('[aria-label="新增系列操作"]')),['建立系列','取消']);
});

test('series-editing: unlocked sections retain editable progress, guarded removal and standalone membership', async () => {
  const manifest={title:'編輯中的系列',slug:'series',sections:[{id:'chapter',title:'章節一',status:'active',posts:[{slug:'one',workingTitle:'文章一',status:'draft'}]}]};
  const doc=await render('./App.vue',{workspaceMode:'series',selectedSeries:{slug:'series'},seriesManifest:manifest,selectedSeriesStarted:false,
    availableStandalonePosts:[{slug:'two',title:'文章二'}]});
  assert.match(doc.body.textContent!,/章節代稱|章節標題|章節進度|加入無系列文章/);
  assert.ok(doc.querySelector('.drag-handle'));
  assert.ok(doc.querySelector('[aria-label="移除章節操作"] button[disabled]'));
  for(const g of doc.querySelectorAll('[role="group"][aria-label]'))assert.ok(buttons(g).length<=2);
});

test('time-preview: preview and confirmation stages never show both sets of actions', async () => {
  const base={preview:undefined,props:{compact:false},queue:queueState,tab:'預計發布',plannedItems:[queueItem],needsAttention:[],seriesGroups:[],overrideSlug:'acceptance',isFixed:()=>false};
  const before=await render('./ReleaseQueuePanel.vue',base);
  assert.deepEqual(buttons(before.querySelector('[aria-label="時間調整預覽操作"]')),['查看影響','取消']);
  assert.ok(before.querySelector('[aria-label="確認時間調整操作"]')===null);
  const after=await render('./ReleaseQueuePanel.vue',{...base,preview:{conflicts:['INTERNAL_ERROR'],affected:[]}});
  assert.deepEqual(buttons(after.querySelector('[aria-label="確認時間調整操作"]')),['確認調整','返回修改']);
  assert.ok(after.querySelector('[aria-label="確認時間調整操作"] button[disabled]'));
  assert.ok(after.querySelector('[aria-label="時間調整預覽操作"]')===null);
});

test('unsaved-navigation: leaving work requires an explicit two-button choice with no hidden discard', async () => {
  const doc=await render('./App.vue',{workspaceMode:'post',selectedPost:post,pendingOverview:'series'});
  const group=doc.querySelector('[aria-label="離開編輯確認"]');
  assert.ok(group);
  assert.deepEqual(buttons(group),['繼續編輯','捨棄修改並離開']);
  assert.ok(doc.querySelector('textarea'));
});

// Exercise the real script setup for failures/navigation; SSR template fixtures
// above cover presentation, while these tests cover actual API calls and refs.
async function withActualWorkspace(run: (state: any) => Promise<void>) {
  const source=await readFile(new URL('./App.vue',import.meta.url),'utf8');
  const {descriptor}=parse(source);
  const compiled=compileScript(descriptor,{id:'workflow-runtime'}).content
    .replace("import ReleaseQueuePanel from './ReleaseQueuePanel.vue';",'const ReleaseQueuePanel = {};')
    .replace("import SubstackStatusPanel from './SubstackStatusPanel.vue';",'const SubstackStatusPanel = {};');
  const url=new URL(`.workflow-script-${process.pid}.mjs`,import.meta.url);
  await writeFile(url,ts.transpileModule(compiled,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
  const originalWindow=globalThis.window;
  const originalFetch=globalThis.fetch;
  const originalStorage=globalThis.localStorage;
  try {
    const component=(await import(url.href+'?t='+Date.now())).default;
    let state:any;
    const app=createSSRApp({...component,setup(props:any,ctx:any){state=component.setup(props,ctx);return ()=>null;}});
    await renderToString(app);
    Object.assign(globalThis,{window:{scrollTo(){}}});
    state.session.value={authenticated:true,csrfToken:'local-test',user:{login:'驗收作者'}};
    state.selectedPost.value={...post,title:'驗收文章',source:'# 原始內容',baseCommitSha:'old-revision'};
    state.editorSource.value='# 原始內容\n尚未儲存的修改';
    state.editorTitle.value='驗收文章';state.editorSlug.value='acceptance';state.workspaceMode.value='post';
    await run(state);
  } finally {
    globalThis.fetch=originalFetch;
    Object.assign(globalThis,{localStorage:originalStorage});
    Object.assign(globalThis,{window:originalWindow});
    await unlink(url);
  }
}

test('actual-unsaved-navigation: requesting another workspace retains draft until explicit discard', async()=>{
  await withActualWorkspace(async s=>{
    await s.selectOverview('series');
    assert.equal(s.workspaceMode.value,'post');
    assert.equal(s.pendingOverview.value,'series');
    s.pendingOverview.value=undefined; // The continue-editing control only clears this intent.
    assert.equal(s.editorSource.value,'# 原始內容\n尚未儲存的修改');
    await s.finishOverview('series');
    assert.equal(s.workspaceMode.value,'overview');assert.equal(s.overviewSection.value,'series');
  });
});

test('actual-conflict: failed save keeps draft and merge uses the newer loaded revision without replay', async()=>{
  await withActualWorkspace(async s=>{
    const calls:string[]=[];
    globalThis.fetch=async(url,options)=>{
      calls.push((options?.method??'GET')+' '+url);
      return options?.method==='POST' ? new Response(JSON.stringify({error:{message:'ARTICLE_CONFLICT'}}),{status:409})
        : new Response(JSON.stringify({...post,source:'# 較新的文章內容',title:'驗收文章',baseCommitSha:'new-revision',baseBlobSha:'new-blob'}));
    };
    await s.saveToGit();
    assert.equal(s.editorSource.value,'# 原始內容\n尚未儲存的修改');
    assert.equal(s.saving.value,false);
    assert.equal(s.recoveryPost.value.baseCommitSha,'new-revision');
    assert.equal(calls.filter(v=>v.startsWith('POST')).length,1);
    s.startManualMerge();
    assert.match(s.editorSource.value,/較新的文章內容/);assert.match(s.editorSource.value,/尚未儲存的修改/);
    assert.equal(s.selectedPost.value.baseCommitSha,'new-revision');
  });
});

test('actual-series-failure: failed series save retains the edited manifest and remains retryable',async()=>{
  await withActualWorkspace(async s=>{
    s.selectedSeries.value={slug:'series',baseBlobSha:'old',baseCommitSha:'old-revision'};
    s.seriesManifest.value={slug:'series',title:'尚未儲存的系列名稱',sections:[]};s.seriesDirty.value=true;
    const before=s.seriesManifest.value;
    globalThis.fetch=async()=>new Response(JSON.stringify({error:{message:'SERIES_CONFLICT'}}),{status:409});
    await s.saveSeries();
    assert.equal(s.seriesManifest.value,before);assert.equal(s.seriesDirty.value,true);assert.equal(s.saving.value,false);
  });
});

test('actual-busy-save: a second click cannot submit the same pending save twice',async()=>{
  await withActualWorkspace(async s=>{
    let requests=0;let release!:(value:Response)=>void;
    globalThis.fetch=async()=>{requests++;return new Promise<Response>(resolve=>{release=resolve;});};
    const first=s.saveToGit();
    assert.equal(s.saving.value,true);
    await s.saveToGit();assert.equal(requests,1);
    release(new Response(JSON.stringify({error:{message:'目前無法儲存，請稍後再試。'}}),{status:503}));
    await first;assert.equal(s.saving.value,false);assert.match(s.editorSource.value,/尚未儲存的修改/);
  });
});

test('actual-view-position: a full cycle restores the source cursor and reading position',async()=>{
  await withActualWorkspace(async s=>{
    const source={selectionStart:4,selectionEnd:8,scrollTop:132,setSelectionRange(start:number,end:number){this.selectionStart=start;this.selectionEnd=end;}};
    s.sourceElement.value=source;s.previewElement.value={scrollTop:0};
    await s.setEditorView('rendered');
    source.selectionStart=0;source.selectionEnd=0;source.scrollTop=0;
    await s.setEditorView(editorViews.nextEditorView(s.editorView.value));
    await s.setEditorView(editorViews.nextEditorView(s.editorView.value));
    assert.equal(s.editorView.value,'markdown');
    assert.equal(source.selectionStart,4);assert.equal(source.selectionEnd,8);assert.equal(source.scrollTop,132);
    assert.equal(s.editorSource.value,'# 原始內容\n尚未儲存的修改');
  });
});

test('actual-media-entry: opens directly, closes without edits and restores focus', async () => {
  await withActualWorkspace(async s => {
    let focused = '';
    s.mediaDialogElement.value = {focus(){focused='dialog';}};
    s.mediaButtonElement.value = {focus(){focused='image';}};
    globalThis.fetch = async () => new Response(JSON.stringify({media:[]}));
    const before=s.editorSource.value;
    await s.openMediaLibrary();
    assert.equal(s.mediaOpen.value,true);assert.equal(focused,'dialog');
    s.closeMediaLibrary();assert.equal(s.mediaOpen.value,false);assert.equal(focused,'image');
    assert.equal(s.editorSource.value,before);
  });
});

test('actual-media-paste-drop: images insert after upload while failed and non-image input preserve work', async () => {
  await withActualWorkspace(async s => {
    const bitmap=globalThis.createImageBitmap;
    globalThis.createImageBitmap=async()=>({width:10,height:10,close(){}}) as any;
    try {
      const file=new File(['image'],'picture.png',{type:'image/png'});
      globalThis.fetch=async(_input,init)=>new Response(JSON.stringify(init?.method==='POST'
        ? {id:'image',key:'picture.png',url:'/image.png',width:10,height:10,size:5} : {media:[]}));
      for(const kind of ['paste','drop']) {
        s.mediaOpen.value=true;
        const event={clipboardData:{files:[file]},dataTransfer:{files:[file]},preventDefault(){}};
        await (kind==='paste'?s.onEditorPaste(event):s.onEditorDrop(event));
        assert.match(s.editorSource.value,/\/image.png/);assert.equal(s.mediaOpen.value,false);
      }
      const before=s.editorSource.value;
      s.mediaOpen.value=true;
      globalThis.fetch=async()=>new Response(JSON.stringify({error:{message:'圖片上傳失敗，請稍後再試。'}}),{status:503});
      await s.onEditorPaste({clipboardData:{files:[file]},preventDefault(){}});
      assert.equal(s.editorSource.value,before);assert.equal(s.mediaOpen.value,true);
      assert.match(s.mediaMessage.value,/失敗/);
      await s.onEditorPaste({clipboardData:{files:[]},preventDefault(){assert.fail('text paste must remain native');}});
      assert.equal(s.editorSource.value,before);
    } finally {globalThis.createImageBitmap=bitmap;}
  });
});


for (const priorConflict of [false, true]) {
  test(`actual-stale-draft: merge and save stay on the opened article after prior conflict=${priorConflict}`, async () => {
    await withActualWorkspace(async s => {
      const beta={...post,slug:'beta',title:'第二篇',source:'# 第二篇較新內容',baseBlobSha:'beta-blob',baseCommitSha:'beta-revision'};
      const storage:Record<string,any>={
        'gcake:draft:gcake119/gcake-dev:beta:older-blob':'第二篇的舊暫存',
        getItem(key:string){return this[key]??null;},
      };
      Object.assign(globalThis,{localStorage:storage});
      const writes:{url:string;body:any}[]=[];
      globalThis.fetch=async(url,options)=>{
        if(options?.method==='POST'){
          writes.push({url:String(url),body:JSON.parse(String(options.body))});
          return new Response(JSON.stringify({error:{message:priorConflict&&writes.length===1?'ARTICLE_CONFLICT':'目前無法儲存'}}),{status:priorConflict&&writes.length===1?409:503});
        }
        return new Response(JSON.stringify(String(url).includes('publications')?{states:[]}:String(url).endsWith('/beta')?beta:{...post,source:'# 第一篇較新內容',baseCommitSha:'first-revision'}));
      };
      if(priorConflict)await s.saveToGit();
      await s.openPost('beta');
      s.recoveryAction.value='merge';
      s.resolveRecovery();
      assert.match(s.editorSource.value,/第二篇較新內容/);
      assert.match(s.editorSource.value,/第二篇的舊暫存/);
      assert.doesNotMatch(s.editorSource.value,/第一篇/);
      await s.saveToGit();
      assert.equal(writes.at(-1)?.url,'/api/v1/posts/beta');
      assert.equal(writes.at(-1)?.body.expectedBaseCommitSha,'beta-revision');
      assert.equal(writes.at(-1)?.body.files[0].expectedBlobSha,'beta-blob');
    });
  });
}

test('actual-body-media-focus: direct paste and drop preserve editing focus while dialog insertion restores entry focus', async () => {
  await withActualWorkspace(async s => {
    const bitmap=globalThis.createImageBitmap;
    globalThis.createImageBitmap=async()=>({width:10,height:10,close(){}}) as any;
    let focused='body';
    s.mediaButtonElement.value={focus(){focused='image';}};
    try {
      globalThis.fetch=async(_url,init)=>new Response(JSON.stringify(init?.method==='POST'
        ?{id:'image',key:'picture.png',url:'/focus-image.png',width:10,height:10,size:5}:{media:[]}));
      const file=new File(['image'],'picture.png',{type:'image/png'});
      for(const kind of ['paste','drop']){
        s.mediaOpen.value=false;focused='body';
        const event={clipboardData:{files:[file]},dataTransfer:{files:[file]},preventDefault(){}};
        await(kind==='paste'?s.onEditorPaste(event):s.onEditorDrop(event));
        assert.match(s.editorSource.value,/focus-image.png/);
        assert.equal(focused,'body',`${kind} moved focus away from typing`);
      }
      s.mediaOpen.value=true;
      await s.onEditorPaste({clipboardData:{files:[file]},preventDefault(){}});
      assert.equal(s.mediaOpen.value,false);
      assert.equal(focused,'image');
    } finally {globalThis.createImageBitmap=bitmap;}
  });
});


test('actual-new-article: creating a draft clears recovery choices from the previous article',async()=>{
  await withActualWorkspace(async s=>{
    s.recoveryConflict.value={draft:'前一篇暫存',repository:'前一篇新內容'};
    s.recoveryPost.value={...post,slug:'previous',source:'前一篇新內容'};
    s.posts.value=[{...post,commitSha:'new-revision'}];
    s.newPostTitle.value='新文章';s.newPostSlug.value='fresh';
    s.createPost();
    assert.equal(s.editorSlug.value,'fresh');
    assert.equal(s.recoveryConflict.value,undefined);
    s.startManualMerge();
    assert.equal(s.selectedPost.value.slug,'fresh');
    assert.doesNotMatch(s.editorSource.value,/前一篇/);
  });
});


test('actual-series-discard: discarded edits cannot be persisted by a later article save while continue retains them',async()=>{
  await withActualWorkspace(async s=>{
    const seriesPath='src/content/series/demo.yaml';
    const savedSeries='slug: demo\ntitle: 原來的系列\nstatus: planned\nsections: []\n';
    let seriesSource=savedSeries;
    let article={...post,source:'# 原始內容',baseCommitSha:'revision'};
    const writes:{url:string;body:any}[]=[];
    Object.assign(globalThis,{localStorage:{getItem(){return null;},removeItem(){}}});
    globalThis.fetch=async(url,options)=>{
      if(options?.method==='POST'){
        const body=JSON.parse(String(options.body));writes.push({url:String(url),body});
        for(const file of body.files){
          if(file.path===seriesPath)seriesSource=file.source;
          else article={...article,source:file.source,baseCommitSha:'saved-revision'};
        }
        return new Response(JSON.stringify({commitSha:'saved-revision'}));
      }
      return new Response(JSON.stringify(String(url).startsWith('/api/v1/series/')
        ?{slug:'demo',path:seriesPath,source:seriesSource,baseBlobSha:'series-blob',baseCommitSha:'revision'}
        :String(url).includes('publications')?{states:[]}:article));
    };
    await s.openSeries('demo');
    s.editSeriesMetadata({title:'應該捨棄的系列名稱'});
    await s.selectOverview('articles');
    assert.equal(s.pendingOverview.value,'articles');
    s.pendingOverview.value=undefined; // Continue editing: the rendered control clears only this intent.
    assert.equal(s.workspaceMode.value,'series');
    assert.equal(s.seriesManifest.value.title,'應該捨棄的系列名稱');
    assert.equal(writes.length,0);
    await s.selectOverview('articles');
    await s.finishOverview(s.pendingOverview.value);
    await s.openPost('acceptance');
    s.editorSource.value+='\n文章本身的修改';
    await s.saveToGit();
    assert.deepEqual(writes.map(w=>w.body.files.map((f:any)=>f.path)),[['src/content/posts/acceptance.md']]);
    assert.equal(seriesSource,savedSeries);
    assert.match(article.source,/文章本身的修改/);
    await s.openSeries('demo');
    assert.equal(s.seriesManifest.value.title,'原來的系列');
  });
});


test('Substack status is mounted in publishing overview and replaces the obsolete single article badge', async () => {
  const overview = await render('./App.vue', { overviewSection:'publishing' });
  assert.ok(overview.querySelector('.substack-mount[data-scope="list"]'), 'publishing overview must mount the read-only status panel');
  const article = await render('./App.vue', { workspaceMode:'post', selectedPost:post });
  assert.ok(article.querySelector('.substack-mount[data-scope="acceptance"]'), 'saved article must use its per-slug status panel');
  assert.equal(article.querySelector('[aria-label="Substack 狀態查詢"]'), null, 'old combined publication badge is replaced');
});


const statusRecord:DraftStatus={schemaVersion:1,slug:'acceptance',providerId:'221099415',version:1,sync:{status:'verified',checkedAt:'2026-10-19T16:05:00Z',unresolvedOperation:false},publication:{state:'scheduled',confirmedTime:'2026-10-21T23:00:00Z'},delivery:{evidence:'armed',subscriberReceipt:'unknown'},attention:{pendingAction:null,code:null},actions:['foreground-review']};
async function renderSubstack(record=statusRecord,patch:Record<string,unknown>={}){
 return render('./SubstackStatusPanel.vue',{props:{slug:'acceptance'},headingId:'substack-article-status-title',snapshot:{...emptyStatusState(),loaded:true,rows:[record]},rows:[{row:record,view:statusPresentation(record),title:'驗收文章'}],...patch});
}
test('Substack actual template separates evidence, check time and unknown receipt with a GET refresh only',async()=>{
 const doc=await renderSubstack();assert.deepEqual([...doc.querySelectorAll('dt')].map(n=>n.textContent),['草稿同步','發布','寄送']);const evidence=[...doc.querySelectorAll('dd')].map(n=>n.textContent);assert.match(evidence[0],/已保存並驗證/);assert.match(evidence[1],/已排程.*2026\/10\/22 07:00/);assert.match(evidence[2],/已安排寄送.*尚無實收證據/);assert.match(doc.body.textContent!,/最近查核：2026\/10\/20 00:05/);assert.deepEqual(buttons(doc),['重新讀取狀態']);assert.equal(doc.querySelector('.substack-attention'),null);
});
test('Substack actual template retains old rows after unavailable read and exposes login or untracked distinctly',async()=>{
 const unavailable=await renderSubstack(statusRecord,{snapshot:{...emptyStatusState(),loaded:true,error:'目前無法更新，以下保留上次讀取的資料。',rows:[statusRecord]}});assert.ok(unavailable.querySelector('[role="alert"]'));assert.equal(unavailable.querySelectorAll('.substack-status-row').length,1);
 const expired=await renderSubstack(statusRecord,{snapshot:{...emptyStatusState(),loaded:true,error:'登入已失效',loginRequired:true},rows:[]});assert.equal(expired.querySelectorAll('.substack-status-row').length,0);assert.equal(expired.querySelector('a')?.getAttribute('href'),'/api/v1/auth/login');
 const untracked=await renderSubstack(statusRecord,{snapshot:{...emptyStatusState(),loaded:true,untracked:true},rows:[]});assert.match(untracked.body.textContent!,/尚未追蹤.*無法據此判斷平台是否已有草稿/);
});
test('Substack actual template keeps reconciliation and independent holds visible and truthful page buttons',async()=>{
 const unknown={...statusRecord,sync:{...statusRecord.sync,status:'reconciliation-required',unresolvedOperation:true},attention:{pendingAction:'reconcile-schedule',code:'SUBSTACK_REMOTE_IDENTITY_MISMATCH'}};
 const doc=await renderSubstack(unknown,{props:{titles:{acceptance:'驗收文章'}},snapshot:{...emptyStatusState(),loaded:true,rows:[unknown],page:{limit:50,offset:0,hasMore:true}}});assert.match(doc.body.textContent!,/結果待查證/);assert.match(doc.querySelector('.substack-attention')!.textContent!,/人工查核/);const nav=doc.querySelector('[aria-label="Substack 狀態分頁"]')!;assert.deepEqual(buttons(nav),['上一頁','下一頁']);assert.ok(nav.querySelectorAll('button')[0].hasAttribute('disabled'));assert.ok(!nav.querySelectorAll('button')[1].hasAttribute('disabled'));
});


test('actual-publication-history: successful read clears prior error and failed next article never reuses earlier rows',async()=>{
 await withActualWorkspace(async s=>{
  s.publicationMessage.value='發佈中心尚未設定。';s.publicationStates.value=[{postSlug:'old',target:'github_pages',status:'verified'}];
  globalThis.fetch=async()=>Response.json({states:[{postSlug:'acceptance',target:'github_pages',status:'stale'}]});await s.loadPublicationStates();assert.equal(s.publicationMessage.value,'');assert.equal(s.publicationStates.value[0].postSlug,'acceptance');
  globalThis.fetch=async()=>Response.json({error:{code:'PUBLICATION_STATE_UNAVAILABLE',message:'目前無法讀取發布紀錄。'}},{status:503});await s.loadPublicationStates({...s.selectedPost.value,slug:'next'});assert.deepEqual(s.publicationStates.value,[]);assert.equal(s.publicationMessage.value,'目前無法讀取發布紀錄。');
 });
});


test('publication-history-empty: missing Pages history is presented as no record, not missing configuration or verified',async()=>{
 const doc=await render('./App.vue',{workspaceMode:'post',selectedPost:post,publicationStates:[]});const target=doc.querySelector('.target-grid')!;assert.match(target.textContent!,/GitHub Pages.*尚無發布紀錄/s);assert.doesNotMatch(target.textContent!,/尚未設定|公開驗證完成/);
});


test('current Pages actual template shows saved publication, deployment and public verification separately with historical Taipei time',async()=>{
 const pagesSummary={label:'已有公開驗證紀錄',deployment:'網站已部署',verification:'文章與 RSS 已驗證',verifiedAt:'2026/10/19 08:46（台北）',url:'https://gcake119.github.io/gcake-dev/posts/acceptance/'};const doc=await render('./App.vue',{workspaceMode:'post',selectedPost:post,pagesSummary});const target=doc.querySelector('.target-grid')!;assert.match(target.textContent!,/已有公開驗證紀錄/);assert.match(target.textContent!,/部署：網站已部署/);assert.match(target.textContent!,/公開驗證：文章與 RSS 已驗證/);assert.match(target.textContent!,/2026\/10\/19 08:46/);assert.match(target.textContent!,/已保存.*不會重新驗證/s);assert.equal(target.querySelector('a')?.getAttribute('href'),pagesSummary.url);
});
test('actual Pages reply is stored for selected article and cleared before another failed read',async()=>{
 await withActualWorkspace(async s=>{globalThis.fetch=async()=>Response.json({states:[],pages:{state:'verified-public',source:'release-queue'}});await s.loadPublicationStates();assert.equal(s.pagesStatus.value.state,'verified-public');globalThis.fetch=async()=>Response.json({error:{message:'查詢失敗'}},{status:503});await s.loadPublicationStates({...s.selectedPost.value,slug:'next'});assert.equal(s.pagesStatus.value,undefined);assert.equal(s.publicationMessage.value,'查詢失敗');});
});


test('publication history ignores earlier replies after a newer article query completes',async()=>{
 for(const earlierFails of [false,true]) await withActualWorkspace(async s=>{
  const pending:((value:Response)=>void)[]=[];
  globalThis.fetch=()=>new Promise(resolve=>pending.push(resolve));
  const first=s.loadPublicationStates();
  const next=s.loadPublicationStates({...s.selectedPost.value,slug:'next'});
  pending[1](Response.json({states:[{postSlug:'next',target:'github_pages',status:'stale'}],pages:{state:'not-recorded',source:'release-queue'}}));await next;
  pending[0](earlierFails?Response.json({error:{message:'上一文章的錯誤'}},{status:503}):Response.json({states:[{postSlug:'acceptance',target:'github_pages',status:'verified'}],pages:{state:'verified-public',source:'release-queue'}}));await first;
  assert.equal(s.publicationStates.value[0].postSlug,'next');
  assert.equal(s.pagesStatus.value.state,'not-recorded');
  assert.equal(s.publicationMessage.value,'');
 });
});
