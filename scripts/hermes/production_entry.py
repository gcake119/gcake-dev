"""Fixed production mappings; installation requires separately verified controls.

Rendering functions never read secrets, modify files or operate launchd.
No arbitrary production path or service override is accepted.
"""
import copy
import subprocess
from pathlib import Path
import os
import pwd
import stat
import re
import time
from update_entry import EntryStore, reject_write_acl, launch_decision

PRODUCTION_ROOT = Path('/usr/local/share/gcake-hermes-runtime')
HOME = Path('/Users/hermes')
GATEWAY_LABEL = 'ai.hermes.gateway.boot'
LAUNCHER = '/usr/local/libexec/hermes-gateway-managed'
ORIGINAL_ARGV = [str(HOME/'.hermes/hermes-agent/venv/bin/python'),
                 '-m','hermes_cli.main','gateway','run','--replace']
GATEWAY_PLIST = Path('/Library/LaunchDaemons/ai.hermes.gateway.boot.plist')


def production_root(path):
    value=Path(path)
    if str(value)!=str(PRODUCTION_ROOT) or value.resolve()!=value:
        raise ValueError('fixed-production-authority-required')
    return value


def render_gateway_plist(original):
    """Validate the reviewed original map and preserve its operational context."""
    env=original.get('EnvironmentVariables',{})
    if (original.get('Label')!=GATEWAY_LABEL or original.get('UserName')!='hermes'
            or original.get('RunAtLoad') is not True or original.get('KeepAlive') is not True
            or original.get('WorkingDirectory')!=str(HOME/'.hermes/hermes-agent')
            or original.get('ProgramArguments')!=ORIGINAL_ARGV
            or env.get('HOME')!=str(HOME) or env.get('HERMES_HOME')!=str(HOME/'.hermes')
            or 'Program' in original):
        raise ValueError('unreviewed-production-gateway-map')
    result=copy.deepcopy(original)
    result['ProgramArguments']=[LAUNCHER]
    result['WorkingDirectory']=str(PRODUCTION_ROOT)
    return result


class ProductionStore(EntryStore):
    namespace = staticmethod(production_root)

    def __init__(self,root=PRODUCTION_ROOT):
        root=production_root(root)
        for path in (root,*root.parents):
            info=path.lstat()
            if not stat.S_ISDIR(info.st_mode) or info.st_uid!=0 or info.st_mode&0o022:
                raise ValueError('unsafe-production-authority-ancestor')
            reject_write_acl(path)
        super().__init__(root)
        if self.uid!=0 or self.runner_uid!=pwd.getpwnam('hermes').pw_uid:
            raise ValueError('production-authority-identity-mismatch')

    @classmethod
    def initialize(cls,root=PRODUCTION_ROOT,runner_uid=None):
        if os.geteuid()!=0:raise PermissionError('root-installation-required')
        user=pwd.getpwnam('hermes')
        if runner_uid is not None and runner_uid!=user.pw_uid:
            raise ValueError('existing-hermes-runner-required')
        return super().initialize(root,user.pw_uid)

    def monitor(self, **kwargs):
        if os.geteuid()!=self.runner_uid:raise PermissionError('hermes-monitor-required')
        return self._shared_monitor(**kwargs)

    def _shared_monitor(self, *, job_id, legacy_env, summary_env, db, timeout=180):
        from monitor_wrapper import render_wrapper
        mode=self.active()['mode']
        # Preserve the selected runtime lease across the original sender and both observations.
        with self.lease(mode) as payload:
            script=render_wrapper(job_id=job_id,legacy_env=legacy_env,summary_env=summary_env,
                library=payload/'library',db=db,mode=mode,python=payload/'runtime/bin/python3.11',
                entrypoint='shared_publication_monitor')
            return subprocess.run(['/bin/bash','-c',script],timeout=timeout).returncode

    def approve(self,manifest,expected_digest):
        from packaging_contract import require_manifest
        require_manifest(manifest)
        return super().approve(manifest,expected_digest)


def gateway_environment(original,digest):
    if not isinstance(digest,str) or not re.fullmatch(r'[0-9a-f]{64}',digest):
        raise ValueError('invalid-production-release-digest')
    env={key:value for key,value in original.items() if key not in ('PYTHONPATH','PYTHONHOME','PYTHONSTARTUP')}
    env.update(HOME=str(HOME),HERMES_HOME=str(HOME/'.hermes'),
               PYTHONDONTWRITEBYTECODE='1',PYTHONNOUSERSITE='1',GCAKE_RELEASE_DIGEST=digest)
    return env


def launch_gateway():
    store=ProductionStore()
    if os.geteuid()!=store.runner_uid:raise PermissionError('hermes-gateway-required')
    while True:
        status=launch_decision(store)
        if status['status']=='ready':break
        time.sleep(.5)
    payload=store.verify_release(status['digest'])
    env=gateway_environment(os.environ,status['digest'])
    python=payload/'runtime/bin/python3.11'
    os.chdir(payload/'code')
    os.execve(str(python),[str(python),'-B','-m','hermes_cli.main','gateway','run'],env)
