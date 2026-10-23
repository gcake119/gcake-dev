"""Authority/runner entry contract, restricted to marked disposable local roots.

Never installs production files or accepts manifest-supplied privileged commands.
The same-UID release manager remains unchanged; this is a separate adapter.
"""
from contextlib import contextmanager
import ctypes as C
import errno
import fcntl
import hashlib
import os
from pathlib import Path
import plistlib
import pwd
import re
import shutil
import stat
import subprocess
import time
import sys
import socket
import threading
import json
import struct
import uuid
from updater_guard import atomic, read, digest, check_payload, validate_manifest

SLOTS = ('updater', 'launcher', 'gateway.plist', 'wrapper')
SHA = re.compile(r'[0-9a-f]{64}')


def runner_profile(root, unix_ipc=False):
    """Permit OS runtime plumbing, deny TCP and all private user homes/writes.

    A default-deny profile aborts the Apple Python shim before Python starts.
    Authority is enforced by UID/ACL, not by granting the runner root writes.
    """
    import json
    root=isolated(root)
    ipc='(allow network* (local unix-socket) (remote unix-socket)) ' if unix_ipc else ''
    return ('(version 1) (allow default) (deny network*) '+ipc+'(deny file-write*) '
            '(allow file-write* (subpath '+json.dumps(str(root/'home'))+') (literal "/dev/null")) '
            '(deny file-read* (subpath "/Users") (subpath "/usr/local/libexec"))')


# Same rights as update_entry's existing text check; directory aliases share bits.
_WRITE_MASK = (1 << 2) | (1 << 4) | (1 << 5) | (1 << 6) | (1 << 8) | (1 << 10) | (1 << 12) | (1 << 13)
_ROOT_COMPAT = bytes.fromhex('ffffeeeeddddccccbbbbaaaa00000000')
_ACL_TIMEOUT_SECONDS = 30


def _acl_identity(info):
    return (info.st_dev, info.st_ino, info.st_mode, info.st_uid, info.st_gid,
            info.st_ctime_ns, getattr(info, 'st_flags', 0))


class _NativeACLInventory:
    def __init__(self):
        self.deadline = time.monotonic() + 30
        self.lib = C.CDLL('/usr/lib/libSystem.B.dylib', use_errno=True)
        for name, args, result in (
            ('acl_get_link_np', [C.c_char_p, C.c_int], C.c_void_p),
            ('acl_valid', [C.c_void_p], C.c_int),
            ('acl_get_entry', [C.c_void_p, C.c_int, C.POINTER(C.c_void_p)], C.c_int),
            ('acl_get_tag_type', [C.c_void_p, C.POINTER(C.c_int)], C.c_int),
            ('acl_get_permset_mask_np', [C.c_void_p, C.POINTER(C.c_uint64)], C.c_int),
            ('acl_get_qualifier', [C.c_void_p], C.c_void_p),
            ('acl_free', [C.c_void_p], C.c_int),
            ('mbr_uid_to_uuid', [C.c_uint32, C.c_void_p], C.c_int),
        ):
            function = getattr(self.lib, name)
            function.argtypes, function.restype = args, result
        self.root_uuid = None

    def budget(self):
        if time.monotonic() >= self.deadline:
            raise ValueError('acl-inventory-failed')

    def require(self, result):
        self.budget()
        if result != 0:
            raise ValueError('acl-inventory-failed')

    def root_user(self, qualifier):
        if qualifier == _ROOT_COMPAT:
            return True
        if self.root_uuid is None:
            value = C.create_string_buffer(16)
            self.require(self.lib.mbr_uid_to_uuid(0, value))
            self.root_uuid = value.raw
        return qualifier == self.root_uuid

    def inspect(self, path):
        self.budget()
        before = os.lstat(path)
        C.set_errno(0)
        acl = self.lib.acl_get_link_np(os.fsencode(path), 0x100)
        try:
            self.budget()
            if not acl:
                # Darwin uses ENOENT for no extended ACL. Require the same node
                # still present below; a vanished path is never an empty ACL.
                if C.get_errno() != errno.ENOENT:
                    raise ValueError('acl-inventory-failed')
            else:
                self.require(self.lib.acl_valid(acl))
                selector = 0  # ACL_FIRST_ENTRY; Darwin returns 0 on success.
                while True:
                    self.budget()
                    entry = C.c_void_p()
                    C.set_errno(0)
                    result = self.lib.acl_get_entry(acl, selector, C.byref(entry))
                    if result == -1 and C.get_errno() == errno.EINVAL:
                        break  # End of a validated, kernel-owned snapshot.
                    self.require(result)
                    selector = -1  # ACL_NEXT_ENTRY, not POSIX's numeric index.
                    tag, mask = C.c_int(), C.c_uint64()
                    self.require(self.lib.acl_get_tag_type(entry, C.byref(tag)))
                    self.require(self.lib.acl_get_permset_mask_np(entry, C.byref(mask)))
                    if tag.value not in (1, 2):
                        raise ValueError('acl-inventory-failed')
                    if tag.value == 1 and mask.value & _WRITE_MASK:
                        qualifier = self.lib.acl_get_qualifier(entry)
                        if not qualifier:
                            raise ValueError('acl-inventory-failed')
                        try:
                            if not self.root_user(C.string_at(qualifier, 16)):
                                raise ValueError('runner-writable-acl')
                        finally:
                            self.lib.acl_free(qualifier)
        finally:
            if acl:
                self.lib.acl_free(acl)
        if _acl_identity(os.lstat(path)) != _acl_identity(before):
            raise ValueError('acl-inventory-failed')
        self.budget()
        return before

    def visit(self, path, recursive):
        before = self.inspect(path)
        if not recursive or not stat.S_ISDIR(before.st_mode):
            return
        descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            if _acl_identity(os.fstat(descriptor)) != _acl_identity(before):
                raise ValueError('acl-inventory-failed')
            # scandir includes hidden children and does not dereference symlinks.
            with os.scandir(descriptor) as children:
                for child in children:
                    self.visit(os.path.join(path, child.name), True)
            if (_acl_identity(os.fstat(descriptor)) != _acl_identity(before)
                    or _acl_identity(os.lstat(path)) != _acl_identity(before)):
                raise ValueError('acl-inventory-failed')
        finally:
            os.close(descriptor)
        self.budget()



