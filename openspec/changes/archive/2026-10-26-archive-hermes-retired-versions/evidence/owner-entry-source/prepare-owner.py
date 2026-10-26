"""Prepare a hash-pinned owner entry, reusing installed controls without replacing them."""
from pathlib import Path
import hashlib
import json
import os
import shlex
import shutil

REPO=Path('/Users/caiyijun/project/gcake-dev')
PACKAGE=Path('/private/tmp/gcake-retired-archive-20261026')
ROOT=Path('/usr/local/share/gcake-hermes-runtime')
PERSIST=Path('/usr/local/share/gcake-hermes-archives/20261026-retired-versions/controls')
SOURCE_NAMES=('archive_retired_packages.py','owner_successor.py')

LOADER='''import hashlib,json,os,re,runpy,shlex,stat,sys,tempfile
from pathlib import Path
ROOT=Path('/usr/local/share/gcake-hermes-runtime')
PACKAGE=Path(PACKAGE_LITERAL)
PERSIST=Path(PERSIST_LITERAL)
HASHES=HASHES_LITERAL
TOOLS=TOOLS_LITERAL
OWNER=OWNER_LITERAL
def checked(path,sha):
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 with os.fdopen(fd,'rb') as stream:
  st=os.fstat(stream.fileno());raw=stream.read(1024*1024+1)
 if not stat.S_ISREG(st.st_mode) or st.st_nlink!=1 or st.st_uid not in (0,OWNER) or st.st_mode&0o022 or len(raw)>1024*1024 or hashlib.sha256(raw).hexdigest()!=sha:raise ValueError('owner-input-drift')
 return raw
def main():
 if os.geteuid()!=0:raise PermissionError('root-required')
 package=Path(sys.argv[1]);action=sys.argv[2]
 if package not in (PACKAGE,PERSIST) or package.resolve()!=package:raise ValueError('package-path-drift')
 if action not in ('plan','archive','resume','restore'):raise ValueError('fixed-action-required')
 for name,sha in TOOLS.items():checked(ROOT/'tools'/name,sha)
 sources={name:checked(package/name,sha) for name,sha in HASHES.items()}
 with tempfile.TemporaryDirectory(prefix='gcake-archive-owner-',dir='/private/tmp') as folder:
  temp=Path(folder)
  for name,raw in sources.items():
   p=temp/name;p.write_bytes(raw);p.chmod(0o600)
  sys.path.insert(0,str(ROOT/'tools'));sys.path.insert(1,str(temp))
  scope=runpy.run_path(str(temp/'archive_retired_packages.py'),run_name='archive_owner_control')
  result=scope['production_main'](action)
  if result['status']=='archived':
   PERSIST.mkdir(mode=0o700,exist_ok=True)
   st=PERSIST.lstat()
   if not stat.S_ISDIR(st.st_mode) or st.st_uid!=0 or st.st_mode&0o077:raise ValueError('unsafe-restore-controls')
   values=dict(sources,**{'loader.py':Path(__file__).read_bytes()})
   command='#!/bin/bash\\nset -euo pipefail\\nexec /usr/bin/python3 -I -B -S '+shlex.quote(str(PERSIST/'loader.py'))+' '+shlex.quote(str(PERSIST))+' restore\\n'
   values['owner_restore.sh']=command.encode()
   from updater_guard import atomic
   for name,raw in values.items():
    p=PERSIST/name
    if p.is_symlink() or (p.exists() and p.read_bytes()!=raw):raise ValueError('foreign-restore-control')
    if not p.exists():
     with p.open('xb') as stream:stream.write(raw);stream.flush();os.fsync(stream.fileno())
     p.chmod(0o700 if name.endswith('.sh') else 0o600)
   atomic(PERSIST/'control-hashes.json',{name:hashlib.sha256(raw).hexdigest() for name,raw in values.items()})
   result['restore_controls_preserved']=True
  result['restore_command']='sudo bash '+str(PERSIST/'owner_restore.sh')
  print(json.dumps(result,indent=2))
  return 0 if result['status'] in ('planned','archived','restored') else 1
try:raise SystemExit(main())
except Exception as error:
 reason=str(error)
 print(json.dumps(dict(status='blocked',error_type=type(error).__name__,error_errno=getattr(error,'errno',None),reason=reason if re.fullmatch('[a-z0-9_-]{1,100}',reason) else 'protected-diagnostic-required',notification_sends=0)))
 raise SystemExit(1)
'''

