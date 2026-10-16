"""Owner controls for the authorized fixed Hermes rollout.

Bootstrap copies only hash-pinned tools before importing them as root. Native
Hermes operations execute only as the existing hermes principal. Diagnostics
are projected; runner stderr and backups remain root-private.
"""
import contextlib
import hashlib
import json
import os
from pathlib import Path
import plistlib
import pwd
import re
import shutil
import signal
import sqlite3
import stat
import subprocess
import sys
import tempfile
import time
import uuid

BASE=Path('/private/tmp/gcake-hermes-monitor-plan-20261012')
INPUTS=BASE/'production-rollout-inputs'
ROOT=Path('/usr/local/share/gcake-hermes-runtime')
HOME=Path('/Users/hermes')
HH=HOME/'.hermes'
DB=HOME/'.local/state/gcake-rss/live.sqlite'
ENV=HOME/'.config/gcake-rss/publication-monitor.env'
PRIVATE_ENV=Path('/private/tmp/gcake-hermes-monitor-private-20261013/publication-monitor.env')
PLIST=Path('/Library/LaunchDaemons/ai.hermes.gateway.boot.plist')
LABEL='system/ai.hermes.gateway.boot'
JOB_ID='550aaf17723d'
URL='https://gcake-admin-worker-production.wwhowbuhow.workers.dev/api/v1/monitoring/publications'
ORIGINALS={
    HOME/'.hermes/hermes-agent/cron/scheduler.py':'f59d641fcc5182a83275da4b45340dd6d7d96f3ab7af6cecf801376def6cc426',
    HOME/'.hermes/hermes-agent/cron/scheduler_script.py':'dfc96fea523334f1cc972be6e84336c3e69e3ebe1307a3a9215b3afe97928f99',
    HOME/'.hermes/scripts/gcake-rss-live.sh':'f3d1868862188c77ccc6c6f8bfb20c14ac9d2fd6354072943194e0bc11c60e46',
    HOME/'.local/lib/gcake-rss/rss_monitor.py':'f4b1e2dd88e53674e30abbd73b7a8ba7874246f74c20b46a9a6745e4a30ee7ac',
    PLIST:'b9d3da9f92783db78c67f78d715b0eb75725ca61da9fddc5548b6966dbc5e5a9',
    Path('/usr/local/libexec/hermes-auto-update'):'3c105601fcf75c291a09019a4d8c6a9c9a63bf51f4a4bb7d5192b61be3217443',
    Path('/usr/local/libexec/hermes-auto-update-lib'):'03415b9e475864dd6b6ec5b0d4f489c503bd67e5b6aa8a52bdc13f4b34a26827',
    Path('/Library/LaunchDaemons/ai.hermes.auto-update.plist'):'a2a0bc4defecb53cb4ae68706f4230baa8773d1143db147cdb4bddb9ba6dca00',
}


def bytes_checked(path,expected):
    fd=os.open(str(path),os.O_RDONLY|os.O_NOFOLLOW)
    with os.fdopen(fd,'rb') as stream:
        info=os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_mode&0o022:raise ValueError('unsafe-control-input')
        data=stream.read()
    if hashlib.sha256(data).hexdigest()!=expected:raise ValueError('control-input-drift')
    return data


def modules():
    import production_entry as entry
    import production_install as installation
    import updater_guard as guard
    import update_entry as common
    return entry,installation,guard,common


@contextlib.contextmanager
def updater_exclusion():
    lock=Path('/var/run/ai.hermes.auto-update.lock')
    lock.mkdir(mode=0o700)
    nonce=uuid.uuid4().hex
    record=lock/'gcake-owner.json'
    record.write_text(json.dumps(dict(pid=os.getpid(),nonce=nonce)))
    try:yield
    finally:
        if record.exists() and json.loads(record.read_text())==dict(pid=os.getpid(),nonce=nonce):
            record.unlink();lock.rmdir()


