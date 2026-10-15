"""One explicit Hermes Bot continuation after approved runtime adoption."""
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import pwd
import sqlite3
import sys

ROOT=Path('/usr/local/share/gcake-hermes-runtime')
DB=Path('/Users/hermes/.local/state/gcake-rss/live.sqlite')
URL='https://gcake119.github.io/gcake-dev/posts/ithome-2026-publishing-toolchain/'
TITLE='原本只是想自動發文，最後怎麼做成一整套鐵人賽工具？'
PREDECESSOR='owner-confirmed-missing-toolchain-20261015'
OPERATION='owner-approved-hermes-bot-switch-20261015'


def main():
    if os.geteuid()!=pwd.getpwnam('hermes').pw_uid:raise PermissionError('hermes account required')
    local=Path(__file__).resolve().parent
    sys.path.insert(0,str(ROOT/'tools'))
    from production_entry import ProductionStore
    store=ProductionStore()
    with store.lease('live') as payload:
        # The scheduled owner must already use this exact repaired monitor.
        if hashlib.sha256((payload/'library/publication_monitor.py').read_bytes()).digest()!=hashlib.sha256((local/'publication_monitor.py').read_bytes()).digest():
            print(json.dumps(dict(status='blocked',reason='approved_repaired_runtime_not_selected',message_sends=0,state_writes=0)))
            return 1
        sys.path.insert(0,str(local))
        import publication_monitor as product
        from reconcile_notification import resend_once
        from telegram_readonly_diagnostic import inspect_provider
        readiness,token,chat=product._notification_configuration()
        if readiness.get('credential_source')!='gateway' or readiness['rejection_reason'] is not None:
            print(json.dumps(dict(status='blocked',reason='gateway_source_not_ready',readiness=readiness,message_sends=0,state_writes=0)))
            return 1
        probe=inspect_provider(token,chat)
        if not (probe.get('bot_identity_matches_token') and probe.get('chat_identity_matches_configuration') and probe.get('getMe',{}).get('ok') and probe.get('getChat',{}).get('ok')):
            print(json.dumps(dict(status='blocked',reason='identity_or_destination_not_verified',probe=probe)))
            return 1
        with closing(sqlite3.connect(DB.as_uri()+'?mode=ro',uri=True)) as db:
            row=db.execute('SELECT message,status,human_received FROM monitor_events WHERE event_id=?',('article:'+URL,)).fetchone()
            if not row or row[1:]!=('unknown',0):raise ValueError('Expected original unreceived article')
            lines=row[0].splitlines()
            if len(lines)<2 or lines[:2]!=[TITLE,URL]:raise ValueError('Original message changed')
            expected=hashlib.sha256(row[0].encode()).hexdigest()
        # Use exactly the credential and destination just verified, not a token
        # re-resolved across a possible concurrent credential rotation.
        def sender(message):return product._send_delivery(message,'https://api.telegram.org/bot'+token+'/sendMessage',chat)
        result=resend_once(DB,'article:'+URL,OPERATION,expected,sender,
                           DB.parent/'notification-repair-backups',predecessor=PREDECESSOR)
        result.update(credential_source='gateway',sender_identity_pinned=True)
        print(json.dumps(result,ensure_ascii=False))
        return 0 if result['status']=='sent' else 1


if __name__=='__main__':
    try:raise SystemExit(main())
    except Exception as error:
        print(json.dumps(dict(status='blocked',error_type=type(error).__name__)))
        raise SystemExit(1)
