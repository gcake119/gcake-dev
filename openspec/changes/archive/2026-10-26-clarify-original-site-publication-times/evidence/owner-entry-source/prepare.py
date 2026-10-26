"""One-time packaging over the existing managed successor interfaces."""
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys

REPO=Path('/Users/caiyijun/project/gcake-dev')
ROOT=Path('/usr/local/share/gcake-hermes-runtime')
BASE='4fe889d8069a96b6d9f11b31d5940ebd00722280d39eabf412ab8ed906dbf554'
TARGET=Path('/private/tmp/gcake-original-site-times-20261026')
sys.path.insert(0,str(ROOT/'tools'))
from updater_guard import read,tree,digest,canonical,check_payload
from packaging_contract import verify_candidate
sys.path.append(str(REPO/'scripts/hermes'))
from prepare_notification_successor import BOOTSTRAP_TEMPLATE

def main():
    if os.geteuid()==0:raise PermissionError('prepare-as-main-user')
    if read(ROOT/'active.json')!={'digest':BASE,'mode':'live'}:raise ValueError('active-baseline-drift')
    if TARGET.exists():raise ValueError('owned-package-already-exists')
    baseline=read(ROOT/'manifests'/(BASE+'.json'))
    if digest(baseline)!=BASE:raise ValueError('baseline-manifest-drift')
    source=ROOT/'releases'/BASE
    check_payload(source,baseline)
    for name in ('selected','full'):
        log=Path('/private/tmp/gcake-publication-times-'+name+'-unsandboxed.log').read_text()
        if 'Ran 297 tests' not in log or '\nOK\n' not in log or '\nFAILED ' in log:
            raise ValueError('complete-test-evidence-required')
    if shutil.disk_usage('/private/tmp').free<3*1024**3:raise ValueError('insufficient-package-space')
    TARGET.mkdir(mode=0o755)
    owned=dict(path=str(TARGET),owner_uid=os.getuid(),purpose='authorized original-site timestamp repair successor',
               retention='retain until administrator adoption and readback; remove exact directory after closeout')
    (TARGET/'owned.json').write_bytes(canonical(owned))
    try:
        bundle=TARGET/'bundle';payload=bundle/'payload'
        shutil.copytree(source,payload,symlinks=True)
        monitor=payload/'library/publication_monitor.py'
        shutil.copyfile(REPO/'scripts/hermes/publication_monitor.py',monitor);monitor.chmod(0o644)
        native=payload/'runtime/bin/python3.11'
        probe=subprocess.run([str(native),'-I','-B','-S',str(ROOT/'tools/offline_probe.py')],
            capture_output=True,text=True,timeout=45,check=True,
            env=dict(HOME=str(TARGET/'offline-home'),PATH='/usr/bin:/bin',PYTHONDONTWRITEBYTECODE='1'))
        sdk=json.loads(probe.stdout.splitlines()[-1])
        if sdk!=baseline['verification']['telegram']:raise ValueError('native-sdk-proof-drift')
        files=tree(payload)
        changed=sorted(name for name in set(files)|set(baseline['files']) if files.get(name)!=baseline['files'].get(name))
        if changed!=['library/publication_monitor.py']:raise ValueError('unexpected-payload-change')
        manifest=dict(baseline,release_id='original-site-times-20261026',files=files,
            verification=dict(baseline['verification'],original_site_times=dict(
                tests=297,selected_python='3.11.15',modelCalls=0,actualTelegramRequests=0,
                monitor_sha256=hashlib.sha256(monitor.read_bytes()).hexdigest())))
        (bundle/'manifest.json').write_bytes(canonical(manifest));(bundle/'manifest.json').chmod(0o644)
        verify_candidate(bundle);sha=digest(manifest)
        adapter=REPO/'scripts/hermes/owner_successor.py'
        shutil.copyfile(adapter,TARGET/'owner_successor.py');(TARGET/'owner_successor.py').chmod(0o644)
        controls=dict(schema=1,base_digest=BASE,bundle_digest=sha,owner_uid=os.getuid(),changed_files=changed,
            owner_script_sha256=hashlib.sha256(adapter.read_bytes()).hexdigest(),
            installed_tools={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((ROOT/'tools').glob('*.py'))})
        raw=canonical(controls);(TARGET/'controls.json').write_bytes(raw);(TARGET/'controls.json').chmod(0o644)
        control_sha=hashlib.sha256(raw).hexdigest()
        bootstrap=BOOTSTRAP_TEMPLATE.replace('PACKAGE_LITERAL',repr(str(TARGET))).replace('CONTROL_LITERAL',repr(control_sha)).replace('OWNER_LITERAL',str(os.getuid()))
        entry='#!/bin/bash\nset -euo pipefail\nexec /usr/bin/sudo /usr/bin/python3 -I -B -S -c '+shlex.quote(bootstrap)+'\n'
        (TARGET/'owner_adopt.sh').write_text(entry);(TARGET/'owner_adopt.sh').chmod(0o755)
        report=dict(owned,base_digest=BASE,bundle_digest=sha,manifest_path=str(bundle/'manifest.json'),
            control_sha256=control_sha,owner_command='bash '+str(TARGET/'owner_adopt.sh'),
            receipt_path=str(ROOT/'private'/('notification-successor-'+sha+'.json')),
            changed_files=changed,gateway_code_runtime_unchanged=True,sdk_offline_passed=True,
            production_writes=False,qualification='pending administrator adoption, natural dry-run and installed readback')
        (TARGET/'prepared.json').write_bytes(canonical(report));(TARGET/'prepared.json').chmod(0o644)
        print(json.dumps(report,indent=2))
    except BaseException:
        if TARGET.resolve()==TARGET and read(TARGET/'owned.json')==owned:shutil.rmtree(TARGET)
        raise

if __name__=='__main__':main()
