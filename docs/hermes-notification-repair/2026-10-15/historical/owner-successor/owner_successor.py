"""Pinned owner adapter over existing approval, updater and policy interfaces."""
from contextlib import closing,redirect_stdout
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import stat
import sys
import tempfile
from updater_guard import read,digest,check_payload,atomic
from update_entry import write_public,sync_directory

ROOT=Path('/usr/local/share/gcake-hermes-runtime')
JOB='550aaf17723d'


def publish_pointer(store,sha,base):
    store.writer()
    if store.journal.exists():raise ValueError('pending-update-recovery')
    if store.active()['digest']!=base:raise ValueError('active-baseline-drift')
    target=store.root/'proposals'/sha
    manifest=read(target/'manifest.json')
    if digest(manifest)!=sha or read(store.root/'approvals.json').get(manifest['release_id'])!=sha:
        raise ValueError('exact-approval-required')
    pointer=store.root/'private/next-candidate.json'
    if pointer.exists():
        store.safe(pointer)
        if read(pointer)!={'digest':sha}:raise ValueError('foreign-successor-pending')
    else:atomic(pointer,dict(digest=sha))


def stage_proposal(store,bundle,sha,base,*,verify=None,publish=True):
    store.writer()
    if store.journal.exists():raise ValueError('pending-update-recovery')
    if store.active()['digest']!=base:raise ValueError('active-baseline-drift')
    pointer=store.root/'private/next-candidate.json'
    if pointer.exists() and read(pointer)!={'digest':sha}:raise ValueError('foreign-successor-pending')
    bundle=Path(bundle)
    manifest=read(bundle/'manifest.json')
    if digest(manifest)!=sha:raise ValueError('proposal-digest-drift')
    check_payload(bundle/'payload',manifest)
    if verify is None:
        from packaging_contract import verify_candidate
        verify=verify_candidate
    verify(bundle)
    proposals=store.root/'proposals';proposals.mkdir(mode=0o755,exist_ok=True);store.safe(proposals)
    target=proposals/sha
    if target.exists():
        store.safe(target)
        if read(target/'manifest.json')!=manifest:raise ValueError('existing-proposal-drift')
        verify(target)
    else:
        staging=proposals/('.stage-'+sha)
        if staging.exists():raise ValueError('unfinished-proposal-staging')
        try:
            shutil.copytree(bundle,staging,symlinks=True)
            verify(staging)
            for path in (staging,*staging.rglob('*')):
                info=path.lstat()
                if info.st_uid!=store.uid or (not path.is_symlink() and info.st_mode&0o022):
                    raise ValueError('unsafe-staged-proposal')
            staging.rename(target);sync_directory(proposals)
        except BaseException:
            if staging.exists() and not staging.is_symlink():shutil.rmtree(staging)
            raise
    store.approve(manifest,sha)
    if publish:publish_pointer(store,sha,base)
    return dict(status='approved',proposal_digest=sha,proposal_path=str(target),
                manifest_path=str(target/'manifest.json'),next_candidate_published=publish)


def job_contract(job):
    return {key:job.get(key) for key in ('id','enabled','no_agent','schedule','script','deliver','failure_deliver')}


def history_hash(actor,payload):
    code='import sqlite3,json,hashlib;from pathlib import Path;from contextlib import closing\np=Path("/Users/hermes/.local/state/gcake-rss/live.sqlite")\nwith closing(sqlite3.connect(p.as_uri()+"?mode=ro",uri=True)) as db:\n db.execute("PRAGMA query_only=ON")\n value=hashlib.sha256("\\n".join(db.iterdump()).encode()).hexdigest()\nprint(json.dumps(dict(sha256=value)))'
    return actor.run(payload,code)['sha256']


def source_probe(actor,payload):
    bootstrap='import sys,runpy;sys.path.insert(0,sys.argv[1]);runpy.run_path(sys.argv[1]+"/successor_runner_probe.py",run_name="__main__")'
    import shlex
    shell='set -euo pipefail\nset -a\n. /Users/hermes/.config/gcake-rss/live.env\n. /Users/hermes/.config/gcake-rss/publication-monitor.env\nset +a\nexec "$1" -I -B -S -c '+shlex.quote(bootstrap)+' "$2"'
    argv=['/bin/bash','-c',shell,'source-probe',str(payload/'runtime/bin/python3.11'),str(payload/'library')]
    code='import subprocess,json\nr=subprocess.run('+repr(argv)+',capture_output=True,text=True,timeout=45)\ntry:value=json.loads(r.stdout.splitlines()[-1])\nexcept Exception:value=dict(ready=False,error_type="runner-probe-failed")\nprint(json.dumps(value))'
    return actor.run(payload,code,timeout=55)


