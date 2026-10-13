"""Complete fixture-free library/gateway smoke; no formal home or Telegram token."""
import hashlib
import json
import os
from pathlib import Path
import pwd
import shlex
import shutil
import tempfile
import sys
from update_entry import EntryStore,runner_profile
import update_entry as api
import updater_guard as guard
from verify_combined_gateway import make_home
from verify_combined_local import LocalNative,LocalSupervisor

BASE=Path('/private/tmp/gcake-hermes-monitor-plan-20261012')
BUNDLE=BASE/'production-rollout-inputs/bundle'


class ProductionNative(LocalNative):
    def runtime_probe(self):
        # A production bundle has no synthetic release_dependency module.
        return 'from gateway.control_socket import identify_gateway;from pathlib import Path;import os,sys,json,pydantic_core;print(json.dumps(dict(uid=os.geteuid(),version=sys.version.split()[0],prefix=sys.prefix,executable=sys.executable,identity=identify_gateway(Path(os.environ["HERMES_HOME"])))))'


def main():
    user=pwd.getpwuid(os.geteuid());supervisor=None
    report=dict(actual_root_hermes=False,actual_launchd=False,production_state_modified=False,
                full_gateway=True,fixture_transport=False,telegram_test_messages=False)
    with tempfile.TemporaryDirectory(prefix='gcake-entry-production-smoke-',dir='/private/tmp') as temporary:
        owner=Path(temporary);root=owner/'authority';store=EntryStore.initialize(root,user.pw_uid)
        manifest=guard.read(BUNDLE/'manifest.json');store.approve(manifest,guard.digest(manifest));sha=store.bootstrap(BUNDLE)
        home,_=make_home(store,user)
        shutil.copyfile('/private/tmp/gcake-hermes-monitor-private-20261013/publication-monitor.env',home/'summary.env')
        (home/'summary.env').chmod(0o600)
        tools=root/'tools';tools.mkdir()
        for name in ('update_entry.py','updater_guard.py','monitor_wrapper.py','verify_combined_gateway.py'):shutil.copy2(Path(__file__).with_name(name),tools/name)
        # The home has fake bot values and no configured gateway platforms.
        # Permit real public HTTPS observation, deny formal home/libexec access.
        profile=runner_profile(root,unix_ipc=True).replace('(deny network*) ','')
        (root/'deny.sb').write_text(profile)
        (root/'launcher.py').write_text('import sys\nfrom pathlib import Path\nroot=Path(__file__).parent\nsys.path.insert(0,str(root/"tools"))\nfrom update_entry import EntryStore,launch_gateway\nlaunch_gateway(EntryStore(root))\n')
        for name in api.SLOTS:(root/'slots'/name).write_text('fixture-'+name)
        dispatcher='''import sys,json,os,subprocess
from pathlib import Path
root=Path(__file__).parent.parent
sys.path.insert(0,str(root/'tools'))
from update_entry import EntryStore
from updater_guard import read
store=EntryStore(root)
payload=store.verify_release(store.active()['digest'])
result=store.monitor(job_id=read(root/'job-context.json')['job_id'],legacy_env=root/'home/legacy.env',summary_env=root/'home/summary.env',db=root/'home/state/live.sqlite')
keys=['HERMES_CRON_JOB_ID','HERMES_CRON_EXECUTION_ID','HERMES_CRON_SCHEDULED_INSTANT']
probe=subprocess.check_output([str(payload/'runtime/bin/python3.11'),'-I','-B','-S','-c','import sys,json;print(json.dumps(dict(python=sys.version.split()[0],prefix=sys.prefix)))'],text=True)
record=dict(context={k:os.environ[k] for k in keys},uid=os.geteuid(),**json.loads(probe))
(root/'home/.hermes/context.json').write_text(json.dumps(record))
raise SystemExit(result)
'''
        (root/'slots/wrapper').write_text(dispatcher)
        (home/'.hermes/scripts/monitor.sh').write_text('#!/bin/bash\nexec /usr/bin/python3 -I -B -S '+shlex.quote(str(root/'slots/wrapper'))+'\n')
        api.write_public(root/'job-context.json',dict(job_id='pending'))
        service=ProductionNative(store,'local.gcake.hermes-test.'+'f'*32,user,api,guard)
        supervisor=LocalSupervisor(service);service.base=supervisor
        create='from cron.jobs import create_job;from datetime import datetime,timezone,timedelta;import json;print(json.dumps(create_job(None,(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat(),script="monitor.sh",no_agent=True,deliver="local",failure_deliver="local")["id"]))'
        job=json.loads(service.run(store.verify_release(sha),create).splitlines()[-1]);api.write_public(root/'job-context.json',dict(job_id=job));service.job_id=job
        try:
            with store.maintenance():service.start(store.verify_release(sha),'dry-run');service.verify(store.verify_release(sha))
            store.gate('ready',sha)
            assert not (home/'.hermes/deliveries.jsonl').exists()
            report.update(passed=True,rounds=service.rounds,digest=sha,db_unchanged=True)
        except BaseException as error:
            report.update(passed=False,error_type=type(error).__name__,error=str(error)[:1000])
        finally:supervisor.stop();report['cleanup']=supervisor.cleanups
    report['owned_root_removed']=not owner.exists()
    (BASE/'docs/hermes-monitor-evidence/production-complete-local-smoke.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))
    return 0 if report.get('passed') else 1


if __name__=='__main__':raise SystemExit(main())