class Actor:
    def __init__(self,store):
        self.store=store;self.user=pwd.getpwnam('hermes')
        self.selected=store.verify_release(store.active()['digest'])
    def run(self,payload,code,timeout=30):
        def drop():os.initgroups(self.user.pw_name,self.user.pw_gid);os.setgid(self.user.pw_gid);os.setuid(self.user.pw_uid)
        env=dict(PATH=str(payload/'runtime/bin')+':/usr/bin:/bin',HOME=str(HOME),HERMES_HOME=str(HH),
                 PYTHONDONTWRITEBYTECODE='1',PYTHONNOUSERSITE='1')
        code='import sys;sys.path.insert(0,'+repr(str(payload/'code'))+')\n'+code
        result=subprocess.run([str(payload/'runtime/bin/python3.11'),'-I','-B','-c',code],
                              cwd=payload/'code',env=env,preexec_fn=drop,capture_output=True,text=True,timeout=timeout)
        if result.returncode:
            path=ROOT/'private/runner-last-error.log';path.write_text(result.stderr[-8000:]);path.chmod(0o600)
            raise RuntimeError('runner-command-failed:'+str(result.returncode))
        return json.loads(result.stdout.splitlines()[-1])
    def payload(self):return self.selected
    def job(self):
        code='import json;from pathlib import Path\ndef records(v):\n if isinstance(v,dict):\n  if v.get("id")=='+repr(JOB_ID)+':yield v\n  for x in v.values():yield from records(x)\n elif isinstance(v,list):\n  for x in v:yield from records(x)\nrows=list(records(json.loads(Path('+repr(str(HH/'cron/jobs.json'))+').read_text())))\nassert len(rows)==1\nr=rows[0]\nprint(json.dumps({k:r.get(k) for k in ("id","enabled","no_agent","schedule","script","next_run_at","name","deliver","failure_deliver")}))'
        return self.run(self.payload(),code)
    def ledger(self):
        code='import sqlite3,json;from pathlib import Path;from contextlib import closing\np=Path('+repr(str(HH/'cron/executions.db'))+')\nwith closing(sqlite3.connect(p.as_uri()+"?mode=ro",uri=True)) as c:\n rows=c.execute("SELECT id,job_id,scheduled_instant,status FROM executions WHERE job_id=? ORDER BY claimed_at DESC LIMIT 8",('+repr(JOB_ID)+',)).fetchall()\nprint(json.dumps(rows))'
        return self.run(self.payload(),code)
    def drained(self):
        code='import sqlite3,json;from pathlib import Path;from contextlib import closing\np=Path('+repr(str(HH/'cron/executions.db'))+')\nwith closing(sqlite3.connect(p.as_uri()+"?mode=ro",uri=True)) as c:n=c.execute("SELECT COUNT(*) FROM executions WHERE status IN (\'running\',\'claimed\')").fetchone()[0]\nprint(json.dumps(n))'
        return self.run(self.payload(),code)==0
    def summary(self,config=ENV):
        if config not in (ENV,ROOT/'runner-preflight.env'):raise ValueError('fixed-summary-config-required')
        code='import json,time,sys;from pathlib import Path\nsys.path.insert(0,'+repr(str(self.payload()/'library'))+')\nfrom publication_monitor import PublicationObserver,summary_articles\npairs=dict(line.split("=",1) for line in Path('+repr(str(config))+').read_text().splitlines() if line)\nassert pairs["PUBLICATION_MONITOR_SUMMARY_URL"]=='+repr(URL)+'\no=PublicationObserver(pairs["PUBLICATION_MONITOR_SUMMARY_URL"],pairs["PUBLICATION_MONITOR_READ_SECRET"])(time.time())\nrows=summary_articles(o)\nprint(json.dumps(dict(complete=True,articles=len(rows))))'
        return self.run(self.payload(),code,timeout=180)


