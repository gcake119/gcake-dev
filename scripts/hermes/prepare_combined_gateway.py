"""Build secret-free full Hermes fixture payloads as main user, never root."""
import argparse
import ast
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
from stage_cron_context import patch_source, SOURCE_SHA256
from updater_guard import tree, digest, atomic, check_payload

BASE=Path('/private/tmp/gcake-hermes-monitor-plan-20261012')
INPUTS=BASE/'combined-gateway-inputs'
SOURCE_SHA='7ce190446e548e2e1c0ae6ba0225be0490d12fc2'


def transport_source():
    for node in ast.parse(Path(__file__).with_name('verify_wrapper_rollover.py').read_text()).body:
        if isinstance(node,ast.Assign) and any(isinstance(x,ast.Name) and x.id=='TRANSPORT' for x in node.targets):
            return ast.literal_eval(node.value).replace("root=Path(__file__).resolve().parents[3]/'.hermes'",'root=Path(os.environ["HERMES_HOME"])')
    raise ValueError('fixture-transport-missing')


def normalize(payload):
    for path in (payload,*payload.rglob('*')):
        if path.is_symlink():continue
        mode=path.stat().st_mode
        path.chmod(0o755 if path.is_dir() or mode&0o111 else 0o644)


def build_bundle(target, release, source, python_base, packages):
    payload=target/'payload';payload.mkdir(parents=True)
    ignore=shutil.ignore_patterns('.git','.env','.env.*','venv','.venv','__pycache__','*.pyc','*.sqlite','*.db')
    shutil.copytree(source,payload/'code',symlinks=True,ignore=ignore)
    kernel=payload/'code/cron/scheduler_script.py';kernel.write_text(patch_source(kernel.read_text()))
    shutil.copytree(python_base,payload/'runtime',symlinks=True,ignore=ignore)
    site=payload/'runtime/lib/python3.11/site-packages'
    shutil.copytree(packages,site,dirs_exist_ok=True,symlinks=True,ignore=ignore)
    (site/'release_dependency.py').write_text('VERSION='+repr(release)+'\n')
    library=payload/'library';library.mkdir()
    for name in ('publication_monitor.py','rss_monitor.py'):
        shutil.copy2(Path(__file__).with_name(name),library/name)
    hook=transport_source()+'''\nimport sys
keys=["HERMES_CRON_JOB_ID","HERMES_CRON_EXECUTION_ID","HERMES_CRON_SCHEDULED_INSTANT"]
(root/"context.json").write_text(json.dumps(dict(context={k:os.environ.get(k) for k in keys},uid=os.geteuid(),python=sys.version.split()[0],prefix=sys.prefix)))
'''
    helper=library/'rss_monitor.py'
    helper.write_text(helper.read_text().replace("if __name__ == '__main__':",'exec(compile('+repr(hook)+',"fixture_transport","exec"))\n\n'+"if __name__ == '__main__':"))
    normalize(payload)
    evidence=BASE/'docs/hermes-monitor-evidence/update-entry-cli-runtime/runtime-summary.json'
    manifest=dict(schema=1,release_id=release,source_sha=SOURCE_SHA,
                  patch_sha=hashlib.sha256(Path(__file__).with_name('hermes-cron-context.patch').read_bytes()).hexdigest(),
                  python_version='3.11.15',lock_sha=hashlib.sha256((source/'uv.lock').read_bytes()).hexdigest(),
                  verification=dict(passed=True,evidence_sha=hashlib.sha256(evidence.read_bytes()).hexdigest()),files=tree(payload))
    atomic(target/'manifest.json',manifest);check_payload(payload,manifest)
    return digest(manifest)


