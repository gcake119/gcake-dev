"""Real gateway/wrapper cutover + old-wrapper rollback with transport-only fixtures."""
import argparse
from contextlib import closing
from datetime import datetime,timezone
import hashlib
import json
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import tempfile
import time
from monitor_wrapper import render_wrapper
from stage_cron_context import patch_source,SOURCE_SHA256
from verify_gateway_isolated import environment,sandbox,stop,digest

ORIGINAL_WRAPPER_SHA='f3d1868862188c77ccc6c6f8bfb20c14ac9d2fd6354072943194e0bc11c60e46'
SITE='https://gcake119.github.io/gcake-dev/'

TRANSPORT='''import io,json,os,urllib.request
from pathlib import Path
from datetime import datetime,timezone
from email.utils import format_datetime
root=Path(__file__).resolve().parents[3]/'.hermes'
class Response(io.BytesIO):
    def __init__(self,url,raw,mime='application/json'):
        super().__init__(raw);self.url=url;self.status=200;self.headers={'Content-Type':mime}
    def geturl(self):return self.url
def fixture_open(self,request,timeout=20):
    data=json.loads((root/'observations.json').read_text())
    with (root/'transport.jsonl').open('a') as log:
        log.write(json.dumps({'kind':'delivery' if request.get_method()=='POST' else 'read','path':request.full_url.split('/bot')[0] if request.get_method()=='POST' else request.full_url})+'\\n')
    if request.get_method()=='POST':
        body=json.loads(request.data)
        slug=next(p['slug'] for p in data['posts'] if '/posts/'+p['slug']+'/' in body['text'])
        with (root/'deliveries.jsonl').open('a') as log:log.write(json.dumps({'slug':slug})+'\\n')
        if slug=='lost':raise TimeoutError('fixture lost acknowledgement')
        return Response(request.full_url,json.dumps({'ok':True,'result':{'message_id':1}}).encode())
    if request.full_url.endswith('/api/v1/monitoring/publications'):
        articles=[dict(articleId=p['slug'],canonicalUrl=data['site']+'posts/'+p['slug']+'/',kind='standalone',scheduleState='unscheduled') for p in data['posts']]
        return Response(request.full_url,json.dumps(dict(schemaVersion=1,generatedAt=datetime.now(timezone.utc).isoformat(),gitRevision='fixture',queueVersion=0,complete=True,articles=articles)).encode())
    if request.full_url.endswith('/rss.xml'):
        date=format_datetime(datetime.fromisoformat(data['published_at']),usegmt=True)
        items=''.join('<item><title>'+p['slug']+'</title><link>'+data['site']+'posts/'+p['slug']+'/</link><guid>'+data['site']+'posts/'+p['slug']+'/</guid><pubDate>'+date+'</pubDate></item>' for p in data['posts'])
        return Response(request.full_url,('<rss><channel>'+items+'</channel></rss>').encode(),'application/rss+xml')
    slug=request.full_url.rstrip('/').rsplit('/',1)[-1]
    if slug not in [p['slug'] for p in data['posts']]:raise AssertionError('Unexpected fixture read')
    html='<link rel="canonical" href="'+request.full_url+'"><script type="application/ld+json">'+json.dumps({'@type':'BlogPosting','datePublished':data['published_at']})+'</script>'
    return Response(request.full_url,html.encode(),'text/html')
urllib.request.OpenerDirector.open=fixture_open
'''


def snapshot(db):
    with closing(sqlite3.connect(db.as_uri()+'?mode=ro',uri=True)) as conn:
        meta=dict(conn.execute('SELECT key,value FROM meta'))
        rows=[list(r) for r in conn.execute('SELECT url,guid,status FROM outbox ORDER BY url')]
        events=[]
        if conn.execute("SELECT 1 FROM sqlite_master WHERE name='monitor_events'").fetchone():
            events=[list(r) for r in conn.execute('SELECT event_id,status FROM monitor_events ORDER BY event_id')]
    return dict(meta=meta,outbox=rows,events=events)


