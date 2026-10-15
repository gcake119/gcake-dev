from contextlib import closing
import hashlib
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
import publication_monitor as product
import test_notification_repair as fixtures


class SharedGatewaySource(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.path=Path(self.temp.name)/'.env';self.write('123:fresh_token')
        self.env=patch.dict(os.environ,{'HERMES_RSS_NOTIFY_ENABLED':'true','TELEGRAM_BOT_TOKEN':'999:retired_token','TELEGRAM_CHAT_ID':'456','HERMES_RSS_TELEGRAM_CREDENTIAL_SOURCE':'gateway','HERMES_RSS_TELEGRAM_EXPECTED_BOT_ID':'123'},clear=True);self.env.start();self.addCleanup(self.env.stop)
        self.source=patch.object(product,'GATEWAY_CREDENTIAL_FILE',self.path,create=True);self.source.start();self.addCleanup(self.source.stop)

    def write(self,token):
        self.path.write_text('OTHER_SECRET=never-import\nTELEGRAM_BOT_TOKEN="'+token+'"\n');self.path.chmod(0o600)

    def test_real_sender_uses_shared_source_then_fresh_same_bot_credential(self):
        with patch.object(product,'_send_delivery',return_value=71) as transport:
            product.send_notification('message')
            self.assertIn('bot123:fresh_token/',transport.call_args.args[1])
            self.assertEqual(transport.call_args.args[2],'456')
            self.write('123:rotated_token');product.send_notification('next')
            self.assertIn('bot123:rotated_token/',transport.call_args.args[1])
        self.assertNotIn('OTHER_SECRET',os.environ)

    def test_missing_unsafe_or_ambiguous_source_never_falls_back(self):
        for case in ('missing','permission','duplicate','interpolation','symlink','identity'):
            with self.subTest(case=case):
                if self.path.is_symlink() or self.path.exists():self.path.unlink()
                self.write('123:fresh_token')
                if case=='missing':self.path.unlink()
                elif case=='permission':self.path.chmod(0o644)
                elif case=='duplicate':self.path.write_text('TELEGRAM_BOT_TOKEN=123:a\nTELEGRAM_BOT_TOKEN=123:b\n')
                elif case=='interpolation':self.path.write_text('TELEGRAM_BOT_TOKEN=${OTHER}\n')
                elif case=='symlink':
                    self.path.unlink();target=self.path.with_name('target');target.write_text('TELEGRAM_BOT_TOKEN=123:a\n');target.chmod(0o600);self.path.symlink_to(target)
                elif case=='identity':self.write('777:another_bot')
                with patch.object(product,'_send_delivery') as transport:
                    with self.assertRaises(product.DeliveryRejected):product.send_notification('message')
                    transport.assert_not_called()


class LinkedContinuation(fixtures.SingleResend):
    # Fixture inheritance; leave original tests to their original suite.
    def test_linked_success_keeps_original_operation_and_uses_same_event(self):
        from reconcile_notification import resend_once
        self.prepare()
        with closing(sqlite3.connect(self.db)) as db:
            db.execute('CREATE TABLE monitor_reconciliations(operation TEXT PRIMARY KEY,event_id TEXT UNIQUE NOT NULL,status TEXT NOT NULL,created_at REAL NOT NULL,backup TEXT NOT NULL)')
            db.execute('INSERT INTO monitor_reconciliations VALUES(?,?,?,?,?)',('old',self.key,'unknown',0,'original-backup'));db.execute("UPDATE monitor_delivery_attempts SET status='rejected',error_type='DeliveryRejected'");db.commit()
        result=resend_once(self.db,self.key,'new',self.digest,lambda msg:91,self.db.parent/'new-backups',predecessor='old')
        self.assertEqual(result['status'],'sent')
        with closing(sqlite3.connect(self.db)) as db:
            self.assertEqual(db.execute('SELECT status,backup FROM monitor_reconciliations').fetchone(),('unknown','original-backup'))
            self.assertEqual(db.execute('SELECT operation,predecessor,status FROM monitor_reconciliation_continuations').fetchone(),('new','old','sent'))

    def test_failed_or_interrupted_continuation_is_single_use(self):
        from reconcile_notification import resend_once
        class Crash(BaseException):pass
        for error in (TimeoutError('response lost'),product.DeliveryRejected('telegram_rejected',403),Crash()):
            self.db=self.db.with_name(type(error).__name__+'.sqlite');self.prepare()
            with closing(sqlite3.connect(self.db)) as db:
                db.execute('CREATE TABLE monitor_reconciliations(operation TEXT PRIMARY KEY,event_id TEXT UNIQUE NOT NULL,status TEXT NOT NULL,created_at REAL NOT NULL,backup TEXT NOT NULL)')
                db.execute('INSERT INTO monitor_reconciliations VALUES(?,?,?,?,?)',('old',self.key,'unknown',0,'original-backup'));db.execute("UPDATE monitor_delivery_attempts SET status='rejected',error_type='DeliveryRejected'");db.commit()
            def failed(message):raise error
            def run(operation,sender):return resend_once(self.db,self.key,operation,self.digest,sender,self.db.parent/(self.db.stem+'-new-backups'),predecessor='old')
            if isinstance(error,Crash):
                with self.assertRaises(Crash):run('new',failed)
            else:self.assertEqual(run('new',failed)['status'],'unknown')
            for operation in ('new','another'):
                with self.assertRaises(ValueError):run(operation,lambda message:self.fail('duplicate send'))
            with closing(sqlite3.connect(self.db)) as db:
                self.assertEqual(db.execute('SELECT status FROM monitor_reconciliations').fetchone(),('unknown',))
                self.assertEqual(db.execute('SELECT COUNT(*) FROM monitor_reconciliation_continuations').fetchone(),(1,))
            self.step(1,monitor=self.monitor(lambda message:self.fail('automatic replay')))

    def test_ambiguous_predecessor_never_sends(self):
        from reconcile_notification import resend_once
        self.prepare()
        with closing(sqlite3.connect(self.db)) as db:
            db.execute('CREATE TABLE monitor_reconciliations(operation TEXT PRIMARY KEY,event_id TEXT UNIQUE NOT NULL,status TEXT NOT NULL,created_at REAL NOT NULL,backup TEXT NOT NULL)')
            db.execute('INSERT INTO monitor_reconciliations VALUES(?,?,?,?,?)',('old',self.key,'unknown',0,'original-backup'));db.commit()
        with self.assertRaises(ValueError):resend_once(self.db,self.key,'new',self.digest,lambda msg:self.fail('ambiguous resend'),self.db.parent/'new-backups',predecessor='old')


for name in list(fixtures.SingleResend.__dict__):
    if name.startswith('test_'):setattr(LinkedContinuation,name,None)


if __name__=='__main__':unittest.main()
