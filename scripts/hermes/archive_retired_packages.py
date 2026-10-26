"""Exact, reversible cold archival. Production entry never changes runtime selection."""
import ctypes
import errno
from functools import lru_cache
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
from updater_guard import atomic, canonical, check_payload, digest, read

LIMIT=4*1024**3
ROOT=Path('/usr/local/share/gcake-hermes-runtime')
ARCHIVE=Path('/usr/local/share/gcake-hermes-archives/20261026-retired-versions')
BASE='4fe889d8069a96b6d9f11b31d5940ebd00722280d39eabf412ab8ed906dbf554'
CANDIDATE='fcb86727dd27036f25aebd129aeee685631cdf85cc60a5998a32ed8661020d54'
ITEMS=[dict(kind=kind,digest=sha) for kind,sha in (
    ('proposals','f36ad05d1ea2fe93fe82712008904ae1cbe7cc4b9b606833fae07aa8bbaf753c'),
    ('releases','40a4edfe0e80891532df6b420680022fd92b8deda67205aea2f1e191d2011c3f'),
    ('releases','f98d49207288ae81f1cad0ece146489c1631700f946ea9146663cfab32eab66e'))]


def capacity(used,candidate,free):
    return dict(authority_bytes=used,candidate_bytes=candidate,projected_bytes=used+candidate,
                limit_bytes=LIMIT,free_bytes=free,ready=used+candidate<=LIMIT and free>=LIMIT+candidate)


def size(path):
    return sum(p.stat().st_size for p in path.rglob('*') if p.is_file() and not p.is_symlink())


def read_launch_definition(path):
    if sys.platform=='darwin':
        result=subprocess.run(['/usr/bin/plutil','-convert','json','-o','-',str(path)],capture_output=True,text=True,timeout=15)
        if result.returncode!=0:raise ValueError('launch-definition-invalid')
        value=json.loads(result.stdout)
    else:
        import plistlib
        try:value=plistlib.loads(path.read_bytes())
        except Exception:raise ValueError('launch-definition-invalid') from None
    if not isinstance(value,dict) or not isinstance(value.get('ProgramArguments',[]),list) or any(not isinstance(x,str) for x in value.get('ProgramArguments',[])):
        raise ValueError('launch-definition-invalid')
    return value


def validate_references(root,items,entry_paths,processes):
    releases={x['digest'] for x in items if x['kind']=='releases'}
    proposals={x['digest'] for x in items if x['kind']=='proposals'}
    for name in ('active.json','gate.json'):
        if read(root/name).get('digest') in releases:raise ValueError('operational-reference')
    if (root/'private/journal.json').exists():raise ValueError('recovery-pending')
    pending=root/'private/next-candidate.json'
    if pending.exists() and read(pending).get('digest') in proposals:raise ValueError('operational-reference')
    first=root/'private/first-production-install.json'
    if first.exists() and read(first).get('phase') not in ('verified','rolled_back'):raise ValueError('recovery-pending')
    locations=[str(root/x['kind']/x['digest']) for x in items]
    for p in entry_paths:
        raw=p.read_text()  # A missing/unreadable executable is a protected evidence gap.
        if any(sha in raw for sha in releases) or any(path in raw for path in locations):raise ValueError('entry-reference')
    if any(any(path in args for path in locations) for args in processes):raise ValueError('process-reference')


@lru_cache(maxsize=1)
def darwin_lib():
    lib=ctypes.CDLL('/usr/lib/libSystem.B.dylib',use_errno=True)
    lib.acl_get_link_np.argtypes=[ctypes.c_char_p,ctypes.c_int];lib.acl_get_link_np.restype=ctypes.c_void_p
    lib.acl_to_text.argtypes=[ctypes.c_void_p,ctypes.POINTER(ctypes.c_ssize_t)];lib.acl_to_text.restype=ctypes.c_void_p
    lib.acl_free.argtypes=[ctypes.c_void_p];lib.acl_free.restype=ctypes.c_int
    lib.listxattr.argtypes=[ctypes.c_char_p,ctypes.c_void_p,ctypes.c_size_t,ctypes.c_int];lib.listxattr.restype=ctypes.c_ssize_t
    lib.getxattr.argtypes=[ctypes.c_char_p,ctypes.c_char_p,ctypes.c_void_p,ctypes.c_size_t,ctypes.c_uint32,ctypes.c_int];lib.getxattr.restype=ctypes.c_ssize_t
    return lib