def main():
    parser=argparse.ArgumentParser()
    for key in ('source','python','original-wrapper','evidence'):parser.add_argument('--'+key,type=Path,required=True)
    args=parser.parse_args();args.evidence.mkdir(parents=True,exist_ok=True)
    if digest(args.original_wrapper)!=ORIGINAL_WRAPPER_SHA:raise ValueError('Original wrapper hash differs')
    raw=args.original_wrapper.read_text()
    env_paths=set(re.findall(r'/Users/hermes/[A-Za-z0-9_./-]+\.env',raw))
    if len(env_paths)!=1:raise ValueError('Original private-env mapping is ambiguous')
    if digest(args.source/'cron/scheduler_script.py')!=SOURCE_SHA256:raise ValueError('Core hash differs')
    results=[]
    with tempfile.TemporaryDirectory(prefix='hermes-wrapper-rollover-',dir='/private/tmp') as owned:
        root=Path(owned);code=root/'code'
        shutil.copytree(args.source,code,symlinks=True,ignore=shutil.ignore_patterns('.env','.env.*','.git','.venv','venv','__pycache__'))
        kernel=code/'cron/scheduler_script.py';original=kernel.read_text();kernel.write_text(patch_source(original))
        home=root/'home';home.mkdir()
        for name in ('runtime','tmp','config','data','cache'):(home/name).mkdir()
        hh=home/'.hermes';(hh/'scripts').mkdir(parents=True)
        config=dict(model=dict(default='fixture-model',provider='openai'),platforms={},gateway=dict(multiplex_profiles=False),kanban=dict(dispatch_in_gateway=False),heartbeats=dict(enabled=False),cron=dict(catch_up_missed=True))
        (hh/'config.yaml').write_text(json.dumps(config));(hh/'gateway.json').write_text('{"platforms":{},"multiplex_profiles":false}')
        lib=home/'.local/lib/gcake-rss';lib.mkdir(parents=True)
        for name in ('publication_monitor.py','rss_monitor.py'):shutil.copy2(Path(__file__).with_name(name),lib/name)
        # Inject only HTTP/ack test services; real Monitor/CLI functions are unchanged.
        helper=lib/'rss_monitor.py'
        hook='exec(compile('+repr(TRANSPORT)+', "fixture_transport", "exec"))\n\n'
        helper.write_text(helper.read_text().replace("if __name__ == '__main__':",hook+"if __name__ == '__main__':"))
        legacy=home/'legacy.env';legacy.write_text('HERMES_RSS_NOTIFY_ENABLED=true\nTELEGRAM_BOT_TOKEN=0:TEST_ONLY\nTELEGRAM_CHAT_ID=0\n')
        summary=home/'summary.env';summary.write_text('PUBLICATION_MONITOR_SUMMARY_URL=https://fixture.invalid/api/v1/monitoring/publications\nPUBLICATION_MONITOR_READ_SECRET=fixture-only\n')
        db=home/'.local/state/gcake-rss/live.sqlite';db.parent.mkdir(parents=True)
        initialized=str(time.time()-7200)
        old_rows=[(SITE+'posts/'+slug+'/',SITE+'posts/'+slug+'/',status) for slug,status in [('sent','sent'),('uncertain','uncertain'),('baseline','baseline')]]
        with closing(sqlite3.connect(db)) as conn,conn:
            conn.executescript('CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE outbox(url TEXT PRIMARY KEY,guid TEXT,status TEXT NOT NULL);')
            conn.executemany('INSERT INTO meta VALUES(?,?)',[('mode','live'),('site',SITE),('initialized',initialized),('failures','0'),('next_check','0')])
            conn.executemany('INSERT INTO outbox VALUES(?,?,?)',old_rows)
        data=dict(site=SITE,published_at=datetime.fromtimestamp(time.time()-3600,timezone.utc).replace(microsecond=0).isoformat(),posts=[dict(slug=s) for s in ('sent','uncertain','baseline','new','lost')])
        (hh/'observations.json').write_text(json.dumps(data))
        old=raw.replace(next(iter(env_paths)),str(legacy)).replace('/Users/hermes/.local/lib/gcake-rss',str(lib)).replace('/Users/hermes/.local/state/gcake-rss/live.sqlite',str(db))
        # The legacy launcher also sets HOME explicitly; map that literal only.
        old=re.sub(r'/Users/hermes(?=\s|[\x27\x22]|$)',str(home),old)
        if '/Users/hermes' in old:raise ValueError('Unmapped original wrapper path')
        wrapper=hh/'scripts/gcake-rss-live.sh'
        env=environment(home,code,args.python)
        prefix=['/usr/bin/sandbox-exec','-p',sandbox(root),str(args.python)]
        create="from cron.jobs import create_job; from datetime import datetime,timezone,timedelta; import json; j=create_job(None,(datetime.now(timezone.utc)-timedelta(seconds=10)).isoformat(),script='gcake-rss-live.sh',no_agent=True,deliver='local',failure_deliver='local');print(json.dumps(j['id']))"
        wrapper.write_text('#!/bin/bash\nexit 1\n')
        created=subprocess.run(prefix+['-c',create],cwd=code,env=env,capture_output=True,text=True,timeout=20)
        if created.returncode:raise RuntimeError('Job preparation failed: '+created.stderr[-500:])
        job_id=json.loads(created.stdout.splitlines()[-1])
        for index,(name,mode) in enumerate([('dry-run','dry-run'),('new-live','live'),('new-retry','live'),('rollback','old'),('rollback-new','old'),('rollback-retry','old')]):
            if name=='rollback-new':
                data['posts'].append(dict(slug='after-rollback'));(hh/'observations.json').write_text(json.dumps(data))
            if mode=='old':kernel.write_text(original)
            rendered=old if mode=='old' else render_wrapper(job_id=job_id,legacy_env=legacy,summary_env=summary,library=lib,db=db,mode=mode)
            staged=wrapper.with_suffix('.staged');staged.write_text(rendered);staged.replace(wrapper)
            if index:
                rearm="from cron.jobs import rearm_oneshot; from datetime import datetime,timezone,timedelta; rearm_oneshot("+repr(job_id)+",(datetime.now(timezone.utc)-timedelta(seconds=10)).isoformat())"
                completed=subprocess.run(prefix+['-c',rearm],cwd=code,env=env,capture_output=True,text=True,timeout=20)
                if completed.returncode:raise RuntimeError('Fixture rearm failed: '+completed.stderr[-500:])
            before=digest(db)
            deliveries=hh/'deliveries.jsonl';before_count=len(deliveries.read_text().splitlines()) if deliveries.exists() else 0
            process=None;result=dict(case=name,job_id=job_id,success=False)
            try:
                with (args.evidence/(name+'-gateway.log')).open('w') as log:
                    process=subprocess.Popen(prefix+['-m','gateway.run'],cwd=code,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
                    deadline=time.monotonic()+75
                    while time.monotonic()<deadline:
                        if process.poll() is not None:raise RuntimeError('Gateway exited')
                        ledger=hh/'cron/executions.db'
                        if ledger.exists():
                            with closing(sqlite3.connect(ledger.as_uri()+'?mode=ro',uri=True)) as conn:
                                finished=conn.execute("SELECT COUNT(*) FROM executions WHERE job_id=? AND status='completed'",(job_id,)).fetchone()[0]
                                failed=conn.execute("SELECT COUNT(*) FROM executions WHERE job_id=? AND status='failed'",(job_id,)).fetchone()[0]
                            if failed:raise RuntimeError('Test job failed; inspect isolated cron output')
                            if finished==index+1:break
                        time.sleep(.25)
                    else:raise TimeoutError('Wrapper dispatch timed out')
                    count=len(deliveries.read_text().splitlines()) if deliveries.exists() else 0
                    state=snapshot(db)
                    expected={'dry-run':0,'new-live':2,'new-retry':0,'rollback':0,'rollback-new':1,'rollback-retry':0}[name]
                    old_preserved=all(list(r) in state['outbox'] for r in old_rows)
                    statuses={r[0]:r[2] for r in state['outbox']}
                    outcomes=mode=='dry-run' or (statuses.get(SITE+'posts/new/')=='sent' and statuses.get(SITE+'posts/lost/')=='uncertain' and ['article:'+SITE+'posts/lost/','unknown'] in state['events'])
                    if name in ('rollback-new','rollback-retry'):outcomes=outcomes and statuses.get(SITE+'posts/after-rollback/')=='sent'
                    result.update(delivery_requests=count-before_count,expected_requests=expected,old_rows_preserved=old_preserved,new_outcomes_preserved=outcomes,initialized_preserved=state['meta']['initialized']==initialized,dry_state_unchanged=before==digest(db) if mode=='dry-run' else None,state=state)
                    result['success']=count-before_count==expected and old_preserved and outcomes and result['initialized_preserved'] and (mode!='dry-run' or result['dry_state_unchanged'])
            except Exception as error:result.update(error_type=type(error).__name__,error=str(error))
            finally:
                if process is not None:result['cleanup']=stop(process)
                (args.evidence/(name+'-result.json')).write_text(json.dumps(result,indent=2))
            results.append(result);print(json.dumps({k:result.get(k) for k in ('case','success','delivery_requests','error_type')}),flush=True)
            if not result['success']:break
        for name in ('deliveries.jsonl','transport.jsonl'):
            if (hh/name).exists():shutil.copy2(hh/name,args.evidence/name)
    report=dict(results=results,success=len(results)==6 and all(r['success'] and r['cleanup']['gateway_reaped'] and not r['cleanup']['remaining_owned_children'] for r in results),disposable_root_removed=not root.exists(),original_wrapper_sha256=ORIGINAL_WRAPPER_SHA,production_telegram_connected=False)
    (args.evidence/'wrapper-summary.json').write_text(json.dumps(report,indent=2))
    if not report['success']:raise SystemExit(1)


if __name__=='__main__':main()