class Supervisor:
    def __init__(self,store,original,actor):
        self.store=store;self.original=original;self.actor=actor
        self.entry,self.installation,self.guard,self.common=modules()
        self.expected=self.entry.render_gateway_plist(original)
        self.round=None
        self.capture_first=False
    def command(self,*args):return subprocess.run(['/bin/launchctl',*args],capture_output=True,text=True,timeout=20)
    def query(self):
        result=self.command('print',LABEL)
        if result.returncode==0:return result.stdout
        if 'Could not find service' in result.stderr:return None
        raise RuntimeError('formal-supervisor-query-failed')
    def pid(self):
        match=re.search(r'\bpid = ([1-9][0-9]*)',self.query() or '')
        return int(match.group(1)) if match else None
    def drained(self):return self.actor.drained()
    def stop(self):
        path=ROOT/'private/formal-supervisor-ownership.json'
        pid=self.pid()
        if pid:
            identity=self.common.process_identity(pid)
            if identity['uid']!=self.store.runner_uid:raise ValueError('foreign-gateway-principal')
            self.guard.atomic(path,dict(pid=pid,identity=identity))
        if self.query() is not None:
            result=self.command('bootout',LABEL)
            if result.returncode:raise RuntimeError('formal-bootout-failed')
        if path.exists():
            record=self.guard.read(path);deadline=time.monotonic()+60
            while time.monotonic()<deadline:
                try:identity=self.common.process_identity(record['pid'])
                except ValueError:break
                if identity!=record['identity']:break
                time.sleep(.2)
            else:raise TimeoutError('formal-owned-pid-did-not-exit')
            path.unlink()
        if self.capture_first:
            self.capture_first=False
            capture_original_runtime(self.store,self.actor)
    def bootstrap(self):
        if self.query() is not None:raise ValueError('duplicate-formal-supervisor')
        result=self.command('bootstrap','system',str(PLIST))
        if result.returncode:raise RuntimeError('formal-bootstrap-failed')
    def start_original(self):self.bootstrap()
    def verify_original(self):
        for path,sha in ORIGINALS.items():bytes_checked(path,sha)
        deadline=time.monotonic()+45
        while time.monotonic()<deadline:
            pid=self.pid()
            if pid:
                result=subprocess.run(['/bin/ps','-p',str(pid),'-o','comm='],capture_output=True,text=True,timeout=10)
                if result.stdout.strip()==str(HOME/'.hermes/hermes-agent/venv/bin/python'):
                    code='from gateway.control_socket import identify_gateway;import json;from pathlib import Path;print(json.dumps(identify_gateway(Path('+repr(str(HH))+'))))'
                    identity=self.actor.run(self.actor.payload(),code)
                    if identity['pid']==pid and identity['hermes_home']==str(HH):return
            time.sleep(1)
        raise RuntimeError('original-gateway-not-verified')
    def start_managed(self):
        converted=subprocess.run(['/usr/bin/plutil','-convert','json','-o','-',str(PLIST)],capture_output=True,text=True,timeout=10,check=True)
        if json.loads(converted.stdout)!=self.expected:raise ValueError('managed-formal-mapping-drift')
        self.before={r[0] for r in self.actor.ledger()};self.before_db=hashlib.sha256(DB.read_bytes()).hexdigest()
        self.store.gate('verifying',self.store.active()['digest']);self.bootstrap()
    def verify_managed(self):
        deadline=time.monotonic()+3900;progress=0
        while time.monotonic()<deadline:
            pid=self.pid()
            if not pid and time.monotonic()+3850<deadline:pass
            elif not pid:raise RuntimeError('managed-gateway-absent')
            if time.monotonic()>progress:
                print('owner: waiting for natural existing-job dry-run',file=sys.stderr,flush=True);progress=time.monotonic()+30
            rows=self.actor.ledger()
            if any(r[0] not in self.before and r[3]=='failed' for r in rows):raise RuntimeError('managed-natural-job-failed')
            receipt=HOME/'.local/state/gcake-rss/managed-last-run.json'
            if receipt.exists():
                data=json.loads(receipt.read_text());execution=data.get('execution_id')
                if execution not in self.before and data.get('digest')==self.store.active()['digest']:
                    matches=[r for r in rows if r[0]==execution]
                    if matches and matches[0][3]=='failed':raise RuntimeError('managed-natural-job-failed')
                    if matches and matches[0][3]=='completed':
                        assert data['job_id']==JOB_ID and data['scheduled_instant']==matches[0][2]
                        assert data['uid']==self.store.runner_uid and data['mode']=='dry-run' and data['exit_code']==0
                        assert hashlib.sha256(DB.read_bytes()).hexdigest()==self.before_db,'dry-state-changed'
                        self.round=data;break
            time.sleep(5)
        else:raise TimeoutError('natural-existing-job-not-qualified')
        payload=self.actor.payload()
        probe='from gateway.control_socket import identify_gateway;import json,os,sys,pydantic_core;from pathlib import Path;print(json.dumps(dict(uid=os.geteuid(),version=sys.version.split()[0],prefix=sys.prefix,identity=identify_gateway(Path('+repr(str(HH))+')))))'
        result=self.actor.run(payload,probe)
        assert result['uid']==self.store.runner_uid and result['version']=='3.11.15' and result['prefix']==str(payload/'runtime')
        assert result['identity']['pid']==self.pid() and result['identity']['hermes_home']==str(HH)
        self.verify_telegram_health(payload)
        inventory=subprocess.run(['/bin/ps','-axo','pid=,uid=,args='],capture_output=True,text=True,timeout=10,check=True)
        pids=[]
        for line in inventory.stdout.splitlines():
            parts=line.split(None,2)
            if len(parts)==3 and parts[1]==str(self.store.runner_uid) and 'hermes_cli.main' in parts[2] and re.search(r'\bgateway\s+run\b',parts[2]):pids.append(int(parts[0]))
        assert pids==[self.pid()],'non-single-formal-gateway'
        assert self.actor.summary()['complete'] is True
        self.store.gate('ready',payload.name)

    def start(self,payload,mode):
        if mode!='dry-run':raise ValueError('dry-verification-required')
        if payload!=self.store.verify_release(self.store.active()['digest']):raise ValueError('selection-drift')
        self.actor.selected=payload;self.start_managed()

    def verify(self,payload):self.verify_managed()

    def verify_telegram_health(self,payload):
        from telegram_health import check_current
        code='from gateway.control_socket import identify_gateway,query_gateway_control;from pathlib import Path;import json;h=Path('+repr(str(HH))+');print(json.dumps(dict(identity=identify_gateway(h),status=query_gateway_control(h,"status"))))'
        result=self.actor.run(payload,code)
        return check_current(result['identity'],result['status'],pid=self.pid(),home=str(HH),now=time.time())


