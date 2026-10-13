"""Actual self-contained runtime switch/recovery drill; all services are owned and sandboxed."""
import argparse
from contextlib import closing
from datetime import datetime,timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import time
import sys
from monitor_wrapper import render_wrapper
from stage_cron_context import patch_source,SOURCE_SHA256
from updater_guard import (init_root,seal_release,bootstrap,apply_update,activate_release,read,atomic,verify_active,tree)
from verify_gateway_isolated import environment,sandbox,stop,digest
from verify_wrapper_rollover import TRANSPORT,SITE,snapshot

class Gateway:
    def __init__(self,root,home,evidence):
        self.root=root;self.home=home;self.hh=home/'.hermes';self.evidence=evidence
        self.process=None;self.log=None;self.calls=[];self.cleanups=[];self.verifications=[];self.fail_on=set();self.timeout_on=set();self.counter=0
        self.db=home/'state/live.sqlite';self.job_id=None;self.expected=0
        self.cli_entry=False
    def drained(self):
        self.calls.append('drain')
        ledger=self.hh/'cron/executions.db'
        if not ledger.exists():return True
        with closing(sqlite3.connect(ledger.as_uri()+'?mode=ro',uri=True)) as conn:
            return conn.execute("SELECT COUNT(*) FROM executions WHERE status IN ('running','claimed')").fetchone()[0]==0
    def command(self,current,code):
        python=current/'runtime/bin/python3.11'
        env=environment(self.home,current/'code',python)
        return subprocess.run(['/usr/bin/sandbox-exec','-p',sandbox(self.root.parent),str(python),'-c',code],cwd=current/'code',env=env,capture_output=True,text=True,timeout=20)
    def stop(self):
        self.calls.append('stop')
        if self.process is not None:
            result=stop(self.process);self.cleanups.append(result);self.process=None
            if self.log:self.log.close();self.log=None
            if not result['gateway_reaped'] or result['remaining_owned_children']:raise RuntimeError('owned process cleanup failed')
    def start(self,current,mode):
        if self.process is not None:raise RuntimeError('second sender refused')
        self.calls.append('start:'+mode);self.current=current;self.mode=mode;self.counter+=1
        self.before=digest(self.db)
        ledger=self.hh/'cron/executions.db'
        if ledger.exists():
            with closing(sqlite3.connect(ledger.as_uri()+'?mode=ro',uri=True)) as conn:
                self.expected=conn.execute("SELECT COUNT(*) FROM executions WHERE job_id=? AND status='completed'",(self.job_id,)).fetchone()[0]
                self.failed_before=conn.execute("SELECT COUNT(*) FROM executions WHERE job_id=? AND status='failed'",(self.job_id,)).fetchone()[0]
        else:self.expected=0;self.failed_before=0
        rearm="from cron.jobs import rearm_oneshot;from datetime import datetime,timezone,timedelta;rearm_oneshot("+repr(self.job_id)+",(datetime.now(timezone.utc)-timedelta(seconds=10)).isoformat())"
        result=self.command(current,rearm)
        if result.returncode:raise RuntimeError('isolated rearm failed: '+result.stderr[-400:])
        self.activate(current,mode)
        python=current/'runtime/bin/python3.11';env=environment(self.home,current/'code',python)
        self.log=(self.evidence/('gateway-'+str(self.counter)+'.log')).open('w')
        module_args=['-m','hermes_cli.main','gateway','run'] if self.cli_entry else ['-m','gateway.run']
        self.process=subprocess.Popen(['/usr/bin/sandbox-exec','-p',sandbox(self.root.parent),str(python),'-B',*module_args],cwd=current/'code',env=env,stdout=self.log,stderr=subprocess.STDOUT,start_new_session=True)
    def activate(self,current,mode):
        self.calls.append('activate:'+mode)
        template=current/('wrapper.live.sh' if mode=='live' else 'wrapper.dry.sh')
        target=self.hh/'scripts/monitor.sh';staged=target.with_suffix('.staged');staged.write_bytes(template.read_bytes());staged.replace(target)
    def wait(self,current,dry=True,deadline_seconds=75):
        deadline=time.monotonic()+deadline_seconds
        while time.monotonic()<deadline:
            if self.process.poll() is not None:raise RuntimeError('gateway exited')
            ledger=self.hh/'cron/executions.db'
            if ledger.exists():
                with closing(sqlite3.connect(ledger.as_uri()+'?mode=ro',uri=True)) as conn:
                    conn.row_factory=sqlite3.Row
                    rows=[dict(r) for r in conn.execute("SELECT * FROM executions WHERE job_id=?",(self.job_id,))]
                completed=[r for r in rows if r['status']=='completed']
                if len(completed)==self.expected+1:break
                if len([r for r in rows if r['status']=='failed'])>self.failed_before:raise RuntimeError('test script failed')
            time.sleep(.2)
        else:raise TimeoutError('owned dispatch timeout')
        occurrence=next(r for r in completed if r['id']==json.loads((self.hh/'context.json').read_text())['HERMES_CRON_EXECUTION_ID'])
        captured=json.loads((self.hh/'context.json').read_text())
        expected=dict(HERMES_CRON_JOB_ID=self.job_id,HERMES_CRON_EXECUTION_ID=occurrence['id'],HERMES_CRON_SCHEDULED_INSTANT=occurrence['scheduled_instant'])
        if captured!=expected:raise RuntimeError('runtime context mismatch')
        identity=self.command(current,'from gateway.control_socket import identify_gateway;from pathlib import Path;import os,json;print(json.dumps(identify_gateway(Path(os.environ["HERMES_HOME"]))))')
        answer=json.loads(identity.stdout) if identity.returncode==0 else None
        if not answer or answer['pid']!=self.process.pid or Path(answer['hermes_home'])!=self.hh:raise RuntimeError('gateway identity mismatch')
        probe=self.command(current,'import sys,json,pydantic_core,release_dependency;print(json.dumps(dict(version=sys.version.split()[0],prefix=sys.prefix,dependency=release_dependency.VERSION,native_dependency=pydantic_core.__version__)))')
        if probe.returncode:raise RuntimeError('runtime import probe failed')
        runtime=json.loads(probe.stdout);release=read(self.root/'active.json')['manifest']['release_id']
        if runtime['version']!='3.11.15' or Path(runtime['prefix'])!=current/'runtime' or runtime['dependency']!=release:raise RuntimeError('full runtime identity mismatch')
        if dry and digest(self.db)!=self.before:raise RuntimeError('dry run changed state')
        record=dict(release_id=release,runtime=runtime,context_matches_ledger=True,unix_identity_verified=True,dry_run=dry,state_unchanged=digest(self.db)==self.before)
        self.verifications.append(record)
        return record
    def verify(self,current):
        self.calls.append('verify');release=read(self.root/'active.json')['manifest']['release_id']
        record=self.wait(current,deadline_seconds=.01 if release in self.timeout_on else 75)
        if release in self.fail_on:raise RuntimeError('intentional post-dispatch verification failure')
        return record
    def live_round(self):
        self.stop();current=self.root/'current';verify_active(self.root,'live')
        requests=self.hh/'deliveries.jsonl';before=len(requests.read_text().splitlines()) if requests.exists() else 0
        self.start(current,'live');self.wait(current,dry=False)
        count=len(requests.read_text().splitlines()) if requests.exists() else 0
        return count-before

