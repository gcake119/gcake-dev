import importlib.util
from pathlib import Path
import unittest
import install_substack_attention as product

class OwnerPreparation(unittest.TestCase):
    def test_service_is_event_driven_hermes_owned_and_never_restarts_gateway(self):
        spec=product.service_spec('/runtime/python','/runtime/code',501)
        self.assertEqual(spec['UserName'],'hermes');self.assertEqual(spec['WatchPaths'],[str(product.SHARED/'input')])
        self.assertNotIn('StartInterval',spec);self.assertFalse(spec['KeepAlive']);self.assertTrue(spec['RunAtLoad'])
        args=' '.join(spec['ProgramArguments']);self.assertNotIn('gateway-managed',args);self.assertNotIn('sudo',args)
        self.assertIn('--producer-uid',spec['ProgramArguments'])
    def test_pinned_paths_reject_unrelated_or_traversing_files(self):
        for name in ['../secret','/absolute','node_modules/secret']:
            with self.subTest(name=name),self.assertRaises(ValueError):product.validate_pin_name(name)
    def test_install_requires_authenticated_owner_before_any_operation(self):
        from unittest.mock import patch
        with patch.object(product.os,'geteuid',return_value=501),self.assertRaises(PermissionError):product.activate(Path('/nonexistent'))
    def test_repair_refuses_unprivileged_execution_before_touching_paths(self):
        from unittest.mock import patch
        with patch.object(product.os,'geteuid',return_value=501),self.assertRaises(PermissionError):product.repair_existing(Path('/missing'), 'a'*64)
    def test_diagnostic_probes_do_not_load_sender_or_modify_ledger(self):
        code=product.diagnostic_code()
        self.assertNotIn('send_message',code);self.assertNotIn('INSERT',code);self.assertNotIn('CREATE TABLE',code)
        self.assertIn('ROLLBACK',code);self.assertIn('feed-read',code);self.assertIn('ledger-mode',code);self.assertIn('receipt-write',code)
    def test_real_diagnostic_preserves_ledger_and_reports_feed_permission_stage(self):
        import contextlib,json,os,sqlite3,subprocess,sys,tempfile
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            for name in ['input','state','receipts']:(root/name).mkdir()
            feed=root/'input/status.json';feed.write_text(json.dumps({'schema':1,'generatedAt':__import__('time').strftime('%Y-%m-%dT%H:%M:%SZ',__import__('time').gmtime()),'issues':[]}));feed.chmod(0o600)
            ledger=root/'state/events.sqlite'
            with contextlib.closing(sqlite3.connect(ledger)) as db:db.execute('CREATE TABLE preserved(value)');db.execute("INSERT INTO preserved VALUES ('original-intent')");db.commit()
            def probe():return json.loads(subprocess.check_output([sys.executable,'-I','-B','-c',product.diagnostic_code(root,os.getuid(),Path(__file__).with_name('substack_attention.py'),__import__('hashlib').sha256(Path(__file__).with_name('substack_attention.py').read_bytes()).hexdigest())],text=True))
            result=probe();self.assertTrue(all(x['status']=='passed' for x in result['checks']))
            with contextlib.closing(sqlite3.connect(ledger)) as db:self.assertEqual(db.execute('SELECT value FROM preserved').fetchall(),[('original-intent',)])
            self.assertEqual(list((root/'receipts').iterdir()),[])
            if os.getuid()!=0:
                feed.chmod(0)
                try:self.assertEqual(probe()['checks'][0],{'stage':'feed-read','status':'blocked','errorType':'PermissionError','errno':13})
                finally:feed.chmod(0o600)
    def test_qualification_invokes_pinned_production_reader_once_and_preserves_failed_evidence(self):
        import contextlib,hashlib,json,os,sqlite3,subprocess,sys,tempfile,time
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            for name in ['input','state','receipts']:(root/name).mkdir()
            feed=root/'input/status.json';feed.write_text(json.dumps({'schema':1,'generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'issues':[]}));feed.chmod(0o600)
            ledger=root/'state/events.sqlite'
            with contextlib.closing(sqlite3.connect(ledger)) as db:db.execute('CREATE TABLE preserved(value)');db.execute("INSERT INTO preserved VALUES('unknown-original')");db.commit()
            called=root/'reader-calls';reader=root/'pinned-reader.py';source=Path(__file__).with_name('substack_attention.py')
            reader.write_text("import runpy\nfrom pathlib import Path\nreal=runpy.run_path("+repr(str(source))+",run_name='readonly')\ndef read_snapshot(*args):\n    file=Path("+repr(str(called))+")\n    file.write_text(file.read_text()+'1' if file.exists() else '1')\n    return real['read_snapshot'](*args)\ndef consume(*args):raise AssertionError('delivery forbidden')\ndef hermes_sender(*args):raise AssertionError('credentials forbidden')\n")
            sha=hashlib.sha256(reader.read_bytes()).hexdigest()
            def probe(expected):return json.loads(subprocess.check_output([sys.executable,'-I','-B','-c',product.diagnostic_code(root,os.getuid(),reader,expected)],text=True))
            result=probe(sha);self.assertTrue(all(x['status']=='passed' for x in result['checks']));self.assertEqual(called.read_text(),'1')
            self.assertEqual(probe('0'*64)['checks'][0]['status'],'blocked');self.assertEqual(called.read_text(),'1')
            feed.write_text('{}');self.assertEqual(probe(sha)['checks'][0]['errorType'],'ValueError');self.assertEqual(called.read_text(),'11')
            with contextlib.closing(sqlite3.connect(ledger)) as db:self.assertEqual(db.execute('SELECT value FROM preserved').fetchall(),[('unknown-original',)])
            self.assertEqual(list((root/'receipts').iterdir()),[])
    def test_stale_selection_reconciliation_preserves_original_unknown_and_refuses_unproven_events(self):
        import sqlite3
        db=sqlite3.connect(':memory:')
        try:
            db.execute('CREATE TABLE events(id INTEGER PRIMARY KEY,fingerprint TEXT,status TEXT,message_id TEXT,error_type TEXT,human_received INTEGER DEFAULT 0)')
            db.execute("INSERT INTO events VALUES(6,'publication:key','unknown',NULL,'ValueError',0)");db.commit()
            proof={'consumerSha256':product.LEGACY_CONSUMER_SHA,'oldCode':'old','selectedCode':'new','eventTime':100,'activeMtime':10,'gateMtime':11,'daemonMtime':12,'consumerMtime':13}
            for invalid in [dict(proof,activeMtime=101),dict(proof,oldCode='new'),dict(proof,consumerSha256='invalid')]:
                with self.assertRaises(ValueError):product.reconcile_selection_rejection(db,6,'publication:key',invalid)
            for patch in ["error_type='TimeoutError'","message_id='123'","human_received=1","status='intent'"]:
                db.execute('UPDATE events SET '+patch+' WHERE id=6');db.commit()
                with self.assertRaises(ValueError):product.reconcile_selection_rejection(db,6,'publication:key',proof)
                db.execute("UPDATE events SET status='unknown',message_id=NULL,error_type='ValueError',human_received=0 WHERE id=6");db.commit()
            self.assertEqual(db.execute('SELECT count(*) FROM events').fetchone()[0],1)
            product.reconcile_selection_rejection(db,6,'publication:key',proof)
            self.assertEqual(db.execute('SELECT status FROM events WHERE id=6').fetchone()[0],'unknown')
            self.assertEqual(db.execute('SELECT status FROM events ORDER BY id DESC LIMIT 1').fetchone()[0],'not_sent')
            product.reconcile_selection_rejection(db,6,'publication:key',proof);self.assertEqual(db.execute('SELECT count(*) FROM events').fetchone()[0],2)
        finally:db.close()
    def test_selection_repair_waits_for_natural_event_and_preserves_all_other_job_settings(self):
        old=product.service_spec('/old/python','/old/code',501)
        new=product.selection_spec(old,'a'*64)
        self.assertFalse(new['RunAtLoad'])
        self.assertEqual({k:v for k,v in old.items() if k not in ('RunAtLoad','ProgramArguments')},{k:v for k,v in new.items() if k not in ('RunAtLoad','ProgramArguments')})
        self.assertEqual(old['ProgramArguments'][1:13],new['ProgramArguments'][1:13])
        self.assertTrue(new['ProgramArguments'][0].endswith('/'+'a'*64+'/runtime/bin/python3.11'))
        self.assertTrue(new['ProgramArguments'][-1].endswith('/'+'a'*64+'/code'))
    def test_selection_repair_requires_administrator_before_any_path_access(self):
        from unittest.mock import patch
        with patch.object(product.os,'geteuid',return_value=501),self.assertRaises(PermissionError):product.repair_selection('/missing','a'*64,'/missing')

if __name__=='__main__':unittest.main()