def _native_acl_worker(path, recursive):
    """Read metadata only; stdout is a fixed non-content result protocol."""
    try:
        _NativeACLInventory().visit(os.fspath(path), recursive)
    except (OSError, ValueError, RecursionError) as error:
        code = 'runner-writable-acl' if str(error) == 'runner-writable-acl' else 'acl-inventory-failed'
        print(code, end='')
        return 2
    return 0


def reject_write_acl(path, recursive=False):
    if sys.platform != 'darwin':
        return
    started = time.monotonic()
    try:
        control = Path(__file__).resolve()
        # -I ignores caller Python settings. Only this fixed control and its
        # protected sibling imports load; the inspected path is an argv value.
        worker = ("import runpy,sys;sys.path.insert(0,sys.argv[1]);"
                  "scope=runpy.run_path(sys.argv[2]);"
                  "sys.exit(scope['_native_acl_worker'](sys.argv[3],sys.argv[4]=='1'))")
        result = subprocess.run(
            [sys.executable, '-I', '-B', '-c', worker, str(control.parent),
             str(control), os.fspath(path), '1' if recursive else '0'],
            stdin=subprocess.DEVNULL, capture_output=True, text=True,
            timeout=_ACL_TIMEOUT_SECONDS)
        if result.returncode == 2 and result.stdout == 'runner-writable-acl' and not result.stderr:
            raise ValueError('runner-writable-acl')
        if (result.returncode != 0 or result.stdout or result.stderr
                or time.monotonic() - started >= _ACL_TIMEOUT_SECONDS):
            raise ValueError('acl-inventory-failed')
    except (OSError, subprocess.SubprocessError):
        raise ValueError('acl-inventory-failed') from None


def isolated(path):
    path = Path(path).absolute()
    if path.resolve() != path or not re.match(r'^/private/tmp/gcake-entry-[^/]+/authority$', str(path)):
        raise ValueError('isolated-authority-root-required')
    return path


def sync_directory(path):
    fd = os.open(str(path), os.O_RDONLY | os.O_NOFOLLOW)
    try: os.fsync(fd)
    finally: os.close(fd)


def write_public(path, value):
    atomic(path, value)
    path.chmod(0o644)
    sync_directory(path.parent)


