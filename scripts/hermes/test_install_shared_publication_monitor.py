from contextlib import closing
from pathlib import Path
import sqlite3,tempfile,unittest
from unittest.mock import patch
import install_shared_publication_monitor as installer

class HistoricalHandoff(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();root=Path(self.tmp.name);self.old=root/'old.sqlite';self.shared=root/'shared.sqlite';self.backup=root/'backup'
  with closing(sqlite3.connect(self.old)) as db:
   db.execute('CREATE TABLE events(id INTEGER PRIMARY KEY,fingerprint TEXT,status TEXT,message_id TEXT,error_type TEXT,human_received INTEGER DEFAULT 0)')
   db.execute("INSERT INTO events VALUES(6,?,'unknown',NULL,'ValueError',0)",(installer.KEY,));db.execute("INSERT INTO events VALUES(7,'publication:another','sent','77',NULL,0)");db.commit()
  with closing(sqlite3.connect(self.shared)) as db:
   db.executescript("CREATE TABLE monitor_events(event_id TEXT PRIMARY KEY,kind TEXT,url TEXT,message TEXT,status TEXT,human_received INTEGER DEFAULT 0);CREATE TABLE outbox(url TEXT PRIMARY KEY,title TEXT);CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT);INSERT INTO monitor_events VALUES('article:existing','article','https://example.org','old private notification','sent',0);INSERT INTO outbox VALUES('https://old','old');");db.commit()
  self.proof={'consumerSha256':installer.LEGACY_CONSUMER_SHA,'oldCode':'old','selectedCode':'new','eventTime':200,**dict.fromkeys(['activeMtime','gateMtime','daemonMtime','consumerMtime'],100)}
 def tearDown(self):self.tmp.cleanup()
 def rows(self,path,table):
  with closing(sqlite3.connect(path)) as db:return db.execute('SELECT * FROM '+table).fetchall()
 def migrate(self):return installer.migrate_publications(self.old,self.shared,self.proof,installer.KEY,self.backup)
 def test_proven_rejection_is_append_only_and_preserves_original_site_and_sent_history(self):
  old=self.rows(self.old,'events');pages=self.rows(self.shared,'monitor_events');outbox=self.rows(self.shared,'outbox')
  report=self.migrate();self.assertEqual(report['notificationsSent'],0);self.assertEqual(self.rows(self.old,'events')[:2],old)
  self.assertEqual(self.rows(self.old,'events')[-1][2:5],('not_sent',None,'ConfirmedPretransportSelectionMismatch:6'))
  rows=self.rows(self.shared,'monitor_events');self.assertEqual(rows[0],pages[0]);self.assertEqual(self.rows(self.shared,'outbox'),outbox)
  self.assertEqual({row[0]:row[4] for row in rows},{'article:existing':'sent',installer.KEY:'rejected','publication:another':'sent'})
  self.assertTrue((self.backup/'legacy.sqlite').exists());self.assertEqual(self.rows(self.backup/'legacy.sqlite','events'),old)
 def test_repeated_handoff_does_not_append_again_or_downgrade_shared_unknown(self):
  self.migrate()
  with closing(sqlite3.connect(self.shared)) as db:db.execute("UPDATE monitor_events SET status='unknown' WHERE event_id=?",(installer.KEY,));db.commit()
  before=self.rows(self.old,'events');self.migrate();self.assertEqual(self.rows(self.old,'events'),before)
  self.assertEqual({r[0]:r[4] for r in self.rows(self.shared,'monitor_events')}[installer.KEY],'unknown')
 def test_unproven_transport_unknown_and_late_proof_leave_both_histories_unchanged(self):
  for mode in ['transport','ack','late-proof','consumer']:
   with self.subTest(mode=mode):
    with closing(sqlite3.connect(self.old)) as db:db.execute("UPDATE events SET error_type=?,message_id=? WHERE id=6",('TimeoutError' if mode=='transport' else 'ValueError','55' if mode=='ack' else None));db.commit()
    self.proof['consumerMtime']=201 if mode=='late-proof' else 100;self.proof['consumerSha256']='bad' if mode=='consumer' else installer.LEGACY_CONSUMER_SHA
    before=[self.rows(self.old,'events'),self.rows(self.shared,'monitor_events'),self.rows(self.shared,'outbox')]
    with self.assertRaises(ValueError):self.migrate()
    self.assertEqual(before,[self.rows(self.old,'events'),self.rows(self.shared,'monitor_events'),self.rows(self.shared,'outbox')])
 def test_non_administrator_cannot_prepare_or_activate_before_any_file_read(self):
  with patch.object(installer.os,'geteuid',return_value=501),patch.object(Path,'read_text',side_effect=AssertionError('unexpected read')):
   for action in [installer.prepare,installer.activate]:
    with self.assertRaises(PermissionError):action('/absent')
 def test_account_migration_rejects_foreign_actor_and_non_pipe_input(self):
  import types,stat,sys
  for uid,mode in [(501,stat.S_IFIFO),(502,stat.S_IFREG)]:
   with patch.object(installer.os,'geteuid',return_value=uid),patch.object(installer.os,'fstat',return_value=types.SimpleNamespace(st_mode=mode,st_uid=502)),patch.object(sys,'argv',['installer','--migrate']):
    with self.assertRaises(PermissionError):installer.main()
 def test_root_opened_handoff_accepts_account_owned_fifo_but_rejects_closed_stale_or_changed_authority(self):
  import time,types,stat,sys,io,json
  root=Path(self.tmp.name)/'root-control';root.mkdir();backup=root/('backup-'+'a'*32);backup.mkdir();ledger=backup/'ledger';ledger.mkdir(mode=0o700);backup.chmod(0o711)
  self.old.chmod(0o600);self.shared.chmod(0o600)
  prepared={'proof':self.proof,'files':{'install_shared_publication_monitor.py':installer.sha(Path(installer.__file__).read_bytes())}};(root/'preparation.json').write_text(json.dumps(prepared));payload={'proof':self.proof,'fingerprint':installer.KEY,'backup':str(ledger)}
  def invoke():
   with patch.multiple(installer,CONTROL=root,LEGACY_DB=self.old,SHARED_DB=self.shared),patch.object(installer.os,'geteuid',return_value=502),patch.object(installer.os,'fstat',return_value=types.SimpleNamespace(st_mode=stat.S_IFIFO,st_uid=502)),patch.object(installer,'regular') as files,patch.object(installer,'directory') as directories,patch.object(installer,'migrate_publications',return_value={'notificationsSent':0}) as migrate,patch.object(sys,'argv',['installer','--migrate']),patch.object(sys,'stdin',io.StringIO(json.dumps(payload))),patch('builtins.print'):
    result=installer.main();self.assertEqual(result,0);migrate.assert_called_once();directories.assert_any_call(backup,0);files.assert_any_call(root/'preparation.json',0)
  invoke()
  for mode in ['closed','stale','changed-proof','wrong-key']:
   with self.subTest(mode=mode):
    backup.chmod(0o700 if mode=='closed' else 0o711);installer.os.utime(backup,(time.time()-120 if mode=='stale' else time.time(),)*2);payload['proof']=dict(self.proof,eventTime=201) if mode=='changed-proof' else self.proof;payload['fingerprint']='other' if mode=='wrong-key' else installer.KEY
    with self.assertRaises((PermissionError,ValueError)):invoke()
 def test_unprivileged_directory_cannot_impersonate_root_handoff(self):
  import os
  if os.geteuid()==0:self.skipTest('fixture requires ordinary developer account')
  with self.assertRaises(ValueError):installer.directory(Path(self.tmp.name),0)

if __name__=='__main__':unittest.main()