def natural_receipt(actor,payload,sha):
    code='from pathlib import Path;import json\nr=json.loads(Path("/Users/hermes/.local/state/gcake-rss/managed-last-run.json").read_text())\nprint(json.dumps({k:r.get(k) for k in ("job_id","execution_id","scheduled_instant","uid","digest","mode","exit_code")}))'
    receipt=actor.run(payload,code)
    if not (receipt.get('job_id')==JOB and receipt.get('digest')==sha and receipt.get('mode')=='dry-run' and receipt.get('uid')==actor.user.pw_uid and receipt.get('exit_code')==0):
        raise ValueError('natural-dry-receipt-required')
    matches=[row for row in actor.ledger() if row[0]==receipt.get('execution_id')]
    if len(matches)!=1 or matches[0][1:]!=[JOB,receipt.get('scheduled_instant'),'completed']:
        raise ValueError('natural-ledger-receipt-mismatch')
    return receipt


def restore_live_policy(store,sha,actor,health,contract,record,save):
    if store.active()['digest']!=sha:raise ValueError('qualified-selection-drift')
    if record.get('phase') not in ('qualified','activating'):raise ValueError('qualification-record-required')
    if store.journal.exists():raise ValueError('pending-update-recovery')
    if health.get('status')!='passed':raise ValueError('current-gateway-health-required')
    with store.maintenance():
        if not actor.drained():raise ValueError('cron-execution-in-progress')
        if job_contract(actor.job())!=contract:raise ValueError('existing-job-changed')
        before=history_hash(actor,store.verify_release(sha))
        if record.get('phase')=='activating' and record.get('policy_history_hash')!=before:
            store.select(sha,mode='dry-run');store.gate('ready',sha,'dry-run')
            record.update(phase='activation-failed',reason='interrupted-policy-history-drift');save(record)
            raise ValueError('interrupted-policy-history-drift')
        record.update(phase='activating',policy_history_hash=before);save(record)
        store.gate('maintenance')
        store.select(sha,mode='live');store.gate('ready',sha,'live')
        if history_hash(actor,store.verify_release(sha))!=before:
            store.select(sha,mode='dry-run');store.gate('ready',sha,'dry-run')
            record.update(phase='activation-failed',reason='notification-history-changed');save(record)
            raise ValueError('notification-history-changed')
        record.update(phase='active-live',mode='live',notification_history_unchanged=True,job_unchanged=True)
        save(record)
    return record


def public_report(record,receipt_path,**extra):
    # Job contracts can include private destinations: never project them.
    keys=('status','phase','base_digest','proposal_digest','proposal_path','manifest_path',
          'next_candidate_created','next_candidate_published','next_candidate_cleared',
          'qualification','mode','notification_history_unchanged','job_unchanged')
    result={key:record[key] for key in keys if key in record}
    result.update(status=record.get('phase','blocked'),receipt_path=str(receipt_path),**extra)
    return result