def copy_preserved(source, target):
    # Fixed, validated local paths only. macOS cp -p preserves ACL as well as mode.
    if source.is_symlink() or target.is_symlink() or not source.is_file():
        raise ValueError('unsafe-entry-slot')
    subprocess.run(['/bin/cp', '-p', str(source), str(target)], check=True,
                   capture_output=True, timeout=20)
    with target.open('rb') as stream: os.fsync(stream.fileno())
    sync_directory(target.parent)


def file_identity(path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode): raise ValueError('unsafe-entry-slot')
    return dict(sha256=hashlib.sha256(path.read_bytes()).hexdigest(), uid=info.st_uid,
                gid=info.st_gid, mode=stat.S_IMODE(info.st_mode))


def process_identity(pid):
    if sys.platform=='darwin':
        # Darwin SDK sys/proc_info.h: PROC_PIDTBSDINFO=3, proc_bsdinfo.
        # Direct kernel metadata avoids sandbox-forbidden setuid /bin/ps.
        import ctypes
        class BSDInfo(ctypes.Structure):
            _fields_=[('head',ctypes.c_uint32*12),('comm',ctypes.c_char*16),
                      ('name',ctypes.c_char*32),('tail',ctypes.c_uint32*6),
                      ('started_sec',ctypes.c_uint64),('started_usec',ctypes.c_uint64)]
        library=ctypes.CDLL('/usr/lib/libproc.dylib',use_errno=True)
        function=library.proc_pidinfo
        function.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_uint64,ctypes.c_void_p,ctypes.c_int]
        function.restype=ctypes.c_int
        info=BSDInfo()
        result=function(pid,3,0,ctypes.byref(info),ctypes.sizeof(info))
        if result!=ctypes.sizeof(info) or info.head[3]!=pid or info.head[1]==5:
            raise ValueError('maintenance-owner-not-running')
        return dict(uid=info.head[5],started=str(info.started_sec)+':'+str(info.started_usec))
    result=subprocess.run(['/bin/ps','-p',str(pid),'-o','uid=,lstart=,stat='],
                          capture_output=True,text=True,timeout=5,env=dict(os.environ,TZ='UTC',LC_ALL='C'))
    fields=result.stdout.split()
    if result.returncode or len(fields)<7 or fields[-1].startswith('Z'):
        raise ValueError('maintenance-owner-not-running')
    return dict(uid=int(fields[0]),started=' '.join(fields[1:6]))


