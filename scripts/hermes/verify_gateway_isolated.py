"""Full real gateway + ticker verification. Owns start, evidence and finally cleanup."""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import sqlite3
import subprocess
import tempfile
import time
import psutil
from stage_cron_context import SOURCE_SHA256, patch_source


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def environment(home,code,python):
    return dict(PATH=str(python.parent)+':/usr/bin:/bin:/opt/homebrew/bin',HOME=str(home),
                HERMES_HOME=str(home/'.hermes'),XDG_CONFIG_HOME=str(home/'config'),
                XDG_DATA_HOME=str(home/'data'),XDG_CACHE_HOME=str(home/'cache'),
                XDG_RUNTIME_DIR=str(home/'runtime'),TMPDIR=str(home/'tmp'),
                PYTHONPATH=str(code),PYTHONDONTWRITEBYTECODE='1',PYTHONUNBUFFERED='1',
                LANG='en_US.UTF-8',TZ='UTC',HERMES_RSS_NOTIFY_ENABLED='false')


def sandbox(root):
    # No credential paths or external networking, including child processes.
    return '(version 1) (allow default) (deny network*) (deny file-write*) '+\
        '(allow network* (local unix-socket) (remote unix-socket)) '+\
        '(allow file-write* (subpath '+json.dumps(str(root))+')) '+\
        '(deny file-read* (subpath "/Users/hermes"))'


def owned_children(process):
    if process.poll() is not None:return []
    try:return [(p.pid,p.create_time()) for p in psutil.Process(process.pid).children(recursive=True)]
    except psutil.NoSuchProcess:return []


def stop(process):
    descendants=owned_children(process)
    if process.poll() is None:
        process.send_signal(signal.SIGTERM)
        try:process.wait(timeout=12)
        except subprocess.TimeoutExpired:
            descendants+=owned_children(process)
            process.kill();process.wait(timeout=5)
    remaining=[]
    for pid,started in set(descendants):
        try:
            child=psutil.Process(pid)
            if child.create_time()!=started:continue
            child.terminate()
            try:child.wait(timeout=3)
            except psutil.TimeoutExpired:child.kill();child.wait(timeout=3)
        except psutil.NoSuchProcess:pass
        except Exception:remaining.append(pid)
    return dict(gateway_pid=process.pid,gateway_reaped=process.poll() is not None,remaining_owned_children=remaining)


