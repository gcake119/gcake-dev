"""Owner-run, secret-free root/hermes + unique isolated launchd qualification.

Source modules are hash-bound below, copied into a new root-owned workspace
before import. Only a disposable probe service is registered. No production
Hermes source/home/env/updater is read or executed.
"""
import hashlib
import importlib
import json
import os
from pathlib import Path
import plistlib
import pwd
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import uuid

SOURCE_HASHES = {}  # Filled with exact reviewed module digests before handoff.


def safe_bytes(path, sha):
    fd=os.open(str(path),os.O_RDONLY|os.O_NOFOLLOW)
    with os.fdopen(fd,'rb') as stream:
        info=os.fstat(stream.fileno())
        if info.st_mode&0o022:raise ValueError('writable-source')
        data=stream.read()
    if hashlib.sha256(data).hexdigest()!=sha:raise ValueError('source-digest-mismatch')
    return data


def probe_bundle(base, name, root, api, guard):
    bundle=base/name;payload=bundle/'payload'
    (payload/'runtime/bin').mkdir(parents=True);(payload/'code/hermes_cli').mkdir(parents=True)
    python=payload/'runtime/bin/python3.11'
    python.write_text('#!/bin/sh\nexec /usr/bin/python3 "$@"\n');python.chmod(0o755)
    (payload/'code/hermes_cli/__init__.py').write_text('')
    (payload/'code/hermes_cli/main.py').write_text(
        'import os,json,time\nfrom pathlib import Path\n'
        'home=Path(os.environ["HOME"])\n'
        'data=dict(pid=os.getpid(),uid=os.geteuid(),home=str(home),hermes_home=os.environ["HERMES_HOME"],release=os.environ["GCAKE_RELEASE_DIGEST"])\n'
        '(home/"probe.json").write_text(json.dumps(data))\n'
        'while True:time.sleep(.2)\n')
    manifest=dict(schema=1,release_id=name,source_sha='a'*40,patch_sha='b'*64,
                  lock_sha='c'*64,python_version=sys.version.split()[0],verification={'passed':True,'evidence_sha':'d'*64},files=guard.tree(payload))
    # This is a supervisor-only fixture, NOT evidence of Python 3.11/Hermes dispatch.
    guard.atomic(bundle/'manifest.json',manifest)
    return bundle,manifest,guard.digest(manifest)


def verify_probe(store, supervisor, payload):
    deadline=time.monotonic()+12
    while time.monotonic()<deadline:
        output=supervisor.query() or ''
        pid_match=re.search(r'\bpid = ([1-9][0-9]*)',output)
        try:data=json.loads((store.root/'home/probe.json').read_text())
        except (OSError,ValueError):data={}
        if pid_match and data.get('pid')==int(pid_match.group(1)):
            if data.get('uid')!=store.runner_uid or data.get('release')!=payload.name or data.get('home')!=str(store.root/'home') or data.get('hermes_home')!=str(store.root/'home/.hermes'):
                raise ValueError('runner-identity-mismatch')
            ps=subprocess.run(['/bin/ps','-p',str(data['pid']),'-o','uid=,command='],capture_output=True,text=True,timeout=5)
            if ps.returncode or not re.match(r'\s*'+str(store.runner_uid)+r'\s',ps.stdout) or 'hermes_cli.main' not in ps.stdout:
                raise ValueError('supervisor-process-identity-mismatch')
            return data
        time.sleep(.1)
    raise TimeoutError('isolated-probe-timeout')


def supervisor_for(store, label, api):
    holder={}
    def verify(payload):return verify_probe(store,holder['service'],payload)
    service=api.LaunchdAdapter(store,label,store.root/'slots/gateway.plist',verify)
    holder['service']=service;return service


def runner(root, code, user, wait=True):
    def drop():
        os.setgroups([]);os.setgid(user.pw_gid);os.setuid(user.pw_uid)
    env=dict(PATH='/usr/bin:/bin',HOME=str(root/'home'),HERMES_HOME=str(root/'home/.hermes'),
             TMPDIR=str(root/'home/tmp'),PYTHONDONTWRITEBYTECODE='1')
    args=['/usr/bin/sandbox-exec','-f',str(root/'deny.sb'),'/usr/bin/python3','-I','-B','-S','-c',code]
    if wait:return subprocess.run(args,env=env,preexec_fn=drop,capture_output=True,text=True,timeout=15)
    return subprocess.Popen(args,env=env,preexec_fn=drop,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)


