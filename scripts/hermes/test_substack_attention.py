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

    def publication(self):
        return {'slug':'trial','id':'123','revision':'sha256:'+'a'*64,'title':'Public title','actualAt':'2026-10-21T23:01:02.155Z','confirmedAt':'2026-10-21T23:00:00.000Z','differenceSeconds':62.155}
    def test_success_once_after_restart_and_issue_recurrence(self):
        self.snapshot([],schema=2,publications=[self.publication()]);self.assertEqual(self.run_once()['status'],'sent')
        self.assertEqual(self.sent[0].splitlines(),['Substack 同步發布驗證完成','Public title','https://gcakedev.substack.com/p/trial'])
        self.assertEqual(self.run_once()['status'],'quiet');self.assertEqual(len(self.sent),1)
        self.snapshot();self.run_once();self.snapshot([],schema=2,publications=[self.publication()]);self.run_once();self.assertEqual(len(self.sent),2)
    def test_unknown_success_never_resends_and_invalid_time_difference_is_rejected(self):
        self.snapshot([],schema=2,publications=[self.publication()])
        def unknown(message):self.sent.append(message);raise TimeoutError('secret')
        self.assertEqual(self.run_once(unknown)['status'],'unknown');self.assertEqual(self.run_once()['status'],'unknown');self.assertEqual(len(self.sent),1)
        for patch in [{'differenceSeconds':0},{'id':'../123'},{'actualAt':'invalid'},{'title':'private\ncontent'}]:
            self.snapshot([],schema=2,publications=[dict(self.publication(),**patch)])
            with self.assertRaises(ValueError):self.run_once()
    def test_success_crash_preserves_intent_and_later_issue_failure_does_not_block_another_article(self):
        self.snapshot([],schema=2,publications=[self.publication()])
        def crash(message):self.sent.append(message);raise SystemExit()
        with self.assertRaises(SystemExit):self.run_once(crash)
        self.assertEqual(self.run_once()['status'],'unknown');self.assertEqual(len(self.sent),1)
        other=dict(self.publication(),slug='second',id='456')
        self.snapshot(schema=2,publications=[other])
        def mixed(message):
            self.sent.append(message)
            if '前景待辦' in message:raise PermissionError(13,'secret')
            return {'success':True,'message_id':456}
        result=self.run_once(mixed);self.assertEqual(result['status'],'unknown');self.assertEqual(result['publications'][0]['status'],'sent');self.assertIn('https://gcakedev.substack.com/p/second',self.sent[-1])
    def test_proven_selection_rejection_is_not_a_transport_attempt_and_can_send_after_repair(self):
        self.snapshot([],schema=2,publications=[self.publication()])
        def selection_rejected(message):raise product.HermesSelectionMismatch('hermes-selection-changed')
        self.assertEqual(self.run_once(selection_rejected)['status'],'not_sent');self.assertEqual(self.sent,[])
        self.assertEqual(self.run_once()['status'],'sent');self.assertEqual(self.run_once()['status'],'quiet');self.assertEqual(len(self.sent),1)
    def test_permission_failure_reports_bounded_stage(self):
        from unittest.mock import patch
        self.snapshot()
        with patch.object(product.os,'open',side_effect=PermissionError(13,'credential-secret')):
            with self.assertRaises(PermissionError) as failure:self.run_once()
        self.assertEqual(failure.exception.stage,'feed-read');self.assertNotIn('credential-secret',json.dumps(product.failure_report(failure.exception)))

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
    def test_selection_preflight_creates_no_delivery_intent_and_never_loads_sender(self):
        from unittest.mock import patch
        self.snapshot()
        args=['consumer','--feed',str(self.feed),'--state',str(self.db),'--receipt',str(self.receipt),'--producer-uid',str(os.getuid()),'--hermes-code','/old']
        with patch.object(product.sys,'argv',args),patch.object(product,'hermes_selection',side_effect=product.HermesSelectionMismatch()),patch.object(product,'hermes_sender') as sender:
            self.assertEqual(product.main(),1);sender.assert_not_called()
        self.assertFalse(self.db.exists());self.assertEqual(json.loads(self.receipt.read_text())['stage'],'selection')
    def test_symlink_input_is_rejected_before_delivery(self):
        self.snapshot();other=self.root/'other';self.feed.rename(other);self.feed.symlink_to(other)
        with self.assertRaises((ValueError,OSError)):self.run_once()
        self.assertEqual(self.sent,[])

if __name__=='__main__':unittest.main()
