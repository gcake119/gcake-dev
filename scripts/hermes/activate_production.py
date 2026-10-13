"""Fixed authorized live activation; no job execution or notification replay."""
import json
import os
from pathlib import Path
import sys
import time

DIGEST='8e285697719b62295eae5bd8db23ed52b8da6f6dbe585eabef91b835462f9f2e'
MAIN='550aaf17723d'
DRY='ea3c550669f1'

def checked_jobs(rows,prior):
    if set(rows)!={MAIN,DRY}:raise ValueError('fixed-jobs-required')
    for ident,script in ((MAIN,'gcake-rss-live.sh'),(DRY,'gcake-rss-dry.sh')):
        row=rows[ident];schedule=row.get('schedule',{})
        if (row.get('id')!=ident or row.get('no_agent') is not True or
                schedule.get('kind')!='interval' or schedule.get('minutes')!=60 or
                row.get('script') not in (script,'/Users/hermes/.hermes/scripts/'+script)):
            raise ValueError('job-baseline-drift')
    if rows[MAIN].get('enabled') is not True:raise ValueError('managed-job-not-enabled')
    if rows[DRY].get('enabled') is not True and not (
            prior and rows[DRY].get('enabled') is False and
            rows[DRY].get('paused_reason')=='gcake-managed-live-activation'):
        raise ValueError('dry-job-baseline-drift')

def activate(store, actor, load, save):
    prior=load();active=store.active()
    if active['digest']!=DIGEST or (prior and prior.get('digest')!=DIGEST):
        raise ValueError('activation-release-drift')
    checked_jobs(actor.jobs(),prior)
    if prior and prior['phase']=='committed':
        if active['mode']!='live':raise ValueError('committed-policy-drift')
        return dict(status='already-live',digest=DIGEST)
    if active['mode']!='dry-run' and not prior:raise ValueError('unrecorded-live-policy')
    with store.maintenance():
        if prior:
            store.select('dry-run');store.gate('ready',DIGEST,'dry-run')
        rows=actor.jobs();checked_jobs(rows,prior)
        before=actor.db_hash()
        record=dict(digest=DIGEST,phase='prepared',managed_before=rows[MAIN],dry_before=rows[DRY])
        save(record)
        try:
            store.gate('maintenance')
            actor.pause();record['phase']='dry-job-paused';save(record)
            after=actor.jobs()
            checked_jobs(after,record)
            # The scheduler may naturally advance next_run_at; do not rewind it.
            for key in ('id','script','enabled','no_agent','schedule','deliver','failure_deliver'):
                if after[MAIN].get(key)!=rows[MAIN].get(key):raise ValueError('managed-job-changed')
            if after[DRY].get('enabled') is not False:raise ValueError('dry-job-not-paused')
            if actor.db_hash()!=before:raise ValueError('notification-state-changed-during-activation')
            record['phase']='selecting-live';save(record)
            store.select('live');record['phase']='live-selected';save(record)
            store.gate('ready',DIGEST,'live')
            record['phase']='committed';save(record)
        except BaseException:
            # No notification intent is executed here. Partial job pause is retained
            # and recorded; the managed sender remains safely in its prior dry mode.
            store.select('dry-run');store.gate('ready',DIGEST,'dry-run')
            record['phase']='blocked';save(record)
            raise
    return dict(status='activated-live',digest=DIGEST,old_dry_job_paused=True,
                managed_job_id=MAIN,managed_schedule_preserved=True,notification_state_unchanged=True)

