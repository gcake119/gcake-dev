import json
from pathlib import Path
from contextlib import closing
import sqlite3
import tempfile
import unittest
from datetime import datetime,timezone
import publication_monitor as original
import shared_publication_monitor as shared

NOW=1792661400.0
JOB='original-job'
def publication():
 return {'slug':'ithome-2026-publishing-in-production','id':'221098688','revision':'sha256:a85b33cfd86a2f589e01ce555f1e50e0a2bd0e7db73252cc4cd9412808b1f9c2','title':'正式開賽後，我怎麼知道自動發文真的完成了？','actualAt':'2026-10-21T23:01:02.155Z','confirmedAt':'2026-10-21T23:00:00Z','differenceSeconds':62.155}
def observation(now=NOW):
 return {'summary':{'schemaVersion':1,'complete':True,'generatedAt':datetime.fromtimestamp(now,timezone.utc).isoformat(),'gitRevision':'source-main','queueVersion':1,'articles':[],'substackPublications':{'complete':True,'publications':[publication()]}},'window':[now-1,now+1],'feed':None,'pages':{}}

class SharedPrivateNotification(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'state.sqlite';self.pages=original.PublicationMonitor(self.path,lambda now:observation(now),mode='test');self.pages._open()
  with closing(sqlite3.connect(self.path)) as db:db.execute("INSERT INTO meta VALUES('initialized',?)",(str(NOW-3600),));db.commit()
  self.pages.run_round(NOW-3600,NOW-3600,job_id=JOB,execution_id='baseline')
 def tearDown(self):self.tmp.cleanup()
 def round(self,sender,now=NOW,obs=None,execution='natural-1'):
  observed=obs or observation(now)
  self.pages.observer=lambda _:observed
  self.pages.run_round(now,now,job_id=JOB,execution_id=execution)
  with closing(sqlite3.connect(self.path)) as db:
   return shared.run_substack_round(db,observed,now,now,JOB,execution,sender)
 def rows(self):
  with closing(sqlite3.connect(self.path)) as db:return db.execute('SELECT event_id,status FROM monitor_events ORDER BY event_id').fetchall()
 def test_substack_uses_existing_private_sender_when_pages_feed_is_inconclusive(self):
  sent=[];result=self.round(lambda message:sent.append(message) or 123)
  self.assertEqual(result['sent'],1);self.assertEqual(len(sent),1)
  self.assertEqual(sent[0].splitlines(),['Substack 同步發布驗證完成',publication()['title'],'https://gcakedev.substack.com/p/ithome-2026-publishing-in-production']);self.assertEqual(self.rows()[0][1],'sent')
  with closing(sqlite3.connect(self.path)) as db:
   self.assertEqual(db.execute('SELECT message_id FROM monitor_delivery_attempts').fetchone(),(123,))
   meta=dict(db.execute('SELECT key,value FROM meta'));self.assertEqual(json.loads(meta['monitor_substack_last_observation'])['executionId'],'natural-1')
 def test_repeat_and_restart_do_not_send_again_and_original_site_event_is_preserved(self):
  sent=[];self.round(lambda text:sent.append(text) or 5)
  with closing(sqlite3.connect(self.path)) as db:db.execute("INSERT INTO monitor_events VALUES('article:existing','article','https://original','already delivered','sent',0)");db.commit()
  self.round(lambda text:sent.append(text) or 6,now=NOW+3600,execution='natural-2')
  self.assertEqual(len(sent),1);self.assertIn(('article:existing','sent'),self.rows())
 def test_sent_intent_and_unproven_unknown_are_not_replayed(self):
  key=shared.publication_key(publication())
  for status in ['sent','intent','unknown']:
   with self.subTest(status=status):
    with closing(sqlite3.connect(self.path)) as db:
     db.executescript('CREATE TABLE IF NOT EXISTS monitor_events(event_id TEXT PRIMARY KEY,kind TEXT,url TEXT,message TEXT,status TEXT,human_received INTEGER DEFAULT 0);')
     db.execute('INSERT OR REPLACE INTO monitor_events VALUES(?,?,?,?,?,0)',(key,'substack',None,'historical',status));db.commit()
    sent=[];self.round(lambda text:sent.append(text) or 7,now=NOW+3600*(['sent','intent','unknown'].index(status)+1),execution='natural-'+status)
    self.assertEqual(sent,[])
 def test_authenticated_rejection_is_eligible_only_on_a_fresh_natural_observation(self):
  self.pages.run_round(NOW,NOW,job_id=JOB,execution_id='natural-1')
  with closing(sqlite3.connect(self.path)) as db:
   db.execute('INSERT INTO monitor_events VALUES(?,?,?,?,?,0)',(shared.publication_key(publication()),'substack',None,'proven not sent','rejected'));db.commit()
  sent=[];self.round(lambda text:sent.append(text) or 22,now=NOW+3600,execution='natural-after-handoff')
  self.assertEqual(len(sent),1);self.assertEqual(self.rows()[0][1],'sent')
 def test_missing_or_invalid_ack_is_unknown_and_cannot_replay(self):
  for ack in [None,0,True,{}]:
   with self.subTest(ack=ack):
    with closing(sqlite3.connect(self.path)) as db:db.execute('DELETE FROM monitor_events');db.execute('DELETE FROM monitor_invocations');db.execute("DELETE FROM meta WHERE key='monitor_last_round'");db.commit()
    calls=[];self.round(lambda text:calls.append(text) or ack)
    self.assertEqual(self.rows()[0][1],'unknown')
    self.round(lambda text:calls.append(text) or 10,now=NOW+3600,execution='next')
    self.assertEqual(len(calls),1)
 def test_stale_missing_or_invalid_authority_does_not_send_or_clear_history(self):
  for mode in ['stale','missing','incomplete','bad-delta','duplicate-id']:
   with self.subTest(mode=mode):
    obs=observation();block=obs['summary']['substackPublications']
    if mode=='stale':obs['summary']['generatedAt']=datetime.fromtimestamp(NOW-3601,timezone.utc).isoformat()
    if mode=='missing':del obs['summary']['substackPublications']
    if mode=='incomplete':block['complete']=False
    if mode=='bad-delta':block['publications'][0]['differenceSeconds']=0
    if mode=='duplicate-id':block['publications'].append(dict(publication(),slug='another'))
    with closing(sqlite3.connect(self.path)) as db:db.execute('DELETE FROM monitor_invocations');db.execute("DELETE FROM meta WHERE key='monitor_last_round'");db.commit()
    calls=[];result=self.round(lambda text:calls.append(text) or 12,obs=obs)
    self.assertEqual(calls,[]);self.assertEqual(result['status'],'inconclusive')
 def test_foreign_or_missing_original_scheduler_occurrence_cannot_send(self):
  with closing(sqlite3.connect(self.path)) as db:
   for job,execution in [('foreign','unknown'),(JOB,'missing')]:
    with self.assertRaises(ValueError):shared.run_substack_round(db,observation(),NOW,NOW,job,execution,lambda _:1)
 def test_shortening_message_preserves_delivered_long_message_and_does_not_resend(self):
  old='Substack 同步發布驗證完成\n'+publication()['title']+'\nhttps://gcakedev.substack.com/p/'+publication()['slug']+'\n台北原定時間：2026-10-22 07:00:00\n台北實際發布：2026-10-22 07:01:02\n時間差：晚 62.155 秒'
  key=shared.publication_key(publication())
  with closing(sqlite3.connect(self.path)) as db:
   db.execute('INSERT INTO monitor_events VALUES(?,?,?,?,?,0)',(key,'substack',None,old,'sent'));db.commit()
  sent=[];result=self.round(lambda text:sent.append(text) or 33)
  self.assertEqual(sent,[]);self.assertEqual(result['suppressed'],1)
  with closing(sqlite3.connect(self.path)) as db:self.assertEqual(db.execute('SELECT message,status FROM monitor_events WHERE event_id=?',(key,)).fetchone(),(old,'sent'))

 def test_identity_matches_original_legacy_publication_key(self):
  self.assertEqual(shared.publication_key(publication()),'publication:b4f32ab3908436c48fdfa32b457dc8d2ba8d3ec0e3447bb050456f87a4f6bbd0')


 def test_production_entry_holds_original_runtime_lease_around_the_shared_flow(self):
  import os,types
  from contextlib import contextmanager
  from unittest.mock import patch
  import production_entry as product
  store=product.ProductionStore.__new__(product.ProductionStore);store.runner_uid=os.geteuid();store.active=lambda:{'mode':'live'};events=[]
  @contextmanager
  def lease(mode):
   events.append(('enter',mode))
   try:yield Path('/fixture-selected')
   finally:events.append(('exit',mode))
  store.lease=lease
  def invoke(args,**kwargs):
   self.assertEqual(events,[('enter','live')]);self.assertIn('shared_publication_monitor.py',args[-1]);self.assertIn('/fixture-selected/runtime/bin/python3.11',args[-1]);return types.SimpleNamespace(returncode=7)
  with patch.object(product.subprocess,'run',side_effect=invoke):
   self.assertEqual(store.monitor(job_id=JOB,legacy_env='/legacy',summary_env='/authority',db='/state'),7)
  self.assertEqual(events,[('enter','live'),('exit','live')])
  store.runner_uid=os.geteuid()+1
  with self.assertRaises(PermissionError):store.monitor(job_id=JOB,legacy_env='/legacy',summary_env='/authority',db='/state')

if __name__=='__main__':unittest.main()
