import json
import subprocess
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from public_release_acceptance import WEB, POST, MANIFEST, SLUG, TITLE, Response, run, PublicReader, PublicGit, EvidenceUnavailable
OLD='a'*40
NEW='b'*40
DATE='2026-10-12T07:00:12+08:00'
SITE='https://gcake119.github.io/gcake-dev'
PAGE=SITE+'/posts/'+SLUG+'/'
RSS=SITE+'/rss.xml'
def manuscript(status):
 return '---\ntitle: '+TITLE+'\nstatus: '+status+'\nseries: ithome-2026-extensions\n'+("publishedAt: '"+DATE+"'\n" if status=='published' else '')+'---\nFinal unchanged manuscript.\n'
def manifest(status):
 return 'posts:\n      - slug: '+SLUG+'\n        status: '+status+'\n      - slug: second\n        status: ready\n'
class GitFixture:
 def __init__(self):
  self.entries=[{'sha':NEW,'parent':OLD,'date':DATE,'author':'cms[bot]','email':'cms[bot]@users.noreply.github.com','message':'Publish '+SLUG+' [release:release-1]','files':[POST,MANIFEST]}]
  self.data={(OLD,POST):manuscript('ready'),(NEW,POST):manuscript('published'),(OLD,MANIFEST):manifest('ready'),(NEW,MANIFEST):manifest('published'),(NEW,'astro.config.mjs'):"site: 'https://gcake119.github.io', base: '/gcake-dev'",(NEW,'src/data/site.ts'):"url: 'https://gcake119.github.io/gcake-dev', basePath: '/gcake-dev'",(NEW,'src/content.config.ts'):'generateId: ({ entry }) => localPostSlugFromEntry(entry)',(NEW,'src/lib/content/local-posts.ts'):r"entry.split(/[\\/]/).at(-1); filename.replace(MARKDOWN_EXTENSION, '')",(NEW,'src/lib/content/catalog.ts'):'href: `${site.basePath}/posts/${p.id}/`',(NEW,'src/pages/rss.xml.ts'):"import rss from '@astrojs/rss'; export async function GET(context) {post.href}"}
 def history(self):return NEW,self.entries
 def source(self,sha,path):return self.data[sha,path]
class Fixture:
 def __init__(self):
  self.urls=[]
  self.data={PAGE:'<h1>'+TITLE+'</h1><link rel="canonical" href="'+PAGE+'"><script type="application/ld+json">'+json.dumps({'@type':'BlogPosting','headline':TITLE,'datePublished':DATE,'mainEntityOfPage':{'@id':PAGE}})+'</script>',RSS:'<rss><channel><item><title>'+TITLE+'</title><link>'+PAGE+'</link><guid>'+PAGE+'</guid><pubDate>Mon, 12 Oct 2026 07:00:12 +0800</pubDate></item></channel></rss>'}
 def __call__(self,url,timeout):
  self.urls.append(url)
  assert 'api.github.com' not in url and '/graphql' not in url
  value=self.data.get(url,Response(404,''))
  return value if isinstance(value,Response) else Response(200,value)