def source_size(path):
    return sum(p.lstat().st_size for p in path.rglob('*') if p.is_file() and not p.is_symlink())


def original_native_probe(user):
    original=HOME/'.hermes/hermes-agent'
    def drop():os.initgroups(user.pw_name,user.pw_gid);os.setgid(user.pw_gid);os.setuid(user.pw_uid)
    result=subprocess.run([str(original/'venv/bin/python'),'-I','-B','-S','-c',
        'import sys,os,json;print(json.dumps(dict(version=sys.version.split()[0],base_prefix=sys.base_prefix,euid=os.geteuid())))'],
        env=dict(PATH='/usr/bin:/bin',HOME=str(HOME)),preexec_fn=drop,capture_output=True,text=True,timeout=20,check=True)
    native=json.loads(result.stdout);base=Path(native['base_prefix'])
    if native['version']!='3.11.15':raise ValueError('original-interpreter-version-drift')
    if native['euid']!=user.pw_uid:raise ValueError('original-interpreter-user-drift')
    parent=HOME/'.local/share/uv/python'
    reviewed=parent/'cpython-3.11.15-macos-aarch64-none'
    alias=parent/'cpython-3.11-macos-aarch64-none'
    resolved=base.resolve(strict=True)
    if not ((base==original/'venv' and resolved==base) or
            (base in (reviewed,alias) and resolved==reviewed)):
        raise ValueError('unreviewed-original-base-runtime')
    # The reviewed alias may be relative or absolute; no other path alias is accepted.
    for path in [resolved]+list(resolved.parents):
        if path==HOME.parent:break
        info=path.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid not in (0,user.pw_uid) or info.st_mode&0o022:
            raise ValueError('unsafe-original-base-runtime')
    native['base_prefix_resolved']=str(resolved)
    native['base_alias']=None
    if base!=resolved:
        info=base.lstat()
        if not stat.S_ISLNK(info.st_mode) or info.st_uid!=user.pw_uid:
            raise ValueError('unsafe-original-base-alias')
        native['base_alias']=dict(path=str(base),target=os.readlink(base),uid=info.st_uid,gid=info.st_gid)
    return native