def main():
    report=dict(passed=False,telegram_test_messages=False,manual_job_execution=False,commit_push=False)
    try:
        if os.geteuid()!=0:raise PermissionError('root-activation-required')
        root=Path('/usr/local/share/gcake-hermes-runtime')
        sys.path.insert(0,str(root/'tools'))
        from production_entry import ProductionStore
        from production_owner import Actor,updater_exclusion
        from updater_guard import read,atomic
        from update_entry import write_public
        store=ProductionStore()
        qualified=read(root/'private/production-qualified.json')
        if qualified.get('digest')!=DIGEST or qualified.get('verified') is not True or qualified.get('job_id')!=MAIN:
            raise ValueError('production-qualification-required')
        if read(root/'private/first-production-install.json').get('phase')!='verified':
            raise ValueError('first-install-not-verified')
        store.verify_release(DIGEST)
        actor=Actor(store)

        class Jobs:
            def jobs(self):
                code='import json;from pathlib import Path\ndef records(v):\n if isinstance(v,dict):\n  if v.get("id") in '+repr((MAIN,DRY))+':yield v\n  for x in v.values():yield from records(x)\n elif isinstance(v,list):\n  for x in v:yield from records(x)\nrows=list(records(json.loads(Path("/Users/hermes/.hermes/cron/jobs.json").read_text())))\nprint(json.dumps({r["id"]:{k:r.get(k) for k in ("id","script","enabled","no_agent","schedule","deliver","failure_deliver","paused_reason")} for r in rows}))'
                return actor.run(actor.payload(),code)
            def db_hash(self):
                return actor.run(actor.payload(),'import hashlib,json;from pathlib import Path;print(json.dumps(hashlib.sha256(Path("/Users/hermes/.local/state/gcake-rss/live.sqlite").read_bytes()).hexdigest()))')
            def pause(self):
                code='from cron.jobs import pause_job;import json;r=pause_job('+repr(DRY)+',reason="gcake-managed-live-activation");assert r and r["enabled"] is False;print(json.dumps(dict(paused=True)))'
                if not actor.run(actor.payload(),code)['paused']:raise ValueError('pause-not-confirmed')

        class Policy:
            def active(self):return store.active()
            def maintenance(self):return store.maintenance()
            def gate(self,*args):return store.gate(*args)
            def select(self,mode):write_public(root/'active.json',dict(digest=DIGEST,mode=mode))

        journal=root/'private/live-activation.json'
        def load():return read(journal) if journal.exists() else None
        def save(value):atomic(journal,value)
        with updater_exclusion():
            if not actor.drained():raise ValueError('cron-execution-in-progress')
            # Existing private env is loaded only by hermes; no credential value
            # reaches root stdout or this journal. No monitor or Telegram call.
            enabled=actor.run(actor.payload(),'import subprocess,json;r=subprocess.run(["/bin/bash","-c",\'set -a; . /Users/hermes/.config/gcake-rss/live.env; test "${HERMES_RSS_NOTIFY_ENABLED:-false}" = true\'],capture_output=True);print(json.dumps(dict(enabled=r.returncode==0)))')
            if not enabled['enabled']:raise ValueError('existing-live-notification-flag-disabled')
            if actor.summary()['complete'] is not True:raise ValueError('summary-unavailable')
            result=activate(Policy(),Jobs(),load,save)
        report.update(result,passed=True,production_operations=True,
                      next_step='verify-next-natural-live-round')
        deadline=time.monotonic()+3900;progress=0
        while time.monotonic()<deadline:
            if time.monotonic()>progress:
                print('activation: waiting for next natural live round',file=sys.stderr,flush=True)
                progress=time.monotonic()+30
            receipt=Path('/Users/hermes/.local/state/gcake-rss/managed-last-run.json')
            if receipt.exists():
                data=read(receipt)
                if data.get('mode')=='live' and data.get('digest')==DIGEST and data.get('job_id')==MAIN:
                    matches=[r for r in actor.ledger() if r[0]==data.get('execution_id')]
                    if matches and matches[0][3] in ('failed','completed'):
                        if (matches[0][3]!='completed' or data.get('exit_code')!=0 or
                                data.get('uid')!=502 or data.get('scheduled_instant')!=matches[0][2]):
                            raise ValueError('natural-live-round-failed')
                        current=store.launch_status()
                        if current.get('mode')!='live' or current.get('digest')!=DIGEST:
                            raise ValueError('live-selection-changed')
                        atomic(root/'private/production-live-qualified.json',dict(digest=DIGEST,verified=True,round=data))
                        report.update(natural_live_verified=True,round=data,next_step='scoped-commit-and-push')
                        break
            time.sleep(5)
        else:
            report.update(passed=False,natural_live_verified=False,error='natural-live-round-not-yet-qualified',
                          live_policy_retained=True,next_step='reconcile-without-replay')
    except Exception as error:
        report.update(error_type=type(error).__name__,error='activation-blocked')
        report['passed']=False
        if report.get('production_operations') and str(error) in ('natural-live-round-failed','live-selection-changed'):
            # A failed live check never causes a send retry or state rewind.
            # Close the gate first; if the lease cannot drain, it stays closed.
            store.gate('maintenance')
            try:
                with store.maintenance():
                    write_public(root/'active.json',dict(digest=DIGEST,mode='dry-run'))
                    store.gate('ready',DIGEST,'dry-run')
                    record=read(journal);record['phase']='blocked';atomic(journal,record)
                report['sender_returned_to_dry_run']=True
            except Exception:
                report['maintenance_gate_retained']=True
        label=str(error)
        if label and all(c in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in label):report['error']=label
    print(json.dumps(report,indent=2))
    return 0 if report['passed'] else 1

if __name__=='__main__':raise SystemExit(main())
