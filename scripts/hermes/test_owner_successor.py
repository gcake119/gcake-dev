from contextlib import closing
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import owner_successor as owner
from updater_guard import read,digest,check_payload,atomic
from update_entry import EntryStore,write_public
from test_update_entry import bundle


class OwnerProposal(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='gcake-entry-owner-',dir='/private/tmp');self.addCleanup(self.temp.cleanup)
        self.base=Path(self.temp.name);self.old=bundle(self.base,'old');self.new=bundle(self.base,'new')
        self.store=EntryStore.initialize(self.base/'authority',__import__('os').getuid())
        self.oldsha=digest(read(self.old/'manifest.json'));self.sha=digest(read(self.new/'manifest.json'))
        self.store.approve(read(self.old/'manifest.json'),self.oldsha);self.store.bootstrap(self.old)
        self.store.select(self.oldsha,'live');self.store.gate('ready',self.oldsha,'live')
        self.approvals=read(self.store.root/'approvals.json')

    def stage(self,**kwargs):
        verify=lambda p:check_payload(p/'payload',read(p/'manifest.json'))
        return owner.stage_proposal(self.store,self.new,self.sha,self.oldsha,verify=verify,**kwargs)

    def test_exact_proposal_approval_pointer_and_repeat_preserve_active(self):
        first=self.stage();second=self.stage()
        self.assertEqual(first,second)
        self.assertEqual(read(self.store.root/'private/next-candidate.json'),{'digest':self.sha})
        self.assertEqual(read(self.store.root/'approvals.json')['new'],self.sha)
        self.assertEqual(self.store.active(),{'digest':self.oldsha,'mode':'live'})
        self.assertEqual(digest(read(Path(first['manifest_path']))),self.sha)

    def test_foreign_pointer_and_pending_recovery_are_preserved(self):
        pointer=self.store.root/'private/next-candidate.json';atomic(pointer,{'digest':'f'*64})
        with self.assertRaises(ValueError):self.stage()
        self.assertEqual(read(pointer),{'digest':'f'*64});self.assertEqual(read(self.store.root/'approvals.json'),self.approvals)
        pointer.unlink();atomic(self.store.journal,{'phase':'prepared'})
        with self.assertRaises(ValueError):self.stage()
        self.assertEqual(read(self.store.root/'approvals.json'),self.approvals)

    def test_payload_or_baseline_drift_is_rejected_before_approval(self):
        self.store.select(self.oldsha,'dry-run')
        with patch.object(self.store,'active',return_value={'digest':'a'*64,'mode':'dry-run'}):
            with self.assertRaises(ValueError):self.stage()
        file=self.new/'payload/runtime/bin/python3.11';file.write_text('tampered')
        with self.assertRaises(ValueError):self.stage()
        self.assertEqual(read(self.store.root/'approvals.json'),self.approvals)

    def test_approval_without_pointer_cannot_trigger_updater(self):
        self.stage(publish=False)
        self.assertFalse((self.store.root/'private/next-candidate.json').exists())
        owner.publish_pointer(self.store,self.sha,self.oldsha)
        self.assertEqual(read(self.store.root/'private/next-candidate.json'),{'digest':self.sha})

    def test_qualified_policy_restore_has_no_service_or_job_commands(self):
        self.stage();self.store.seal(self.new);self.store.select(self.sha,'dry-run');self.store.gate('ready',self.sha)
        contract={'id':'test-job'}
        class Actor:
            def drained(self):return True
            def job(self):return dict(contract)
        normalized=owner.job_contract(contract);record={'phase':'qualified'};saved=[]
        with patch.object(owner,'history_hash',return_value='history'):
            owner.restore_live_policy(self.store,self.sha,Actor(),{'status':'passed'},normalized,record,lambda r:saved.append(dict(r)))
        self.assertEqual(self.store.active(),{'digest':self.sha,'mode':'live'})
        self.assertEqual(saved[-1]['phase'],'active-live')
        self.assertTrue(saved[-1]['notification_history_unchanged'])

    def test_unqualified_health_never_activates(self):
        record={'phase':'prepared'}
        with self.assertRaises(ValueError):owner.restore_live_policy(self.store,self.oldsha,None,{'status':'passed'},{},record,lambda r:None)
        record={'phase':'qualified'}
        with self.assertRaises(ValueError):owner.restore_live_policy(self.store,self.oldsha,None,{'status':'failed'},{},record,lambda r:None)
        self.assertEqual(self.store.active(),{'digest':self.oldsha,'mode':'live'})

    def test_public_receipt_never_exposes_private_job_destination(self):
        result=owner.public_report({'phase':'qualified','job_contract':{'deliver':'PRIVATE_RECIPIENT'},'source_probe':{'secret':'PRIVATE_TOKEN'}},'/private/receipt')
        self.assertEqual(result,{'phase':'qualified','status':'qualified','receipt_path':'/private/receipt'})

    def test_policy_history_drift_returns_to_dry_and_records_failure(self):
        self.stage();self.store.seal(self.new);self.store.select(self.sha,'dry-run');self.store.gate('ready',self.sha)
        class Actor:
            def drained(self):return True
            def job(self):return {'id':'test'}
        record={'phase':'qualified'};saved=[]
        with patch.object(owner,'history_hash',side_effect=['before','after']):
            with self.assertRaises(ValueError):owner.restore_live_policy(self.store,self.sha,Actor(),{'status':'passed'},owner.job_contract({'id':'test'}),record,lambda r:saved.append(dict(r)))
        self.assertEqual(self.store.active()['mode'],'dry-run')
        self.assertEqual(saved[-1]['phase'],'activation-failed')

    def test_natural_receipt_requires_exact_execution_and_original_time(self):
        from types import SimpleNamespace
        receipt={'job_id':owner.JOB,'execution_id':'exec','scheduled_instant':'2026-10-15T00:00:00Z','uid':502,'digest':self.sha,'mode':'dry-run','exit_code':0}
        class Actor:
            user=SimpleNamespace(pw_uid=502)
            def run(self,*args):return receipt
            def ledger(self):return [['exec',owner.JOB,'2026-10-15T00:00:00Z','completed']]
        actor=Actor()
        self.assertEqual(owner.natural_receipt(actor,self.new/'payload',self.sha),receipt)
        with patch.object(actor,'ledger',return_value=[['exec',owner.JOB,'2026-10-15T00:01:00Z','completed']]):
            with self.assertRaises(ValueError):owner.natural_receipt(actor,self.new/'payload',self.sha)


if __name__=='__main__':unittest.main()
