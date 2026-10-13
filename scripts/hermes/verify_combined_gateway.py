"""Hash-bound owner-run full Hermes, root/hermes, launchd and history drill.

No production service, credential, source or state is used. Root only controls
sealed data/service lifecycle; all candidate Python executes as hermes.
"""
from contextlib import closing
from datetime import datetime,timezone
import hashlib
import importlib
import json
import os
from pathlib import Path
import plistlib
import pwd
import re
import shutil
import signal
import sqlite3
import subprocess
import sys
import tempfile
import time
import uuid
import traceback

BASE=Path('/private/tmp/gcake-hermes-monitor-plan-20261012')
INPUTS=BASE/'combined-gateway-inputs'
SITE='https://gcake119.github.io/gcake-dev/'


def pinned_bytes(path, sha):
    fd=os.open(str(path),os.O_RDONLY|os.O_NOFOLLOW)
    with os.fdopen(fd,'rb') as stream:
        if os.fstat(stream.fileno()).st_mode&0o022:raise ValueError('writable-input')
        data=stream.read()
    if hashlib.sha256(data).hexdigest()!=sha:raise ValueError('input-digest-mismatch')
    return data


def snapshot(db, include_round=False):
    with closing(sqlite3.connect(db.as_uri()+'?mode=ro',uri=True)) as conn:
        meta=dict(conn.execute('SELECT key,value FROM meta'))
        if not include_round:meta.pop('monitor_last_round',None)
        rows=[list(r) for r in conn.execute('SELECT url,guid,status FROM outbox ORDER BY url')]
        events=[]
        if conn.execute("SELECT 1 FROM sqlite_master WHERE name='monitor_events'").fetchone():
            events=[list(r) for r in conn.execute('SELECT event_id,status FROM monitor_events ORDER BY event_id')]
        return dict(meta=meta,outbox=rows,events=events)


