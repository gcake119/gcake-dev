"""Observable isolated entry acceptance; real cross-UID evidence is owner-run."""
import hashlib
import json
import os
import plistlib
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from updater_guard import atomic, canonical, digest, read, tree
import update_entry as entry


def bundle(base, name):
    root = base/name
    payload = root/'payload'
    for file in ('code/hermes_cli/main.py','runtime/bin/python3.11','library/monitor.py'):
        path=payload/file;path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(name+' '+file);path.chmod(0o644)
    manifest=dict(schema=1,release_id=name,source_sha='a'*40,patch_sha='b'*64,
                  lock_sha='c'*64,python_version='3.11.15',verification={'passed':True,'evidence_sha':'d'*64},files=tree(payload))
    atomic(root/'manifest.json',manifest)
    return root


class PersistentSupervisor:
    """State survives controller process death; no real system service operations."""
    def __init__(self,root):
        self.path=root/'supervisor.json'
        if not self.path.exists():atomic(self.path,{'running':True,'calls':[],'fail':[],'drained':True})
    def state(self):return read(self.path)
    def change(self,event,**values):
        data=self.state();data['calls'].append(event);data.update(values);atomic(self.path,data)
    def drained(self):return self.state()['drained']
    def stop(self):self.change('stop',running=False)
    def start(self,payload,mode):
        if self.state()['running']:raise ValueError('duplicate-supervisor')
        self.change('start:'+payload.name, running=True)
    def verify(self,payload):
        self.change('verify:'+payload.name)
        if payload.name in self.state()['fail']:raise RuntimeError('fixture-verification-failure')