def main(control,package):
    if os.geteuid()!=0 or sys.platform!='darwin':raise PermissionError('root-macos-owner-required')
    package=Path(package)
    if package.resolve()!=package or not str(package).startswith('/private/tmp/'):
        raise ValueError('fixed-local-package-required')
    tools=ROOT/'tools'
    for name,sha in control['installed_tools'].items():
        if not re.fullmatch(r'[a-z_]+\.py',name):raise ValueError('invalid-installed-tool-name')
        path=tools/name;info=path.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_uid!=0 or info.st_mode&0o022 or info.st_nlink!=1 or hashlib.sha256(path.read_bytes()).hexdigest()!=sha:
            raise ValueError('installed-control-drift')
    sys.path.insert(0,str(tools))
    from production_entry import ProductionStore
    from production_owner import Actor,Supervisor,updater_exclusion,manage,validate_existing_job
    from packaging_contract import verify_candidate
    store=ProductionStore();sha=control['bundle_digest'];base=control['base_digest']
    receipt_path=ROOT/'private'/('notification-successor-'+sha+'.json')
    record=read(receipt_path) if receipt_path.exists() else dict(schema=1,phase='prepared',base_digest=base,proposal_digest=sha)
    def save(value):atomic(receipt_path,value)
    if record.get('proposal_digest')!=sha or record.get('base_digest')!=base:raise ValueError('owner-receipt-drift')
    if record.get('phase')=='active-live':
        status=store.launch_status()
        if status!={'status':'ready','digest':sha,'mode':'live'}:raise ValueError('completed-selection-drift')
        with updater_exclusion():
            pointer=ROOT/'private/next-candidate.json'
            if pointer.exists() and read(pointer)=={'digest':sha}:
                pointer.unlink();sync_directory(pointer.parent)
                record.update(next_candidate_published=False,next_candidate_cleared=True);save(record)
        print(json.dumps(public_report(record,receipt_path,already_complete=True)));return 0
    if record.get('phase') in ('rolled_back','recovery_failed','updating','activation-failed'):
        print(json.dumps(dict(status='blocked',reason='reconcile-existing-owner-operation',receipt_path=str(receipt_path),phase=record['phase'])));return 1
    try:
        if store.journal.exists():raise ValueError('pending-update-recovery')
        if record['phase'] not in ('qualified','activating'):
            bundle=package/'bundle';manifest=read(bundle/'manifest.json')
            if digest(manifest)!=sha:raise ValueError('package-manifest-drift')
            verify_candidate(bundle)
            if store.active()!=dict(digest=base,mode='live'):raise ValueError('initial-live-baseline-drift')
            with updater_exclusion():
                staged=stage_proposal(store,bundle,sha,base,publish=False)
                record.update(staged,phase='approved');save(record)
            proposal=ROOT/'proposals'/sha
            actor=Actor(store);job=validate_existing_job(actor);record['job_contract']=job_contract(job)
            # Re-prove native SDK as hermes, with all external effects denied.
            code='import runpy;runpy.run_path("/usr/local/share/gcake-hermes-runtime/tools/offline_probe.py",run_name="__main__")'
            sdk=actor.run(proposal/'payload',code,timeout=45)
            if sdk!=manifest['verification']['telegram']:raise ValueError('native-sdk-proof-drift')
            probe=source_probe(actor,proposal/'payload');record['source_probe']=probe
            if probe.get('ready') is not True:
                record['phase']='approved';save(record)
                print(json.dumps(dict(status='staged-awaiting-shared-source',proposal_digest=sha,proposal_path=str(proposal),source_probe=probe,receipt_path=str(receipt_path))));return 1
            with updater_exclusion():
                publish_pointer(store,sha,base)
                record.update(phase='updating',next_candidate=str(ROOT/'private/next-candidate.json'),next_candidate_created=True,next_candidate_published=True);save(record)
            output=io.StringIO()
            with redirect_stdout(output):manage('update')
            result=json.loads(output.getvalue().splitlines()[-1]);record['managed_update']=result
            if result.get('status')!='updated' or store.active()!=dict(digest=sha,mode='dry-run'):
                record['phase']=result.get('status','blocked');save(record)
                print(json.dumps(public_report(record,receipt_path)));return 1
            actor=Actor(store)
            record['qualification']=natural_receipt(actor,actor.payload(),sha)
            record['phase']='qualified';save(record)
        actor=Actor(store);payload=actor.payload()
        if store.active()['digest']!=sha:raise ValueError('qualified-selection-drift')
        probe=source_probe(actor,payload)
        if probe.get('ready') is not True:
            print(json.dumps(dict(status='qualified-dry-run-awaiting-source',source_probe=probe,receipt_path=str(receipt_path))));return 1
        original=read(ROOT/'private/original-gateway-map.json')
        service=Supervisor(store,original,actor)
        health=service.verify_telegram_health(payload)
        with updater_exclusion():
            restore_live_policy(store,sha,actor,health,record['job_contract'],record,save)
            pointer=ROOT/'private/next-candidate.json'
            if pointer.exists() and read(pointer)=={'digest':sha}:
                pointer.unlink();sync_directory(pointer.parent)
                record.update(next_candidate_published=False,next_candidate_cleared=True);save(record)
        result=public_report(record,receipt_path,message_sends=0,manual_job_execution=False,
                    next_step='Hermes executes the fixed one-time continuation after verifying this receipt')
        print(json.dumps(result));return 0
    except Exception as error:
        reason=str(error)
        report=dict(status='blocked',error_type=type(error).__name__,phase=record.get('phase'),receipt_path=str(receipt_path))
        if re.fullmatch(r'[a-z0-9_-]{1,100}',reason):report['reason']=reason
        print(json.dumps(report));return 1


if __name__=='__main__':
    raise SystemExit(main(APPROVED_CONTROL,PACKAGE_ROOT))
