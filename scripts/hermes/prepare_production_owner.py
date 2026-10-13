"""Hash-bind reviewed production tools and private env, without root operations."""
import hashlib
import json
import os
from pathlib import Path
import shlex
from updater_guard import atomic,digest,check_payload

BASE=Path('/private/tmp/gcake-hermes-monitor-plan-20261012')
INPUTS=BASE/'production-rollout-inputs'
PRIVATE_ENV=Path('/private/tmp/gcake-hermes-monitor-private-20261013/publication-monitor.env')
MODULES=('production_entry.py','production_install.py','production_owner.py','production_monitor_dispatch.py','updater_guard.py','monitor_wrapper.py','update_entry.py')


def prepare():
    if os.geteuid()==0:raise PermissionError('prepare-as-main-user')
    marker=json.loads((INPUTS/'prepared.json').read_text())
    if marker['owner_uid']!=os.geteuid() or marker['path']!=str(INPUTS) or INPUTS.resolve()!=INPUTS:
        raise ValueError('prepared-input-owner-mismatch')
    manifest=json.loads((INPUTS/'bundle/manifest.json').read_text())
    if digest(manifest)!=marker['bundle_digest']:raise ValueError('bundle-identity-drift')
    check_payload(INPUTS/'bundle/payload',manifest)
    parent=Path(__file__).parent
    controls=dict(schema=1,bundle_digest=marker['bundle_digest'],
        private_env_sha256=hashlib.sha256(PRIVATE_ENV.read_bytes()).hexdigest(),
        modules={name:hashlib.sha256((parent/name).read_bytes()).hexdigest() for name in MODULES})
    atomic(INPUTS/'controls.json',controls)
    sha=hashlib.sha256((INPUTS/'controls.json').read_bytes()).hexdigest()
    driver=parent/'production_owner.py'
    program='import hashlib,os;p='+repr(str(driver))+';f=os.fdopen(os.open(p,os.O_RDONLY|os.O_NOFOLLOW),"rb");data=f.read();f.close();assert hashlib.sha256(data).hexdigest()=='+repr(controls['modules']['production_owner.py'])+';g=dict();g.update({chr(95)*2+"file"+chr(95)*2:p});exec(compile(data,p,"exec"),g);raise SystemExit(g.get("owner_main")('+repr(sha)+'))'
    command=parent/'run-production-install-owner.sh'
    command.write_text('#!/bin/bash\nset -euo pipefail\nexec sudo /usr/bin/python3 -I -B -S -c '+shlex.quote(program)+'\n');command.chmod(0o700)
    print(json.dumps(dict(prepared=True,control_sha256=sha,bundle_digest=marker['bundle_digest'],owner_command=str(command),secret_disclosed=False,production_operations=False)))


if __name__=='__main__':prepare()