class EntryStore:
    namespace = staticmethod(isolated)

    def __init__(self, root):
        self.root = self.namespace(root)
        self.marker = read(self.root/'.authority.json')
        if self.marker.get('schema') != 1 or self.marker.get('root') != str(self.root):
            raise ValueError('invalid-authority-marker')
        self.uid = self.marker['authority_uid']
        self.runner_uid = self.marker['runner_uid']
        if type(self.uid) is not int or type(self.runner_uid) is not int:
            raise ValueError('invalid-authority-identity')
        self.validate()

    @classmethod
    def initialize(cls, root, runner_uid):
        root = cls.namespace(root)
        if root.exists(): raise ValueError('new-root-required')
        root.mkdir(mode=0o755)
        for name in ('releases','manifests','slots','pending','receipts','private'):
            (root/name).mkdir(mode=0o700 if name in ('private','receipts') else 0o755)
        write_public(root/'.authority.json', dict(schema=1,root=str(root),
                     authority_uid=os.geteuid(),runner_uid=runner_uid))
        write_public(root/'approvals.json', {})
        write_public(root/'gate.json', {'status':'maintenance','mode':'dry-run'})
        fd=os.open(str(root/'maintenance.lock'),os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o644)
        os.close(fd)
        return cls(root)

    def safe(self, path):
        info = path.lstat()
        if stat.S_ISLNK(info.st_mode) or info.st_uid != self.uid or info.st_mode & 0o022:
            raise ValueError('unsafe-authority-permission')
        reject_write_acl(path)

    def validate(self):
        self.safe(self.root)
        for name in ('.authority.json','approvals.json','gate.json','maintenance.lock',
                     'releases','manifests','slots','pending'):
            self.safe(self.root/name)
        if (self.root/'active.json').exists(): self.safe(self.root/'active.json')
        # A reader cannot inspect the root-private journal; the public gate carries its state.
        if os.geteuid() == self.uid:
            for name in ('private','receipts'):self.safe(self.root/name)
            if self.journal.exists():self.safe(self.journal)

    @property
    def journal(self): return self.root/'private/journal.json'

    def writer(self):
        if os.geteuid() != self.uid: raise PermissionError('installation-authority-required')
        self.validate()

    @contextmanager
    def maintenance(self):
        self.writer()
        fd=os.open(str(self.root/'maintenance.lock'),os.O_RDWR|os.O_NOFOLLOW)
        try:
            fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
            identity=process_identity(os.getpid())
            record=dict(pid=os.getpid(),nonce=uuid.uuid4().hex,**identity)
            os.ftruncate(fd,0);os.write(fd,json.dumps(record).encode());os.fsync(fd)
            endpoint=self.root/'maintenance-owner.sock'
            if endpoint.exists():
                info=endpoint.lstat()
                if info.st_uid!=self.uid or not stat.S_ISSOCK(info.st_mode):raise ValueError('unsafe-maintenance-socket')
                endpoint.unlink()
            server=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
            server.bind(str(endpoint));endpoint.chmod(0o666);server.listen(4);server.settimeout(.2)
            ending=threading.Event()
            def serve():
                while not ending.is_set():
                    try:connection,_=server.accept()
                    except socket.timeout:continue
                    except OSError:break
                    with connection:
                        try:connection.settimeout(2);connection.recv(1);connection.sendall(json.dumps(record).encode())
                        except OSError:pass
            thread=threading.Thread(target=serve,daemon=True);thread.start()
            try:yield
            finally:
                ending.set();server.close();thread.join(timeout=3)
                if endpoint.exists():endpoint.unlink()
                os.ftruncate(fd,0);os.fsync(fd)
        finally:os.close(fd)

    def recreate_lock(self):
        if os.geteuid()!=self.uid:raise PermissionError('installation-authority-required')
        self.safe(self.root);self.safe(self.root/'gate.json')
        fd=os.open(str(self.root/'maintenance.lock'),os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o644)
        os.close(fd);sync_directory(self.root)

    def approve(self, manifest, expected_digest):
        self.writer();validate_manifest(manifest)
        if digest(manifest)!=expected_digest or not manifest['verification']['passed']:
            raise ValueError('exact-verified-approval-required')
        approvals=read(self.root/'approvals.json')
        prior=approvals.get(manifest['release_id'])
        if prior and prior!=expected_digest:raise ValueError('release-identity-reused')
        approvals[manifest['release_id']]=expected_digest
        write_public(self.root/'approvals.json',approvals)

    def seal(self, bundle):
        self.writer();bundle=Path(bundle).absolute()
        if bundle.resolve()!=bundle or not str(bundle).startswith('/private/tmp/'):
            raise ValueError('isolated-candidate-required')
        manifest=read(bundle/'manifest.json');sha=digest(manifest)
        if read(self.root/'approvals.json').get(manifest['release_id'])!=sha:
            raise ValueError('unapproved-release')
        check_payload(bundle/'payload',manifest)
        target=self.root/'releases'/sha
        if not target.exists():
            temporary=self.root/'releases'/('.stage-'+sha)
            if temporary.exists():raise ValueError('unfinished-seal')
            try:
                shutil.copytree(bundle/'payload',temporary,symlinks=True)
                check_payload(temporary,manifest)
                if sys.platform=='darwin':
                    subprocess.run(['/bin/chmod','-RN',str(temporary)],check=True,capture_output=True,timeout=30)
                for path in (temporary,*temporary.rglob('*')):
                    if path.lstat().st_uid!=self.uid or path.lstat().st_mode&0o022:
                        raise ValueError('runner-writable-release')
                    if path.is_file() and not path.is_symlink():
                        with path.open('rb') as stream:os.fsync(stream.fileno())
                for path in sorted((p for p in temporary.rglob('*') if p.is_dir()),reverse=True):
                    sync_directory(path)
                sync_directory(temporary)
                temporary.rename(target);sync_directory(target.parent)
            except BaseException:
                if temporary.exists():shutil.rmtree(temporary)
                raise
        write_public(self.root/'manifests'/(sha+'.json'),manifest)
        self.verify_release(sha)
        return sha

    def verify_release(self, sha):
        if not isinstance(sha,str) or not SHA.fullmatch(sha):raise ValueError('invalid-release-digest')
        manifest_path=self.root/'manifests'/(sha+'.json');self.safe(manifest_path)
        manifest=read(manifest_path)
        if digest(manifest)!=sha or read(self.root/'approvals.json').get(manifest['release_id'])!=sha:
            raise ValueError('unapproved-release')
        payload=self.root/'releases'/sha
        reject_write_acl(payload,recursive=True)
        for path in (payload,*payload.rglob('*')):
            info=path.lstat()
            if info.st_uid!=self.uid or (not path.is_symlink() and info.st_mode&0o022):
                raise ValueError('runner-writable-release')
        check_payload(payload,manifest)
        return payload

    def active(self):
        self.validate();value=read(self.root/'active.json')
        if value.get('mode') not in ('dry-run','live'):raise ValueError('invalid-mode')
        self.verify_release(value['digest']);return value

    def select(self, sha, mode='dry-run'):
        self.writer();self.verify_release(sha)
        if mode not in ('dry-run','live'):raise ValueError('invalid-mode')
        write_public(self.root/'active.json',{'digest':sha,'mode':mode})

    def bootstrap(self, bundle):
        self.writer()
        if (self.root/'active.json').exists():raise ValueError('already-initialized')
        sha=self.seal(bundle);self.select(sha)
        self.gate('ready',sha);return sha

    def gate(self, status, sha=None, mode='dry-run'):
        self.writer()
        write_public(self.root/'gate.json',dict(status=status,digest=sha,mode=mode))

    def launch_status(self):
        self.validate();gate=read(self.root/'gate.json')
        if gate['status']!='ready':return {'status':'maintenance'}
        active=self.active()
        if gate['digest']!=active['digest'] or gate['mode']!=active['mode']:
            raise ValueError('gate-selection-mismatch')
        return dict(status='ready',**active)

    def monitor(self, *, job_id, legacy_env, summary_env, db, timeout=180):
        """Pin the selected library and hold SH across env loading and the whole child."""
        from monitor_wrapper import render_wrapper
        mode=self.active()['mode']
        with self.lease(mode) as payload:
            script=render_wrapper(job_id=job_id,legacy_env=legacy_env,summary_env=summary_env,
                                  library=payload/'library',db=db,mode=mode,
                                  python=payload/'runtime/bin/python3.11')
            return subprocess.run(['/bin/bash','-c',script],timeout=timeout).returncode

    @contextmanager
    def lease(self, mode='dry-run'):
        self.validate()
        if os.geteuid() not in (self.uid,self.runner_uid):raise PermissionError('runner-required')
        if mode not in ('dry-run','live'):raise ValueError('invalid-mode')
        fd=os.open(str(self.root/'maintenance.lock'),os.O_RDONLY|os.O_NOFOLLOW)
        try:
            try:fcntl.flock(fd,fcntl.LOCK_SH|fcntl.LOCK_NB)
            except BlockingIOError:
                gate=read(self.root/'gate.json');active=self.active()
                owner=read(self.root/'maintenance.lock')
                if mode!='dry-run' or active['mode']!='dry-run' or gate.get('status')!='verifying' or gate.get('digest')!=active['digest']:
                    raise ValueError('exclusive-verification-not-authorized')
                self.verify_maintenance_owner(owner)
                yield self.verify_release(active['digest'])
                return
            status=self.launch_status()
            if status['status']!='ready' or (mode=='live' and status['mode']!='live'):
                raise ValueError('maintenance-or-live-not-authorized')
            yield self.verify_release(status['digest'])
        finally:os.close(fd)

    def verify_maintenance_owner(self,record):
        endpoint=self.root/'maintenance-owner.sock';info=endpoint.lstat()
        if info.st_uid!=self.uid or not stat.S_ISSOCK(info.st_mode) or record['uid']!=self.uid:
            raise ValueError('maintenance-owner-mismatch')
        # Kernel peer credentials authenticate the live controller across UIDs;
        # unprivileged proc_pidinfo for root processes is not available on macOS.
        with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as client:
            client.settimeout(3);client.connect(str(endpoint))
            if sys.platform=='darwin':
                cred=client.getsockopt(0,1,76)  # LOCAL_PEERCRED, struct xucred.
                peer_uid=struct.unpack_from('=I',cred,4)[0]
                peer_pid=struct.unpack('=i',client.getsockopt(0,2,4))[0]  # LOCAL_PEERPID.
            else:
                peer_pid,peer_uid,_=struct.unpack('=3i',client.getsockopt(socket.SOL_SOCKET,socket.SO_PEERCRED,12))
            if peer_uid!=self.uid or peer_pid!=record['pid']:raise ValueError('maintenance-peer-mismatch')
            client.sendall(b'?');data=client.recv(4096)
            if json.loads(data)!=record:raise ValueError('maintenance-generation-mismatch')

    def receipt(self, status, **values):
        self.writer();value=dict(status=status,**values)
        atomic(self.root/'receipts'/(str(time.time_ns())+'.json'),value);return value