def backup_original_base(native,folder,user):
    base=Path(native['base_prefix_resolved'])
    subprocess.run(['/usr/bin/ditto','--rsrc','--extattr',str(base),str(folder/'python-base')],check=True,capture_output=True,timeout=600)
    if native['base_alias']:
        saved=folder/'python-base.alias'
        os.symlink(native['base_alias']['target'],saved)
        os.lchown(saved,native['base_alias']['uid'],native['base_alias']['gid'])
    if original_native_probe(user)!=native:raise ValueError('original-base-changed-during-backup')


def capture_original_runtime(store,actor):
    """Runs only after the original supervisor stopped; never rewinds live state."""
    entry,installation,guard,common=modules()
    folder=ROOT/'private/first-runtime'
    if folder.exists():raise ValueError('first-runtime-backup-already-present')
    folder.mkdir(mode=0o700)
    print('owner: backing up original source/runtime and consistent state',file=sys.stderr,flush=True)
    original=HOME/'.hermes/hermes-agent'
    native=original_native_probe(actor.user)
    base=Path(native['base_prefix_resolved'])
    if base!=original/'venv':
        if source_size(base)+source_size(original)>3*1024**3:raise ValueError('original-runtime-budget')
        backup_original_base(native,folder,actor.user)
    subprocess.run(['/usr/bin/ditto','--rsrc','--extattr',str(original),str(folder/'hermes-agent')],check=True,capture_output=True,timeout=600)
    for path,sha in ORIGINALS.items():
        if str(path).startswith(str(original)+'/'):
            copied=folder/'hermes-agent'/path.relative_to(original)
            bytes_checked(copied,sha)
    # Preserve immutable original system inputs beyond the replaced slots.
    for key,path in [('updater-lib',Path('/usr/local/libexec/hermes-auto-update-lib')),
                     ('updater.plist',Path('/Library/LaunchDaemons/ai.hermes.auto-update.plist')),
                     ('rss_monitor.py',HOME/'.local/lib/gcake-rss/rss_monitor.py')]:
        common.copy_preserved(path,folder/key)
    staging=HOME/'.local/state/gcake-rss'/('.gcake-backup-'+uuid.uuid4().hex)
    staging.mkdir(mode=0o700);os.chown(staging,actor.user.pw_uid,actor.user.pw_gid)
    code='import sqlite3,json,shutil;from pathlib import Path;from contextlib import closing\nbase=Path('+repr(str(staging))+')\nfor name,src in '+repr([('live.sqlite',str(DB)),('executions.db',str(HH/'cron/executions.db'))])+':\n with closing(sqlite3.connect(Path(src).as_uri()+"?mode=ro",uri=True)) as original,closing(sqlite3.connect(base/name)) as copied:original.backup(copied)\nfor name,src in '+repr([('jobs.json',str(HH/'cron/jobs.json')),('config.yaml',str(HH/'config.yaml')),('gateway.json',str(HH/'gateway.json'))])+':\n p=Path(src)\n if p.exists():shutil.copy2(p,base/name)\nprint(json.dumps(dict(consistent_sqlite_backups=True)))'
    try:
        assert actor.run(actor.payload(),code)['consistent_sqlite_backups']
        staging.rename(folder/'state-reconciliation')
    finally:
        if staging.exists():shutil.rmtree(staging)
    guard.atomic(ROOT/'private/first-runtime-backup.json',dict(
        complete=True,original_absolute_path=str(original),source_copy=str(folder/'hermes-agent'),
        original_path_preserved=True,original_base_prefix=native['base_prefix'],
        original_base_resolved=str(base),original_base_alias=native['base_alias'],
        state_backup_for_reconciliation_only=True))