def extended_attributes(path):
    if sys.platform!='darwin':
        return {key:hashlib.sha256(os.getxattr(path,key,follow_symlinks=False)).hexdigest() for key in sorted(os.listxattr(path,follow_symlinks=False))}
    lib=darwin_lib();encoded=os.fsencode(path)
    length=lib.listxattr(encoded,None,0,1)
    if length<0:raise OSError('xattr-list-failed')
    buf=ctypes.create_string_buffer(max(1,length));actual=lib.listxattr(encoded,buf,length,1)
    if actual!=length:raise OSError('xattr-list-drift')
    result={}
    for key in sorted(x for x in buf.raw[:actual].split(b'\0') if x):
        count=lib.getxattr(encoded,key,None,0,0,1)
        if count<0:raise OSError('xattr-read-failed')
        value=ctypes.create_string_buffer(max(1,count))
        if lib.getxattr(encoded,key,value,count,0,1)!=count:raise OSError('xattr-read-drift')
        result[os.fsdecode(key)]=hashlib.sha256(value.raw[:count]).hexdigest()
    return result


def acl_text(path):
    if sys.platform!='darwin':return b''
    lib=darwin_lib()
    ctypes.set_errno(0);acl=lib.acl_get_link_np(os.fsencode(path),0x100)
    if not acl:
        if ctypes.get_errno()==errno.ENOENT:return b''
        raise OSError('acl-read-failed')
    text=None
    try:
        length=ctypes.c_ssize_t();text=lib.acl_to_text(acl,ctypes.byref(length))
        if not text:raise OSError('acl-text-failed')
        return ctypes.string_at(text,length.value)
    finally:
        if text:lib.acl_free(text)
        lib.acl_free(acl)


def metadata(path):
    rows={}
    for p in (path,*sorted(path.rglob('*'))):
        info=p.lstat()
        attrs=extended_attributes(p)
        rows[str(p.relative_to(path))]=dict(uid=info.st_uid,gid=info.st_gid,mode=info.st_mode,
            device=info.st_dev,inode=info.st_ino,flags=getattr(info,'st_flags',0),xattrs=attrs,
            acl=hashlib.sha256(acl_text(p)).hexdigest())
    return digest(rows)