def refresh_controls():
    if os.geteuid()==0:raise ValueError('prepare-as-main-user-not-root')
    marker=json.loads((INPUTS/'.prepared.json').read_text())
    if marker!=dict(schema=1,uid=os.geteuid(),path=str(INPUTS),expiry='2026-10-19') or INPUTS.resolve()!=INPUTS:
        raise ValueError('prepared-owner-mismatch')
    inventory=json.loads((INPUTS/'inventory.json').read_text())
    for release,sha in inventory['bundles'].items():
        manifest=json.loads((INPUTS/release/'manifest.json').read_text())
        if digest(manifest)!=sha:raise ValueError('prepared-manifest-drift')
        check_payload(INPUTS/release/'payload',manifest)
    modules=('update_entry.py','updater_guard.py','monitor_wrapper.py','verify_combined_gateway.py')
    inventory['modules']={n:hashlib.sha256(Path(__file__).with_name(n).read_bytes()).hexdigest() for n in modules}
    atomic(INPUTS/'inventory.json',inventory)
    inventory_sha=hashlib.sha256((INPUTS/'inventory.json').read_bytes()).hexdigest()
    driver=Path(__file__).with_name('verify_combined_gateway.py')
    command='import hashlib,os;p='+repr(str(driver))+';f=os.fdopen(os.open(p,os.O_RDONLY|os.O_NOFOLLOW),"rb");data=f.read();f.close();assert hashlib.sha256(data).hexdigest()=='+repr(inventory['modules'][driver.name])+';g=dict();g.update({chr(95)*2+"file"+chr(95)*2:p});exec(compile(data,p,"exec"),g);raise SystemExit(g.get("main")('+repr(inventory_sha)+'))'
    import shlex
    wrapper=Path(__file__).with_name('run-combined-gateway-owner.sh')
    wrapper.write_text('#!/bin/bash\nset -euo pipefail\nexec sudo /usr/bin/python3 -I -B -S -c '+shlex.quote(command)+'\n');wrapper.chmod(0o700)
    return inventory_sha


def prepare():
    if os.geteuid()==0:raise ValueError('prepare-as-main-user-not-root')
    if INPUTS.exists():raise ValueError('prepared-inputs-already-exist')
    source=BASE/'hermes-gateway-source'
    python=Path('/Users/caiyijun/.local/share/uv/python/cpython-3.11.15-macos-aarch64-none')
    packages=BASE/'hermes-gateway-env311/lib/python3.11/site-packages'
    if hashlib.sha256((source/'cron/scheduler_script.py').read_bytes()).hexdigest()!=SOURCE_SHA256:
        raise ValueError('source-kernel-drift')
    if shutil.disk_usage(BASE).free<4*1024**3:raise ValueError('disk-budget')
    INPUTS.mkdir(mode=0o755)
    atomic(INPUTS/'.prepared.json',dict(schema=1,uid=os.geteuid(),path=str(INPUTS),expiry='2026-10-19'))
    try:
        bundles={}
        for release in ('old','new','bad'):
            bundles[release]=build_bundle(INPUTS/release,release,source,python,packages)
        modules=('update_entry.py','updater_guard.py','monitor_wrapper.py','verify_combined_gateway.py')
        hashes={name:hashlib.sha256(Path(__file__).with_name(name).read_bytes()).hexdigest() for name in modules}
        size=sum(p.stat().st_size for p in INPUTS.rglob('*') if p.is_file() and not p.is_symlink())
        if size>4*1024**3:raise ValueError('prepared-disk-budget')
        inventory=dict(schema=1,path=str(INPUTS),uid=os.geteuid(),expiry='2026-10-19',bundles=bundles,modules=hashes,bytes=size)
        atomic(INPUTS/'inventory.json',inventory)
        inventory_sha=hashlib.sha256((INPUTS/'inventory.json').read_bytes()).hexdigest()
        driver=Path(__file__).with_name('verify_combined_gateway.py')
        command='import hashlib,os;p='+repr(str(driver))+';f=os.fdopen(os.open(p,os.O_RDONLY|os.O_NOFOLLOW),"rb");data=f.read();f.close();assert hashlib.sha256(data).hexdigest()=='+repr(hashes[driver.name])+';g=dict();g.update({chr(95)*2+"file"+chr(95)*2:p});exec(compile(data,p,"exec"),g);raise SystemExit(g.get("main")('+repr(inventory_sha)+'))'
        import shlex
        wrapper=Path(__file__).with_name('run-combined-gateway-owner.sh')
        wrapper.write_text('#!/bin/bash\nset -euo pipefail\nexec sudo /usr/bin/python3 -I -B -S -c '+shlex.quote(command)+'\n');wrapper.chmod(0o700)
        print(json.dumps(dict(prepared=True,bytes=size,inventory_sha=inventory_sha,owner_command=str(wrapper))))
    except BaseException:
        shutil.rmtree(INPUTS);raise


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--refresh-controls',action='store_true');args=parser.parse_args()
    if args.refresh_controls:print(json.dumps(dict(inventory_sha=refresh_controls())))
    else:prepare()