def snapshot_baseline():
    for path,sha in ORIGINALS.items():bytes_checked(path,sha)
    converted=subprocess.run(['/usr/bin/plutil','-convert','json','-o','-',str(PLIST)],capture_output=True,text=True,timeout=10,check=True)
    return json.loads(converted.stdout)


def build_plan(store,original,env_bytes):
    entry,installation,guard,common=modules()
    pairs=dict(line.split('=',1) for line in env_bytes.decode().splitlines())
    if set(pairs)!={'PUBLICATION_MONITOR_SUMMARY_URL','PUBLICATION_MONITOR_READ_SECRET'} or pairs['PUBLICATION_MONITOR_SUMMARY_URL']!=URL or not re.fullmatch(r'[A-Za-z0-9_-]{64}',pairs['PUBLICATION_MONITOR_READ_SECRET']):
        raise ValueError('restricted-private-configuration-invalid')
    prefix='#!/bin/bash\nset -euo pipefail\nexec /usr/bin/python3 -I -B -S '
    launcher=prefix+str(ROOT/'tools/gateway_bootstrap.py')+'\n'
    updater=prefix+str(ROOT/'tools/management_bootstrap.py')+' update\n'
    wrapper=prefix+str(ROOT/'tools/monitor_bootstrap.py')+'\n'
    return dict(updater=updater.encode(),launcher=launcher.encode(),wrapper=wrapper.encode(),
                gateway=plistlib.dumps(entry.render_gateway_plist(original)),summary_env=env_bytes)


def validate_existing_job(actor):
    job=actor.job()
    schedule=job['schedule']
    if job['id']!=JOB_ID or job['enabled'] is not True or job['no_agent'] is not True or not isinstance(schedule,dict) or schedule.get('kind')!='interval' or schedule.get('minutes')!=60:
        raise ValueError('existing-monitor-job-drift')
    if job['script'] not in ('gcake-rss-live.sh',str(HH/'scripts/gcake-rss-live.sh')):
        raise ValueError('existing-wrapper-path-drift')
    return job


