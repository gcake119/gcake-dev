"""Local isolated release manager. No production adapter or manifest-supplied commands."""
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import time
import uuid

def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(',',':')).encode()

def digest(value):return hashlib.sha256(canonical(value)).hexdigest()

def atomic(path,value):
    temporary=path.with_name('.'+path.name+'.tmp')
    if path.is_symlink() or temporary.is_symlink():raise ValueError('unsafe-control-path')
    with temporary.open('wb') as out:
        out.write(canonical(value));out.flush();os.fsync(out.fileno())
    temporary.chmod(0o600);temporary.replace(path)
    fd=os.open(str(path.parent),os.O_RDONLY)
    try:os.fsync(fd)
    finally:os.close(fd)

def read(path):
    if path.is_symlink() or not path.is_file():raise ValueError('unsafe-control-file')
    if path.stat().st_size>16*1024*1024:raise ValueError('oversized-control-file')
    result=json.loads(path.read_bytes())
    if not isinstance(result,dict):raise ValueError('invalid-control-object')
    return result

def local_path(path):
    path=Path(path).absolute()
    if path.resolve()!=path or not str(path).startswith('/private/tmp/'):raise ValueError('isolated-path-required')
    return path

def owned(root):
    root=Path(root).absolute()
    if root.is_symlink() or root.resolve()!=root or not str(root).startswith('/private/tmp/'):
        raise ValueError('isolated-root-required')
    info=root.stat();marker=read(root/'.owned.json')
    if info.st_uid!=os.getuid() or info.st_mode&0o022 or marker!={'schema':1,'root':str(root),'uid':os.getuid()}:
        raise ValueError('owned-root-required')
    for name in ('current','active.json','approvals.json','journal.json','maintenance.lock','pending','receipts'):
        if (root/name).is_symlink():raise ValueError('unsafe-owned-path')
    return root

def init_root(root):
    root=local_path(root)
    if root.exists() and any(root.iterdir()):raise ValueError('new-empty-root-required')
    if root.resolve()!=root or not str(root).startswith('/private/tmp/'):raise ValueError('isolated-root-required')
    root.mkdir(parents=True,exist_ok=True);root.chmod(0o700)
    atomic(root/'.owned.json',{'schema':1,'root':str(root),'uid':os.getuid()})

def tree(payload):
    if payload.is_symlink() or not payload.is_dir():raise ValueError('unsafe-payload-root')
    rows={}
    for path in sorted(payload.rglob('*')):
        rel=str(path.relative_to(payload));mode=stat.S_IMODE(path.lstat().st_mode)
        if path.name=='.env' or path.name.startswith('.env.') or path.suffix in ('.env','.sqlite','.db') or PurePosixPath(rel).parts[0] in ('home','state','jobs','credentials'):
            raise ValueError('private-state-in-payload')
        if path.is_symlink():
            target=os.readlink(path)
            if os.path.isabs(target):raise ValueError('external-link')
            try:path.resolve(strict=True).relative_to(payload.resolve())
            except (ValueError,FileNotFoundError,RuntimeError):raise ValueError('external-or-dangling-link')
            rows[rel]={'kind':'link','mode':mode,'target':target}
        elif path.is_dir():rows[rel]={'kind':'directory','mode':mode}
        elif stat.S_ISREG(path.lstat().st_mode):
            h=hashlib.sha256()
            with path.open('rb') as stream:
                for block in iter(lambda:stream.read(1024*1024),b''):h.update(block)
            rows[rel]={'kind':'file','mode':mode,'sha256':h.hexdigest()}
        else:raise ValueError('special-payload-file')
    return rows

def validate_manifest(manifest):
    if not isinstance(manifest,dict):raise ValueError('invalid-manifest')
    if manifest.get('schema')!=1 or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,63}',manifest.get('release_id','')):
        raise ValueError('invalid-release-identity')
    for field,n in (('source_sha',40),('patch_sha',64),('lock_sha',64)):
        if not re.fullmatch(r'[0-9a-f]{'+str(n)+'}',manifest.get(field,'')):raise ValueError('invalid-provenance')
    if not re.fullmatch(r'\d+\.\d+\.\d+',manifest.get('python_version','')):raise ValueError('invalid-python-version')
    evidence=manifest.get('verification',{})
    if not isinstance(evidence,dict) or not isinstance(evidence.get('passed'),bool) or not re.fullmatch(r'[0-9a-f]{64}',evidence.get('evidence_sha','')):
        raise ValueError('invalid-verification-provenance')
    files=manifest.get('files')
    if not isinstance(files,dict) or not files:raise ValueError('empty-payload')
    for name,row in files.items():
        path=PurePosixPath(name)
        if path.is_absolute() or '..' in path.parts or str(path)!=name or not path.parts:
            raise ValueError('unsafe-manifest-path')
        if not isinstance(row,dict) or row.get('kind') not in ('file','directory','link'):raise ValueError('invalid-payload-entry')
    if set(manifest)-{'schema','release_id','source_sha','patch_sha','python_version','lock_sha','verification','files','capability'}:
        raise ValueError('unsupported-manifest-field')

