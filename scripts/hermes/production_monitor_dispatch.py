"""Runner-only managed cron entry, with a non-secret qualification receipt."""
import os
from pathlib import Path
from production_entry import ProductionStore, HOME
from updater_guard import atomic,read


def main():
    store=ProductionStore()
    if os.geteuid()!=store.runner_uid:raise PermissionError('hermes-monitor-required')
    job_id=read(store.root/'job-context.json')['job_id']
    context={name:os.environ[name] for name in ('HERMES_CRON_JOB_ID','HERMES_CRON_EXECUTION_ID','HERMES_CRON_SCHEDULED_INSTANT')}
    if context['HERMES_CRON_JOB_ID']!=job_id:raise ValueError('unexpected-monitor-job')
    active=store.active()
    result=store.monitor(job_id=job_id,legacy_env=HOME/'.config/gcake-rss/live.env',
        summary_env=HOME/'.config/gcake-rss/publication-monitor.env',db=HOME/'.local/state/gcake-rss/live.sqlite')
    atomic(HOME/'.local/state/gcake-rss/managed-last-run.json',dict(
        job_id=job_id,execution_id=context['HERMES_CRON_EXECUTION_ID'],
        scheduled_instant=context['HERMES_CRON_SCHEDULED_INSTANT'],uid=os.geteuid(),
        digest=active['digest'],mode=active['mode'],exit_code=result))
    return result


if __name__=='__main__':raise SystemExit(main())