def build(bundle,release,source,python_base,site_packages,root,home,job_id,evidence_sha):
    payload=bundle/'payload';payload.mkdir(parents=True)
    ignore=shutil.ignore_patterns('.git','.env','.env.*','.venv','venv','node_modules','__pycache__','*.sqlite','*.db')
    shutil.copytree(source,payload/'code',symlinks=True,ignore=ignore)
    kernel=payload/'code/cron/scheduler_script.py';kernel.write_text(patch_source(kernel.read_text()))
    shutil.copytree(python_base,payload/'runtime',symlinks=True,ignore=shutil.ignore_patterns('__pycache__'))
    packages=payload/'runtime/lib/python3.11/site-packages'
    shutil.copytree(site_packages,packages,symlinks=True,dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__'))
    (packages/'release_dependency.py').write_text('VERSION='+repr(release)+'\n')
    lib=payload/'library';lib.mkdir()
    for name in ('rss_monitor.py','publication_monitor.py','updater_guard.py'):shutil.copy2(Path(__file__).with_name(name),lib/name)
    transport=TRANSPORT.replace("root=Path(__file__).resolve().parents[3]/'.hermes'",'root=Path('+repr(str(home/'.hermes'))+')')
    transport+='\nkeys=["HERMES_CRON_JOB_ID","HERMES_CRON_EXECUTION_ID","HERMES_CRON_SCHEDULED_INSTANT"]\n(root/"context.json").write_text(json.dumps({k:os.environ.get(k) for k in keys}))\n'
    helper=lib/'rss_monitor.py';hook='exec(compile('+repr(transport)+', "fixture_transport", "exec"))\n\n'
    helper.write_text(helper.read_text().replace("if __name__ == '__main__':",hook+"if __name__ == '__main__':"))
    for mode in ('dry-run','live'):
        name='wrapper.dry.sh' if mode=='dry-run' else 'wrapper.live.sh'
        (payload/name).write_text(render_wrapper(job_id=job_id,legacy_env=home/'legacy.env',summary_env=home/'summary.env',library=root/'current/library',db=home/'state/live.sqlite',mode=mode,guard_root=root))
    return seal_release(bundle,release_id=release,source_sha='7ce190446e548e2e1c0ae6ba0225be0490d12fc2',patch_sha=digest(Path(__file__).with_name('hermes-cron-context.patch')),python_version='3.11.15',lock_sha=digest(source/'uv.lock'),verification={'passed':True,'evidence_sha':evidence_sha},capability='cron-context-v1')

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--cli-entry',action='store_true')
    for name in ('source','python-base','site-packages','evidence'):parser.add_argument('--'+name,type=Path,required=True)
    args=parser.parse_args()
    for path in (args.source,args.evidence):
        if not str(path.resolve()).startswith('/private/tmp/') or path.resolve()!=path.absolute():raise ValueError('isolated input/output required')
    args.evidence.mkdir(parents=True,exist_ok=True)
    if digest(args.source/'cron/scheduler_script.py')!=SOURCE_SHA256:raise ValueError('source hash mismatch')
    if shutil.disk_usage('/private/tmp').free<4*1024**3:raise ValueError('insufficient free space')
    service=None;results=[]
    with tempfile.TemporaryDirectory(prefix='hermes-runtime-update-',dir='/private/tmp') as owned:
        owner=Path(owned);root=owner/'managed';init_root(root);home=root/'home';home.mkdir()
        for name in ('runtime','tmp','config','data','cache','state'):(home/name).mkdir()
        hh=home/'.hermes';(hh/'scripts').mkdir(parents=True)
        config=dict(model=dict(default='fixture-model',provider='openai',base_url='http://127.0.0.1:1'),platforms={},gateway=dict(multiplex_profiles=False),kanban=dict(dispatch_in_gateway=False),heartbeats=dict(enabled=False),cron=dict(catch_up_missed=True),update=dict(check_on_startup=False))
        (hh/'config.yaml').write_text(json.dumps(config));(hh/'gateway.json').write_text('{"platforms":{},"multiplex_profiles":false}')
        (home/'legacy.env').write_text('HERMES_RSS_NOTIFY_ENABLED=true\nTELEGRAM_BOT_TOKEN=0:TEST_ONLY\nTELEGRAM_CHAT_ID=0\n')
        (home/'summary.env').write_text('PUBLICATION_MONITOR_SUMMARY_URL=https://fixture.invalid/api/v1/monitoring/publications\nPUBLICATION_MONITOR_READ_SECRET=fixture-only\n')
        db=home/'state/live.sqlite';initialized=str(time.time()-7200)
        with closing(sqlite3.connect(db)) as conn,conn:
            conn.executescript('CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);CREATE TABLE outbox(url TEXT PRIMARY KEY,guid TEXT,status TEXT NOT NULL);')
            conn.executemany('INSERT INTO meta VALUES(?,?)',[('initialized',initialized),('mode','live'),('site',SITE),('failures','0'),('next_check','0')])
            conn.executemany('INSERT INTO outbox VALUES(?,?,?)',[(SITE+'posts/'+slug+'/',SITE+'posts/'+slug+'/',status) for slug,status in [('sent','sent'),('uncertain','uncertain'),('baseline','baseline')]])
        data=dict(site=SITE,published_at=datetime.fromtimestamp(time.time()-3600,timezone.utc).replace(microsecond=0).isoformat(),posts=[dict(slug=s) for s in ('sent','uncertain','baseline','new','lost')]);(hh/'observations.json').write_text(json.dumps(data))
        creator="from cron.jobs import create_job;from datetime import datetime,timezone,timedelta;import json;print(json.dumps(create_job(None,(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat(),script='monitor.sh',no_agent=True,deliver='local',failure_deliver='local')['id']))"
        # Creator uses the prior isolated dependency environment; service runtime is fully copied below.
        initial_python=Path(sys.executable);env=environment(home,args.source,initial_python)
        created=subprocess.run(['/usr/bin/sandbox-exec','-p',sandbox(owner),str(initial_python),'-c',creator],cwd=args.source,env=env,capture_output=True,text=True,timeout=20)
        if created.returncode:
            (args.evidence/'fixture-creation-error.json').write_text(json.dumps(dict(returncode=created.returncode,stdout=created.stdout,stderr=created.stderr)))
            raise RuntimeError('fixture creation failed: '+created.stderr[-500:])
        job_id=json.loads(created.stdout.splitlines()[-1]);service=Gateway(root,home,args.evidence);service.job_id=job_id
        service.cli_entry=args.cli_entry
        try:
            provenance=hashlib.sha256((args.evidence.parent/'gateway311-full/gateway-summary.json').read_bytes()).hexdigest()
            bundles={};catalog={}
            for release in ('old','new','bad'):
                bundle=owner/release;catalog[release]=build(bundle,release,args.source,args.python_base,args.site_packages,root,home,job_id,provenance);bundles[release]=bundle
            bootstrap(root,bundles['old'],catalog);service.start(root/'current','dry-run');service.verify(root/'current')
            activation=activate_release(root,service,live_authorized=True)
            if activation['status']!='activated':raise RuntimeError('fixture live activation failed')
            unknown=owner/'unknown';unknown.mkdir();manifest=read(bundles['new']/'manifest.json');manifest.update(release_id='unreviewed',source_sha='f'*40);manifest['verification']['passed']=False;atomic(unknown/'manifest.json',manifest)
            calls=len(service.calls)
            for _ in range(2):results.append(apply_update(root,unknown,catalog,service))
            assert all(r['status']=='skipped' for r in results) and len(service.calls)==calls and len(list((root/'pending').glob('*.json')))==1
            results.append(apply_update(root,bundles['new'],catalog,service,live_authorized=True));assert results[-1]['status']=='updated'
            print('approved update verified',flush=True)
            assert service.live_round()==2
            sent_state=snapshot(db)
            service.fail_on={'bad'};results.append(apply_update(root,bundles['bad'],catalog,service,live_authorized=True));assert results[-1]['status']=='rolled_back';assert verify_active(root,'live')['release_id']=='new';assert snapshot(db)==sent_state
            assert service.live_round()==0
            data['posts'].append(dict(slug='after-rollback'));(hh/'observations.json').write_text(json.dumps(data));assert service.live_round()==1;assert service.live_round()==0
            after=snapshot(db)
            service.fail_on=set()
            def interrupt(phase):
                if phase=='installed':raise KeyboardInterrupt('intentional update interruption')
            results.append(apply_update(root,bundles['bad'],catalog,service,live_authorized=True,failpoint=interrupt));assert results[-1]['status']=='rolled_back';assert snapshot(db)==after
            def damage_interpreter(phase):
                if phase=='installed':(root/'current/runtime/bin/python3.11').write_bytes(b'broken-fixture-interpreter')
            results.append(apply_update(root,bundles['bad'],catalog,service,live_authorized=True,failpoint=damage_interpreter));assert results[-1]['status']=='rolled_back';assert snapshot(db)==after
            def damage_native_dependency(phase):
                if phase=='installed':
                    library=next((root/'current/runtime/lib/python3.11/site-packages/pydantic_core').glob('*.so'))
                    library.write_bytes(b'broken-fixture-native-dependency')
            results.append(apply_update(root,bundles['bad'],catalog,service,live_authorized=True,failpoint=damage_native_dependency));assert results[-1]['status']=='rolled_back';assert snapshot(db)==after
            print('interpreter and native dependency rollback verified',flush=True)
            service.timeout_on={'bad'};results.append(apply_update(root,bundles['bad'],catalog,service,live_authorized=True));assert results[-1]['status']=='rolled_back';service.timeout_on=set()
            service.fail_on={'bad','new'};results.append(apply_update(root,bundles['bad'],catalog,service,live_authorized=True));assert results[-1]['status']=='recovery_failed';assert service.process is None
            calls=len(service.calls);results.append(apply_update(root,bundles['bad'],catalog,service));assert results[-1]['status']=='blocked' and len(service.calls)==calls
            assert snapshot(db)==after and after['meta']['initialized']==initialized
            statuses={r[0]:r[2] for r in after['outbox']};assert statuses[SITE+'posts/new/']=='sent' and statuses[SITE+'posts/lost/']=='uncertain'
            assert ['article:'+SITE+'posts/lost/','unknown'] in after['events']
            for name in ('deliveries.jsonl','transport.jsonl'):
                shutil.copy2(hh/name,args.evidence/name)
            for path in (root/'receipts').glob('*.json'):shutil.copy2(path,args.evidence/('receipt-'+path.name))
            shutil.copy2(root/'journal.json',args.evidence/'final-recovery-journal.json')
            (args.evidence/'state.json').write_text(json.dumps(after,indent=2))
            success=True
        except BaseException as error:
            success=False;(args.evidence/'error.json').write_text(json.dumps({'type':type(error).__name__,'error':str(error)}))
            if (root/'journal.json').exists():shutil.copy2(root/'journal.json',args.evidence/'failed-journal.json')
            raise
        finally:
            service.stop()
            (args.evidence/'lifecycle.json').write_text(json.dumps({'results':results,'verifications':service.verifications,'cleanup':service.cleanups,'owned_calls':service.calls},indent=2))
    report=dict(success=success,disposable_root_removed=not owner.exists(),gateway_python='3.11.15',gateway_entry='hermes_cli.main gateway run' if args.cli_entry else 'gateway.run',self_contained_runtime=True,real_gateway_verified=True,damaged_interpreter_recovered=True,damaged_native_dependency_recovered=True,no_history_rollback=True,delivery_request_counts=[2,0,1,0],production_operations=False,cleanup=service.cleanups)
    (args.evidence/'runtime-summary.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='cleanup'}))

if __name__=='__main__':main()
