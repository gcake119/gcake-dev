"""Runner-only shared source probe; no DB, writes, send or update polling."""
import json
import os
from pathlib import Path
import pwd
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from publication_monitor import _notification_configuration
from telegram_readonly_diagnostic import inspect_provider

if __name__=='__main__':
    try:
        if os.geteuid()!=pwd.getpwnam('hermes').pw_uid:raise PermissionError('runner-required')
        readiness,token,chat=_notification_configuration()
        if readiness.get('credential_source')!='gateway' or readiness.get('rejection_reason') is not None:
            print(json.dumps(dict(ready=False,readiness=readiness,message_sends=0,state_writes=0)))
        else:
            probe=inspect_provider(token,chat)
            ready=bool(probe.get('bot_identity_matches_token') and probe.get('chat_identity_matches_configuration') and probe.get('getMe',{}).get('ok') and probe.get('getChat',{}).get('ok'))
            print(json.dumps(dict(ready=ready,credential_source='gateway',identity_pinned=True,
                                  probe=probe,message_sends=0,state_writes=0)))
    except Exception as error:
        print(json.dumps(dict(ready=False,error_type=type(error).__name__,message_sends=0,state_writes=0)))