class NativeService:
    def runtime_probe(self):
        return 'from gateway.control_socket import identify_gateway;from pathlib import Path;import os,sys,json,pydantic_core,release_dependency;print(json.dumps(dict(uid=os.geteuid(),version=sys.version.split()[0],prefix=sys.prefix,executable=sys.executable,dependency=release_dependency.VERSION,identity=identify_gateway(Path(os.environ["HERMES_HOME"])))))'

    def __init__(self,store,label,user,api,guard):
        self.store=store;self.label=label;self.user=user;self.api=api;self.guard=guard
        self.home=store.root/'home';self.hh=self.home/'.hermes';self.db=self.home/'state/live.sqlite'
        self.job_id=guard.read(store.root/'job-context.json')['job_id']
        self.fail=set();self.rounds=[];self.stops=[]
        self.data_payload=store.verify_release(store.active()['digest'])
        self.base=api.LaunchdAdapter(store,label,store.root/'slots/gateway.plist',self.verify,self.drained)

    def run(self,payload,code,timeout=25):
        def drop():os.setgroups([]);os.setgid(self.user.pw_gid);os.setuid(self.user.pw_uid)
        root=self.store.root
        env=dict(PATH=str(payload/'runtime/bin')+':/usr/bin:/bin',HOME=str(self.home),HERMES_HOME=str(self.hh),
                 XDG_CONFIG_HOME=str(self.home/'config'),XDG_DATA_HOME=str(self.home/'data'),
                 XDG_CACHE_HOME=str(self.home/'cache'),XDG_RUNTIME_DIR=str(self.home/'runtime'),
                 TMPDIR=str(self.home/'tmp'),PYTHONDONTWRITEBYTECODE='1')
        result=subprocess.run(['/usr/bin/sandbox-exec','-f',str(root/'deny.sb'),
            str(payload/'runtime/bin/python3.11'),'-B','-c',code],cwd=payload/'code',env=env,
            preexec_fn=drop,capture_output=True,text=True,timeout=timeout)
        if result.returncode:raise RuntimeError('runner-command-failed:'+str(result.returncode)+':'+result.stderr[-700:])
        return result.stdout

    def counts(self):
        code='import sqlite3,json,os;from pathlib import Path;from contextlib import closing;p=Path(os.environ["HERMES_HOME"])/"cron/executions.db"\nrows=[]\nif p.exists():\n with closing(sqlite3.connect(p.as_uri()+"?mode=ro",uri=True)) as c:rows=c.execute("SELECT status,COUNT(*) FROM executions WHERE job_id=? GROUP BY status",('+repr(self.job_id)+',)).fetchall()\nprint(json.dumps(rows))'
        rows=json.loads(self.run(self.data_payload,code).splitlines()[-1])
        data=dict(rows);return data.get('completed',0),data.get('failed',0)

    def drained(self):
        code='import sqlite3,json,os;from pathlib import Path;from contextlib import closing;p=Path(os.environ["HERMES_HOME"])/"cron/executions.db"\ncount=0\nif p.exists():\n with closing(sqlite3.connect(p.as_uri()+"?mode=ro",uri=True)) as c:count=c.execute("SELECT COUNT(*) FROM executions WHERE status IN (\'running\',\'claimed\')").fetchone()[0]\nprint(json.dumps(count))'
        return json.loads(self.run(self.data_payload,code).splitlines()[-1])==0

    def snapshot(self,include_round=False):
        code='import json;from pathlib import Path;import sys;sys.path.insert(0,'+repr(str(self.store.root/'tools'))+');from verify_combined_gateway import snapshot;print(json.dumps(snapshot(Path('+repr(str(self.db))+'),include_round='+repr(include_round)+')))'
        return json.loads(self.run(self.data_payload,code).splitlines()[-1])

    def stop(self):
        ownership=self.store.root/'private/supervisor-ownership.json'
        output=self.base.query() or ''
        match=re.search(r'\bpid = ([1-9][0-9]*)',output)
        if match:
            pid=int(match.group(1));identity=self.api.process_identity(pid)
            if identity['uid']!=self.user.pw_uid:raise ValueError('foreign-supervisor-user')
            self.guard.atomic(ownership,dict(pid=pid,identity=identity))
        self.base.stop()
        if ownership.exists():
            record=self.guard.read(ownership);deadline=time.monotonic()+20
            while True:
                try:identity=self.api.process_identity(record['pid'])
                except ValueError:break
                if identity!=record['identity']:break
                if time.monotonic()>deadline:raise TimeoutError('owned-daemon-did-not-exit')
                time.sleep(.2)
            self.stops.append(dict(pid=record['pid'],exited=True));ownership.unlink()

    def prepare_round(self,payload):
        self.data_payload=payload
        print('combined: prepare scheduled round '+payload.name[:12],file=sys.stderr,flush=True)
        self.before_counts=self.counts();self.before_db=hashlib.sha256(self.db.read_bytes()).hexdigest()
        self.run(payload,'from cron.jobs import rearm_oneshot;from datetime import datetime,timezone,timedelta;rearm_oneshot('+repr(self.job_id)+',(datetime.now(timezone.utc)-timedelta(seconds=10)).isoformat())')

    def start(self,payload,mode):
        self.prepare_round(payload);self.base.start(payload,mode)

    def wait_round(self,payload,dry=True):
        deadline=time.monotonic()+100
        while time.monotonic()<deadline:
            completed,failed=self.counts()
            if failed>self.before_counts[1]:
                code='import json,sqlite3,os;from pathlib import Path;from contextlib import closing\nwith closing(sqlite3.connect((Path(os.environ["HERMES_HOME"])/"cron/executions.db").as_uri()+"?mode=ro",uri=True)) as c:r=c.execute("SELECT error FROM executions WHERE job_id=? AND status=\'failed\' ORDER BY claimed_at DESC LIMIT 1",('+repr(self.job_id)+',)).fetchone()\nprint(json.dumps(r))'
                error=json.loads(self.run(payload,code).splitlines()[-1])
                raise RuntimeError('real-wrapper-dispatch-failed:'+str(error)[:4000])
            if completed==self.before_counts[0]+1:break
            output=self.base.query() or ''
            if not re.search(r'\bpid = [1-9][0-9]*',output):
                if time.monotonic()+90<deadline:pass
                else:raise RuntimeError('full-gateway-process-absent')
            time.sleep(.3)
        else:raise TimeoutError('full-natural-dispatch-timeout')
        context=json.loads((self.hh/'context.json').read_text())
        code='import json,sqlite3,os;from pathlib import Path;from contextlib import closing\nwith closing(sqlite3.connect((Path(os.environ["HERMES_HOME"])/"cron/executions.db").as_uri()+"?mode=ro",uri=True)) as c:r=c.execute("SELECT job_id,scheduled_instant,status FROM executions WHERE id=?",('+repr(context['context']['HERMES_CRON_EXECUTION_ID'])+',)).fetchone()\nprint(json.dumps(r))'
        occurrence=json.loads(self.run(payload,code).splitlines()[-1])
        expected=dict(HERMES_CRON_JOB_ID=self.job_id,HERMES_CRON_EXECUTION_ID=context['context']['HERMES_CRON_EXECUTION_ID'],HERMES_CRON_SCHEDULED_INSTANT=occurrence[1])
        assert occurrence[0]==self.job_id and occurrence[2]=='completed' and context['context']==expected
        assert context['uid']==self.user.pw_uid and context['python']=='3.11.15' and context['prefix']==str(payload/'runtime')
        probe=self.runtime_probe()
        result=json.loads(self.run(payload,probe).splitlines()[-1])
        output=self.base.query() or '';pid=int(re.search(r'\bpid = ([1-9][0-9]*)',output).group(1))
        assert result['identity']['pid']==pid and result['identity']['hermes_home']==str(self.hh)
        assert result['uid']==self.user.pw_uid and result['version']=='3.11.15' and result['prefix']==str(payload/'runtime')
        assert Path(result['executable']).resolve()==(payload/'runtime/bin/python3.11').resolve()
        manifest=self.guard.read(self.store.root/'manifests'/(payload.name+'.json'))
        if 'dependency' in result:assert result['dependency']==manifest['release_id']
        unchanged=hashlib.sha256(self.db.read_bytes()).hexdigest()==self.before_db
        if dry:assert unchanged
        else:
            state=self.snapshot(include_round=True)
            assert float(state['meta']['monitor_last_round'])==datetime.fromisoformat(occurrence[1]).timestamp(),'persisted-round-does-not-match-occurrence'
        record=dict(pid=pid,uid=result['uid'],python=result['version'],prefix=result['prefix'],release_id=manifest['release_id'],
                    digest=payload.name,context_matches_occurrence=True,dry_run=dry,state_unchanged=unchanged)
        self.rounds.append(record)
        print('combined: verified '+manifest['release_id']+' uid='+str(result['uid'])+' dry='+str(dry),file=sys.stderr,flush=True)
        return record

    def verify(self,payload):
        record=self.wait_round(payload)
        if record['release_id'] in self.fail:raise RuntimeError('intentional-post-dispatch-verification-failure')

    def live_round(self):
        sha=self.store.active()['digest'];payload=self.store.verify_release(sha)
        self.store.select(sha,'live');self.store.gate('ready',sha,'live')
        requests=self.hh/'deliveries.jsonl';before=len(requests.read_text().splitlines()) if requests.exists() else 0
        self.prepare_round(payload);self.wait_round(payload,False)
        after=len(requests.read_text().splitlines()) if requests.exists() else 0
        return after-before