def check_payload(path,manifest):
    validate_manifest(manifest)
    if not manifest['verification']['passed']:raise ValueError('unverified-release')
    if tree(path)!=manifest['files']:raise ValueError('payload-integrity-mismatch')

def seal_release(bundle,**identity):
    bundle=local_path(bundle);manifest=dict(schema=1,files=tree(bundle/'payload'),**identity)
    validate_manifest(manifest);atomic(bundle/'manifest.json',manifest)
    return digest(manifest)

def verify_active(root,mode='dry-run'):
    root=owned(root);active=read(root/'active.json');manifest=active['manifest']
    if mode not in ('dry-run','live'):raise ValueError('invalid-mode')
    if active['digest']!=digest(manifest) or read(root/'approvals.json').get(manifest['release_id'])!=active['digest']:
        raise ValueError('unapproved-active-release')
    if (root/'journal.json').exists():
        journal=read(root/'journal.json')
        if not (mode=='dry-run' and journal['phase']=='verifying' and journal['candidate_digest']==active['digest']):
            raise ValueError('pending-recovery')
    if active.get('mode') not in ('live','dry-run') or (mode=='live' and active['mode']!='live'):
        raise ValueError('live-not-authorized')
    check_payload(root/'current',manifest)
    return manifest

@contextmanager
def invocation_lease(root,mode='dry-run'):
    root=owned(root)
    # A manager-held exclusive lock permits only its read-only verification lease.
    if (root/'journal.json').exists():
        journal=read(root/'journal.json')
        if journal.get('phase')=='verifying' and mode=='dry-run':
            yield verify_active(root,mode)
            return
    fd=os.open(str(root/'maintenance.lock'),os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)
    try:
        try:fcntl.flock(fd,fcntl.LOCK_SH|fcntl.LOCK_NB)
        except BlockingIOError:raise ValueError('maintenance-busy')
        yield verify_active(root,mode)
    finally:os.close(fd)

@contextmanager
def lock(root):
    fd=os.open(str(root/'maintenance.lock'),os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)
    try:
        try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise ValueError('maintenance-busy')
        os.ftruncate(fd,0);os.write(fd,canonical({'pid':os.getpid(),'started_at':time.time()}));os.fsync(fd)
        yield
    finally:os.close(fd)

def receipt(root,status,**values):
    result=dict(status=status,**values)
    (root/'receipts').mkdir(exist_ok=True)
    atomic(root/'receipts'/(str(time.time_ns())+'.json'),result)
    return result

def remove(path):
    if path.is_symlink():raise ValueError('unsafe-remove-path')
    if path.exists():shutil.rmtree(path)

def bootstrap(root,bundle,catalog):
    root=owned(root);bundle=local_path(bundle);manifest=read(bundle/'manifest.json');check_payload(bundle/'payload',manifest)
    if catalog.get(manifest['release_id'])!=digest(manifest):raise ValueError('unapproved-bootstrap')
    if (root/'current').exists():raise ValueError('already-initialized')
    shutil.copytree(bundle/'payload',root/'current',symlinks=True)
    atomic(root/'approvals.json',catalog)
    atomic(root/'active.json',{'manifest':manifest,'digest':digest(manifest),'mode':'dry-run'})

def activate_release(root,service,live_authorized=False):
    if not live_authorized:return {'status':'blocked','reason':'live-authority-required'}
    try:
        root=owned(root)
        with lock(root):
            if (root/'journal.json').exists():raise ValueError('pending-recovery')
            verify_active(root)
            if not service.drained():raise ValueError('drain-failed')
            service.verify(root/'current');service.activate(root/'current','live')
            active=read(root/'active.json');active['mode']='live';atomic(root/'active.json',active)
            return receipt(root,'activated',release_id=active['manifest']['release_id'],mode='live')
    except Exception as error:return {'status':'blocked','reason':type(error).__name__}

def safe_member(root,name,prefix):
    if not isinstance(name,str) or not re.fullmatch(prefix+r'-[0-9a-f]{32}',name):raise ValueError('unsafe-journal-path')
    path=root/name
    if path.is_symlink():raise ValueError('unsafe-journal-path')
    return path

def recover_locked(root,service,live_authorized=False):
    journal=read(root/'journal.json');previous=safe_member(root,journal['previous'],'previous');stage=safe_member(root,journal['stage'],'stage')
    old=journal['old_active'];current=root/'current'
    try:
        if journal['phase']=='staging':
            check_payload(current,old['manifest']);remove(stage);(root/'journal.json').unlink()
            return receipt(root,'blocked',reason='interrupted-staging')
        service.stop()
        if previous.exists():
            check_payload(previous,old['manifest']);remove(current);previous.rename(current)
        else:check_payload(current,old['manifest'])
        atomic(root/'active.json',dict(old,mode='dry-run'))
        journal.update(phase='verifying',candidate_digest=old['digest']);atomic(root/'journal.json',journal)
        service.start(current,'dry-run');service.verify(current)
        mode='live' if old['mode']=='live' and live_authorized else 'dry-run'
        service.activate(current,mode);atomic(root/'active.json',dict(old,mode=mode))
        remove(stage);(root/'journal.json').unlink()
        return receipt(root,'rolled_back',release_id=old['manifest']['release_id'],mode=mode)
    except BaseException as error:
        try:service.stop()
        except BaseException:pass
        journal['phase']='recovery_failed';atomic(root/'journal.json',journal)
        return receipt(root,'recovery_failed',reason=type(error).__name__)