class ArchiveTransaction:
    def __init__(self,root,archive,items,check_references,failpoint=None):
        self.root,self.archive=Path(root),Path(archive)
        self.items=items;self.check_references=check_references
        self.failpoint=failpoint or (lambda phase,index:None)
        if not items or len({(x['kind'],x['digest']) for x in items})!=len(items):raise ValueError('invalid-allowlist')
        for x in items:
            if set(x)!={'kind','digest'} or x['kind'] not in ('releases','proposals') or not re.fullmatch('[a-f0-9]{64}',x['digest']):
                raise ValueError('invalid-allowlist')

    def paths(self,item):
        rel=Path(item['kind'])/item['digest']
        return self.root/rel,self.archive/rel

    def validate_paths(self):
        if self.root.resolve()!=self.root or self.archive.resolve()!=self.archive or self.root==self.archive or self.root in self.archive.parents:
            raise ValueError('unsafe-archive-path')
        for p in (self.root,self.archive,*self.archive.parents):
            if p.is_symlink():raise ValueError('unsafe-archive-path')
        parent=self.archive
        while not parent.exists():parent=parent.parent
        if parent.stat().st_dev!=self.root.stat().st_dev:raise ValueError('cross-device-archive')
        if self.archive.exists() and (not self.archive.is_dir() or self.archive.stat().st_uid!=os.geteuid() or self.archive.stat().st_mode&0o022):
            raise ValueError('unsafe-archive-owner')
        for kind in {x['kind'] for x in self.items}:
            for parent in (self.root/kind,self.archive/kind):
                if parent.is_symlink() or (parent.exists() and (not parent.is_dir() or parent.stat().st_uid!=os.geteuid() or parent.stat().st_mode&0o022)):
                    raise ValueError('unsafe-package-parent')

    def verify(self,item,path,expected=None):
        manifest=read(path/'manifest.json') if item['kind']=='proposals' else read(self.root/'manifests'/(item['digest']+'.json'))
        if digest(manifest)!=item['digest']:raise ValueError('manifest-drift')
        check_payload(path/'payload' if item['kind']=='proposals' else path,manifest)
        value=metadata(path)
        if expected is not None and value!=expected:raise ValueError('metadata-drift')
        return value

    def plan(self):
        self.validate_paths();self.check_references()
        rows=[]
        for item in self.items:
            src,dst=self.paths(item)
            if dst.exists() or dst.is_symlink():raise ValueError('foreign-destination')
            rows.append(dict(item,source=str(src),destination=str(dst),metadata=self.verify(item,src),bytes=size(src)))
        return dict(status='planned',items=rows,archive_bytes=sum(x['bytes'] for x in rows),notification_sends=0)

    def save(self,record):atomic(self.archive/'inventory.json',record)

    def load(self):
        record=read(self.archive/'inventory.json')
        if record.get('schema')!=1 or record.get('authority')!=str(self.root) or record.get('archive')!=str(self.archive) or record.get('allowlist')!=self.items:
            raise ValueError('inventory-identity-drift')
        if record.get('inventory_digest')!=digest(record['items']):raise ValueError('inventory-content-drift')
        for item,row in zip(self.items,record['items']):
            src,dst=self.paths(item)
            if row.get('source')!=str(src) or row.get('destination')!=str(dst) or row.get('digest')!=item['digest'] or row.get('kind')!=item['kind']:
                raise ValueError('inventory-path-drift')
        if len(record['items'])!=len(self.items):raise ValueError('inventory-count-drift')
        return record

    def locations(self,record):
        for item,row in zip(self.items,record['items']):
            src,dst=self.paths(item)
            present=[p for p in (src,dst) if p.exists() or p.is_symlink()]
            if len(present)!=1:raise ValueError('foreign-or-missing-destination')
            self.verify(item,present[0],row['metadata'])

    def move(self,record,restore=False,callbacks=True):
        for index,(item,row) in enumerate(zip(self.items,record['items'])):
            original,cold=self.paths(item);src,dst=(cold,original) if restore else (original,cold)
            if dst.exists():continue  # Complete identity was verified for every item first.
            if dst.is_symlink():raise ValueError('foreign-destination')
            dst.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
            record.update(phase='restoring' if restore else 'archiving',intent=index);self.save(record)
            if callbacks:self.failpoint('intent',index)
            src.rename(dst)
            from update_entry import sync_directory
            sync_directory(src.parent);sync_directory(dst.parent)
            if callbacks:self.failpoint('renamed',index)
            self.verify(item,dst,row['metadata'])
            record.update(completed=index,intent=None);self.save(record)
        record.update(phase='restored' if restore else 'archived',intent=None);self.save(record)

    def run(self,action):
        if action not in ('archive','resume','restore'):raise ValueError('invalid-archive-action')
        self.validate_paths();self.check_references()
        if (self.archive/'inventory.json').exists():record=self.load()
        else:
            if action!='archive':raise ValueError('archive-inventory-required')
            planned=self.plan();self.archive.mkdir(mode=0o700,parents=True,exist_ok=True)
            record=dict(schema=1,authority=str(self.root),archive=str(self.archive),allowlist=self.items,
                items=planned['items'],inventory_digest=digest(planned['items']),phase='prepared')
            self.save(record)
        self.locations(record)
        try:self.move(record,restore=action=='restore')
        except Exception as error:
            record['error_type']=type(error).__name__;self.save(record)
            try:
                self.locations(record);self.move(record,restore=True,callbacks=False)
            except Exception:
                record.update(phase='recovery-required');self.save(record)
        return dict(status=record['phase'],phase=record['phase'],items=self.items,
            archive_path=str(self.archive),inventory_digest=record['inventory_digest'],
            retained_archive_bytes=size(self.archive),notification_sends=0,service_operations=0)