def make_home(store,user):
    home=store.root/'home';home.mkdir(mode=0o700)
    for name in ('config','data','cache','runtime','tmp','state','.hermes/scripts'):(home/name).mkdir(parents=True,exist_ok=True)
    hh=home/'.hermes'
    config=dict(model=dict(default='fixture-model',provider='openai',base_url='http://127.0.0.1:1'),platforms={},
        gateway=dict(multiplex_profiles=False),kanban=dict(dispatch_in_gateway=False),heartbeats=dict(enabled=False),
        cron=dict(catch_up_missed=True,require_restart_safe_scope=False),update=dict(check_on_startup=False),terminal=dict(env_passthrough=[]))
    (hh/'config.yaml').write_text(json.dumps(config));(hh/'gateway.json').write_text('{"platforms":{},"multiplex_profiles":false}')
    (home/'legacy.env').write_text('HERMES_RSS_NOTIFY_ENABLED=true\nTELEGRAM_BOT_TOKEN=0:TEST_ONLY\nTELEGRAM_CHAT_ID=0\n')
    (home/'summary.env').write_text('PUBLICATION_MONITOR_SUMMARY_URL=https://fixture.invalid/api/v1/monitoring/publications\nPUBLICATION_MONITOR_READ_SECRET=fixture-only\n')
    db=home/'state/live.sqlite';initialized=str(time.time()-7200)
    with closing(sqlite3.connect(db)) as conn,conn:
        conn.executescript('CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);CREATE TABLE outbox(url TEXT PRIMARY KEY,guid TEXT,status TEXT NOT NULL);')
        conn.executemany('INSERT INTO meta VALUES(?,?)',[('initialized',initialized),('mode','live'),('site',SITE),('failures','0'),('next_check','0')])
        conn.executemany('INSERT INTO outbox VALUES(?,?,?)',[(SITE+'posts/'+s+'/',SITE+'posts/'+s+'/',status) for s,status in [('sent','sent'),('uncertain','uncertain'),('baseline','baseline')]])
    observations=dict(site=SITE,published_at=datetime.fromtimestamp(time.time()-3600,timezone.utc).replace(microsecond=0).isoformat(),posts=[dict(slug=s) for s in ('sent','uncertain','baseline','new','lost')])
    (hh/'observations.json').write_text(json.dumps(observations))
    for path in (home,*home.rglob('*')):
        os.chown(path,user.pw_uid,user.pw_gid);path.chmod(0o700 if path.is_dir() else 0o600)
    return home,initialized


