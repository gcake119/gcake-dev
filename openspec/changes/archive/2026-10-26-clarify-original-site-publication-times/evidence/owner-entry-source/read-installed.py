"""Pure public release readback: no private state, network or sender invocation."""
import hashlib
import json
from pathlib import Path
import sys

ROOT=Path('/usr/local/share/gcake-hermes-runtime')
EXPECTED='fcb86727dd27036f25aebd129aeee685631cdf85cc60a5998a32ed8661020d54'
MONITOR_SHA='94a43f69cecb074300e8c8a6d88642b251991ecc365c48cee0089659ad8fa42a'
active=json.loads((ROOT/'active.json').read_text())
if active!={'digest':EXPECTED,'mode':'live'}:
    print(json.dumps(dict(status='awaiting-adoption',active=active)));raise SystemExit(1)
payload=ROOT/'releases'/EXPECTED
source=payload/'library/publication_monitor.py'
assert hashlib.sha256(source.read_bytes()).hexdigest()==MONITOR_SHA
sys.path.insert(0,str(payload/'library'))
import publication_monitor as monitor
assert Path(monitor.__file__).resolve()==source
at=monitor.instant('2026-10-26T09:24:50+08:00')
assert monitor.public_confirmation_time({'publicWindow':[at-60,at+1]},{'observedAt':at})=='2026-10-26 09:24'
assert monitor.public_confirmation_time({'publicWindow':[at-60,at+1]},{'observedAt':True})=='未記錄'
print(json.dumps(dict(status='installed-readback-passed',active=active,monitor_sha256=MONITOR_SHA,
    scheduled_label='原定發布時間（台北）',confirmation_label='公開確認時間（台北）',
    private_state_read=False,notification_sends=0),ensure_ascii=False,indent=2))