def production_main(action):
    if os.geteuid()!=0 or sys.platform!='darwin':raise PermissionError('root-macos-required')
    import updater_guard
    from production_entry import ProductionStore
    from production_owner import Actor, Supervisor, updater_exclusion, validate_existing_job
    from owner_successor import history_hash,job_contract
    from update_entry import reject_write_acl
    if Path(updater_guard.__file__).resolve().parent!=ROOT/'tools':raise ValueError('installed-controls-required')
    store=ProductionStore()
    parent=ARCHIVE.parent
    for p in (parent,*parent.parents):
        if p.exists():
            info=p.lstat()
            if not stat.S_ISDIR(info.st_mode) or info.st_uid!=0 or info.st_mode&0o022:raise ValueError('unsafe-archive-parent')
            reject_write_acl(p)
    if action not in ('plan','archive','resume','restore'):raise ValueError('fixed-action-required')
    with updater_exclusion(),store.maintenance():
        active=store.active()
        if action!='restore' and active!=dict(digest=BASE,mode='live'):raise ValueError('active-baseline-drift')
        if store.launch_status()!=dict(status='ready',**active):raise ValueError('gateway-not-ready')
        pointer=ROOT/'private/next-candidate.json'
        if pointer.exists() and read(pointer)!=dict(digest=CANDIDATE):raise ValueError('foreign-successor-pending')
        actor=Actor(store)
        if not actor.drained():raise ValueError('cron-execution-in-progress')
        job=validate_existing_job(actor);contract=job_contract(job)
        payload=actor.payload()
        supervisor=Supervisor(store,read(ROOT/'private/original-gateway-map.json'),actor)
        pid=supervisor.pid();supervisor.verify_telegram_health(payload)
        entry_paths=sorted((ROOT/'tools').glob('*.py'))+sorted((ROOT/'slots').iterdir())
        launcher=Path('/usr/local/libexec/hermes-gateway-managed');entry_paths.append(launcher)
        wrapper=Path(job['script'])
        if not wrapper.is_absolute():wrapper=Path('/Users/hermes/.hermes/scripts')/wrapper
        entry_paths.append(wrapper)
        configured_argv=[]
        for p in Path('/Library/LaunchDaemons').glob('*hermes*.plist'):
            value=read_launch_definition(p)
            configured_argv.extend(value.get('ProgramArguments',[]))
            for arg in value.get('ProgramArguments',[]):
                candidate=Path(arg)
                if candidate.is_absolute() and candidate.is_file() and candidate.suffix not in ('.dylib',):
                    # Executables such as Python are binaries; text launch scripts
                    # are checked below, and all argv values are checked as refs.
                    with candidate.open('rb') as stream:prefix=stream.read(2)
                    if prefix==b'#!':entry_paths.append(candidate)
        def references():
            processes=subprocess.run(['/bin/ps','-axo','args='],check=True,capture_output=True,text=True,timeout=15).stdout.splitlines()
            validate_references(ROOT,ITEMS,entry_paths,processes+configured_argv)
        before_history=history_hash(actor,payload)
        control_paths=[ROOT/name for name in ('active.json','gate.json','approvals.json')]+sorted((ROOT/'manifests').glob('*.json'))
        before_controls={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in control_paths}
        tx=ArchiveTransaction(ROOT,ARCHIVE,ITEMS,references)
        candidate_size=size(ROOT/'proposals'/CANDIDATE/'payload')
        remaining=sum(size(ROOT/x['kind']/x['digest']) for x in ITEMS if (ROOT/x['kind']/x['digest']).exists())
        projected=capacity(size(ROOT)-remaining,candidate_size,shutil.disk_usage(ROOT).free)
        if action!='restore' and not projected['ready']:raise ValueError('planned-capacity-blocked')
        if action=='plan':
            result=tx.plan();result['capacity_after_archive']=projected
        else:
            if not parent.exists():parent.mkdir(mode=0o700)
            if ARCHIVE.exists():reject_write_acl(ARCHIVE,recursive=True)
            result=tx.run(action)
            result['capacity']=capacity(size(ROOT),candidate_size,shutil.disk_usage(ROOT).free)
            if result['status']=='archived' and not result['capacity']['ready']:raise ValueError('post-archive-capacity-blocked')
        if history_hash(actor,payload)!=before_history:raise ValueError('notification-history-drift')
        if job_contract(actor.job())!=contract:raise ValueError('job-contract-drift')
        if any(hashlib.sha256(Path(p).read_bytes()).hexdigest()!=sha for p,sha in before_controls.items()):raise ValueError('preserved-control-drift')
        if supervisor.pid()!=pid:raise ValueError('gateway-process-drift')
        supervisor.verify_telegram_health(payload)
        result.update(active=active,job_unchanged=True,notification_history_unchanged=True,
            preserved_controls_unchanged=True,gateway_pid_unchanged=True,gateway_health='passed',
            restore_entry='the hash-pinned owner entry with restore action',runtime_adopted=False)
        return result


def main():
    try:
        result=production_main(sys.argv[1] if len(sys.argv)==2 else '')
        print(json.dumps(result,indent=2))
        return 0 if result['status'] in ('planned','archived','restored') else 1
    except Exception as error:
        reason=str(error)
        print(json.dumps(dict(status='blocked',error_type=type(error).__name__,
            reason=reason if re.fullmatch('[a-z0-9_-]{1,100}',reason) else 'protected-diagnostic-required',notification_sends=0)))
        return 1


if __name__=='__main__':raise SystemExit(main())