class UpdateEntry:
    def __init__(self, store, supervisor):self.store=store;self.supervisor=supervisor

    def backup_slots(self):
        root=self.store.root;backup=root/'private/transaction-backup'
        if backup.exists():shutil.rmtree(backup)
        backup.mkdir(mode=0o700);identities={}
        for name in SLOTS:
            source=root/'slots'/name
            self.store.safe(source)
            identities[name]=file_identity(source)
            copy_preserved(source,backup/name)
            if file_identity(backup/name)!=identities[name]:raise ValueError('backup-identity-mismatch')
        atomic(backup/'identity.json',identities)
        baseline=root/'private/first-backup'
        if not baseline.exists():
            baseline.mkdir(mode=0o700)
            for name in SLOTS:copy_preserved(backup/name,baseline/name)
            atomic(baseline/'identity.json',identities)
            atomic(baseline/'active.json',self.store.active())
        return identities

    def restore_slots(self, journal):
        root=self.store.root
        for name in SLOTS:
            copy_preserved(root/'private/transaction-backup'/name,root/'slots'/name)
            if file_identity(root/'slots'/name)!=journal['slots'][name]:
                raise ValueError('restored-slot-identity-mismatch')
        for name in SLOTS:
            staged=root/'slots'/('.'+name+'.staged')
            if staged.exists():
                self.store.safe(staged);staged.unlink();sync_directory(staged.parent)

    def finish_committed(self, journal):
        store=self.store;sha=journal['new_digest']
        if store.active()['digest']!=sha:raise ValueError('committed-selection-mismatch')
        store.gate('ready',sha)
        store.journal.unlink();sync_directory(store.journal.parent)
        try:return store.receipt('updated',digest=sha,mode='dry-run')
        except OSError as error:return dict(status='updated',digest=sha,receipt_error=type(error).__name__)

    def recover_locked(self, automatic=False):
        store=self.store;journal=read(store.journal)
        if journal['phase']=='recovery_failed' and automatic:
            return dict(status='blocked',reason='manual-recovery-required')
        if journal['phase']=='committed':return self.finish_committed(journal)
        store.gate('maintenance')
        try:
            self.supervisor.stop()
            self.restore_slots(journal)
            old=journal['old_active'];store.select(old['digest'])
            self.supervisor.start(store.verify_release(old['digest']),'dry-run')
            self.supervisor.verify(store.verify_release(old['digest']))
            store.gate('ready',old['digest'])
            store.journal.unlink();sync_directory(store.journal.parent)
            return store.receipt('rolled_back',digest=old['digest'],mode='dry-run')
        except BaseException as error:
            try:self.supervisor.stop()
            except BaseException:pass
            journal['phase']='recovery_failed';atomic(store.journal,journal);store.gate('maintenance')
            return store.receipt('recovery_failed',reason=type(error).__name__)

    def recover(self):
        try:
            with self.store.maintenance():
                if not self.store.journal.exists():return dict(status='blocked',reason='no-pending-recovery')
                return self.recover_locked()
        except (ValueError,PermissionError,OSError,KeyError) as error:
            return dict(status='blocked',reason=str(error))

    def update(self, bundle, replacements=None, failpoint=None):
        store=self.store;replacements={} if replacements is None else replacements
        def point(phase):
            if failpoint:failpoint(phase)
        try:
            if not isinstance(replacements,dict) or set(replacements)-set(SLOTS) or any(type(v) is not bytes for v in replacements.values()):
                raise ValueError('fixed-entry-slots-required')
            with store.maintenance():
                if store.journal.exists():return self.recover_locked(automatic=True)
                bundle=Path(bundle).absolute()
                if bundle.resolve()!=bundle or not str(bundle).startswith('/private/tmp/'):
                    raise ValueError('isolated-candidate-required')
                manifest=read(bundle/'manifest.json');validate_manifest(manifest);sha=digest(manifest)
                if read(store.root/'approvals.json').get(manifest['release_id'])!=sha:
                    record=store.root/'pending'/(sha+'.json')
                    if not record.exists():atomic(record,dict(digest=sha,release_id=manifest['release_id']))
                    return store.receipt('skipped',reason='unapproved-release')
                old=store.active();check_payload(bundle/'payload',manifest)
                if sha==old['digest']:return dict(status='updated',already_current=True,digest=sha)
                size=sum(p.stat().st_size for p in (bundle/'payload').rglob('*') if p.is_file() and not p.is_symlink())
                used=sum(p.stat().st_size for p in store.root.rglob('*') if p.is_file() and not p.is_symlink())
                if shutil.disk_usage(store.root).free<4*1024**3+size or used+size>4*1024**3:
                    raise ValueError('disk-budget')
                sha=store.seal(bundle)
                if not self.supervisor.drained():return dict(status='blocked',reason='drain-failed')
                identities=self.backup_slots()
                journal=dict(schema=1,phase='prepared',old_active=old,new_digest=sha,slots=identities)
                atomic(store.journal,journal)
                try:
                    store.gate('maintenance')
                    point('prepared')
                    journal['phase']='stopping';atomic(store.journal,journal);point('stopping')
                    self.supervisor.stop();journal['phase']='stopped';atomic(store.journal,journal);point('stopped')
                    for name in sorted(replacements):
                        journal.update(phase='replacing',slot=name);atomic(store.journal,journal);point('replace:'+name)
                        target=store.root/'slots'/name;store.safe(target)
                        staged=store.root/'slots'/('.'+name+'.staged')
                        fd=os.open(str(staged),os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,identities[name]['mode'])
                        with os.fdopen(fd,'wb') as stream:
                            stream.write(replacements[name]);stream.flush();os.fsync(stream.fileno())
                        os.chmod(staged,identities[name]['mode']);os.chown(staged,identities[name]['uid'],identities[name]['gid'])
                        staged.replace(target);sync_directory(target.parent);point('replaced:'+name)
                    journal['phase']='switching';atomic(store.journal,journal);point('switching')
                    store.select(sha);point('selected')
                    journal['phase']='verifying';atomic(store.journal,journal);point('verifying')
                    self.supervisor.start(store.verify_release(sha),'dry-run');self.supervisor.verify(store.verify_release(sha));point('verified')
                    journal['phase']='committed';atomic(store.journal,journal);point('committed')
                    return self.finish_committed(journal)
                except BaseException:
                    if read(store.journal)['phase']=='committed':return self.finish_committed(journal)
                    return self.recover_locked()
        except (ValueError,OSError,KeyError,TypeError) as error:
            return dict(status='blocked',reason=str(error))


