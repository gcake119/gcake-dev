"""Fixed authorized article only. Execute as hermes; never as root."""
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import pwd
import sqlite3
import sys

ROOT=Path('/usr/local/share/gcake-hermes-runtime')
EXPECTED='f98d49207288ae81f1cad0ece146489c1631700f946ea9146663cfab32eab66e'
URL='https://gcake119.github.io/gcake-dev/posts/ithome-2026-publishing-toolchain/'
TITLE='原本只是想自動發文，最後怎麼做成一整套鐵人賽工具？'
DB=Path('/Users/hermes/.local/state/gcake-rss/live.sqlite')
OPERATION='owner-confirmed-missing-toolchain-20261015'


def main():
    if os.geteuid()!=pwd.getpwnam('hermes').pw_uid:raise PermissionError('hermes account required')
    if json.loads((ROOT/'active.json').read_text())!=dict(digest=EXPECTED,mode='live'):
        raise ValueError('Selected production release changed; inspect before proceeding')
    sys.path.insert(0,str(ROOT/'tools'))
    from production_entry import ProductionStore
    store=ProductionStore()
    with store.lease('live'):
        sys.path.insert(0,str(Path(__file__).resolve().parent))
        from reconcile_notification import resend_once
        from publication_monitor import send_notification
        with closing(sqlite3.connect(DB.as_uri()+'?mode=ro',uri=True)) as db:
            row=db.execute('SELECT message,status,human_received FROM monitor_events WHERE event_id=?',('article:'+URL,)).fetchone()
            if not row or row[1:]!=('unknown',0):raise ValueError('Event changed or no longer eligible')
            lines=row[0].splitlines()
            if len(lines)<2 or lines[0]!=TITLE or lines[1]!=URL:raise ValueError('Unexpected original message')
            expected_hash=hashlib.sha256(row[0].encode()).hexdigest()
        result=resend_once(DB,'article:'+URL,OPERATION,expected_hash,send_notification,
                           DB.parent/'notification-repair-backups')
        print(json.dumps(result,ensure_ascii=False))
        return 0 if result['status']=='sent' else 1


if __name__=='__main__':
    try:raise SystemExit(main())
    except Exception as error:
        print(json.dumps(dict(status='blocked',error_type=type(error).__name__)))
        raise SystemExit(1)