class EntryAcceptance(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='gcake-entry-',dir='/private/tmp');self.addCleanup(self.tmp.cleanup)
        self.base=Path(self.tmp.name);self.root=self.base/'authority'
        self.store=entry.EntryStore.initialize(self.root,os.getuid())
        self.old=bundle(self.base,'old');self.new=bundle(self.base,'new')
        for path in (self.old,self.new):self.store.approve(read(path/'manifest.json'),digest(read(path/'manifest.json')))
        self.oldsha=self.store.bootstrap(self.old)
        self.newsha=digest(read(self.new/'manifest.json'))
        for name in entry.SLOTS:
            p=self.root/'slots'/name;p.write_bytes(('original-'+name).encode());p.chmod(0o640)
        self.original={name:(self.root/'slots'/name).read_bytes() for name in entry.SLOTS}
        self.history=self.base/'history.json';self.history.write_text('{"sent":["one"],"unknown":["lost"],"jobs":"unchanged"}')
        self.before=self.history.read_bytes();self.service=PersistentSupervisor(self.base)
        self.controller=entry.UpdateEntry(self.store,self.service)
    def update(self,**kwargs):return self.controller.update(self.new,replacements={'wrapper':b'new-wrapper','updater':b'new-updater'},**kwargs)
    def assert_old(self):
        self.assertEqual(self.store.active()['digest'],self.oldsha)
        for name in entry.SLOTS:
            p=self.root/'slots'/name;self.assertEqual(p.read_bytes(),self.original[name]);self.assertEqual(p.stat().st_mode&0o777,0o640)
        self.assertEqual(self.history.read_bytes(),self.before)
    def test_unknown_candidate_deduplicates_without_supervisor_operations(self):
        unknown=bundle(self.base,'unknown')
        for _ in range(2):self.assertEqual(self.controller.update(unknown)['status'],'skipped')
        self.assertEqual(len(list((self.root/'pending').iterdir())),1);self.assertEqual(self.service.state()['calls'],[]);self.assert_old()
    def test_success_pins_read_only_release_and_preserves_latest_history(self):
        self.assertEqual(self.update()['status'],'updated')
        self.assertEqual(self.store.active()['digest'],self.newsha);self.assertEqual(self.store.active()['mode'],'dry-run')
        with self.store.lease() as payload:self.assertEqual(payload.name,self.newsha)
        self.assertEqual(self.history.read_bytes(),self.before)
    def test_shared_lease_blocks_update_before_service_stop(self):
        with self.store.lease():self.assertEqual(self.update()['status'],'blocked')
        self.assertEqual(self.service.state()['calls'],[]);self.assert_old()
    def test_failed_drain_preserves_old_sender(self):
        state=self.service.state();state['drained']=False;atomic(self.service.path,state)
        self.assertEqual(self.update()['status'],'blocked');self.assertEqual(self.service.state()['calls'],[]);self.assert_old()
    def test_bad_control_permissions_or_symlink_refuse_before_stop(self):
        for name in ('active.json','approvals.json'):
            p=self.root/name;p.chmod(0o666)
            self.assertEqual(self.update()['status'],'blocked');p.chmod(0o644)
        p=self.root/'maintenance.lock';p.unlink();p.symlink_to(self.history)
        self.assertEqual(self.update()['status'],'blocked');self.assertEqual(self.service.state()['calls'],[])
    def test_non_authority_cannot_write(self):
        with patch('update_entry.os.geteuid',return_value=os.getuid()+1000):
            with self.assertRaises(PermissionError):self.store.approve(read(self.new/'manifest.json'),self.newsha)
            self.assertEqual(self.update()['status'],'blocked')
        self.assert_old()
    def test_approved_payload_corruption_is_blocked_before_stop(self):
        (self.new/'payload/runtime/bin/python3.11').write_text('corrupt')
        self.assertEqual(self.update()['status'],'blocked');self.assertEqual(self.service.state()['calls'],[]);self.assert_old()
    def test_candidate_verification_failure_restores_original_slots(self):
        state=self.service.state();state['fail']=[self.newsha];atomic(self.service.path,state)
        self.assertEqual(self.update()['status'],'rolled_back');self.assert_old();self.assertTrue(self.service.state()['running'])
    def test_every_crash_boundary_recovers_in_fresh_controller_process(self):
        phases=('prepared','stopping','stopped','replace:updater','replaced:updater','replace:wrapper','replaced:wrapper','switching','selected','verifying','verified')
        for phase in phases:
            with self.subTest(phase=phase):
                pid=os.fork()
                if pid==0:
                    self.update(failpoint=lambda point:os._exit(79) if point==phase else None);os._exit(1)
                self.assertEqual(os.waitpid(pid,0)[1]>>8,79)
                script='from pathlib import Path;from update_entry import EntryStore,UpdateEntry;from test_update_entry import PersistentSupervisor;import json;print(json.dumps(UpdateEntry(EntryStore(Path('+repr(str(self.root))+')),PersistentSupervisor(Path('+repr(str(self.base))+'))).recover()))'
                result=subprocess.run([sys.executable,'-B','-c',script],cwd=Path(__file__).parent,capture_output=True,text=True,timeout=10)
                self.assertEqual(result.returncode,0,result.stderr);self.assertEqual(json.loads(result.stdout)['status'],'rolled_back');self.assert_old()
    def test_recovery_failure_stops_and_blocks_future_restart(self):
        state=self.service.state();state['fail']=[self.newsha,self.oldsha];atomic(self.service.path,state)
        self.assertEqual(self.update()['status'],'recovery_failed');self.assertFalse(self.service.state()['running'])
        calls=self.service.state()['calls'];self.assertEqual(self.update()['status'],'blocked');self.assertEqual(self.service.state()['calls'],calls)
        self.assertEqual(self.store.launch_status()['status'],'maintenance');self.assertEqual(self.history.read_bytes(),self.before)
    def test_pending_maintenance_survives_lock_recreation(self):
        pid=os.fork()
        if pid==0:self.update(failpoint=lambda phase:os._exit(79) if phase=='stopped' else None);os._exit(1)
        os.waitpid(pid,0);self.assertEqual(self.store.launch_status()['status'],'maintenance')
        (self.root/'maintenance.lock').unlink();self.store.recreate_lock()
        self.assertEqual(self.store.launch_status()['status'],'maintenance')
        with self.assertRaises(ValueError):
            with self.store.lease('live'):pass
        self.assertEqual(self.controller.recover()['status'],'rolled_back');self.assert_old()
    def test_post_commit_receipt_failure_does_not_rollback(self):
        with patch.object(self.store,'receipt',side_effect=OSError('fixture-receipt-failure')):result=self.update()
        self.assertEqual(result['status'],'updated');self.assertIn('receipt_error',result)
        self.assertEqual(self.store.active()['digest'],self.newsha)
    def test_foreign_target_paths_and_arbitrary_slot_are_rejected(self):
        with self.assertRaises(ValueError):entry.EntryStore(Path('/Users/hermes/.hermes'))
        with self.assertRaises(ValueError):entry.LaunchdAdapter(self.store,'ai.hermes.gateway.boot',self.root/'slots/gateway.plist',lambda payload:None)
        self.assertEqual(self.controller.update(self.new,replacements={'../../escape':b'bad'})['status'],'blocked')
        self.assertEqual(self.service.state()['calls'],[])

    def test_second_update_recovers_previous_slots_and_keeps_initial_backup(self):
        self.assertEqual(self.update()['status'],'updated')
        current={n:(self.root/'slots'/n).read_bytes() for n in entry.SLOTS}
        third=bundle(self.base,'third');sha=digest(read(third/'manifest.json'));self.store.approve(read(third/'manifest.json'),sha)
        state=self.service.state();state['fail']=[sha];atomic(self.service.path,state)
        self.assertEqual(self.controller.update(third,replacements={'wrapper':b'third'})['status'],'rolled_back')
        self.assertEqual(self.store.active()['digest'],self.newsha)
        for n in entry.SLOTS:
            self.assertEqual((self.root/'slots'/n).read_bytes(),current[n])
            self.assertEqual((self.root/'private/first-backup'/n).read_bytes(),self.original[n])

    def test_verification_permit_disappears_after_controller_lock_is_released(self):
        with self.store.maintenance():
            self.store.gate('verifying',self.oldsha)
            self.assertEqual(entry.launch_decision(self.store)['status'],'ready')
        self.assertEqual(entry.launch_decision(self.store)['status'],'maintenance')

    def test_combined_wrapper_can_verify_dry_during_exclusive_maintenance(self):
        with self.store.maintenance():
            self.store.gate('verifying',self.oldsha)
            with self.store.lease('dry-run') as payload:self.assertEqual(payload.name,self.oldsha)
            with self.assertRaises(ValueError):
                with self.store.lease('live'):pass
        with self.assertRaises(ValueError):
            with self.store.lease('dry-run'):pass

    def test_verification_lease_rejects_wrong_selection(self):
        with self.store.maintenance():
            self.store.gate('verifying',self.newsha)
            with self.assertRaises(ValueError):
                with self.store.lease('dry-run'):pass

    def test_maintenance_owner_identity_is_timezone_independent(self):
        with patch.dict(os.environ,{'TZ':'Asia/Taipei'}):taipei=entry.process_identity(os.getpid())
        with patch.dict(os.environ,{'TZ':'UTC'}):utc=entry.process_identity(os.getpid())
        self.assertEqual(taipei,utc)
        self.assertEqual(utc['uid'],os.getuid())

    @unittest.skipUnless(sys.platform == 'darwin', 'Darwin sandbox requires direct libproc metadata; Linux uses its supported ps path')
    def test_owner_identity_does_not_spawn_setuid_ps(self):
        with patch('update_entry.subprocess.run',side_effect=PermissionError('sandbox forbids setuid ps')):
            self.assertEqual(entry.process_identity(os.getpid())['uid'],os.getuid())

    def test_committed_crash_is_completed_without_rolling_back(self):
        pid=os.fork()
        if pid==0:self.update(failpoint=lambda p:os._exit(79) if p=='committed' else None);os._exit(1)
        os.waitpid(pid,0)
        self.assertEqual(self.controller.recover()['status'],'updated')
        self.assertEqual(self.store.active()['digest'],self.newsha)

    def test_fixed_launchctl_arrays_and_duplicate_start_refusal(self):
        label='local.gcake.hermes-test.'+'a'*32
        (self.root/'slots/gateway.plist').write_bytes(plistlib.dumps(entry.render_plist(self.store,label)))
        calls=[];loaded={'value':False}
        def run(argv,**kwargs):
            calls.append(argv)
            if argv[1]=='print':return subprocess.CompletedProcess(argv,0 if loaded['value'] else 113,'pid = 123' if loaded['value'] else '', '' if loaded['value'] else 'Could not find service')
            loaded['value']=argv[1]=='bootstrap'
            return subprocess.CompletedProcess(argv,0,'','')
        supervisor=entry.LaunchdAdapter(self.store,label,self.root/'slots/gateway.plist',lambda payload:None,run=run)
        with self.store.maintenance():supervisor.start(self.store.verify_release(self.oldsha),'dry-run')
        with self.assertRaises(ValueError):supervisor.start(self.store.verify_release(self.oldsha),'dry-run')
        supervisor.verify(self.store.verify_release(self.oldsha));supervisor.stop()
        self.assertFalse(loaded['value'])
        for argv in calls:self.assertEqual(argv[0],'/bin/launchctl');self.assertNotIn('ai.hermes.gateway.boot',' '.join(argv))

    def test_mapping_drift_and_non_missing_launchctl_error_refuse(self):
        label='local.gcake.hermes-test.'+'b'*32
        actual=entry.render_plist(self.store,label);actual['EnvironmentVariables']['HOME']='/Users/hermes'
        (self.root/'slots/gateway.plist').write_bytes(plistlib.dumps(actual))
        calls=[]
        def run(argv,**kwargs):calls.append(argv);return subprocess.CompletedProcess(argv,125,'','permission denied')
        supervisor=entry.LaunchdAdapter(self.store,label,self.root/'slots/gateway.plist',lambda payload:None,run=run)
        with self.assertRaises(ValueError):supervisor.start(self.store.verify_release(self.oldsha),'dry-run')
        self.assertEqual(calls,[])
        with self.assertRaises(RuntimeError):supervisor.query()

if __name__=='__main__':unittest.main()