def main():
    if os.geteuid()!=0:raise PermissionError('owner-sudo-required')
    if sys.platform!='darwin':raise ValueError('macos-launchd-required')
    user=pwd.getpwnam('hermes')
    os.umask(0o022)
    # Identity lookup only; no account/home contents are opened.
    owner=Path(tempfile.mkdtemp(prefix='gcake-entry-owner-',dir='/private/tmp'))
    owner.chmod(0o755);root=owner/'authority';service=None;child=None;managers=[]
    report=dict(schema=1,production_operations=False,production_credentials_read=False,
                telegram_connections=False,account_changes=False,network_used=False,
                test_kind='real-root-hermes-and-launchd-probe-not-full-hermes',checks={})
    try:
        tools=owner/'tools';tools.mkdir(mode=0o755)
        if set(SOURCE_HASHES)!={'update_entry.py','updater_guard.py','monitor_wrapper.py'}:
            raise ValueError('reviewed-source-digests-required')
        for name,sha in SOURCE_HASHES.items():
            data=safe_bytes(Path(__file__).with_name(name),sha)
            path=tools/name;path.write_bytes(data);path.chmod(0o644)
        sys.path.insert(0,str(tools));api=importlib.import_module('update_entry');guard=importlib.import_module('updater_guard')
        store=api.EntryStore.initialize(root,user.pw_uid)
        home=root/'home';home.mkdir(mode=0o700);os.chown(home,user.pw_uid,user.pw_gid)
        for name in ('.hermes','tmp'):
            p=home/name;p.mkdir(mode=0o700);os.chown(p,user.pw_uid,user.pw_gid)
        # ACL gives hermes read, not write. No group or account membership changes.
        lock=root/'maintenance.lock';lock.chmod(0o600)
        subprocess.run(['/bin/chmod','+a','user:hermes allow read',str(lock)],check=True,capture_output=True,timeout=5)
        roottools=root/'tools';shutil.copytree(tools,roottools)
        launcher=root/'launcher.py'
        launcher.write_text('import sys\nfrom pathlib import Path\nroot=Path(__file__).parent\nsys.path.insert(0,str(root/"tools"))\nfrom update_entry import EntryStore,launch_gateway\nlaunch_gateway(EntryStore(root))\n');launcher.chmod(0o644)
        # Apple Python requires OS runtime access beyond a static CLI-tools list.
        # Keep explicit network/private-home/write exclusions and actual UID/ACL.
        profile=api.runner_profile(root)
        (root/'deny.sb').write_text(profile)
        old,om,osha=probe_bundle(owner,'old',root,api,guard)
        new,nm,nsha=probe_bundle(owner,'new',root,api,guard)
        for manifest,sha in ((om,osha),(nm,nsha)):store.approve(manifest,sha)
        store.bootstrap(old)
        label='local.gcake.hermes-test.'+uuid.uuid4().hex
        for name in api.SLOTS:
            p=root/'slots'/name;p.write_bytes(('original-'+name).encode());p.chmod(0o640)
        (root/'slots/gateway.plist').write_bytes(plistlib.dumps(api.render_plist(store,label)))
        prefix='import sys,json,os\nfrom pathlib import Path\nsys.path.insert(0,'+repr(str(roottools))+')\nfrom update_entry import EntryStore\ns=EntryStore(Path('+repr(str(root))+'))\n'
        probe=prefix+'out={}\nwith s.lease() as p:out["read_and_lease"]=p.name\n'
        probe+='for n in ("approvals.json","active.json","maintenance.lock"):\n try:\n  open(s.root/n,"w").write("bad")\n  out[n]=False\n except PermissionError:out[n]=True\n'
        probe+='try:\n s.approve('+repr(nm)+','+repr(nsha)+')\n out["writer_denied"]=False\nexcept PermissionError:out["writer_denied"]=True\n'
        probe+='try:\n open(s.root/"releases"/'+repr(osha)+'/"runtime/bin/python3.11","w").write("bad")\n out["release_write_denied"]=False\nexcept PermissionError:out["release_write_denied"]=True\nprint(json.dumps(out))'
        result=runner(root,probe,user)
        if result.returncode:
            report['checks']['runner_startup']=dict(returncode=result.returncode,stdout=result.stdout[-500:],stderr=result.stderr[-500:])
            raise RuntimeError('runner-permission-probe-failed')
        permissions=json.loads(result.stdout);assert all(v is True for k,v in permissions.items() if k!='read_and_lease')
        report['checks']['permissions']=permissions
        # ACL write permission does not reliably appear in mode bits; reject it too.
        active=root/'active.json'
        subprocess.run(['/bin/chmod','+a','user:hermes allow write',str(active)],check=True,capture_output=True,timeout=5)
        try:
            try:store.active();raise AssertionError('write ACL accepted')
            except ValueError:report['checks']['write_acl_rejected']=True
        finally:subprocess.run(['/bin/chmod','-N',str(active)],check=True,capture_output=True,timeout=5)
        hold=prefix+'import time\nwith s.lease():\n (s.root/"home/lease-ready").write_text("ready")\n time.sleep(8)\n'
        child=runner(root,hold,user,False)
        deadline=time.monotonic()+10
        while not (home/'lease-ready').exists():
            if child.poll() is not None or time.monotonic()>deadline:raise RuntimeError('shared-lease-probe-failed')
            time.sleep(.1)
        # No real service exists yet; a blocked lock must not call supervisor.
        service=supervisor_for(store,label,api);controller=api.UpdateEntry(store,service)
        assert controller.update(new)['status']=='blocked'
        child.terminate();child.communicate(timeout=5);child=None
        report['checks']['runner_shared_lease_blocks_root_update']=True
        with store.maintenance():service.start(store.verify_release(osha),'dry-run');service.verify(store.verify_release(osha))
        store.gate('ready',osha)
        report['checks']['actual_launchd_runner']=verify_probe(store,service,store.verify_release(osha))
        # Preserve and restore ACL on a fixture entry, never formal files.
        slot=root/'slots/wrapper'
        subprocess.run(['/bin/chmod','+a','user:hermes allow read',str(slot)],check=True,capture_output=True,timeout=5)
        original_acl=subprocess.run(['/bin/ls','-le',str(slot)],capture_output=True,text=True,check=True).stdout.splitlines()[1:]
        crash_phases=('prepared','stopping','stopped','replace:updater','replaced:updater','replace:wrapper','replaced:wrapper','switching','selected','verifying','verified')
        recovered=[]
        for phase in crash_phases:
            pid=os.fork()
            if pid==0:
                os.setsid()
                def crash(point):
                    if point==phase:os.kill(os.getpid(),signal.SIGKILL)
                controller.update(new,replacements={'updater':b'test-new-updater','wrapper':b'test-new-wrapper'},failpoint=crash)
                os._exit(2)
            managers.append(pid)
            status=os.waitpid(pid,0)[1];managers.remove(pid)
            if not os.WIFSIGNALED(status) or os.WTERMSIG(status)!=signal.SIGKILL:raise RuntimeError('expected-manager-kill-missing')
            # Fresh root process builds a new store and supervisor from durable state.
            fresh=os.fork()
            if fresh==0:
                os.setsid()
                try:
                    reopened=api.EntryStore(root);adapter=supervisor_for(reopened,label,api)
                    answer=api.UpdateEntry(reopened,adapter).recover()
                    guard.atomic(root/'private/recovery-result.json',answer)
                    os._exit(0 if answer['status']=='rolled_back' else 3)
                except BaseException:os._exit(4)
            managers.append(fresh)
            fresh_status=os.waitpid(fresh,0)[1];managers.remove(fresh)
            if fresh_status!=0:raise RuntimeError('fresh-process-recovery-failed')
            assert store.active()['digest']==osha
            acl=subprocess.run(['/bin/ls','-le',str(slot)],capture_output=True,text=True,check=True).stdout.splitlines()[1:]
            assert acl==original_acl
            recovered.append(phase)
        report['checks']['sigkill_fresh_controller_recovery']=recovered
        report['checks']['acl_restored']=True
        report['checks']['success_selection']=controller.update(new)['status']
        assert report['checks']['success_selection']=='updated'
        report['passed']=True
    except BaseException as error:
        report.update(passed=False,error_type=type(error).__name__,error=str(error)[:700])
    finally:
        cleanup=[]
        # A direct, unreaped fork child cannot have a reused PID. Kill its owned
        # session first so a controller cannot bootstrap after final teardown.
        for pid in managers:
            try:
                if os.waitpid(pid,os.WNOHANG)[0]==0:
                    if os.getpgid(pid)==pid:os.killpg(pid,signal.SIGKILL)
                    else:os.kill(pid,signal.SIGKILL)
                    os.waitpid(pid,0)
            except ChildProcessError:pass
            except BaseException as error:cleanup.append(type(error).__name__)
        if child is not None:
            try:child.terminate();child.communicate(timeout=5)
            except BaseException as error:cleanup.append(type(error).__name__)
        if service is not None:
            try:service.stop()
            except BaseException as error:cleanup.append(type(error).__name__)
        if not cleanup:
            try:shutil.rmtree(owner)
            except BaseException as error:cleanup.append(type(error).__name__)
        report['cleanup']=dict(test_service_removed=not cleanup,owned_root_removed=not owner.exists(),errors=cleanup)
        if cleanup:report.update(passed=False,retained_owned_root=str(owner),retained_test_label=service.label if service else None)
        print(json.dumps(report,indent=2))
    return 0 if report.get('passed') and not report['cleanup']['errors'] else 1


if __name__=='__main__':raise SystemExit(main())
