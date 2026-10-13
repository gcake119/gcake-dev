import hashlib
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from update_entry import EntryStore, file_identity


class Supervisor:
    def __init__(self,fail=False):self.running=True;self.fail=fail;self.calls=[]
    def drained(self):return True
    def stop(self):self.running=False;self.calls.append('stop')
    def start_original(self):self.running=True;self.calls.append('start-original')
    def verify_original(self):self.calls.append('verify-original')
    def start_managed(self):self.running=True;self.calls.append('start-managed')
    def verify_managed(self):
        self.calls.append('verify-managed')
        if self.fail:raise RuntimeError('candidate-failed')


class FirstInstallAcceptance(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='gcake-entry-first-install-',dir='/private/tmp');self.addCleanup(self.tmp.cleanup)
        self.base=Path(self.tmp.name);self.root=self.base/'authority'
        self.store=EntryStore.initialize(self.root,os.geteuid())
        self.paths={name:self.base/name for name in ('updater','launcher','gateway','wrapper','summary_env')}
        for name in ('updater','gateway','wrapper'):
            self.paths[name].write_text('original-'+name);self.paths[name].chmod(0o600)
        self.original={k:p.read_bytes() if p.exists() else None for k,p in self.paths.items()}
        self.plan={k:('candidate-'+k).encode() for k in self.paths}
        from production_install import slot_identity
        self.identities={k:slot_identity(p) if p.exists() else None for k,p in self.paths.items()}
        self.history=self.base/'latest-history';self.history.write_text('sent;unknown;baseline')

    def installer(self,service):
        import production_install as module
        self.patch=patch.object(module,'SLOT_PATHS',self.paths);self.patch.start();self.addCleanup(self.patch.stop)
        return module.FirstInstall(self.store,service)

    def test_drift_blocks_before_stop_or_write(self):
        service=Supervisor();installer=self.installer(service)
        self.paths['wrapper'].write_text('drift')
        result=installer.install(self.plan,self.identities)
        self.assertEqual(result['status'],'blocked')
        self.assertEqual(service.calls,[])
        self.assertEqual(self.paths['wrapper'].read_text(),'drift')

    def test_candidate_failure_restores_exact_first_slots_without_history_rollback(self):
        service=Supervisor(fail=True);installer=self.installer(service)
        result=installer.install(self.plan,self.identities)
        self.assertEqual(result['status'],'rolled_back')
        for key,path in self.paths.items():
            self.assertEqual(path.read_bytes() if path.exists() else None,self.original[key])
            if path.exists():self.assertEqual(path.stat().st_mode&0o777,0o600)
        self.assertEqual(self.history.read_text(),'sent;unknown;baseline')
        self.assertTrue(service.running)
        self.assertEqual(service.calls[-2:],['start-original','verify-original'])

    def test_success_keeps_durable_originals(self):
        service=Supervisor();installer=self.installer(service)
        result=installer.install(self.plan,self.identities)
        self.assertEqual(result['status'],'installed-dry-run')
        for key,path in self.paths.items():self.assertEqual(path.read_bytes(),self.plan[key])
        self.assertTrue((self.root/'private/first-production-backup.json').exists())
        self.assertEqual(self.history.read_text(),'sent;unknown;baseline')

    def test_permission_drift_blocks_before_stop(self):
        service=Supervisor();installer=self.installer(service)
        self.paths['wrapper'].chmod(0o644)
        self.assertEqual(installer.install(self.plan,self.identities)['status'],'blocked')
        self.assertEqual(service.calls,[])

    def test_interrupted_wrapper_switch_recovers_in_fresh_controller(self):
        class Crash(BaseException):pass
        service=Supervisor();installer=self.installer(service)
        def crash(phase):
            if phase=='replaced:wrapper':raise Crash()
        with self.assertRaises(Crash):installer.install(self.plan,self.identities,failpoint=crash)
        from production_install import FirstInstall
        fresh=FirstInstall(EntryStore(self.root),Supervisor())
        self.assertEqual(fresh.recover()['status'],'rolled_back')
        for key,path in self.paths.items():self.assertEqual(path.read_bytes() if path.exists() else None,self.original[key])
        self.assertEqual(self.history.read_text(),'sent;unknown;baseline')

    def test_failed_original_verification_keeps_sender_stopped(self):
        class BrokenOriginal(Supervisor):
            def verify_original(self):raise RuntimeError('original-failed')
        service=BrokenOriginal(fail=True);installer=self.installer(service)
        self.assertEqual(installer.install(self.plan,self.identities)['status'],'recovery_failed')
        self.assertFalse(service.running)
        self.assertEqual(installer.install(self.plan,self.identities)['reason'],'manual-recovery-required')


if __name__=='__main__':unittest.main()
