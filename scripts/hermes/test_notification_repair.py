import contextlib
import hashlib
import io
import json
import os
import sqlite3
import sys
import unittest
from unittest.mock import patch
import publication_monitor as product
from test_publication_monitor_integration import Persistence
from test_publication_monitor_acceptance import article, BASE


class DeliveryReporting(Persistence):
    def cli(self, hour, sender):
        env={'HERMES_RSS_NOTIFY_ENABLED':'true','PUBLICATION_MONITOR_SUMMARY_URL':'https://fixture.invalid/api/v1/monitoring/publications','PUBLICATION_MONITOR_READ_SECRET':'fixture'}
        output=io.StringIO()
        with patch.dict(os.environ,env), patch.object(sys,'argv',['monitor','--db',str(self.db),'--live']), patch.object(product,'scheduled_context',return_value=(BASE+hour*3600,'job','exec-'+str(hour))), patch.object(product.time,'time',return_value=BASE+hour*3600), patch.object(product,'PublicationObserver',return_value=self.observe), patch.object(product,'send_notification',side_effect=sender), contextlib.redirect_stdout(output):
            code=product.main()
        return code,json.loads(output.getvalue())

    def test_cli_timeout_fails_and_later_occurrences_remain_failed_without_resend(self):
        self.initialize();self.articles=[article()];self.publish()
        def timeout(message):raise TimeoutError('secret-token=https://private.invalid')
        code,report=self.cli(0,timeout)
        self.assertEqual(code,1)
        self.assertEqual(report['unresolved_notifications'],1)
        for hour in (0,1):
            code,report=self.cli(hour,lambda message:self.fail('uncertain event resent'))
            self.assertEqual(code,1)
        with contextlib.closing(sqlite3.connect(self.db)) as db:
            diagnostics=db.execute('SELECT status,error_type,reason_type,message_id FROM monitor_delivery_attempts').fetchall()
            self.assertEqual(diagnostics,[('unknown','TimeoutError',None,None)])
            self.assertNotIn('secret-token','\n'.join(db.iterdump()))

    def test_cli_rejected_fails_then_acknowledgement_succeeds_without_human_receipt(self):
        self.initialize();self.articles=[article()];self.publish()
        def rejected(message):raise product.DeliveryRejected()
        self.assertEqual(self.cli(0,rejected)[0],1)
        self.assertEqual(self.cli(1,lambda message:42)[0],0)
        with contextlib.closing(sqlite3.connect(self.db)) as db:
            self.assertEqual(db.execute('SELECT status,human_received FROM monitor_events').fetchall(),[('sent',0)])
            self.assertEqual(db.execute('SELECT message_id FROM monitor_delivery_attempts ORDER BY attempt_id DESC LIMIT 1').fetchone(),(42,))

    def test_wrapped_transport_reason_is_sanitized(self):
        self.initialize();self.articles=[article()];self.publish()
        import urllib.error
        def timeout(message):raise urllib.error.URLError(TimeoutError('bot-secret'))
        self.assertEqual(self.cli(0,timeout)[0],1)
        with contextlib.closing(sqlite3.connect(self.db)) as db:
            self.assertEqual(db.execute('SELECT error_type,reason_type FROM monitor_delivery_attempts').fetchone(),('URLError','TimeoutError'))
            self.assertNotIn('bot-secret','\n'.join(db.iterdump()))


