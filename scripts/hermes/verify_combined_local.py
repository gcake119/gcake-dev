"""Pre-owner smoke of the same full payload/dispatcher; not privilege/launchd proof."""
import os
from pathlib import Path
import pwd
import shlex
import shutil
import subprocess
import tempfile
import sys
import json
from update_entry import EntryStore, runner_profile, launch_gateway
import update_entry as api
import updater_guard as guard
from verify_combined_gateway import NativeService, make_home, INPUTS
from verify_gateway_isolated import environment,stop


class LocalNative(NativeService):
    def run(self,payload,code,timeout=25):
        env=environment(self.home,payload/'code',payload/'runtime/bin/python3.11')
        result=subprocess.run(['/usr/bin/sandbox-exec','-f',str(self.store.root/'deny.sb'),
            str(payload/'runtime/bin/python3.11'),'-B','-c',code],cwd=payload/'code',env=env,capture_output=True,text=True,timeout=timeout)
        if result.returncode:raise RuntimeError(result.stderr[-1000:])
        return result.stdout


class LocalSupervisor:
    def __init__(self,service):self.service=service;self.process=None;self.log=None;self.cleanups=[]
    def query(self):return 'pid = '+str(self.process.pid) if self.process and self.process.poll() is None else None
    def start(self,payload,mode):
        if self.query():raise ValueError('second-local-gateway')
        root=self.service.store.root;self.service.store.gate('verifying',payload.name)
        env=environment(self.service.home,payload/'code',payload/'runtime/bin/python3.11')
        self.log=(self.service.home/'gateway.log').open('w')
        self.process=subprocess.Popen(['/usr/bin/sandbox-exec','-f',str(root/'deny.sb'),'/usr/bin/python3','-I','-B','-S',str(root/'launcher.py')],env=env,stdout=self.log,stderr=subprocess.STDOUT,start_new_session=True)
    def stop(self):
        if self.process:
            self.cleanups.append(stop(self.process));self.process=None
            self.log.close();self.log=None


def main():
    evidence=Path('/private/tmp/gcake-hermes-monitor-plan-20261012/docs/hermes-monitor-evidence/combined-local-smoke.json')
    report=dict(actual_root_hermes=False,actual_launchd=False,full_gateway=True,production_operations=False)
    user=pwd.getpwuid(os.geteuid());supervisor=None
    with tempfile.TemporaryDirectory(prefix='gcake-entry-local-full-',dir='/private/tmp') as temporary:
        owner=Path(temporary);root=owner/'authority';store=EntryStore.initialize(root,user.pw_uid)
        manifest=guard.read(INPUTS/'old/manifest.json');store.approve(manifest,guard.digest(manifest));sha=store.bootstrap(INPUTS/'old')
        home,initialized=make_home(store,user)
        tools=root/'tools';tools.mkdir()
        for name in ('update_entry.py','updater_guard.py','monitor_wrapper.py','verify_combined_gateway.py'):shutil.copy2(Path(__file__).with_name(name),tools/name)
        (root/'deny.sb').write_text(runner_profile(root,unix_ipc=True))
        (root/'launcher.py').write_text('import sys\nfrom pathlib import Path\nroot=Path(__file__).parent\nsys.path.insert(0,str(root/"tools"))\nfrom update_entry import EntryStore,launch_gateway\nlaunch_gateway(EntryStore(root))\n')
        for name in api.SLOTS:(root/'slots'/name).write_text('fixture-'+name)
        dispatcher='import sys\nfrom pathlib import Path\nroot=Path(__file__).parent.parent\nsys.path.insert(0,str(root/"tools"))\nfrom update_entry import EntryStore\nfrom updater_guard import read\ns=EntryStore(root)\nraise SystemExit(s.monitor(job_id=read(root/"job-context.json")["job_id"],legacy_env=root/"home/legacy.env",summary_env=root/"home/summary.env",db=root/"home/state/live.sqlite"))\n'
        (root/'slots/wrapper').write_text(dispatcher)
        (home/'.hermes/scripts/monitor.sh').write_text('#!/bin/bash\nexec /usr/bin/python3 -I -B -S '+shlex.quote(str(root/'slots/wrapper'))+'\n')
        api.write_public(root/'job-context.json',dict(job_id='pending'))
        service=LocalNative(store,'local.gcake.hermes-test.'+'f'*32,user,api,guard)
        supervisor=LocalSupervisor(service);service.base=supervisor
        create='from cron.jobs import create_job;from datetime import datetime,timezone,timedelta;import json;print(json.dumps(create_job(None,(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat(),script="monitor.sh",no_agent=True,deliver="local",failure_deliver="local")["id"]))'
        job=json.loads(service.run(store.verify_release(sha),create).splitlines()[-1]);api.write_public(root/'job-context.json',dict(job_id=job));service.job_id=job
        try:
            with store.maintenance():service.start(store.verify_release(sha),'dry-run');service.verify(store.verify_release(sha))
            store.gate('ready',sha)
            counts=[service.live_round()];assert counts==[2]
            preserved=service.snapshot()
            manifest=guard.read(INPUTS/'new/manifest.json');store.approve(manifest,guard.digest(manifest))
            result=api.UpdateEntry(store,service).update(INPUTS/'new');assert result['status']=='updated'
            counts.append(service.live_round());assert counts[-1]==0
            assert service.snapshot()==preserved
            report.update(passed=True,rounds=service.rounds,delivery_request_counts=counts,history_unchanged=True)
        except BaseException as error:
            report.update(passed=False,error_type=type(error).__name__,error=str(error))
            log=home/'gateway.log'
            if log.exists():report['gateway_log_tail']=log.read_text()[-1800:]
        finally:
            supervisor.stop();report['cleanup']=supervisor.cleanups
    report['owned_root_removed']=not owner.exists();evidence.write_text(json.dumps(report,indent=2));print(json.dumps(report))
    if not report.get('passed'):raise SystemExit(1)


if __name__=='__main__':main()