def run_case(code,python,root,evidence,name,patched,timeout=75,interrupt=False):
    home=root/name;home.mkdir()
    for child in ('runtime','tmp','config','data','cache'):(home/child).mkdir()
    hh=home/'.hermes';(hh/'scripts').mkdir(parents=True)
    config=dict(model=dict(default='fixture-model',provider='openai',base_url='http://127.0.0.1:1'),
                gateway=dict(multiplex_profiles=False),platforms={},
                cron=dict(catch_up_missed=True,require_restart_safe_scope=False),
                kanban=dict(dispatch_in_gateway=False),heartbeats=dict(enabled=False),
                update=dict(check_on_startup=False),terminal=dict(env_passthrough=[]))
    # JSON is valid YAML; all values are disposable fixture values.
    (hh/'config.yaml').write_text(json.dumps(config),encoding='utf-8')
    (hh/'gateway.json').write_text(json.dumps(dict(platforms={},multiplex_profiles=False)),encoding='utf-8')
    library=hh/'monitor-lib';library.mkdir()
    for filename in ('publication_monitor.py','rss_monitor.py'):
        shutil.copy2(Path(__file__).with_name(filename),library/filename)
    db=hh/'monitor.sqlite'
    with closing(sqlite3.connect(db)) as conn,conn:
        conn.executescript('CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE outbox(url TEXT PRIMARY KEY,guid TEXT,status TEXT NOT NULL);')
        conn.executemany('INSERT INTO meta VALUES(?,?)',[('mode','live'),('site','https://gcake119.github.io/gcake-dev/'),('initialized',str(time.time()-3600))])
    before=digest(db)
    capture=hh/'capture.json'
    script='''import contextlib,io,json,os,sys,time
from pathlib import Path
from datetime import datetime,timezone
home=Path(os.environ['HERMES_HOME'])
sys.path.insert(0,str(home/'monitor-lib'))
import publication_monitor as monitor
keys=['HERMES_CRON_JOB_ID','HERMES_CRON_EXECUTION_ID','HERMES_CRON_SCHEDULED_INSTANT']
record={'context':{k:os.environ.get(k) for k in keys},'started_at':datetime.now(timezone.utc).isoformat(),'pid':os.getpid(),'ppid':os.getppid()}
Path(home/'capture.json').write_text(json.dumps(record))
def observe(now):
    return dict(window=[now,now],summary=dict(schemaVersion=1,generatedAt=datetime.fromtimestamp(now,timezone.utc).isoformat(),gitRevision='fixture',queueVersion=0,complete=True,articles=[]),feed=[],pages={})
monitor.PublicationObserver=lambda *args:observe
os.environ['PUBLICATION_MONITOR_SUMMARY_URL']='https://fixture.invalid/api/v1/monitoring/publications'
os.environ['PUBLICATION_MONITOR_READ_SECRET']='fixture'
sys.argv=['monitor','--db',str(home/'monitor.sqlite')]
output=io.StringIO()
try:
    with contextlib.redirect_stdout(output):monitor.main()
    record['monitor_result']=json.loads(output.getvalue())
except Exception as exc:record['monitor_error']=type(exc).__name__
Path(home/'capture.json').write_text(json.dumps(record))
'''
    (hh/'scripts/verify.py').write_text(script,encoding='utf-8')
    env=environment(home,code,python)
    profile=sandbox(root)
    prefix=['/usr/bin/sandbox-exec','-p',profile,str(python)]
    boundary_code='''import socket,pathlib,json
checks={}
try:
 s=socket.socket();s.settimeout(1);s.connect(('1.1.1.1',443));checks['network_denied']=False
except PermissionError:checks['network_denied']=True
try:pathlib.Path('/Users/hermes/.hermes/.env').open('rb');checks['production_read_denied']=False
except PermissionError:checks['production_read_denied']=True
print(json.dumps(checks))
'''
    boundary=subprocess.run(prefix+['-c',boundary_code],cwd=code,env=env,capture_output=True,text=True,timeout=10)
    if boundary.returncode:raise RuntimeError('Sandbox preflight failed: '+boundary.stderr[:500])
    checks=json.loads(boundary.stdout)
    if not all(checks.values()):raise RuntimeError('Isolation boundary not enforced')
    creator='''from cron.jobs import create_job
from datetime import datetime,timezone,timedelta
import json
at=(datetime.now(timezone.utc)-timedelta(seconds=10)).isoformat()
job=create_job(None,at,name='isolated-context-verification',deliver='local',failure_deliver='local',script='verify.py',no_agent=True)
print(json.dumps({'job_id':job['id'],'scheduled_at':job['next_run_at']}))
'''
    created=subprocess.run(prefix+['-c',creator],cwd=code,env=env,capture_output=True,text=True,timeout=20)
    if created.returncode:raise RuntimeError('Test job creation failed: '+created.stderr[-1000:])
    job=json.loads(created.stdout.splitlines()[-1])
    result=dict(case=name,patched=patched,isolation=checks,job=job,success=False)
    process=None
    try:
        with (evidence/(name+'-gateway.log')).open('w',encoding='utf-8') as log:
            process=subprocess.Popen(prefix+['-m','gateway.run'],cwd=code,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
            deadline=time.monotonic()+timeout
            while time.monotonic()<deadline:
                if process.poll() is not None:raise RuntimeError('Gateway exited before test dispatch')
                state=hh/'gateway_state.json'
                status=json.loads(state.read_text()) if state.exists() else {}
                if interrupt and status.get('gateway_state')=='running':
                    raise KeyboardInterrupt('Intentional lifecycle interruption probe')
                if capture.exists():
                    record=json.loads(capture.read_text())
                    ledger=hh/'cron/executions.db'
                    if ledger.exists() and ('monitor_result' in record or 'monitor_error' in record):
                        with closing(sqlite3.connect(ledger.as_uri()+'?mode=ro',uri=True)) as conn:
                            conn.row_factory=sqlite3.Row
                            rows=[dict(r) for r in conn.execute('SELECT * FROM executions WHERE job_id=?',(job['job_id'],))]
                        terminal=[r for r in rows if r['status'] in ('completed','failed','succeeded','success')]
                        if terminal:
                            occurrence=terminal[-1]
                            expected=dict(HERMES_CRON_JOB_ID=job['job_id'],HERMES_CRON_EXECUTION_ID=occurrence['id'],HERMES_CRON_SCHEDULED_INSTANT=occurrence['scheduled_instant'])
                            result.update(runtime_status=status.get('gateway_state'),capture=record,
                                          ledger={k:occurrence.get(k) for k in ('id','job_id','scheduled_instant','status','source')},
                                          fixture_state_unchanged=digest(db)==before,
                                          dispatch_observed=True,metadata_matches=record['context']==expected)
                            query='from gateway.control_socket import identify_gateway; from pathlib import Path; import json,os; print(json.dumps(identify_gateway(Path(os.environ["HERMES_HOME"]))))'
                            answer=subprocess.run(prefix+['-c',query],cwd=code,env=env,capture_output=True,text=True,timeout=10)
                            identity=json.loads(answer.stdout) if answer.returncode==0 else None
                            result['control_socket_verified']=bool(identity and identity.get('pid')==process.pid and Path(identity.get('hermes_home','')).resolve()==hh.resolve())
                            result['success']=result['metadata_matches'] and record.get('monitor_result')=={'evaluated_messages':0,'mode':'dry-run'} and result['fixture_state_unchanged'] and status.get('gateway_state')=='running' and result['control_socket_verified']
                            return result
                time.sleep(.25)
            raise TimeoutError('Gateway dispatch verification timed out')
    except BaseException as error:
        result.update(error_type=type(error).__name__,error=str(error))
        if isinstance(error,KeyboardInterrupt):
            if not interrupt:raise
            result.update(interrupted=True,runtime_status='running',success=True)
        return result
    finally:
        if process is not None:
            result['cleanup']=stop(process)
            for filename in ('gateway_state.json','cron/jobs.json'):
                src=hh/filename
                if src.exists():shutil.copy2(src,evidence/(name+'-'+filename.replace('/','-')))
        (evidence/(name+'-result.json')).write_text(json.dumps(result,indent=2),encoding='utf-8')


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',type=Path,required=True)
    parser.add_argument('--python',type=Path,required=True)
    parser.add_argument('--evidence',type=Path,required=True)
    args=parser.parse_args()
    source=args.source.resolve();python=args.python.absolute();evidence=args.evidence.resolve()
    if not source.is_relative_to(Path('/private/tmp')) or not evidence.is_relative_to(Path('/private/tmp')):
        raise ValueError('Only isolated staging permitted')
    if digest(source/'cron/scheduler_script.py')!=SOURCE_SHA256:raise ValueError('Source hash mismatch')
    evidence.mkdir(parents=True,exist_ok=True)
    results=[]
    with tempfile.TemporaryDirectory(prefix='hermes-gateway-verify-',dir='/private/tmp') as owned:
        root=Path(owned);code=root/'source'
        shutil.copytree(source,code,ignore=shutil.ignore_patterns('.git','.env','.env.*','.venv','venv','node_modules','__pycache__'))
        kernel=code/'cron/scheduler_script.py';original=kernel.read_text(encoding='utf-8')
        for name,patched,interrupt in [('baseline',False,False),('patched-a',True,False),('patched-b',True,False),('interrupted',True,True),('timed-out',True,False)]:
            kernel.write_text(patch_source(original) if patched else original,encoding='utf-8')
            result=run_case(code,python,root,evidence,name,patched,interrupt=interrupt,timeout=.01 if name=='timed-out' else 75)
            results.append(result)
            print(json.dumps(dict(case=name,success=result['success'],dispatch=result.get('dispatch_observed'),error=result.get('error_type'))),flush=True)
            if name=='baseline' and not (result.get('dispatch_observed') and not result.get('metadata_matches')):break
            if patched and name!='timed-out' and not result['success']:break
    summary=dict(results=results,disposable_root_removed=not root.exists(),
                 success=len(results)==5 and results[0].get('dispatch_observed') and not results[0]['success'] and all(r['success'] for r in results[1:4]) and results[4].get('error_type')=='TimeoutError' and all(r['cleanup']['gateway_reaped'] and not r['cleanup']['remaining_owned_children'] for r in results),
                 production_telegram_connected=False,production_jobs_modified=False)
    (evidence/'gateway-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    if not summary['success']:raise SystemExit(1)


if __name__=='__main__':main()
