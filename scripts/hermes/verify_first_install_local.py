"""Actual CLI first-slot rollback with an original-style absolute runtime layout.

Same UID, empty platforms and synthetic state; not production/launchd evidence.
"""
import hashlib
import json
import os
from pathlib import Path
import pwd
import shlex
import shutil
import subprocess
import tempfile
import time
from unittest.mock import patch
import update_entry as api
import updater_guard as guard
import production_install as installation
from verify_production_local import ProductionNative,BUNDLE,BASE
from verify_combined_gateway import make_home
from verify_combined_local import LocalSupervisor
from verify_gateway_isolated import environment


class FirstSupervisor(LocalSupervisor):
    def __init__(self,service,original):super().__init__(service);self.original=original;self.calls=[]
    def drained(self):return self.service.drained()
    def start_original(self):
        self.calls.append('start-original')
        payload=self.original;env=environment(self.service.home,payload/'code',payload/'runtime/bin/python3.11')
        self.log=(self.service.home/'original-gateway.log').open('w')
        self.process=subprocess.Popen([str(payload/'runtime/bin/python3.11'),'-B','-m','hermes_cli.main','gateway','run'],cwd=payload/'code',env=env,stdout=self.log,stderr=subprocess.STDOUT,start_new_session=True)
    def verify_original(self):
        code='from gateway.control_socket import identify_gateway;from pathlib import Path;import os,json;print(json.dumps(identify_gateway(Path(os.environ["HERMES_HOME"]))))'
        deadline=time.monotonic()+45
        while time.monotonic()<deadline:
            try:identity=json.loads(self.service.run(self.original,code).splitlines()[-1])
            except Exception:time.sleep(1);continue
            if identity and identity.get('pid')==self.process.pid:
                self.calls.append('verified-original');return
            time.sleep(1)
        raise RuntimeError('original-layout-not-verified')
    def start_managed(self):
        self.calls.append('start-managed');payload=self.service.store.verify_release(self.service.store.active()['digest'])
        self.service.prepare_round(payload);self.start(payload,'dry-run')
    def verify_managed(self):
        payload=self.service.store.verify_release(self.service.store.active()['digest'])
        self.service.wait_round(payload,True);self.calls.append('verified-candidate-then-injected-failure')
        raise RuntimeError('intentional-post-dispatch-first-install-failure')


def main():
    report=dict(actual_root_hermes=False,actual_launchd=False,production_state_modified=False,telegram_test_messages=False)
    supervisor=None
    with tempfile.TemporaryDirectory(prefix='gcake-entry-first-full-',dir='/private/tmp') as temporary:
        base=Path(temporary);root=base/'authority';user=pwd.getpwuid(os.geteuid())
        store=api.EntryStore.initialize(root,user.pw_uid);manifest=guard.read(BUNDLE/'manifest.json')
        store.approve(manifest,guard.digest(manifest));sha=store.bootstrap(BUNDLE)
        home,_=make_home(store,user);shutil.copyfile('/private/tmp/gcake-hermes-monitor-private-20261013/publication-monitor.env',home/'summary.env');(home/'summary.env').chmod(0o600)
        original=base/'original-absolute-layout';shutil.copytree(BUNDLE/'payload',original,symlinks=True)
        original_before=guard.tree(original)
        tools=root/'tools';tools.mkdir()
        for name in ('update_entry.py','updater_guard.py','monitor_wrapper.py','verify_combined_gateway.py'):shutil.copy2(Path(__file__).with_name(name),tools/name)
        (root/'deny.sb').write_text(api.runner_profile(root,unix_ipc=True).replace('(deny network*) ',''))
        (root/'launcher.py').write_text('import sys\nfrom pathlib import Path\nroot=Path(__file__).parent\nsys.path.insert(0,str(root/"tools"))\nfrom update_entry import EntryStore,launch_gateway\nlaunch_gateway(EntryStore(root))\n')
        for name in api.SLOTS:(root/'slots'/name).write_text('original-'+name)
        # Use the dispatcher already exercised by the complete production smoke.
        source=Path(__file__).with_name('verify_production_local.py').read_text()
        import ast
        dispatcher=None
        for node in ast.walk(ast.parse(source)):
            if isinstance(node,ast.Assign) and any(isinstance(n,ast.Name) and n.id=='dispatcher' for n in node.targets):dispatcher=ast.literal_eval(node.value)
        assert dispatcher
        (root/'slots/wrapper').write_text(dispatcher)
        shell=home/'.hermes/scripts/monitor.sh';shell.write_text('#!/bin/bash\nexit 0\n')
        api.write_public(root/'job-context.json',dict(job_id='pending'))
        service=ProductionNative(store,'local.gcake.hermes-test.'+'f'*32,user,api,guard)
        create='from cron.jobs import create_job;from datetime import datetime,timezone,timedelta;import json;print(json.dumps(create_job(None,(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat(),script="monitor.sh",no_agent=True,deliver="local",failure_deliver="local")["id"]))'
        job=json.loads(service.run(store.verify_release(sha),create).splitlines()[-1]);api.write_public(root/'job-context.json',dict(job_id=job));service.job_id=job
        supervisor=FirstSupervisor(service,original);service.base=supervisor
        slots={name:base/('external-'+name) for name in ('updater','launcher','gateway','summary_env')};slots['wrapper']=shell
        for name in ('updater','launcher','gateway'):slots[name].write_text('original-'+name);slots[name].chmod(0o600)
        expected={name:installation.slot_identity(path) if path.exists() else None for name,path in slots.items()}
        before={name:path.read_bytes() if path.exists() else None for name,path in slots.items()}
        plan={name:('candidate-'+name).encode() for name in slots}
        plan['wrapper']=('#!/bin/bash\nexec /usr/bin/python3 -I -B -S '+shlex.quote(str(root/'slots/wrapper'))+'\n').encode()
        db_before=hashlib.sha256((home/'state/live.sqlite').read_bytes()).hexdigest()
        try:
            supervisor.start_original();supervisor.verify_original()
            with patch.object(installation,'SLOT_PATHS',slots):result=installation.FirstInstall(store,supervisor).install(plan,expected)
            assert result['status']=='rolled_back'
            for name,path in slots.items():assert (path.read_bytes() if path.exists() else None)==before[name]
            assert guard.tree(original)==original_before
            assert hashlib.sha256((home/'state/live.sqlite').read_bytes()).hexdigest()==db_before
            report.update(passed=True,status=result['status'],calls=supervisor.calls,original_absolute_runtime_unchanged=True,
                          db_unchanged=True,candidate_rounds=service.rounds)
        except BaseException as error:report.update(passed=False,error_type=type(error).__name__,error=str(error)[:1000])
        finally:supervisor.stop();report['cleanup']=supervisor.cleanups
    report['owned_root_removed']=not base.exists()
    (BASE/'docs/hermes-monitor-evidence/production-first-complete-rollback.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report));return 0 if report.get('passed') else 1


if __name__=='__main__':raise SystemExit(main())
