"""Local preflight and sanitized journal inspection. No network or SQL writes."""
from contextlib import closing
import json
import os
from pathlib import Path
import pwd
import sqlite3
import sys
from publication_monitor import notification_readiness

URL='https://gcake119.github.io/gcake-dev/posts/ithome-2026-publishing-toolchain/'
DB=Path('/Users/hermes/.local/state/gcake-rss/live.sqlite')


def main():
    if os.geteuid()!=pwd.getpwnam('hermes').pw_uid:raise PermissionError('hermes account required')
    report=dict(scope=sys.argv[1],readiness=notification_readiness(),network_requests=0,state_writes=0,
                gateway_inherited_environment_observed=False)
    with closing(sqlite3.connect(DB.as_uri()+'?mode=ro',uri=True)) as db:
        db.execute('PRAGMA query_only=ON')
        report['event']=db.execute('SELECT status,human_received FROM monitor_events WHERE event_id=?',('article:'+URL,)).fetchone()
        report['outbox']=db.execute('SELECT status FROM outbox WHERE url=?',(URL,)).fetchone()
        report['attempts']=db.execute('SELECT status,error_type,reason_type,error_code,message_id FROM monitor_delivery_attempts WHERE event_id=? ORDER BY attempt_id DESC LIMIT 3',('article:'+URL,)).fetchall()
        report['reconciliation']=db.execute('SELECT operation,status FROM monitor_reconciliations WHERE event_id=?',('article:'+URL,)).fetchall()
    print(json.dumps(report))


if __name__=='__main__':
    try:main()
    except Exception as error:
        print(json.dumps(dict(status='blocked',error_type=type(error).__name__,network_requests=0,state_writes=0)))
        raise SystemExit(1)