class Acceptance(unittest.TestCase):
 def setUp(self):self.git=GitFixture();self.web=Fixture()
 def verify(self):return run(fetch=self.web,git=self.git,max_wait=0)
 def test_git_transition_page_rss_without_api(self):
  r=self.verify();self.assertEqual(r['publication_sha'],NEW);self.assertTrue(r['observations']['ready_to_published'])
  self.assertEqual(r['criteria']['page']['status'],'passed');self.assertEqual(r['criteria']['rss']['status'],'passed');self.assertEqual(r['status'],'unconfirmed')
 def test_no_publication_still_checks_configured_page_rss(self):
  self.git.entries=[];self.git.data[NEW,POST]=manuscript('ready');self.web.data[PAGE]=Response(404,'');self.web.data[RSS]='<rss><channel/></rss>'
  r=self.verify();self.assertIsNone(r['publication_sha']);self.assertIn(PAGE,self.web.urls);self.assertIn(RSS,self.web.urls);self.assertEqual(r['status'],'unconfirmed')
 def test_api_and_internal_routes_denied_before_network(self):
  reader=PublicReader()
  with patch.object(reader.opener,'open') as opened:
   for u in ['https://api.github.com/repos/gcake119/gcake-dev/commits/'+NEW,'https://api.github.com/graphql',WEB+'/actions/runs/77/job_groups_batch?attempt=1',WEB+'/actions/runs/77/rerun','https://127.0.0.1/','https://u:p@github.com/']:
    with self.assertRaises(ValueError):reader(u,1)
   opened.assert_not_called()
 def test_body_title_order_contradictions_fail(self):
  for target in ['body','title','order']:
   self.setUp()
   if target=='body':self.git.data[NEW,POST]+='extra'
   if target=='title':self.git.data[NEW,POST]=self.git.data[NEW,POST].replace(TITLE,'Other')
   if target=='order':self.git.data[NEW,MANIFEST]='posts:\n      - slug: second\n        status: ready\n      - slug: '+SLUG+'\n        status: published\n'
   self.assertEqual(self.verify()['status'],'failed')
 def test_page_rss_contradictions_not_masked(self):
  for target in [PAGE,RSS]:
   self.setUp();self.web.data[target]=self.web.data[target].replace(TITLE,'Wrong');self.assertEqual(self.verify()['status'],'failed')
 def test_manual_message_not_automatic(self):
  self.git.entries[0]['message']='manual';self.assertEqual(self.verify()['criteria']['commit']['status'],'unconfirmed')
 def test_unsupported_loader_no_guessed_url(self):
  self.git.data[NEW,'src/content.config.ts']='other';self.assertEqual(self.verify()['status'],'unconfirmed');self.assertNotIn(PAGE,self.web.urls)
 def test_http_failure_not_publication_failure(self):
  self.web.data[PAGE]=Response(403,'private body');r=self.verify();self.assertEqual(r['status'],'unconfirmed');self.assertNotIn('private body',json.dumps(r))
 def test_get_credentials_proxy_body_and_timeout(self):
  class Stream:
   status=200
   def read(self,_):return b'page'
   def __enter__(self):return self
   def __exit__(self,*_):pass
  with patch('urllib.request.build_opener') as build:
   build.return_value.open.return_value=Stream();PublicReader()(WEB+'/actions/runs/77',1);req=build.return_value.open.call_args.args[0]
   self.assertEqual(req.get_method(),'GET');self.assertIsNone(req.data);self.assertFalse(any('authorization' in k.lower() for k in req.headers));self.assertTrue(any(getattr(h,'proxies',None)=={} for h in build.call_args.args))
  class Slow(Stream):
   def read(self,_):time.sleep(.3);return b'page'
  with patch('urllib.request.build_opener') as build:
   build.return_value.open.return_value=Slow()
   with self.assertRaises(TimeoutError):PublicReader()(WEB+'/actions/runs/77',.03)
 def test_git_isolation_cleanup_on_failure(self):
  with patch('subprocess.Popen') as process:
   process.return_value.returncode=1;process.return_value.communicate.return_value=(b'',b'');g=PublicGit(time.monotonic()+30)
   with self.assertRaises(EvidenceUnavailable):
    with g:pass
   self.assertFalse(Path(g.tmp.name).exists());kw=process.call_args.kwargs;cmd=process.call_args.args[0]
   self.assertEqual(kw['env']['GIT_CONFIG_GLOBAL'],'/dev/null');self.assertEqual(kw['env']['GIT_CONFIG_NOSYSTEM'],'1');self.assertIn('credential.helper=',cmd);self.assertIn('http.followRedirects=false',cmd);self.assertNotIn('GITHUB_TOKEN',kw['env'])
 def test_git_revision_and_path_allowlist(self):
  g=PublicGit(time.monotonic()+30)
  for sha,path in [('main',POST),(NEW,'../../secret')]:
   with self.assertRaises(ValueError):g.source(sha,path)
 def test_actual_cli_fixture(self):
  code="import sys;sys.path.insert(0,'scripts/hermes');from test_public_release_acceptance import Fixture,GitFixture;from public_release_acceptance import main;main(['--max-wait','0'],fetch=Fixture(),git=GitFixture())"
  r=subprocess.run([sys.executable,'-c',code],cwd=Path(__file__).resolve().parents[2],capture_output=True,text=True,env={'PATH':'/usr/bin:/bin'})
  self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(json.loads(r.stdout)['criteria']['page']['status'],'passed')
 def test_missing_bot_and_malformed_page_do_not_skip_rss(self):
  self.git.entries[0]['author']='human'
  r=self.verify();self.assertIn(PAGE,self.web.urls);self.assertIn(RSS,self.web.urls);self.assertEqual(r['criteria']['commit']['status'],'unconfirmed')
  self.setUp();self.web.data[PAGE]='<h1>'+TITLE+'</h1><script type="application/ld+json">{bad}</script>'
  r=self.verify();self.assertIn(RSS,self.web.urls);self.assertEqual(r['criteria']['rss']['status'],'passed');self.assertEqual(r['criteria']['page']['status'],'unconfirmed')
 def test_timeout_terminates_real_git_helper_process_group(self):
  import tempfile
  real_popen=subprocess.Popen
  with tempfile.TemporaryDirectory() as folder:
   marker=Path(folder)/'child-survived'; started=Path(folder)/'child-started'
   child="import time;from pathlib import Path;Path("+repr(str(started))+").write_text('started');time.sleep(1.5);Path("+repr(str(marker))+").write_text('survived');time.sleep(1)"
   parent="import subprocess,sys,time;subprocess.Popen([sys.executable,'-c',"+repr(child)+"]);time.sleep(2)"
   def fake_git(cmd,**kwargs):
    process=real_popen(['/usr/bin/python3','-c',parent],**kwargs)
    deadline=time.monotonic()+10
    while not started.exists() and time.monotonic()<deadline:time.sleep(.01)
    if not started.exists():
     import os,signal
     os.killpg(process.pid,signal.SIGKILL);process.communicate();self.fail('Child did not become ready')
    return process
   g=PublicGit(1,monotonic=lambda:.85);g.tmp=type('Temp',(),{'name':folder})();g.home=Path(folder);g.path=Path(folder)/'snapshot.git'
   with patch('subprocess.Popen',side_effect=fake_git):
    with self.assertRaises(subprocess.TimeoutExpired):g.command('version')
   self.assertTrue(started.exists(),'Child must actually start to test cleanup');time.sleep(1.5);self.assertFalse(marker.exists(),'Git child continued after timeout')
 def test_incomplete_page_rss_actions_preserve_json_and_other_evidence(self):
  import http.client
  from public_release_acceptance import RUN_LIST
  for target,stage,remaining in [(PAGE,'page','rss'),(RSS,'rss','page'),(RUN_LIST,'actions','page')]:
   self.setUp();requests=[]
   class Stream:
    status=200
    def __init__(self,url):self.url=url
    def read(stream,_):
     if stream.url==target:raise http.client.IncompleteRead(b'PARTIAL_MUST_NOT_BE_EVIDENCE')
     value=self.web.data.get(stream.url,'<html></html>')
     return value.encode()
    def __enter__(self):return self
    def __exit__(self,*_):pass
   def open_source(request,**kwargs):requests.append(request.full_url);return Stream(request.full_url)
   with patch('urllib.request.build_opener') as build:
    build.return_value.open.side_effect=open_source
    result=run(fetch=PublicReader(),git=self.git,max_wait=0)
   encoded=json.dumps(result)
   self.assertEqual(result['status'],'unconfirmed');self.assertNotIn('PARTIAL_MUST_NOT_BE_EVIDENCE',encoded)
   self.assertEqual(result['criteria'][remaining]['status'],'passed')
   self.assertEqual(requests.count(target),1)
   self.assertIn({'url':target,'stage':stage,'error_type':'IncompleteRead','reason':'公開HTTP回應不完整，已捨棄partial內容；未重試'},result['source_errors'])
   if stage!='actions':self.assertEqual(result['criteria'][stage]['status'],'unconfirmed')
 def test_actual_cli_truncated_response_still_emits_json(self):
  code="import sys,http.client;sys.path.insert(0,'scripts/hermes');from test_public_release_acceptance import Fixture,GitFixture,PAGE;from public_release_acceptance import main;f=Fixture();original=f.__class__.__call__;f.__class__.__call__=lambda self,u,t:(_ for _ in ()).throw(http.client.IncompleteRead(b'PARTIAL_SECRET')) if u==PAGE else original(self,u,t);main(['--max-wait','0'],fetch=f,git=GitFixture())"
  r=subprocess.run([sys.executable,'-c',code],cwd=Path(__file__).resolve().parents[2],capture_output=True,text=True,env={'PATH':'/usr/bin:/bin'})
  self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(r.stderr,'')
  result=json.loads(r.stdout);self.assertEqual(result['status'],'unconfirmed');self.assertEqual(result['criteria']['rss']['status'],'passed');self.assertNotIn('PARTIAL_SECRET',r.stdout)
 def test_other_http_protocol_failure_is_structured_without_retry(self):
  import http.client
  f=self.web;original=f.__class__.__call__
  try:
   f.__class__.__call__=lambda self,u,t:(_ for _ in ()).throw(http.client.RemoteDisconnected('SENSITIVE_PROVIDER_TEXT')) if u==PAGE else original(self,u,t)
   r=self.verify();self.assertEqual(r['criteria']['rss']['status'],'passed');self.assertEqual(r['source_errors'][0]['error_type'],'RemoteDisconnected');self.assertNotIn('SENSITIVE_PROVIDER_TEXT',json.dumps(r));self.assertEqual(r['status'],'unconfirmed')
  finally:f.__class__.__call__=original
 def evidence_fixture(self):
  from public_release_acceptance import RUN_LIST
  schedule=WEB+'/actions/runs/77';pages=WEB+'/actions/runs/88'
  self.git.data[NEW,'.github/workflows/deploy-pages.yml']=(Path(__file__).parent/'fixtures/reviewed-pages-workflow.yml').read_text()
  self.web.data[RUN_LIST]='<a href="/gcake119/gcake-dev/actions/runs/77">scheduled</a>'
  self.web.data[WEB+'/actions/workflows/deploy-pages.yml']='<a href="/gcake119/gcake-dev/actions/runs/88">pages</a>'
  def summary(url,head,event,jobs):
   prefix=url[len('https://github.com'):]
   return '<a href="/gcake119/gcake-dev/actions/workflows/'+('editorial-release.yml' if event=='schedule' else 'deploy-pages.yml')+'">workflow</a><div role="region" aria-label="Workflow run summary">'+('Triggered via schedule' if event=='schedule' else 'Manually triggered')+'<a href="/gcake119/gcake-dev/commit/'+head+'">sha</a><a href="/gcake119/gcake-dev/tree/refs/heads/main">main</a>Status Success</div>'+''.join('<streaming-graph-job data-job-id="'+name+'" data-group-id="group-build_env_github-pages_"><a id="workflow-job-name-'+name+'" href="'+prefix+'/job/'+jid+'">'+name+'</a><svg aria-label="completed successfully: "></svg>'+('<a href="'+SITE+'/">site</a>' if name=='deploy' else '')+'</streaming-graph-job>' for name,jid in jobs)
  self.web.data[schedule]=summary(schedule,OLD,'schedule',[('release','100')])
  self.web.data[pages]=summary(pages,NEW,'manual',[('build','200'),('deploy','201')])
  def job(name,head,jid,step):
   return '<section aria-label="Check run summary"><a id="check-step-header-title">'+name+'</a><check-steps data-job-status="completed"><check-step data-name="'+step+'" data-number="2" data-conclusion="success" data-started-at="2026-10-11T23:00:01Z" data-completed-at="2026-10-11T23:00:19Z" data-log-url="/gcake119/gcake-dev/commit/'+head+'/checks/'+jid+'/logs/2"></check-step></check-steps></section>'
  self.web.data[schedule+'/job/100']=job('release',OLD,'100','Request fenced release and public verification')
  self.web.data[pages+'/job/200']=job('build',NEW,'200','Checkout latest main for manual deployment').replace('23:00:01','23:00:20').replace('23:00:19','23:00:40')
  self.web.data[pages+'/job/201']=job('deploy',NEW,'201','Deploy').replace('23:00:01','23:00:41').replace('23:00:19','23:00:50')
  self.web.data[WEB+'/commit/'+NEW+'/checks/200/logs/2']='<div class="js-log-line">[command]/usr/bin/git log -1 --format=%H</div><div class="js-log-line">'+NEW+'</div>'
  return schedule,pages
 def test_progress_and_parent_fact_without_provenance(self):
  r=self.verify();self.assertEqual(r['progress'],'public_provenance_pending');self.assertEqual(r['observations']['parent_sha'],OLD)
  self.assertEqual(r['observations']['article_transition'],{'before':'ready','after':'published','published_at':DATE})
 def test_complete_parent_linked_schedule_and_checkout_provenance_pass(self):
  schedule,pages=self.evidence_fixture();r=self.verify()
  self.assertEqual(r['status'],'passed');self.assertEqual(r['progress'],'verified_public');self.assertEqual(r['observations']['scheduled_run']['url'],schedule)
  self.assertEqual(r['observations']['pages_source_sha'],NEW);self.assertIn(pages,r['criteria']['pages']['evidence'])
  self.assertEqual(len(self.web.urls),len(set(self.web.urls)))
 def test_manual_wrong_parent_and_missing_timing_do_not_prove_schedule(self):
  for case in ['manual','parent','timing']:
   self.setUp();s,p=self.evidence_fixture()
   if case=='manual':self.web.data[s]=self.web.data[s].replace('Triggered via schedule','Manually triggered')
   if case=='parent':self.web.data[s]=self.web.data[s].replace(OLD,'c'*40)
   if case=='timing':self.web.data[s+'/job/100']=self.web.data[s+'/job/100'].replace('2026-10-11T23:00:19Z','2026-10-11T23:00:02Z')
   self.assertEqual(self.verify()['criteria']['commit']['status'],'unconfirmed')
 def test_matching_head_without_checkout_log_cannot_pass_pages(self):
  from public_release_acceptance import Response
  for case in ['missing','wrong','unrelated_text']:
   self.setUp();s,p=self.evidence_fixture();u=WEB+'/commit/'+NEW+'/checks/200/logs/2'
   if case=='missing':self.web.data[u]=Response(404,'')
   if case=='wrong':self.web.data[u]=self.web.data[u].replace(NEW,'c'*40)
   if case=='unrelated_text':self.web.data[u]='<div class="js-log-line">'+NEW+'</div>'
   self.assertEqual(self.verify()['criteria']['pages']['status'],'unconfirmed')
 def test_truncated_discovery_and_duplicate_matching_runs_do_not_pass(self):
  from public_release_acceptance import RUN_LIST
  self.evidence_fixture();self.web.data[RUN_LIST]+='<a href="/gcake119/gcake-dev/actions/workflows/editorial-release.yml?page=2">next</a>'
  self.assertEqual(self.verify()['criteria']['commit']['status'],'unconfirmed')
  self.setUp();s,p=self.evidence_fixture();other=WEB+'/actions/runs/78'
  self.web.data[RUN_LIST]+='<a href="/gcake119/gcake-dev/actions/runs/78">another</a>'
  self.web.data[other]=self.web.data[s].replace('/runs/77','/runs/78')
  self.web.data[other+'/job/100']=self.web.data[s+'/job/100']
  self.assertEqual(self.verify()['criteria']['commit']['status'],'unconfirmed')
 def test_captured_public_run_and_job_markup_is_supported(self):
  from public_release_acceptance import RunParser,JobParser
  folder=Path(__file__).parent/'fixtures'
  parser=RunParser();parser.feed((folder/'public-pages-run.html').read_text())
  record=parser.record(WEB+'/actions/runs/38201797158','deploy-pages.yml')
  self.assertEqual(record['event'],'workflow_dispatch');self.assertEqual(record['head_sha'],'eb6b988ad3f030fab2555a789897b7e81e5a0ad6')
  job=next(j for j in record['jobs'] if j['name']=='build');self.assertEqual(job['status'],'success')
  steps=JobParser();steps.feed((folder/'public-build-job.html').read_text());start,end=steps.validate(job,record)
  self.assertLess(start,end);self.assertTrue(any(s['data-name']=='Checkout latest main for manual deployment' for s in steps.steps))
 def test_invisible_logs_and_graphs_never_prove_runtime_evidence(self):
  from public_release_acceptance import checkout_revision,RunParser,JobParser
  command='[command]/usr/bin/git log -1 --format=%H'
  for source in ['<div hidden><div class="js-log-line">'+command+'</div><div class="js-log-line">'+NEW+'</div></div>','<div class="js-log-line" hidden>'+command+'</div><div class="js-log-line" hidden>'+NEW+'</div>','<div class="js-log-line"><script>'+command+'</script></div><div class="js-log-line"><script>'+NEW+'</script></div>','<template><div class="js-log-line">'+command+'</div><div class="js-log-line">'+NEW+'</div></template>']:
   with self.assertRaises(ValueError):checkout_revision(source)
  s,p=self.evidence_fixture();self.web.data[s]='<div hidden>'+self.web.data[s]+'</div>'
  self.assertEqual(self.verify()['criteria']['commit']['status'],'unconfirmed')
  self.setUp();s,p=self.evidence_fixture();self.web.data[p]=self.web.data[p].replace('<streaming-graph-job','<streaming-graph-job hidden')
  self.assertEqual(self.verify()['criteria']['pages']['status'],'unconfirmed')
  self.setUp();s,p=self.evidence_fixture();self.web.data[s+'/job/100']=self.web.data[s+'/job/100'].replace('<check-step ','<check-step hidden ')
  self.assertEqual(self.verify()['criteria']['commit']['status'],'unconfirmed')
 def test_failure_url_shared_by_two_lists_is_not_retried(self):
  from public_release_acceptance import RUN_LIST
  s,p=self.evidence_fixture();self.web.data[s]=Response(503,'')
  self.web.data[WEB+'/actions/workflows/deploy-pages.yml']+='<a href="/gcake119/gcake-dev/actions/runs/77">same failed run</a>'
  self.verify();self.assertEqual(self.web.urls.count(s),1)
 def test_same_proven_source_failed_deployment_is_failed(self):
  s,p=self.evidence_fixture();self.web.data[p]=self.web.data[p].replace('<svg aria-label="completed successfully: "></svg><a href="'+SITE+'/', '<svg aria-label="failed: "></svg><a href="'+SITE+'/')
  self.web.data[p+'/job/201']=self.web.data[p+'/job/201'].replace('data-conclusion="success"','data-conclusion="failure"')
  r=self.verify();self.assertEqual(r['criteria']['pages']['status'],'failed');self.assertEqual(r['status'],'failed')
 def test_missing_bot_with_complete_provenance_never_upgrades_commit(self):
  self.evidence_fixture();self.git.entries[0]['author']='human';r=self.verify()
  self.assertEqual(r['criteria']['commit']['status'],'unconfirmed');self.assertEqual(r['criteria']['page']['status'],'passed');self.assertEqual(r['criteria']['rss']['status'],'passed');self.assertNotIn('scheduled_run',r['observations'])
 def test_new_success_not_overridden_by_older_same_sha_deploy_failure(self):
  s,p=self.evidence_fixture();new=WEB+'/actions/runs/89'
  self.web.data[WEB+'/actions/workflows/deploy-pages.yml']+='<a href="/gcake119/gcake-dev/actions/runs/89">new</a>'
  self.web.data[new]=self.web.data[p].replace('/runs/88','/runs/89').replace('/job/200','/job/300').replace('/job/201','/job/301')
  for old_id,new_id in [('200','300'),('201','301')]:
   self.web.data[new+'/job/'+new_id]=self.web.data[p+'/job/'+old_id].replace('/checks/'+old_id+'/', '/checks/'+new_id+'/').replace('23:00:','23:01:')
  self.web.data[WEB+'/commit/'+NEW+'/checks/300/logs/2']=self.web.data[WEB+'/commit/'+NEW+'/checks/200/logs/2']
  self.web.data[p]=self.web.data[p].replace('<svg aria-label="completed successfully: "></svg><a href="'+SITE+'/', '<svg aria-label="failed: "></svg><a href="'+SITE+'/')
  self.web.data[p+'/job/201']=self.web.data[p+'/job/201'].replace('data-conclusion="success"','data-conclusion="failure"')
  self.assertEqual(self.verify()['criteria']['pages']['status'],'passed')
 def test_unreadable_checkout_log_reports_exact_url_and_stage(self):
  self.evidence_fixture();url=WEB+'/commit/'+NEW+'/checks/200/logs/2';self.web.data[url]=Response(404,'')
  r=self.verify();self.assertTrue(any(e['url']==url and e['stage']=='pages' and e['http_status']==404 for e in r['source_errors']))
  self.assertEqual(r['criteria']['page']['status'],'passed');self.assertEqual(r['progress'],'public_provenance_pending')
if __name__=='__main__':unittest.main()
