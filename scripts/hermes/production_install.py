"""Durable first-install slot transaction; production paths are a fixed allowlist.

The owner driver supplies pinned bytes and independently verifies full runtime,
configuration, drain and supervisor. This module never executes candidate hooks.
"""
import hashlib
import json
import os
from pathlib import Path
import pwd
import stat
import uuid
import sys
import subprocess
import re
from update_entry import copy_preserved, file_identity, sync_directory
from updater_guard import atomic, read

SLOT_PATHS={
    'updater':Path('/usr/local/libexec/hermes-auto-update'),
    'launcher':Path('/usr/local/libexec/hermes-gateway-managed'),
    'gateway':Path('/Library/LaunchDaemons/ai.hermes.gateway.boot.plist'),
    'wrapper':Path('/Users/hermes/.hermes/scripts/gcake-rss-live.sh'),
    'summary_env':Path('/Users/hermes/.config/gcake-rss/publication-monitor.env'),
}


def slot_identity(path):
    identity=file_identity(path)
    identity['acl']=[]
    if sys.platform=='darwin':
        result=subprocess.run(['/bin/ls','-lde',str(path)],capture_output=True,text=True,timeout=10,check=True)
        identity['acl']=[line.strip() for line in result.stdout.splitlines() if re.match(r'\s*\d+:',line)]
    return identity


class FirstInstall:
    def __init__(self,store,supervisor):
        self.store=store;self.supervisor=supervisor
        self.journal=store.root/'private/first-production-install.json'
        self.backup=store.root/'private/first-production-backup.json'
        self.backup_dir=store.root/'private/first-production-originals'

    def preflight(self,plan,expected):
        self.store.writer()
        if set(plan)!=set(SLOT_PATHS) or set(expected)!=set(SLOT_PATHS) or any(type(v) is not bytes for v in plan.values()):
            raise ValueError('fixed-production-slots-required')
        for key,path in SLOT_PATHS.items():
            if path.resolve()!=path or path.is_symlink():raise ValueError('unsafe-production-slot')
            exists=path.exists()
            if exists and not path.is_file():raise ValueError('unsafe-production-slot')
            current=slot_identity(path) if exists else None
            if current!=expected[key]:raise ValueError('production-slot-drift:'+key)
        if not self.supervisor.drained():raise ValueError('production-drain-failed')

    def preserve(self):
        if self.backup.exists():raise ValueError('first-backup-already-present')
        self.backup_dir.mkdir(mode=0o700)
        records={}
        for key,path in SLOT_PATHS.items():
            if path.exists():
                records[key]=slot_identity(path)
                copy_preserved(path,self.backup_dir/key)
                if slot_identity(self.backup_dir/key)!=records[key]:raise ValueError('backup-identity-mismatch')
            else:records[key]=None
        atomic(self.backup,records)
        return records

    def replace(self,key,content,identity,nonce):
        target=SLOT_PATHS[key]
        if target.resolve()!=target or target.is_symlink():raise ValueError('unsafe-production-slot')
        parent=os.open(str(target.parent),os.O_RDONLY|os.O_NOFOLLOW)
        name='.'+target.name+'.gcake-'+nonce
        try:
            fd=os.open(name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=parent)
            with os.fdopen(fd,'wb') as stream:stream.write(content);stream.flush();os.fsync(stream.fileno())
            uid=self.store.uid;gid=os.getgid();mode=0o755
            if identity:uid=identity['uid'];gid=identity['gid'];mode=identity['mode']
            elif key=='summary_env':
                user=pwd.getpwuid(self.store.runner_uid);uid=user.pw_uid;gid=user.pw_gid;mode=0o600
            os.chown(name,uid,gid,dir_fd=parent,follow_symlinks=False)
            os.chmod(name,mode,dir_fd=parent,follow_symlinks=False)
            os.rename(name,target.name,src_dir_fd=parent,dst_dir_fd=parent);os.fsync(parent)
        finally:
            try:os.unlink(name,dir_fd=parent)
            except FileNotFoundError:pass
            os.close(parent)

    def restore(self,records,nonce):
        for key,identity in records.items():
            target=SLOT_PATHS[key]
            if target.resolve()!=target or target.is_symlink():raise ValueError('unsafe-recovery-slot')
            if identity is None:
                if target.exists():target.unlink();sync_directory(target.parent)
                continue
            backup=self.backup_dir/key
            if slot_identity(backup)!=identity:raise ValueError('first-backup-drift')
            # cp -p preserves the exact original ACL; stage privately before rename.
            staged=self.backup_dir/('.restore-'+key+'-'+nonce)
            if staged.exists():raise ValueError('unfinished-restore-stage')
            copy_preserved(backup,staged)
            parent=os.open(str(target.parent),os.O_RDONLY|os.O_NOFOLLOW)
            try:os.rename(str(staged),target.name,dst_dir_fd=parent);os.fsync(parent)
            finally:os.close(parent)
            if slot_identity(target)!=identity:raise ValueError('original-slot-not-restored')

    def recover_locked(self):
        record=read(self.journal)
        if record['phase']=='verified':return dict(status='installed-dry-run',already_verified=True)
        try:
            self.store.gate('maintenance');self.supervisor.stop()
            self.restore(read(self.backup),record['nonce'])
            self.supervisor.start_original();self.supervisor.verify_original()
            record['phase']='rolled_back';atomic(self.journal,record)
            return dict(status='rolled_back')
        except BaseException as error:
            try:self.supervisor.stop()
            except BaseException:pass
            record.update(phase='recovery_failed',error_type=type(error).__name__)
            atomic(self.journal,record);self.store.gate('maintenance')
            return dict(status='recovery_failed',error_type=type(error).__name__)

    def recover(self):
        with self.store.maintenance():return self.recover_locked()

    def install(self,plan,expected,failpoint=None):
        try:
            with self.store.maintenance():
                if self.journal.exists():
                    prior=read(self.journal)
                    if prior['phase']=='recovery_failed':return dict(status='blocked',reason='manual-recovery-required')
                    if prior['phase'] in ('verified','rolled_back'):return dict(status='blocked',reason='first-install-already-recorded')
                    return self.recover_locked()
                self.preflight(plan,expected)
                originals=self.preserve()
                record=dict(schema=1,nonce=uuid.uuid4().hex,phase='prepared',candidate_hashes={k:hashlib.sha256(v).hexdigest() for k,v in plan.items()})
                atomic(self.journal,record)
                try:
                    self.store.gate('maintenance')
                    self.supervisor.stop();record['phase']='stopped';atomic(self.journal,record)
                    if failpoint:failpoint('stopped')
                    for key in ('updater','launcher','gateway','wrapper','summary_env'):
                        record.update(phase='replacing',slot=key);atomic(self.journal,record)
                        self.replace(key,plan[key],originals[key],record['nonce'])
                        record.update(phase='replaced');atomic(self.journal,record)
                        if failpoint:failpoint('replaced:'+key)
                    record['phase']='verifying';atomic(self.journal,record)
                    self.supervisor.start_managed();self.supervisor.verify_managed()
                    record['phase']='verified';atomic(self.journal,record)
                    return dict(status='installed-dry-run')
                except Exception as error:
                    result=self.recover_locked()
                    result['candidate_error_type']=type(error).__name__
                    label=str(error)
                    if re.fullmatch(r'[a-z0-9_-]+(?::[a-z0-9_-]+)?',label):result['candidate_error']=label
                    return result
        except (ValueError,OSError,PermissionError) as error:
            return dict(status='blocked',reason=str(error))
