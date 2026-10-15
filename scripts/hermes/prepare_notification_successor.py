"""Build a fixed approved-baseline successor; no production writes or network."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT=Path('/usr/local/share/gcake-hermes-runtime')
BASE_DIGEST='f98d49207288ae81f1cad0ece146489c1631700f946ea9146663cfab32eab66e'
TASK=Path('/private/tmp/gcake-notification-repair-20261015')
TARGET=TASK/'owner-successor'
SCRIPTS=Path(__file__).resolve().parent
EVIDENCE=SCRIPTS.parents[1]/'docs/hermes-notification-repair/2026-10-15'

# Root executes only this bootstrap plus an exact hash-pinned adapter copy.
BOOTSTRAP_TEMPLATE='''import hashlib,json,os,stat,sys,tempfile,runpy
from pathlib import Path
package=Path(PACKAGE_LITERAL)
if os.geteuid()!=0:raise PermissionError("root-required")
if package.resolve()!=package:raise ValueError("package-path-drift")
def checked(path,sha,limit):
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 with os.fdopen(fd,"rb") as f:
  st=os.fstat(f.fileno());raw=f.read(limit+1)
 if not stat.S_ISREG(st.st_mode) or st.st_nlink!=1 or st.st_mode&0o022 or st.st_uid not in (0,OWNER_LITERAL) or len(raw)>limit or hashlib.sha256(raw).hexdigest()!=sha:raise ValueError("owner-input-drift")
 return raw
control=json.loads(checked(package/"controls.json",CONTROL_LITERAL,1024*1024))
for name,sha in control["installed_tools"].items():
 if not name.replace("_","").replace(".","").isalnum() or not name.endswith(".py"):raise ValueError("invalid-tool-name")
 checked(Path("/usr/local/share/gcake-hermes-runtime/tools")/name,sha,1024*1024)
source=checked(package/"owner_successor.py",control["owner_script_sha256"],1024*1024)
sys.path.insert(0,"/usr/local/share/gcake-hermes-runtime/tools")
with tempfile.TemporaryDirectory(prefix="gcake-owner-successor-code-",dir="/private/tmp") as temp:
 path=Path(temp)/"owner_successor.py";path.write_bytes(source);path.chmod(0o600)
 runpy.run_path(str(path),init_globals={"APPROVED_CONTROL":control,"PACKAGE_ROOT":str(package)},run_name="__main__")
'''


def preparation_inputs():
    """Resolve preserved inputs from this checkout, never the old temp copy."""
    names=('publication_monitor.py','reconcile_notification.py','telegram_readonly_diagnostic.py','successor_runner_probe.py')
    inputs={name:SCRIPTS/name for name in names}
    inputs['owner_continue.py']=EVIDENCE/'historical/gateway-switch/owner_continue.py'
    inputs['product_test_log']=EVIDENCE/'gateway-switch-full-green.log'
    for path in inputs.values():
        if not path.is_file():raise ValueError('preparation-input-missing')
    return inputs


def prepare():
    if os.geteuid()==0:raise PermissionError('prepare-as-main-user')
    inputs=preparation_inputs()
    # Installed controls are required only for actual owner preparation.
    sys.path.insert(0,str(ROOT/'tools'))
    from updater_guard import read,tree,digest,canonical,check_payload
    from packaging_contract import verify_candidate,PROOF
    if read(ROOT/'active.json')!={'digest':BASE_DIGEST,'mode':'live'}:raise ValueError('active-baseline-drift')
    if TARGET.exists():raise ValueError('owned-package-already-exists')
    original=read(ROOT/'manifests'/(BASE_DIGEST+'.json'))
    if digest(original)!=BASE_DIGEST:raise ValueError('original-manifest-drift')
    source=ROOT/'releases'/BASE_DIGEST
    check_payload(source,original)
    if shutil.disk_usage(TASK).free<5*1024**3:raise ValueError('prepare-disk-budget')
    TARGET.mkdir(mode=0o755)
    owned=dict(path=str(TARGET),owner_uid=os.geteuid(),purpose='authorized owner notification repair successor',retention='until production adoption and closeout; do not remove while owner operation runs')
    (TARGET/'owned.json').write_bytes(canonical(owned))
    try:
        bundle=TARGET/'bundle';payload=bundle/'payload'
        shutil.copytree(source,payload,symlinks=True)
        library=payload/'library'
        names=('publication_monitor.py','reconcile_notification.py','telegram_readonly_diagnostic.py','owner_continue.py','successor_runner_probe.py')
        for name in names:
            src=inputs[name]
            shutil.copyfile(src,library/name);(library/name).chmod(0o644)
        native=payload/'runtime/bin/python3.11'
        result=subprocess.run([str(native),'-I','-B','-S',str(ROOT/'tools/offline_probe.py')],capture_output=True,text=True,timeout=40,check=True,
                              env=dict(HOME=str(TARGET/'offline-home'),PATH='/usr/bin:/bin',PYTHONDONTWRITEBYTECODE='1'))
        sdk=json.loads(result.stdout.splitlines()[-1])
        if sdk.get('status')!='passed':raise ValueError('native-sdk-proof-failed')
        (payload/PROOF).write_bytes(canonical(sdk));(payload/PROOF).chmod(0o644)
        evidence=dict(schema=1,source_baseline='4068a3695b484309bfc87c1b1ad68bee6d7eb327',
                      product_tests='gateway-switch-full-green.log',hermes_test_count=174,
                      product_test_log_sha256=hashlib.sha256(inputs['product_test_log'].read_bytes()).hexdigest(),
                      root_owner_qualification='pending',human_receipt='not_run',message_sends=0)
        (library/'notification-repair-health.json').write_bytes(canonical(evidence))
        files=tree(payload)
        changed={name for name in set(files)|set(original['files']) if files.get(name)!=original['files'].get(name)}
        allowed={'library/'+name for name in names}|{PROOF,'library/notification-repair-health.json'}
        if changed!=allowed:raise ValueError('unexpected-payload-change')
        manifest=dict(original,release_id='hermes-notification-repair-20261015',files=files,
                      capability=dict(telegram=dict(required=True,proof_file=PROOF,post_start_required=True)),
                      verification=dict(passed=True,evidence_sha=hashlib.sha256(canonical(sdk)).hexdigest(),telegram=sdk,notification_repair=evidence))
        (bundle/'manifest.json').write_bytes(canonical(manifest));(bundle/'manifest.json').chmod(0o644)
        verify_candidate(bundle);sha=digest(manifest)
        shutil.copyfile(SCRIPTS/'owner_successor.py',TARGET/'owner_successor.py');(TARGET/'owner_successor.py').chmod(0o644)
        installed={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((ROOT/'tools').glob('*.py'))}
        controls=dict(schema=1,base_digest=BASE_DIGEST,bundle_digest=sha,
                      owner_script_sha256=hashlib.sha256((TARGET/'owner_successor.py').read_bytes()).hexdigest(),
                      installed_tools=installed,changed_files=sorted(changed),owner_uid=os.geteuid())
        raw=canonical(controls);(TARGET/'controls.json').write_bytes(raw);(TARGET/'controls.json').chmod(0o644)
        control_sha=hashlib.sha256(raw).hexdigest()
        bootstrap=BOOTSTRAP_TEMPLATE.replace('PACKAGE_LITERAL',repr(str(TARGET))).replace('CONTROL_LITERAL',repr(control_sha)).replace('OWNER_LITERAL',str(os.geteuid()))
        import shlex
        entry='#!/bin/bash\nset -euo pipefail\nexec /usr/bin/sudo /usr/bin/python3 -I -B -S -c '+shlex.quote(bootstrap)+'\n'
        (TARGET/'owner_adopt.sh').write_text(entry);(TARGET/'owner_adopt.sh').chmod(0o755)
        report=dict(owned,bundle_digest=sha,manifest_path=str(bundle/'manifest.json'),control_sha256=control_sha,
                    proposal_path=str(ROOT/'proposals'/sha),owner_command='bash '+str(TARGET/'owner_adopt.sh'),
                    receipt_path=str(ROOT/'private'/('notification-successor-'+sha+'.json')),
                    changed_files=sorted(changed),gateway_code_runtime_unchanged=True,sdk_offline_passed=True,
                    production_writes=False,qualification='pending owner native/root/launchd execution')
        (TARGET/'prepared.json').write_bytes(canonical(report));(TARGET/'prepared.json').chmod(0o644)
        print(json.dumps(report,indent=2))
    except BaseException:
        # The marker, exact fixed path and owner were established in this run.
        if TARGET.resolve()==TARGET and read(TARGET/'owned.json')==owned:shutil.rmtree(TARGET)
        raise


if __name__=='__main__':prepare()