def owner_main(control_sha):
    if os.geteuid()!=0 or sys.platform!='darwin':raise PermissionError('root-macos-owner-required')
    control=json.loads(bytes_checked(INPUTS/'controls.json',control_sha))
    if control['schema']!=1 or not re.fullmatch(r'[0-9a-f]{64}',control['bundle_digest']):
        raise ValueError('approved-production-identity-required')
    report=dict(production_operations=False,job_modified=False,telegram_test_messages=False,commit_push=False)
    user=pwd.getpwnam('hermes');store=None;service=None
    if user.pw_uid!=502:raise ValueError('principal-baseline-drift')
    try:
        with updater_exclusion(),tempfile.TemporaryDirectory(prefix='gcake-production-tools-',dir='/private/tmp') as temporary:
            tools=Path(temporary);tools.chmod(0o755)
            required={'production_entry.py','production_install.py','production_owner.py','production_monitor_dispatch.py','updater_guard.py','monitor_wrapper.py','update_entry.py','packaging_contract.py','telegram_health.py'}
            if set(control['modules'])!=required:raise ValueError('fixed-control-modules-required')
            for name,sha in control['modules'].items():
                if not re.fullmatch(r'[a-z_]+\.py',name):raise ValueError('invalid-tool-identity')
                path=tools/name;path.write_bytes(bytes_checked(Path(__file__).with_name(name),sha));path.chmod(0o644)
            sys.path.insert(0,str(tools))
            entry,installation,guard,common=modules()
            original=snapshot_baseline();entry.render_gateway_plist(original)
            if ROOT.exists():raise ValueError('production-authority-already-present-use-recorded-recovery')
            bytes_needed=source_size(HOME/'.hermes/hermes-agent')+source_size(INPUTS/'bundle/payload')
            native=original_native_probe(user)
            base=Path(native['base_prefix_resolved'])
            if base!=HOME/'.hermes/hermes-agent/venv':bytes_needed+=source_size(base)
            if bytes_needed>3*1024**3 or shutil.disk_usage('/usr/local/share').free<4*1024**3+bytes_needed:
                raise ValueError('first-install-disk-budget')
            env_bytes=bytes_checked(PRIVATE_ENV,control['private_env_sha256'])
            store=entry.ProductionStore.initialize()
            guard.atomic(ROOT/'private/bootstrap-preparation.json',dict(schema=1,control_sha=control_sha,bundle_digest=control['bundle_digest'],phase='preparing'))
            shutil.copytree(tools,ROOT/'tools')
            for name,function in [('gateway','from production_entry import launch_gateway\nlaunch_gateway()'),
                                  ('monitor','from production_monitor_dispatch import main\nraise SystemExit(main())'),
                                  ('management','from production_owner import manage\nraise SystemExit(manage(sys.argv[1] if len(sys.argv)>1 else "update"))')]:
                (ROOT/'tools'/(name+'_bootstrap.py')).write_text('import sys\nsys.path.insert(0,'+repr(str(ROOT/'tools'))+')\n'+function+'\n')
            manifest=guard.read(INPUTS/'bundle/manifest.json')
            if guard.digest(manifest)!=control['bundle_digest']:raise ValueError('production-bundle-drift')
            if manifest['source_sha']!='7ce190446e548e2e1c0ae6ba0225be0490d12fc2' or manifest['python_version']!='3.11.15':
                raise ValueError('unreviewed-initial-source-runtime')
            store.approve(manifest,control['bundle_digest']);sha=store.bootstrap(INPUTS/'bundle')
            actor=Actor(store);job=validate_existing_job(actor)
            common.write_public(ROOT/'job-context.json',dict(job_id=JOB_ID))
            guard.atomic(ROOT/'private/original-gateway-map.json',original)
            # A protected temporary config tests the actual hermes principal before stop.
            preflight_env=ROOT/'runner-preflight.env';preflight_env.write_bytes(env_bytes)
            os.chown(preflight_env,user.pw_uid,user.pw_gid);preflight_env.chmod(0o600)
            try:assert actor.summary(preflight_env)['complete']
            finally:preflight_env.unlink()
            service=Supervisor(store,original,actor);service.capture_first=True
            if service.pid() is None:raise ValueError('original-supervisor-absent')
            plan=build_plan(store,original,env_bytes)
            expected={key:installation.slot_identity(path) if path.exists() else None for key,path in installation.SLOT_PATHS.items()}
            if expected['launcher'] is not None or expected['summary_env'] is not None:raise ValueError('unexpected-installed-slot')
            # Recheck immediately before taking the maintenance transaction.
            snapshot_baseline();validate_existing_job(actor)
            for name,key in [('updater','updater'),('launcher','launcher'),('gateway.plist','gateway'),('wrapper','wrapper')]:
                (ROOT/'slots'/name).write_bytes(plan[key]);(ROOT/'slots'/name).chmod(0o600)
            print('owner: installing authorized gateway/entry/wrapper; cron job unchanged',file=sys.stderr,flush=True)
            import fcntl
            legacy_lock=DB.with_name(DB.name+'.lock')
            fd=os.open(str(legacy_lock),os.O_RDONLY|os.O_NOFOLLOW)
            try:
                fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
                result=installation.FirstInstall(store,service).install(plan,expected)
            finally:os.close(fd)
            report.update(result,production_operations=True,digest=sha,round=service.round,backup=str(ROOT/'private/first-runtime'),
                          gateway_pid=service.pid(),credential_disclosed=False)
            if result['status']=='installed-dry-run':
                guard.atomic(ROOT/'private/production-qualified.json',dict(digest=sha,job_id=JOB_ID,round=service.round,verified=True))
                report['passed']=True
            else:report['passed']=False
    except KeyboardInterrupt:
        if store is not None and service is not None and (ROOT/'private/first-production-install.json').exists():
            entry,installation,guard,common=modules();report.update(installation.FirstInstall(store,service).recover())
        report.update(passed=False,error_type='KeyboardInterrupt')
    except Exception as error:
        report.update(passed=False,error_type=type(error).__name__,error='owner-operation-blocked')
        label=str(error)
        if re.fullmatch(r'[a-z0-9_-]+(?::[a-z0-9_-]+)?',label):report['error']=label
        if store is not None:report['retained_authority']=str(ROOT)
    print(json.dumps(report,indent=2))
    return 0 if report.get('passed') else 1