class SingleResend(Persistence):
    def prepare(self):
        self.articles=[];self.feed=[];self.pages={}
        self.initialize();self.articles=[article()];self.publish()
        def lost(message):raise TimeoutError('lost')
        self.step(0,monitor=self.monitor(lost))
        self.key='article:'+article()['canonicalUrl']
        with contextlib.closing(sqlite3.connect(self.db)) as db:
            message=db.execute('SELECT message FROM monitor_events WHERE event_id=?',(self.key,)).fetchone()[0]
        self.digest=hashlib.sha256(message.encode()).hexdigest()

    def resend(self, sender, operation='approved-once', digest=None):
        from reconcile_notification import resend_once
        return resend_once(self.db,self.key,operation,digest or self.digest,sender,self.db.parent/(self.db.stem+'-backups'))

    def test_success_keeps_original_event_backup_and_human_evidence(self):
        self.prepare();sent=[]
        result=self.resend(lambda message:sent.append(message) or 77)
        self.assertEqual(len(sent),1);self.assertEqual(result['status'],'sent')
        with contextlib.closing(sqlite3.connect(result['backup'])) as backup:
            self.assertEqual(backup.execute('SELECT status FROM monitor_events').fetchone(),('unknown',))
        with contextlib.closing(sqlite3.connect(self.db)) as db:
            self.assertEqual(db.execute('SELECT event_id,status,human_received FROM monitor_events').fetchone(),(self.key,'sent',0))
            self.assertEqual(db.execute('SELECT status FROM outbox').fetchone(),('sent',))
            self.assertEqual(db.execute('SELECT message_id FROM monitor_delivery_attempts ORDER BY attempt_id DESC LIMIT 1').fetchone(),(77,))
        for operation in ('another-operation','approved-once'):
            with self.assertRaises(ValueError):self.resend(lambda message:self.fail('duplicate'),operation)

    def test_timeout_or_rejection_consumes_authorization_without_automatic_retry(self):
        for error in (TimeoutError('lost'),product.DeliveryRejected()):
            self.db=self.db.with_name(type(error).__name__+'.sqlite');self.prepare()
            result=self.resend(lambda message:(_ for _ in ()).throw(error))
            self.assertEqual(result['status'],'unknown')
            for operation in ('another-operation','approved-once'):
                with self.assertRaises(ValueError):self.resend(lambda message:self.fail('duplicate'),operation)
            self.step(1,monitor=self.monitor(lambda message:self.fail('automatic resend')))
            with contextlib.closing(sqlite3.connect(self.db)) as db:
                self.assertEqual(db.execute('SELECT status FROM monitor_events').fetchone(),('unknown',))

    def test_crash_after_intent_cannot_replay(self):
        self.prepare()
        class Crash(BaseException):pass
        def crash(message):raise Crash()
        with self.assertRaises(Crash):self.resend(crash)
        with self.assertRaises(ValueError):self.resend(lambda message:self.fail('duplicate'))

    def test_drift_lock_and_backup_failure_do_not_send_or_consume_operation(self):
        self.prepare()
        with self.assertRaises(ValueError):self.resend(lambda message:self.fail('digest drift'),digest='0'*64)
        import fcntl
        with open(str(self.db)+'.lock','a') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            with self.assertRaises(BlockingIOError):self.resend(lambda message:self.fail('concurrent send'))
        (self.db.parent/(self.db.stem+'-backups')).write_text('occupied')
        with self.assertRaises(FileExistsError):self.resend(lambda message:self.fail('no backup'))
        with contextlib.closing(sqlite3.connect(self.db)) as db:
            self.assertEqual(db.execute('SELECT status FROM monitor_events').fetchone(),('unknown',))
            self.assertIsNone(db.execute("SELECT name FROM sqlite_master WHERE name='monitor_reconciliations'").fetchone())


class RejectionDiagnostics(unittest.TestCase):
    def test_local_refusals_identify_cause_without_network(self):
        valid={'HERMES_RSS_NOTIFY_ENABLED':'true','TELEGRAM_BOT_TOKEN':'123:fixture_token','TELEGRAM_CHAT_ID':'-123'}
        for changes,expected in [({'HERMES_RSS_NOTIFY_ENABLED':'false'},'notify_disabled'),({'TELEGRAM_BOT_TOKEN':''},'invalid_bot_token'),({'TELEGRAM_CHAT_ID':''},'invalid_chat_id')]:
            with self.subTest(expected=expected),patch.dict(os.environ,dict(valid,**changes),clear=True),patch.object(product,'_send_delivery') as transport:
                with self.assertRaises(product.DeliveryRejected) as caught:product.send_notification('fixture')
                self.assertEqual(getattr(caught.exception,'rejection_reason',None),expected)
                transport.assert_not_called()

    def test_provider_rejection_retains_only_numeric_error_and_bounded_reason(self):
        env={'HERMES_RSS_NOTIFY_ENABLED':'true','TELEGRAM_BOT_TOKEN':'123:fixture_token','TELEGRAM_CHAT_ID':'-123'}
        response=io.BytesIO(json.dumps({'ok':False,'error_code':403,'description':'sensitive destination data'}).encode())
        with patch.dict(os.environ,env,clear=True),patch.object(product.urllib.request.OpenerDirector,'open',return_value=response):
            with self.assertRaises(product.DeliveryRejected) as caught:product.send_notification('fixture')
        self.assertEqual(getattr(caught.exception,'rejection_reason',None),'telegram_rejected')
        self.assertEqual(getattr(caught.exception,'error_code',None),403)
        self.assertNotIn('sensitive',str(caught.exception))

    def test_preflight_flags_do_not_disclose_secrets(self):
        env={'HERMES_RSS_NOTIFY_ENABLED':'true','TELEGRAM_BOT_TOKEN':'123:fixture_token','TELEGRAM_CHAT_ID':'-123'}
        with patch.dict(os.environ,env,clear=True),patch.object(product,'_send_delivery') as transport:
            report=product.notification_readiness()
            self.assertEqual(report,dict(notify_enabled=True,bot_token_valid=True,chat_id_valid=True,rejection_reason=None))
            self.assertNotIn('fixture_token',json.dumps(report))
            self.assertNotIn('-123',json.dumps(report))
            transport.assert_not_called()


if __name__=='__main__':unittest.main()