def main():
    if PACKAGE.exists():raise ValueError('owned-package-already-exists')
    PACKAGE.mkdir(mode=0o755)
    owner=dict(path=str(PACKAGE),owner_uid=os.getuid(),purpose='authorized exact retired-package archive and dependent timestamp adoption',retention='until archive, adoption and readback complete; root restore controls are retained separately')
    (PACKAGE/'owned.json').write_text(json.dumps(owner,indent=2))
    hashes={}
    for name in SOURCE_NAMES:
        raw=(REPO/'scripts/hermes'/name).read_bytes();hashes[name]=hashlib.sha256(raw).hexdigest()
        (PACKAGE/name).write_bytes(raw);(PACKAGE/name).chmod(0o644)
    tools={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((ROOT/'tools').glob('*.py'))}
    loader=LOADER.replace('PACKAGE_LITERAL',repr(str(PACKAGE))).replace('PERSIST_LITERAL',repr(str(PERSIST))).replace('HASHES_LITERAL',repr(hashes)).replace('TOOLS_LITERAL',repr(tools)).replace('OWNER_LITERAL',str(os.getuid()))
    (PACKAGE/'loader.py').write_text(loader);(PACKAGE/'loader.py').chmod(0o644)
    loader_sha=hashlib.sha256(loader.encode()).hexdigest()
    boot='''import hashlib,os,runpy,stat,sys,tempfile
from pathlib import Path
p=Path(PACKAGE_LITERAL)
if os.geteuid()!=0 or p.resolve()!=p:raise PermissionError('fixed-root-package-required')
fd=os.open(p/'loader.py',os.O_RDONLY|os.O_NOFOLLOW)
with os.fdopen(fd,'rb') as f:st=os.fstat(f.fileno());raw=f.read(1024*1024)
if not stat.S_ISREG(st.st_mode) or st.st_nlink!=1 or st.st_uid not in (0,OWNER_LITERAL) or st.st_mode&0o022 or hashlib.sha256(raw).hexdigest()!=SHA_LITERAL:raise ValueError('loader-drift')
action=sys.argv[1]
with tempfile.TemporaryDirectory(prefix='gcake-archive-bootstrap-',dir='/private/tmp') as folder:
 target=Path(folder)/'loader.py';target.write_bytes(raw);target.chmod(0o600)
 sys.argv=[str(target),str(p),action]
 runpy.run_path(str(target),run_name='__main__')
'''.replace('PACKAGE_LITERAL',repr(str(PACKAGE))).replace('OWNER_LITERAL',str(os.getuid())).replace('SHA_LITERAL',repr(loader_sha))
    entry='#!/bin/bash\nset -euo pipefail\nexec /usr/bin/sudo /usr/bin/python3 -I -B -S -c '+shlex.quote(boot)+' "${1:-archive}"\n'
    (PACKAGE/'owner_archive.sh').write_text(entry);(PACKAGE/'owner_archive.sh').chmod(0o755)
    report=dict(owner,source_hashes=hashes,installed_tool_hashes=tools,loader_sha256=loader_sha,archive_command='bash '+str(PACKAGE/'owner_archive.sh')+' archive',restore_command='sudo bash '+str(PERSIST/'owner_restore.sh'),production_writes=False)
    (PACKAGE/'prepared.json').write_text(json.dumps(report,indent=2));(PACKAGE/'prepared.json').chmod(0o644)
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
