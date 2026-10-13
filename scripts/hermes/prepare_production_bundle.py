"""Prepare a fixture-free Hermes payload; no production mutation or credentials."""
import hashlib
import argparse
import json
import os
from pathlib import Path
import shutil
from stage_cron_context import patch_source, SOURCE_SHA256
from updater_guard import tree, digest, atomic, check_payload

BASE=Path('/private/tmp/gcake-hermes-monitor-plan-20261012')
TARGET=BASE/'production-rollout-inputs'
RSS_SHA='f4b1e2dd88e53674e30abbd73b7a8ba7874246f74c20b46a9a6745e4a30ee7ac'


def prepare(rebuild=False):
    if os.geteuid()==0:raise PermissionError('prepare-as-main-user')
    if TARGET.exists():
        marker=json.loads((TARGET/'prepared.json').read_text())
        if not rebuild or TARGET.resolve()!=TARGET or marker.get('owner_uid')!=os.geteuid() or marker.get('path')!=str(TARGET):
            raise ValueError('production-inputs-already-exist')
        manifest=json.loads((TARGET/'bundle/manifest.json').read_text())
        if digest(manifest)!=marker['bundle_digest']:raise ValueError('owned-input-drift')
        check_payload(TARGET/'bundle/payload',manifest)
        shutil.rmtree(TARGET)
    source=BASE/'hermes-gateway-source'
    scripts=Path(__file__).parent
    for path,sha in ((source/'cron/scheduler_script.py',SOURCE_SHA256),(scripts/'rss_monitor.py',RSS_SHA)):
        if hashlib.sha256(path.read_bytes()).hexdigest()!=sha:raise ValueError('original-source-drift')
    evidence=BASE/'docs/hermes-monitor-evidence/combined-owner-passed.json'
    owner=json.loads(evidence.read_text())
    if not owner.get('passed') or not owner['cleanup']['owned_root_removed']:
        raise ValueError('combined-qualification-required')
    if shutil.disk_usage(BASE).free<4*1024**3:raise ValueError('disk-budget')
    TARGET.mkdir(mode=0o700)
    try:
        payload=TARGET/'bundle/payload';payload.mkdir(parents=True)
        ignore=shutil.ignore_patterns('.git','.env','.env.*','venv','.venv','__pycache__','*.pyc','*.sqlite','*.db')
        shutil.copytree(source,payload/'code',symlinks=True,ignore=ignore)
        kernel=payload/'code/cron/scheduler_script.py';kernel.write_text(patch_source(kernel.read_text()))
        shutil.copytree('/Users/caiyijun/.local/share/uv/python/cpython-3.11.15-macos-aarch64-none',payload/'runtime',symlinks=True,ignore=ignore)
        shutil.copytree(BASE/'hermes-gateway-env311/lib/python3.11/site-packages',payload/'runtime/lib/python3.11/site-packages',dirs_exist_ok=True,symlinks=True,ignore=ignore)
        library=payload/'library';library.mkdir()
        for name in ('publication_monitor.py','rss_monitor.py'):shutil.copy2(scripts/name,library/name)
        if hashlib.sha256((library/'rss_monitor.py').read_bytes()).hexdigest()!=RSS_SHA:
            raise ValueError('real-transport-provenance-required')
        for path in (payload,*payload.rglob('*')):
            if not path.is_symlink():path.chmod(0o755 if path.is_dir() or path.stat().st_mode&0o111 else 0o644)
        manifest=dict(schema=1,release_id='hermes-0214-gcake-context-20261013',
            source_sha='7ce190446e548e2e1c0ae6ba0225be0490d12fc2',
            patch_sha=hashlib.sha256((scripts/'hermes-cron-context.patch').read_bytes()).hexdigest(),
            lock_sha=hashlib.sha256((source/'uv.lock').read_bytes()).hexdigest(),python_version='3.11.15',
            verification=dict(passed=True,evidence_sha=hashlib.sha256(evidence.read_bytes()).hexdigest()),files=tree(payload))
        atomic(TARGET/'bundle/manifest.json',manifest);check_payload(payload,manifest)
        receipt=dict(schema=1,owner_uid=os.geteuid(),bundle_digest=digest(manifest),
            path=str(TARGET),production_operations=False,contains_credentials=False,
            rss_original_hash_matches=True,transport='unmodified-original-real-library',
            prior_evidence_scope='combined fixture transport; actual network qualification pending',
            bytes=sum(p.stat().st_size for p in payload.rglob('*') if p.is_file() and not p.is_symlink()))
        atomic(TARGET/'prepared.json',receipt)
        print(json.dumps(receipt))
    except BaseException:
        shutil.rmtree(TARGET);raise


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--rebuild',action='store_true');args=parser.parse_args()
    prepare(args.rebuild)