def recover_update(root,service,live_authorized=False):
    try:
        root=owned(root)
        with lock(root):
            if not (root/'journal.json').exists():return {'status':'blocked','reason':'no-pending-recovery'}
            return recover_locked(root,service,live_authorized)
    except (ValueError,OSError,KeyError) as error:return {'status':'blocked','reason':str(error) if isinstance(error,ValueError) else type(error).__name__}

def apply_update(root,bundle,catalog,service,live_authorized=False,min_free=4*1024**3,max_bytes=4*1024**3,failpoint=None,catalog_override=None):
    def point(phase):
        if failpoint:failpoint(phase)
    try:
        root=owned(root);bundle=local_path(bundle)
        with lock(root):
            if (root/'journal.json').exists():
                if read(root/'journal.json')['phase']=='recovery_failed':return receipt(root,'blocked',reason='manual-recovery-required')
                return recover_locked(root,service,live_authorized)
            manifest=read(bundle/'manifest.json');validate_manifest(manifest);sha=digest(manifest)
            allowed=catalog if catalog_override is None else catalog_override
            if allowed.get(manifest['release_id'])!=sha:
                (root/'pending').mkdir(exist_ok=True)
                record=root/'pending'/(sha+'.json')
                if not record.exists():atomic(record,{'release_id':manifest['release_id'],'digest':sha,'reason':'unapproved-release'})
                return receipt(root,'skipped',release_id=manifest['release_id'],reason='unapproved-release')
            check_payload(bundle/'payload',manifest);old=read(root/'active.json');verify_active(root)
            if manifest['release_id']==old['manifest']['release_id'] and sha!=old['digest']:
                raise ValueError('release-identity-reused')
            if sha==old['digest']:return receipt(root,'updated',release_id=manifest['release_id'],mode=old['mode'],already_current=True)
            size=sum(p.stat().st_size for p in (bundle/'payload').rglob('*') if p.is_file() and not p.is_symlink())
            owned_size=sum(p.stat().st_size for p in root.rglob('*') if p.is_file() and not p.is_symlink())
            if shutil.disk_usage(root).free<min_free+size or owned_size+size>max_bytes:raise ValueError('disk-budget')
            if not service.drained():return receipt(root,'blocked',reason='drain-failed')
            ident=uuid.uuid4().hex;stage=root/('stage-'+ident);previous=root/('previous-'+ident)
            journal={'schema':1,'phase':'staging','stage':stage.name,'previous':previous.name,'old_active':old,'candidate_digest':sha}
            atomic(root/'journal.json',journal)
            try:
                point('staging')
                shutil.copytree(bundle/'payload',stage,symlinks=True);check_payload(stage,manifest)
            except BaseException:
                remove(stage);(root/'journal.json').unlink();raise
            journal['phase']='prepared';atomic(root/'journal.json',journal)
            approvals=read(root/'approvals.json');approvals.update(catalog);atomic(root/'approvals.json',approvals)
            committed=False
            try:
                service.stop();journal['phase']='stopped';atomic(root/'journal.json',journal);point('stopped')
                journal['phase']='switching';atomic(root/'journal.json',journal)
                (root/'current').rename(previous);point('old_moved');stage.rename(root/'current');point('installed')
                atomic(root/'active.json',{'manifest':manifest,'digest':sha,'mode':'dry-run'})
                journal['phase']='verifying';atomic(root/'journal.json',journal)
                service.start(root/'current','dry-run');service.verify(root/'current');point('verified')
                mode='live' if live_authorized and old['mode']=='live' else 'dry-run'
                service.activate(root/'current',mode)
                retained={'directory':previous.name,'manifest':old['manifest'],'digest':old['digest']}
                atomic(root/'active.json',{'manifest':manifest,'digest':sha,'mode':mode,'previous':retained})
                (root/'journal.json').unlink()
                committed=True
                cleanup_warning=None
                if old.get('previous'):
                    try:
                        prior=old['previous']
                        if digest(prior['manifest'])!=prior['digest']:raise ValueError('invalid-backup-identity')
                        path=safe_member(root,prior['directory'],'previous')
                        check_payload(path,prior['manifest']);remove(path)
                    except (ValueError,OSError,KeyError) as error:cleanup_warning=type(error).__name__
                return receipt(root,'updated',release_id=manifest['release_id'],mode=mode,cleanup_warning=cleanup_warning)
            except BaseException as error:
                if committed:return {'status':'updated','release_id':manifest['release_id'],'mode':mode,'receipt_error':type(error).__name__}
                return recover_locked(root,service,live_authorized)
    except (ValueError,OSError,KeyError,TypeError) as error:
        return {'status':'blocked','reason':str(error) if isinstance(error,ValueError) else type(error).__name__}
