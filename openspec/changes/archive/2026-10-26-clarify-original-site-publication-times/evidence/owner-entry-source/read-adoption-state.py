"""Read only this adoption's control receipt; never inspect credentials or messages."""
from pathlib import Path
import json
import re
import shutil

root=Path('/usr/local/share/gcake-hermes-runtime')
sha='fcb86727dd27036f25aebd129aeee685631cdf85cc60a5998a32ed8661020d54'
record=json.loads((root/'private'/('notification-successor-'+sha+'.json')).read_text())
update=record.get('managed_update',{})
reason=update.get('reason')
report=dict(phase=record.get('phase'),managed_update_status=update.get('status'),
    reason=reason if isinstance(reason,str) and re.fullmatch(r'[a-z0-9_-]{1,100}',reason) else 'not-a-fixed-reason',
    active=json.loads((root/'active.json').read_text()),
    free_bytes=shutil.disk_usage(root).free,
    notification_sends=0,production_writes=False)
report['authority_directory_bytes']={}
for folder in sorted(root.iterdir()):
    if folder.is_dir() and not folder.is_symlink():
        report['authority_directory_bytes'][folder.name]=sum(p.stat().st_size for p in folder.rglob('*') if p.is_file() and not p.is_symlink())
report['authority_total_bytes']=sum(p.stat().st_size for p in root.rglob('*') if p.is_file() and not p.is_symlink())
candidate=root/'proposals'/sha/'payload'
report['candidate_payload_bytes']=sum(p.stat().st_size for p in candidate.rglob('*') if p.is_file() and not p.is_symlink())
report['existing_managed_limit_bytes']=4*1024**3
report['projected_authority_bytes']=report['authority_total_bytes']+report['candidate_payload_bytes']
report['private_directory_bytes']={p.name:sum(f.stat().st_size for f in p.rglob('*') if f.is_file() and not f.is_symlink()) for p in (root/'private').iterdir() if p.is_dir() and not p.is_symlink()}
print(json.dumps(report,indent=2))