def fresh_recover(store,label,user,api,guard,managers):
    pid=os.fork()
    if pid==0:
        os.setsid()
        try:
            reopened=api.EntryStore(store.root);service=NativeService(reopened,label,user,api,guard)
            answer=api.UpdateEntry(reopened,service).recover()
            guard.atomic(store.root/'private/fresh-result.json',dict(result=answer,rounds=service.rounds,stops=service.stops))
            os._exit(0 if answer['status']=='rolled_back' else 3)
        except BaseException as error:
            guard.atomic(store.root/'private/fresh-error.json',dict(type=type(error).__name__,error=str(error)));os._exit(4)
    managers.append(pid);status=os.waitpid(pid,0)[1];managers.remove(pid)
    if status!=0:raise RuntimeError('fresh-full-gateway-recovery-failed')
    return guard.read(store.root/'private/fresh-result.json')


def main(inventory_sha):
    if os.geteuid()!=0 or sys.platform!='darwin':raise PermissionError('owner-root-macos-required')
    if INPUTS.resolve()!=INPUTS:raise ValueError('redirected-inputs')
    inventory=json.loads(pinned_bytes(INPUTS/'inventory.json',inventory_sha))
    if inventory.get('schema')!=1 or inventory.get('path')!=str(INPUTS):raise ValueError('invalid-input-inventory')
    if shutil.disk_usage('/private/tmp').free<4*1024**3:raise ValueError('disk-budget')
    user=pwd.getpwnam('hermes');os.umask(0o022)
    owner=Path(tempfile.mkdtemp(prefix='gcake-entry-combined-',dir='/private/tmp'));owner.chmod(0o755)
    root=owner/'authority';service=None;managers=[]
    report=dict(schema=1,test_kind='combined-real-root-hermes-launchd-full-hermes',
        production_operations=False,production_credentials_read=False,telegram_connections=False,account_changes=False,
        tcp_used=False,checks={},rounds=[],recoveries=[])
    try:
        tools=owner/'tools';tools.mkdir(mode=0o755)
        expected={'update_entry.py','updater_guard.py','monitor_wrapper.py','verify_combined_gateway.py'}
        if set(inventory['modules'])!=expected:raise ValueError('module-inventory-mismatch')
        for name,sha in inventory['modules'].items():
            path=tools/name;path.write_bytes(pinned_bytes(Path(__file__).with_name(name),sha));path.chmod(0o644)
        sys.path.insert(0,str(tools));api=importlib.import_module('update_entry');guard=importlib.import_module('updater_guard')
        store=api.EntryStore.initialize(root,user.pw_uid)
        shutil.copytree(tools,root/'tools')
        lock=root/'maintenance.lock';lock.chmod(0o600)
        subprocess.run(['/bin/chmod','+a','user:hermes allow read',str(lock)],check=True,capture_output=True,timeout=5)
        (root/'deny.sb').write_text(api.runner_profile(root,unix_ipc=True))
        (root/'launcher.py').write_text('import sys\nfrom pathlib import Path\nroot=Path(__file__).parent\nsys.path.insert(0,str(root/"tools"))\nfrom update_entry import EntryStore,launch_gateway\nlaunch_gateway(EntryStore(root))\n')
        for name in ('old','new','bad'):
            bundle=INPUTS/name;manifest=guard.read(bundle/'manifest.json')
            if guard.digest(manifest)!=inventory['bundles'][name] or manifest['python_version']!='3.11.15':raise ValueError('bundle-identity-mismatch')
            guard.check_payload(bundle/'payload',manifest);store.approve(manifest,inventory['bundles'][name])
        oldsha=store.bootstrap(INPUTS/'old');home,initialized=make_home(store,user)
        label='local.gcake.hermes-test.'+uuid.uuid4().hex
        for name in api.SLOTS:(root/'slots'/name).write_text('original-'+name)
        daemon_plist=api.render_plist(store,label)
        (root/'slots/gateway.plist').write_bytes(plistlib.dumps(daemon_plist))
        # This protected slot is the actual cron wrapper entry, not an unused placeholder.
        dispatcher='import sys\nfrom pathlib import Path\nroot=Path(__file__).parent.parent\nsys.path.insert(0,str(root/"tools"))\nfrom update_entry import EntryStore\nfrom updater_guard import read\ns=EntryStore(root)\nraise SystemExit(s.monitor(job_id=read(root/"job-context.json")["job_id"],legacy_env=root/"home/legacy.env",summary_env=root/"home/summary.env",db=root/"home/state/live.sqlite"))\n'
        (root/'slots/wrapper').write_text(dispatcher)
        shell=home/'.hermes/scripts/monitor.sh'
        import shlex
        shell.write_text('#!/bin/bash\nset -euo pipefail\nexec /usr/bin/python3 -I -B -S '+shlex.quote(str(root/'slots/wrapper'))+'\n')
        os.chown(shell,user.pw_uid,user.pw_gid);shell.chmod(0o700)
        # Creation also runs as hermes, using the sealed native runtime.
        api.write_public(root/'job-context.json',{'job_id':'pending'})
        service=NativeService(store,label,user,api,guard)
        create='from cron.jobs import create_job;from datetime import datetime,timezone,timedelta;import json;print(json.dumps(create_job(None,(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat(),script="monitor.sh",no_agent=True,deliver="local",failure_deliver="local")["id"]))'
        job_id=json.loads(service.run(store.verify_release(oldsha),create).splitlines()[-1])
        api.write_public(root/'job-context.json',dict(job_id=job_id));service.job_id=job_id
        controller=api.UpdateEntry(store,service)
        with store.maintenance():service.start(store.verify_release(oldsha),'dry-run');service.verify(store.verify_release(oldsha))
        store.gate('ready',oldsha);report['checks']['initial_dry_dispatch']=True
        counts=[service.live_round()];assert counts==[2]
        preserved=service.snapshot()
        result=controller.update(INPUTS/'new');assert result['status']=='updated'
        counts.append(service.live_round());current=service.snapshot()
        report['checks']['update_replay']=dict(delivery_requests=counts[-1],history_unchanged=current==preserved)
        assert counts[-1]==0,'update-replay-sent:'+str(counts[-1])
        assert current==preserved,'update-replay-history-changed:'+json.dumps(dict(before=preserved,after=current))
        # Fail after real candidate dispatch, restore the complete native prior release.
        service.fail={'bad'};result=controller.update(INPUTS/'bad');assert result['status']=='rolled_back';service.fail=set()
        assert service.snapshot()==preserved
        report['checks']['failed_candidate_recovered']=True
        for phase in ('stopped','selected','verified'):
            pid=os.fork()
            if pid==0:
                os.setsid()
                controller.update(INPUTS/'bad',replacements={'wrapper':dispatcher.encode()},failpoint=lambda p:os.kill(os.getpid(),signal.SIGKILL) if p==phase else None)
                os._exit(2)
            managers.append(pid);status=os.waitpid(pid,0)[1];managers.remove(pid)
            if not os.WIFSIGNALED(status) or os.WTERMSIG(status)!=signal.SIGKILL:raise RuntimeError('missing-full-controller-kill')
            recovered=fresh_recover(store,label,user,api,guard,managers)
            assert service.snapshot()==preserved
            report['recoveries'].append(dict(phase=phase,**recovered))
        counts.append(service.live_round());assert counts[-1]==0
        observations=home/'.hermes/observations.json';data=json.loads(observations.read_text());data['posts'].append(dict(slug='after-rollback'));observations.write_text(json.dumps(data))
        counts.append(service.live_round());assert counts[-1]==1
        counts.append(service.live_round());assert counts[-1]==0
        current=service.snapshot();assert current['meta']['initialized']==initialized
        statuses={r[0]:r[2] for r in current['outbox']}
        assert statuses[SITE+'posts/new/']=='sent' and statuses[SITE+'posts/lost/']=='uncertain'
        assert ['article:'+SITE+'posts/lost/','unknown'] in current['events']
        report['checks'].update(delivery_request_counts=counts,old_state_preserved=True,unknown_not_replayed=True,new_article_once=True)
        service.fail={'bad','new'};result=controller.update(INPUTS/'bad');assert result['status']=='recovery_failed'
        assert service.base.query() is None and controller.update(INPUTS/'bad')['status']=='blocked'
        assert service.snapshot()==current
        report['checks']['recovery_failure_stops_sender']=True
        report['rounds']=service.rounds;report['state']=current;report['passed']=True
    except BaseException as error:
        report.update(passed=False,error_type=type(error).__name__,error=str(error)[:1000])
        report['traceback']=traceback.format_exc()[-6000:]
        if root.exists():
            for name in ('private/journal.json','private/fresh-error.json'):
                path=root/name
                if path.exists():
                    try:report[name]=json.loads(path.read_text())
                    except Exception:pass
            if service is not None:report['rounds']=service.rounds
    finally:
        errors=[]
        for pid in managers:
            try:
                if os.waitpid(pid,os.WNOHANG)[0]==0:
                    if os.getpgid(pid)==pid:os.killpg(pid,signal.SIGKILL)
                    else:os.kill(pid,signal.SIGKILL)
                    os.waitpid(pid,0)
            except ChildProcessError:pass
            except BaseException as error:errors.append(type(error).__name__)
        if service is not None:
            try:service.stop();report['daemon_stops']=service.stops
            except BaseException as error:errors.append(type(error).__name__)
        if not errors:
            try:shutil.rmtree(owner)
            except BaseException as error:errors.append(type(error).__name__)
        report['cleanup']=dict(test_service_removed=not errors,owned_root_removed=not owner.exists(),errors=errors)
        if errors:report.update(passed=False,retained_owned_root=str(owner),retained_test_label=service.label if service else None)
        print(json.dumps(report,indent=2))
    return 0 if report.get('passed') and not report['cleanup']['errors'] else 1


if __name__=='__main__':raise SystemExit('Use the prepared hash-bound owner command')