def render_plist(store, label):
    if not re.fullmatch(r'local\.gcake\.hermes-test\.[0-9a-f]{32}',label):
        raise ValueError('owned-test-label-required')
    user=pwd.getpwuid(store.runner_uid).pw_name
    root=store.root
    return dict(Label=label,UserName=user,WorkingDirectory=str(root),
                ProgramArguments=['/usr/bin/sandbox-exec','-f',str(root/'deny.sb'),
                                  '/usr/bin/python3','-I','-B','-S',str(root/'launcher.py')],
                EnvironmentVariables=dict(HOME=str(root/'home'),HERMES_HOME=str(root/'home/.hermes'),
                    XDG_CONFIG_HOME=str(root/'home/config'),XDG_DATA_HOME=str(root/'home/data'),
                    XDG_CACHE_HOME=str(root/'home/cache'),XDG_RUNTIME_DIR=str(root/'home/runtime'),
                    TMPDIR=str(root/'home/tmp'),PYTHONDONTWRITEBYTECODE='1',PYTHONUNBUFFERED='1'),
                RunAtLoad=True,KeepAlive=True,ThrottleInterval=10)


class LaunchdAdapter:
    """Only a disposable test LaunchDaemon. No production enable switch exists."""
    def __init__(self,store,label,plist,verify,drain=lambda:True,run=subprocess.run):
        self.store=store;self.expected=render_plist(store,label);self.label=label
        self.target='system/'+label;self.plist=Path(plist)
        if self.plist!=store.root/'slots/gateway.plist':raise ValueError('owned-plist-required')
        self.verify_callback=verify;self.drain_callback=drain;self.run=run

    def command(self,*args):
        return self.run(['/bin/launchctl',*args],capture_output=True,text=True,timeout=15)

    def query(self):
        result=self.command('print',self.target)
        if result.returncode==0:return result.stdout
        if 'Could not find service' in result.stderr:return None
        raise RuntimeError('launchctl-query-failed')

    def drained(self):return self.drain_callback()

    def stop(self):
        if self.query() is None:return
        result=self.command('bootout',self.target)
        if result.returncode:raise RuntimeError('launchctl-stop-failed')
        deadline=time.monotonic()+10
        while time.monotonic()<deadline:
            if self.query() is None:return
            time.sleep(.1)
        raise TimeoutError('launchctl-stop-timeout')

    def start(self,payload,mode):
        self.store.writer();self.store.verify_release(payload.name)
        if self.store.active()['digest']!=payload.name or mode!='dry-run':
            raise ValueError('fixed-dry-verification-required')
        self.store.safe(self.plist)
        with self.plist.open('rb') as stream:actual=plistlib.load(stream)
        if actual!=self.expected:raise ValueError('launchd-mapping-drift')
        if self.query() is not None:raise ValueError('duplicate-supervisor')
        # A launch-specific permit is visible only while the controller owns EX lock.
        self.store.gate('verifying',payload.name)
        result=self.command('bootstrap','system',str(self.plist))
        if result.returncode:raise RuntimeError('launchctl-bootstrap-failed:'+str(result.returncode))

    def verify(self,payload):
        output=self.query()
        if output is None or not re.search(r'\bpid = [1-9][0-9]*',output):
            raise RuntimeError('launchd-process-absent')
        self.verify_callback(payload)


