import json
import os
from pathlib import Path
import tempfile
import time
import unittest
import substack_attention as product

class AttentionDelivery(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.feed=self.root/'status.json';self.db=self.root/'state.sqlite';self.receipt=self.root/'receipt.json';self.sent=[]
    def tearDown(self):self.temp.cleanup()
    def snapshot(self,issues=None,**patch):
        data={'schema':1,'generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'issues':issues if issues is not None else [{'slug':'demo','code':'DISTRIBUTION_MANUAL_REQUIRED'}]};data.update(patch)
        self.feed.write_text(json.dumps(data));self.feed.chmod(0o600)
    def sender(self,message):self.sent.append(message);return {'success':True,'message_id':123}
    def run_once(self,sender=None):return product.consume(self.feed,self.db,self.receipt,os.getuid(),sender or self.sender)
    def test_existing_quiet_holds_send_once_after_restart_and_recur_after_clear(self):
        self.snapshot();self.assertEqual(self.run_once()['status'],'sent');self.snapshot()
        self.assertEqual(self.run_once()['status'],'quiet');self.assertEqual(len(self.sent),1)
        self.snapshot([]);self.assertEqual(self.run_once()['status'],'clear');self.assertEqual(len(self.sent),1)
        self.snapshot();self.assertEqual(self.run_once()['status'],'sent');self.assertEqual(len(self.sent),2)
        self.assertIn('https://gcake119.github.io/gcake-dev/posts/demo/',self.sent[0]);self.assertFalse(json.loads(self.receipt.read_text())['humanReceived'])
    def test_unknown_result_never_resends_or_saves_exception_secrets(self):
        self.snapshot()
        def unknown(message):self.sent.append(message);raise TimeoutError('bot-secret')
        self.assertEqual(self.run_once(unknown)['status'],'unknown')
        self.assertEqual(self.run_once()['status'],'unknown');self.assertEqual(len(self.sent),1)
        self.assertNotIn('bot-secret',self.receipt.read_text())
    def test_durable_intent_prevents_resend_after_crash(self):
        self.snapshot()
        def crash(message):self.sent.append(message);raise SystemExit()
        with self.assertRaises(SystemExit):self.run_once(crash)
        self.assertEqual(self.run_once()['status'],'unknown');self.assertEqual(len(self.sent),1)
    def test_skipped_partial_or_missing_message_ack_is_not_sent(self):
        for reply in [{'success':True,'skipped':True,'message_id':123},{'success':True},{'success':True,'partial_success':True,'message_id':123},{'success':False,'error':'secret'}]:
            with self.subTest(reply=reply):
                if self.db.exists():self.db.unlink()
                self.snapshot();self.assertEqual(self.run_once(lambda _:reply)['status'],'unknown')
    def test_invalid_or_stale_input_does_not_clear_previous_state(self):
        self.snapshot();self.run_once()
        for patch in [{'generatedAt':'2000-01-01T00:00:00Z'},{'issues':[{'slug':'../secret','code':'DISTRIBUTION_MANUAL_REQUIRED'}]},{'issues':[{'slug':'demo','code':'SECRET'}]}]:
            self.snapshot(**patch)
            with self.assertRaises(ValueError):self.run_once()
        self.snapshot();self.assertEqual(self.run_once()['status'],'quiet');self.assertEqual(len(self.sent),1)
    def test_actionable_reasons_do_not_invent_identity_errors_or_completed_cancellation(self):
        cases={
            'SUBSTACK_DRAFT_PREPARATION_REQUIRED':'待備稿',
            'SUBSTACK_CONTENT_SYNC_REQUIRED':'內容',
            'SUBSTACK_SCHEDULE_CANCEL_REQUIRED':'尚未確認解除',
            'SUBSTACK_SCHEDULE_POSTPONE_REQUIRED':'尚未確認延期',
            'SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED':'結果未明',
            'DISTRIBUTION_MANUAL_REQUIRED':'人工確認',
        }
        for index,(code,expected) in enumerate(cases.items()):
            with self.subTest(code=code):
                self.snapshot([{'slug':'article-'+str(index),'code':code}]);self.assertEqual(self.run_once()['status'],'sent')
                self.assertIn(expected,self.sent[-1]);self.assertNotIn('檢查文章身分',self.sent[-1]);self.assertNotIn('已暫停自動重試',self.sent[-1]);self.assertNotIn('發文失敗',self.sent[-1])
                self.assertEqual(self.run_once()['status'],'quiet')
        self.assertEqual(len(self.sent),len(cases))

    def test_nonlive_hermes_gate_blocks_before_credentials_or_send(self):
        from unittest.mock import patch
        import types
        authority=self.root/'authority';authority.mkdir();digest='a'*64;code=authority/'releases'/digest/'code';code.mkdir(parents=True)
        (authority/'active.json').write_text(json.dumps({'digest':digest,'mode':'live'}))
        (authority/'gate.json').write_text(json.dumps({'digest':digest,'mode':'dry-run','status':'ready'}))
        effects=[];mods={'hermes_cli':types.ModuleType('hermes_cli'),'tools':types.ModuleType('tools'),'hermes_cli.send_cmd':types.ModuleType('hermes_cli.send_cmd'),'tools.send_message_tool':types.ModuleType('tools.send_message_tool')}
        mods['hermes_cli.send_cmd']._load_hermes_env=lambda:effects.append('credentials')
        mods['tools.send_message_tool'].send_message_tool=lambda _:effects.append('send')
        with patch.object(product,'AUTHORITY',authority),patch.dict(product.sys.modules,mods):
            with self.assertRaises(ValueError):product.hermes_sender(code)
        self.assertEqual(effects,[])
    def test_symlink_input_is_rejected_before_delivery(self):
        self.snapshot();other=self.root/'other';self.feed.rename(other);self.feed.symlink_to(other)
        with self.assertRaises((ValueError,OSError)):self.run_once()
        self.assertEqual(self.sent,[])

if __name__=='__main__':unittest.main()
