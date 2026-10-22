"""Render a reviewable wrapper; no installed file/config mutation."""
import re
from pathlib import Path
import shlex


def render_wrapper(*, job_id, legacy_env, summary_env, library, db, mode='dry-run', python='/usr/bin/python3', guard_root=None, entrypoint='publication_monitor'):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._:-]{0,127}',job_id):raise ValueError('Invalid job identity')
    if mode not in ('dry-run','live'):raise ValueError('Invalid wrapper mode')
    if entrypoint not in ('publication_monitor','shared_publication_monitor'):raise ValueError('Invalid monitor entrypoint')
    q=shlex.quote
    tools=Path(__file__).resolve().parent
    target=tools/'shared_publication_monitor.py' if entrypoint=='shared_publication_monitor' else Path(library)/'publication_monitor.py'
    setup='import runpy, sys; sys.path.insert(0, '+repr(str(library))+'); '
    if entrypoint=='shared_publication_monitor':setup+='sys.path.insert(0, '+repr(str(tools))+'); '
    bootstrap=setup+'runpy.run_path('+repr(str(target))+', run_name="__main__")'
    guard=[]
    if guard_root is not None:
        check='import sys; sys.path.insert(0, '+repr(str(library))+'); from updater_guard import invocation_lease\nwith invocation_lease('+repr(str(guard_root))+', '+repr(mode)+'): pass'
        guard=[q(str(python))+' -I -B -S -c '+q(check)]
        bootstrap=setup+'from updater_guard import invocation_lease\nwith invocation_lease('+repr(str(guard_root))+', '+repr(mode)+'): runpy.run_path('+repr(str(target))+', run_name="__main__")'
    return '\n'.join(['#!/bin/bash','set -euo pipefail']+guard+[
        'readonly _monitor_job_id="${HERMES_CRON_JOB_ID:?missing scheduler job ID}"',
        'readonly _monitor_execution_id="${HERMES_CRON_EXECUTION_ID:?missing scheduler execution ID}"',
        'readonly _monitor_round_at="${HERMES_CRON_SCHEDULED_INSTANT:?missing original scheduled time}"',
        'set -a','. '+q(str(legacy_env)),'. '+q(str(summary_env)),'set +a',
        'test "$HERMES_CRON_JOB_ID" = "$_monitor_job_id"',
        'test "$HERMES_CRON_EXECUTION_ID" = "$_monitor_execution_id"',
        'test "$HERMES_CRON_SCHEDULED_INSTANT" = "$_monitor_round_at"',
        'test "$HERMES_CRON_JOB_ID" = '+q(job_id),
        'test "${HERMES_RSS_NOTIFY_ENABLED:-false}" = true' if mode=='live' else 'export HERMES_RSS_NOTIFY_ENABLED=false',
        'exec '+q(str(python))+' -I -B -S -c '+q(bootstrap)+' --db '+q(str(db))+(' --live' if mode=='live' else ''),''])
