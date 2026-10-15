#!/bin/bash
set -euo pipefail
exec /usr/bin/sudo /usr/bin/python3 -I -B -S -c 'import hashlib,json,os,stat,sys,tempfile,runpy
from pathlib import Path
package=Path('"'"'/private/tmp/gcake-notification-repair-20261015/owner-successor'"'"')
if os.geteuid()!=0:raise PermissionError("root-required")
if package.resolve()!=package:raise ValueError("package-path-drift")
def checked(path,sha,limit):
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 with os.fdopen(fd,"rb") as f:
  st=os.fstat(f.fileno());raw=f.read(limit+1)
 if not stat.S_ISREG(st.st_mode) or st.st_nlink!=1 or st.st_mode&0o022 or st.st_uid not in (0,501) or len(raw)>limit or hashlib.sha256(raw).hexdigest()!=sha:raise ValueError("owner-input-drift")
 return raw
control=json.loads(checked(package/"controls.json",'"'"'16ecd97d7d4089bfe431b1bb0edc46e3d7528363c1ae1074b19083a110c2c66a'"'"',1024*1024))
for name,sha in control["installed_tools"].items():
 if not name.replace("_","").replace(".","").isalnum() or not name.endswith(".py"):raise ValueError("invalid-tool-name")
 checked(Path("/usr/local/share/gcake-hermes-runtime/tools")/name,sha,1024*1024)
source=checked(package/"owner_successor.py",control["owner_script_sha256"],1024*1024)
sys.path.insert(0,"/usr/local/share/gcake-hermes-runtime/tools")
with tempfile.TemporaryDirectory(prefix="gcake-owner-successor-code-",dir="/private/tmp") as temp:
 path=Path(temp)/"owner_successor.py";path.write_bytes(source);path.chmod(0o600)
 runpy.run_path(str(path),init_globals={"APPROVED_CONTROL":control,"PACKAGE_ROOT":str(package)},run_name="__main__")
'
