"""Preparation inputs survive removal of the original repair workspace."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


class RelocatedPreparation(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='gcake-saveback-')
        self.addCleanup(self.temp.cleanup)
        self.repo=Path(self.temp.name).resolve()/'checkout'
        source=Path(__file__).resolve().parent
        target=self.repo/'scripts/hermes'
        shutil.copytree(source,target,ignore=shutil.ignore_patterns('__pycache__'))
        evidence=source.parents[1]/'docs/hermes-notification-repair/2026-10-15'
        self.evidence=self.repo/'docs/hermes-notification-repair/2026-10-15'
        shutil.copytree(evidence,self.evidence)

    def resolve(self,prepare=False):
        script=self.repo/'scripts/hermes/prepare_notification_successor.py'
        code="import runpy,json; m=runpy.run_path("+repr(str(script))+"); "+("m['prepare']()" if prepare else "print(json.dumps({k:str(v) for k,v in m['preparation_inputs']().items()}))")
        return subprocess.run([sys.executable,'-B','-c',code],capture_output=True,text=True,cwd=script.parent)

    def test_relocated_checkout_uses_only_preserved_repository_inputs(self):
        result=self.resolve()
        self.assertEqual(result.returncode,0,result.stderr)
        inputs=json.loads(result.stdout)
        self.assertEqual(set(inputs),{'publication_monitor.py','reconcile_notification.py','telegram_readonly_diagnostic.py','owner_continue.py','successor_runner_probe.py','product_test_log'})
        for path in inputs.values():
            self.assertTrue(Path(path).is_relative_to(self.repo))
            self.assertTrue(Path(path).is_file())
        self.assertEqual(Path(inputs['owner_continue.py']),self.evidence/'historical/gateway-switch/owner_continue.py')

    def test_missing_continuation_or_evidence_refuses_without_output(self):
        for name in ('historical/gateway-switch/owner_continue.py','gateway-switch-full-green.log'):
            path=self.evidence/name
            saved=path.read_bytes();path.unlink()
            try:
                result=self.resolve(prepare=True)
                self.assertNotEqual(result.returncode,0)
                self.assertIn('preparation-input-missing',result.stderr)
                self.assertFalse((self.repo/'owner-successor').exists())
            finally:path.write_bytes(saved)


if __name__=='__main__':unittest.main()