def manage(command):
    if os.geteuid()!=0:raise PermissionError('root-management-required')
    if command not in ('update','recover'):raise ValueError('fixed-management-command-required')
    entry,installation,guard,common=modules();store=entry.ProductionStore()
    with updater_exclusion():
        path=ROOT/'private/first-production-install.json'
        if path.exists() and guard.read(path)['phase'] not in ('verified','rolled_back'):
            original=guard.read(ROOT/'private/original-gateway-map.json')
            result=installation.FirstInstall(store,Supervisor(store,original,Actor(store))).recover()
        elif command=='recover':result=dict(status='blocked',reason='no-pending-first-install')
        else:
            # Production never fetches or runs a moving main branch. A root
            # operator stages/approves an exact proposal before selecting it.
            next_path=ROOT/'private/next-candidate.json'
            if not next_path.exists():
                pending=ROOT/'pending/no-approved-successor.json'
                if not pending.exists():guard.atomic(pending,dict(status='skipped',reason='no-approved-successor'))
                result=dict(status='skipped',reason='no-approved-successor')
            else:
                store.safe(next_path);sha=guard.read(next_path)['digest']
                if not isinstance(sha,str) or not re.fullmatch(r'[0-9a-f]{64}',sha):raise ValueError('invalid-successor-digest')
                candidate=ROOT/'proposals'/sha
                if candidate.resolve()!=candidate:raise ValueError('redirected-proposal')
                manifest=guard.read(candidate/'manifest.json')
                if guard.digest(manifest)!=sha:raise ValueError('proposal-digest-drift')
                if guard.read(ROOT/'approvals.json').get(manifest['release_id'])!=sha:
                    pending=ROOT/'pending'/(sha+'.json')
                    if not pending.exists():guard.atomic(pending,dict(digest=sha,status='skipped',reason='unapproved-release'))
                    result=dict(status='skipped',reason='unapproved-release')
                else:
                    guard.check_payload(candidate/'payload',manifest)
                    from packaging_contract import verify_candidate
                    verify_candidate(candidate)
                    original=guard.read(ROOT/'private/original-gateway-map.json')
                    supervisor=Supervisor(store,original,Actor(store))
                    with tempfile.TemporaryDirectory(prefix='gcake-approved-update-',dir='/private/tmp') as temporary:
                        bundle=Path(temporary)/'bundle';shutil.copytree(candidate,bundle,symlinks=True)
                        result=common.UpdateEntry(store,supervisor).update(bundle)
        print(json.dumps(result))
        return 0 if result['status'] in ('skipped','rolled_back') else 1