def launch_decision(store):
    """No gateway code loads before this decision; hard crash removes verify permit."""
    status=store.launch_status()
    if status['status']=='ready':return status
    gate=read(store.root/'gate.json')
    if gate.get('status')!='verifying' or gate.get('mode')!='dry-run':return status
    fd=os.open(str(store.root/'maintenance.lock'),os.O_RDONLY|os.O_NOFOLLOW)
    try:
        try:
            fcntl.flock(fd,fcntl.LOCK_SH|fcntl.LOCK_NB)
            return {'status':'maintenance'}
        except BlockingIOError:
            active=store.active()
            if active['digest']!=gate['digest']:raise ValueError('verification-selection-mismatch')
            return dict(status='ready',digest=active['digest'],mode='dry-run')
    finally:os.close(fd)


def launch_gateway(store):
    if os.geteuid()!=store.runner_uid:raise PermissionError('gateway-runner-required')
    while True:
        status=launch_decision(store)
        if status['status']=='ready':break
        time.sleep(.5)
    payload=store.verify_release(status['digest'])
    env={k:v for k,v in os.environ.items() if k not in ('PYTHONPATH','PYTHONHOME','PYTHONSTARTUP')}
    env.update(HOME=str(store.root/'home'),HERMES_HOME=str(store.root/'home/.hermes'),
               XDG_CONFIG_HOME=str(store.root/'home/config'),XDG_DATA_HOME=str(store.root/'home/data'),
               XDG_CACHE_HOME=str(store.root/'home/cache'),XDG_RUNTIME_DIR=str(store.root/'home/runtime'),
               TMPDIR=str(store.root/'home/tmp'),PYTHONDONTWRITEBYTECODE='1',GCAKE_RELEASE_DIGEST=status['digest'])
    python=payload/'runtime/bin/python3.11'
    os.chdir(payload/'code')
    os.execve(str(python),[str(python),'-B','-m','hermes_cli.main','gateway','run'],env)
