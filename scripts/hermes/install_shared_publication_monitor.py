"""Owner-reviewed shared-monitor installation; never runs a live occurrence or transport."""
from contextlib import closing
from datetime import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import plistlib
import shlex
import sqlite3
import stat
import subprocess
import sys
import time
import uuid
from install_substack_attention import reconcile_selection_rejection, LEGACY_CONSUMER_SHA

AUTHORITY=Path('/usr/local/share/gcake-hermes-runtime')
CONTROL=Path('/usr/local/share/gcake-substack-shared-monitor')
HOME=Path('/Users/hermes')
SHARED_DB=HOME/'.local/state/gcake-rss/live.sqlite'
LEGACY_DB=Path('/Users/Shared/gcake-substack-hermes/state/events.sqlite')
LEGACY_CONSUMER=Path('/usr/local/share/gcake-substack-attention/consumer.py')
LEGACY_DAEMON=Path('/Library/LaunchDaemons/dev.gcake.substack-hermes-notify.plist')
SELECTED='4fe889d8069a96b6d9f11b31d5940ebd00722280d39eabf412ab8ed906dbf554'
KEY='publication:b4f32ab3908436c48fdfa32b457dc8d2ba8d3ec0e3447bb050456f87a4f6bbd0'
TARGET='ithome-2026-publishing-in-production'
JOB='550aaf17723d'
FILES=('production_entry.py','monitor_wrapper.py','shared_publication_monitor.py','substack_attention.py','install_shared_publication_monitor.py','install_substack_attention.py')
OLD_CONTROLS={'production_entry.py':'2c2999778c711c3dbaa66d3d197f1c4e96cec07aeae2bb52cce1c222da9b2d9d','monitor_wrapper.py':'2aa34397771bd9eb88814d2fa8594d79aa31937a3ced8d58b0a1ff6b2f309e7e','shared_publication_monitor.py':None,'substack_attention.py':None}
LIBRARY={'publication_monitor.py':'0301d3c3e3d16b52ddfbd5c4d27fbdd1aee7ea61601fa1a0acee12f2ff687cd5','rss_monitor.py':'f4b1e2dd88e53674e30abbd73b7a8ba7874246f74c20b46a9a6745e4a30ee7ac'}
DISTRIBUTION=Path('/Users/caiyijun/Library/Application Support/gcake-distribution/installed-draft-continuous-media-chrome-20261019')
TIMER=Path('/Users/caiyijun/Library/LaunchAgents/dev.gcake.distribution-sync.plist')
GATEWAY=Path('/Library/LaunchDaemons/ai.hermes.gateway.boot.plist')

def sha(value):return hashlib.sha256(value).hexdigest()
def regular(path,uid):
 i=Path(path).lstat()
 if not stat.S_ISREG(i.st_mode) or i.st_uid!=uid or i.st_mode&0o022 or i.st_nlink!=1:raise ValueError('unsafe-owned-file')
def directory(path,uid,private=False):
 i=Path(path).lstat()
 if not stat.S_ISDIR(i.st_mode) or i.st_uid!=uid or i.st_mode&0o022 or (private and i.st_mode&0o077):raise ValueError('unsafe-owned-directory')

def atomic(path,data,mode=0o444):
 path=Path(path);temporary=path.with_name('.'+path.name+'-'+uuid.uuid4().hex)
 try:
  fd=os.open(temporary,os.O_CREAT|os.O_EXCL|os.O_WRONLY|os.O_NOFOLLOW,mode)
  with os.fdopen(fd,'wb') as stream:stream.write(data);stream.flush();os.fsync(stream.fileno())
  os.replace(temporary,path)
 finally:
  try:temporary.unlink()
  except FileNotFoundError:pass

def fixed_job():
 rows=[]
 def visit(value):
  if isinstance(value,dict):
   if value.get('id')==JOB:rows.append(value)
   for child in value.values():visit(child)
  elif isinstance(value,list):
   for child in value:visit(child)
 visit(json.loads((HOME/'.hermes/cron/jobs.json').read_text()))
 if len(rows)!=1:raise ValueError('original-job-missing')
 return sha(json.dumps({key:rows[0].get(key) for key in ('id','enabled','no_agent','schedule','script','deliver','failure_deliver')},sort_keys=True).encode())

def legacy_proof():
 for p in [AUTHORITY/'active.json',AUTHORITY/'gate.json',LEGACY_CONSUMER,LEGACY_DAEMON]:regular(p,0)
 if json.loads((AUTHORITY/'active.json').read_text())!={'digest':SELECTED,'mode':'live'} or json.loads((AUTHORITY/'gate.json').read_text())!={'digest':SELECTED,'mode':'live','status':'ready'}:raise ValueError('selected-release-changed')
 if sha(LEGACY_CONSUMER.read_bytes())!=LEGACY_CONSUMER_SHA:raise ValueError('legacy-consumer-changed')
 args=plistlib.loads(LEGACY_DAEMON.read_bytes())['ProgramArguments'];old_code=args[args.index('--hermes-code')+1]
 proof={'consumerSha256':LEGACY_CONSUMER_SHA,'oldCode':old_code,'selectedCode':str(AUTHORITY/'releases'/SELECTED/'code'),'eventTime':datetime.fromisoformat('2026-10-22T05:04:47.623303+00:00').timestamp()}
 for name,path in [('activeMtime',AUTHORITY/'active.json'),('gateMtime',AUTHORITY/'gate.json'),('daemonMtime',LEGACY_DAEMON),('consumerMtime',LEGACY_CONSUMER)]:
  i=path.stat();proof[name]=max(i.st_mtime,i.st_ctime)
 return proof

def migrate_publications(legacy,shared,proof,fingerprint,backup):
 """One attached transaction preserves originals; the existing proof validator runs on a copy."""
 backup=Path(backup);backup.mkdir(mode=0o700,exist_ok=True)
 with closing(sqlite3.connect(legacy,timeout=5)) as db:
  with closing(sqlite3.connect(backup/'legacy.sqlite')) as copy:db.backup(copy)
  with closing(sqlite3.connect(shared,timeout=5)) as source,closing(sqlite3.connect(backup/'original-site.sqlite')) as copy:source.backup(copy)
  for name in ('legacy.sqlite','original-site.sqlite'):(backup/name).chmod(0o600)
  db.execute('ATTACH DATABASE ? AS shared',(str(shared),));db.execute('BEGIN IMMEDIATE')
  try:
   original=db.execute('SELECT id,fingerprint,status,message_id,error_type,human_received FROM events ORDER BY id').fetchall()
   pages=db.execute("SELECT * FROM shared.monitor_events WHERE kind!='substack' ORDER BY event_id").fetchall()
   outbox=db.execute('SELECT * FROM shared.outbox ORDER BY url').fetchall()
   with closing(sqlite3.connect(':memory:')) as validation:
    validation.execute('CREATE TABLE events(id INTEGER PRIMARY KEY,fingerprint TEXT,status TEXT,message_id TEXT,error_type TEXT,human_received INTEGER)')
    validation.executemany('INSERT INTO events VALUES(?,?,?,?,?,?)',original);validation.commit()
    reconcile_selection_rejection(validation,6,fingerprint,proof)
   latest=db.execute('SELECT id,status,error_type FROM events WHERE fingerprint=? ORDER BY id DESC LIMIT 1',(fingerprint,)).fetchone()
   marker='ConfirmedPretransportSelectionMismatch:6'
   if latest==(6,'unknown','ValueError'):db.execute("INSERT INTO events(fingerprint,status,error_type,human_received) VALUES(?,'not_sent',?,0)",(fingerprint,marker))
   elif latest[1:]!=('not_sent',marker):raise ValueError('legacy-delivery-changed')
   rows=db.execute("SELECT fingerprint,status,human_received FROM events WHERE fingerprint LIKE 'publication:%' ORDER BY id").fetchall();states={key:(status,human) for key,status,human in rows}
   imported=0
   for key,(status,human) in states.items():
    desired='rejected' if key==fingerprint and status=='not_sent' else 'sent' if status=='sent' else 'unknown'
    prior=db.execute('SELECT status FROM shared.monitor_events WHERE event_id=?',(key,)).fetchone()
    if prior is None:
     db.execute("INSERT INTO shared.monitor_events(event_id,kind,url,message,status,human_received) VALUES(?,'substack',NULL,'Historical delivery handoff',?,?)",(key,desired,human));imported+=1
   for row in original:
    if db.execute('SELECT id,fingerprint,status,message_id,error_type,human_received FROM events WHERE id=?',(row[0],)).fetchone()!=row:raise ValueError('original-history-changed')
   if db.execute("SELECT * FROM shared.monitor_events WHERE kind!='substack' ORDER BY event_id").fetchall()!=pages or db.execute('SELECT * FROM shared.outbox ORDER BY url').fetchall()!=outbox:raise ValueError('original-site-history-changed')
   report={'originalUnknownPreserved':True,'reconciledEventId':6,'importedPublicationStates':imported,'proofSha256':sha(json.dumps(proof,sort_keys=True).encode()),'notificationsSent':0}
   db.execute('INSERT OR REPLACE INTO shared.meta VALUES(?,?)',('monitor_substack_handoff',json.dumps(report)));db.commit();return report
  except BaseException:db.rollback();raise


def prepare(bundle):
 if os.geteuid()!=0:raise PermissionError('administrator-required')
 bundle=Path(bundle);regular(bundle/'manifest.json',501);manifest=json.loads((bundle/'manifest.json').read_text())
 if set(manifest['files'])!=set(FILES) or any(r['exitCode']!=0 for r in manifest['gates']['results']) or len(manifest['gates']['results'])!=5 or manifest['gates'].get('candidateChanged'):raise ValueError('unqualified-candidate')
 data={}
 for name in FILES:
  regular(bundle/name,501);data[name]=(bundle/name).read_bytes()
  if sha(data[name])!=manifest['files'][name]:raise ValueError('candidate-source-changed')
 proof=legacy_proof()
 for name,expected in OLD_CONTROLS.items():
  target=AUTHORITY/'tools'/name
  if expected is None:
   if target.exists():raise ValueError('unexpected-existing-extension')
  else:
   regular(target,0)
   if sha(target.read_bytes())!=expected:raise ValueError('original-monitor-control-changed')
 library=AUTHORITY/'releases'/SELECTED/'library'
 for name,expected in LIBRARY.items():
  regular(library/name,0)
  if sha((library/name).read_bytes())!=expected:raise ValueError('original-sender-library-changed')
 if json.loads((AUTHORITY/'job-context.json').read_text())!={'job_id':JOB}:raise ValueError('job-context-changed')
 CONTROL.mkdir(mode=0o755,exist_ok=True);directory(CONTROL,0);candidate=CONTROL/'candidate';candidate.mkdir(mode=0o755,exist_ok=True);directory(candidate,0)
 for name,raw in data.items():atomic(candidate/name,raw)
 python=AUTHORITY/'releases'/SELECTED/'runtime/bin/python3.11'
 code='import runpy,sys;sys.path.insert(0,'+repr(str(library))+');sys.path.insert(0,'+repr(str(candidate))+');runpy.run_path('+repr(str(candidate/'shared_publication_monitor.py'))+',run_name="__main__")'
 shell='set -euo pipefail\nset -a\n. '+shlex.quote(str(HOME/'.config/gcake-rss/live.env'))+'\n. '+shlex.quote(str(HOME/'.config/gcake-rss/publication-monitor.env'))+'\nset +a\nexec '+shlex.quote(str(python))+' -I -B -S -c '+shlex.quote(code)+' --qualify'
 result=subprocess.run(['/usr/bin/sudo','-n','-u','hermes','/bin/bash','-c',shell],capture_output=True,text=True,cwd='/',timeout=120)
 if result.returncode:raise ValueError('shared-account-readiness-failed')
 qualification=json.loads(result.stdout)
 if qualification.get('status')!='qualified' or qualification.get('uid')!=502 or not any(p=={'id':'221098688','slug':TARGET,'key':KEY} for p in qualification['publications']):raise ValueError('original-publication-not-qualified')
 receipt={'status':'prepared-shared-monitor','files':manifest['files'],'proof':proof,'qualification':qualification,'jobHash':fixed_job(),'gatewaySha256':sha(GATEWAY.read_bytes()),'timerSha256':sha(TIMER.read_bytes()),'configSha256':sha((DISTRIBUTION/'unattended.json').read_bytes()),'preparedAt':time.time(),'notificationsSent':0}
 atomic(CONTROL/'preparation.json',(json.dumps(receipt,indent=2)+'\n').encode())
 print(json.dumps({'status':receipt['status'],'realAccountQualified':True,'publications':len(qualification['publications']),'notificationsSent':0}));return 0


def activate(runtime_receipt):
 if os.geteuid()!=0:raise PermissionError('administrator-required')
 directory(CONTROL,0);directory(CONTROL/'candidate',0)
 regular(CONTROL/'preparation.json',0);prepared=json.loads((CONTROL/'preparation.json').read_text());candidate=CONTROL/'candidate'
 for name,expected in prepared['files'].items():
  regular(candidate/name,0)
  if sha((candidate/name).read_bytes())!=expected:raise ValueError('prepared-code-changed')
 runtime_receipt=Path(runtime_receipt);regular(runtime_receipt,501);runtime=json.loads(runtime_receipt.read_text())
 if runtime.get('status')!='installed-awaiting-natural-round' or runtime.get('sharedMonitorPreparation')!=sha((CONTROL/'preparation.json').read_bytes()) or sha((DISTRIBUTION/'runtime-sha256.json').read_bytes())!=runtime.get('pinDigest'):raise ValueError('paired-producer-not-installed')
 if legacy_proof()!=prepared['proof'] or fixed_job()!=prepared['jobHash'] or sha(GATEWAY.read_bytes())!=prepared['gatewaySha256'] or sha(TIMER.read_bytes())!=prepared['timerSha256'] or sha((DISTRIBUTION/'unattended.json').read_bytes())!=prepared['configSha256']:raise ValueError('operational-context-changed')
 backup=CONTROL/('backup-'+uuid.uuid4().hex);backup.mkdir(mode=0o700);migration_backup=backup/'ledger';migration_backup.mkdir(mode=0o700);os.chown(migration_backup,502,20)
 # Permit only the reviewed actor to reach its temporary backup directory.
 backup.chmod(0o711)
 try:
  with open(AUTHORITY/'maintenance.lock','rb') as lock:
   fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
   originals={}
   for name,expected in OLD_CONTROLS.items():
    target=AUTHORITY/'tools'/name
    if expected is None:
     if target.exists():raise ValueError('extension-already-installed')
     originals[name]=None
    else:
     regular(target,0);raw=target.read_bytes()
     if sha(raw)!=expected:raise ValueError('monitor-control-changed')
     originals[name]=raw;atomic(backup/name,raw,0o600)
   python=AUTHORITY/'releases'/SELECTED/'runtime/bin/python3.11'
   code='import runpy,sys;sys.path.insert(0,'+repr(str(candidate))+');runpy.run_path('+repr(str(candidate/'install_shared_publication_monitor.py'))+',run_name="__main__")'
   payload=json.dumps({'proof':prepared['proof'],'fingerprint':KEY,'backup':str(migration_backup)})
   result=subprocess.run(['/usr/bin/sudo','-n','-u','hermes',str(python),'-I','-B','-S','-c',code,'--migrate'],input=payload,capture_output=True,text=True,cwd='/',timeout=30)
   if result.returncode:
    try:failure=json.loads(result.stdout)
    except (ValueError,TypeError):failure={}
    reason=failure.get('reason');allowed={'root-delegated-actor-required','root-handoff-not-open','root-handoff-authority-changed','unsafe-owned-directory','unsafe-owned-file','private-ledger-required','unproven-pretransport-rejection','historical-event-changed','legacy-delivery-changed'}
    raise ValueError('history-migration-failed:'+reason if reason in allowed else 'history-migration-failed')
   migration=json.loads(result.stdout)
   try:
    for name in ('substack_attention.py','shared_publication_monitor.py','monitor_wrapper.py','production_entry.py'):atomic(AUTHORITY/'tools'/name,(candidate/name).read_bytes())
    if fixed_job()!=prepared['jobHash'] or sha(GATEWAY.read_bytes())!=prepared['gatewaySha256'] or sha(TIMER.read_bytes())!=prepared['timerSha256']:raise ValueError('scheduler-changed')
   except BaseException:
    for name,raw in originals.items():
     target=AUTHORITY/'tools'/name
     if raw is not None:atomic(target,raw)
     elif target.exists() and sha(target.read_bytes())==prepared['files'][name]:target.unlink()
    raise
   report={'status':'installed-awaiting-natural-original-job','files':{name:sha((AUTHORITY/'tools'/name).read_bytes()) for name in OLD_CONTROLS},'selectedDigest':SELECTED,'jobId':JOB,'jobHash':prepared['jobHash'],'migration':migration,'installedAt':time.time(),'timerChanged':False,'gatewayChanged':False,'notificationsSent':0}
   atomic(CONTROL/'installation.json',(json.dumps(report,indent=2)+'\n').encode())
 finally:backup.chmod(0o700)
 print(json.dumps({'status':report['status'],'notificationsSent':0,'originalUnknownPreserved':True,'timerChanged':False,'gatewayChanged':False}));return 0


def main():
 if sys.argv[1:]==['--migrate']:
  source=os.fstat(0)
  if os.geteuid()!=502 or not stat.S_ISFIFO(source.st_mode):raise PermissionError('root-delegated-actor-required')
  raw=sys.stdin.read(65537)
  if len(raw)>65536:raise ValueError('delegation-too-large')
  value=json.loads(raw);backup=Path(value['backup'])
  if backup.parent.parent!=CONTROL or not backup.parent.name.startswith('backup-'):raise ValueError('invalid-owned-backup')
  directory(CONTROL,0);directory(backup.parent,0)
  opened=backup.parent.stat()
  if opened.st_mode&0o777!=0o711 or not 0<=time.time()-opened.st_mtime<=60:raise PermissionError('root-handoff-not-open')
  regular(CONTROL/'preparation.json',0);prepared=json.loads((CONTROL/'preparation.json').read_text())
  regular(Path(__file__),0)
  if value.get('proof')!=prepared['proof'] or prepared['files']['install_shared_publication_monitor.py']!=sha(Path(__file__).read_bytes()):raise ValueError('root-handoff-authority-changed')
  directory(backup,502,True)
  for path in (LEGACY_DB,SHARED_DB):
   regular(path,502)
   if path.stat().st_mode&0o077:raise ValueError('private-ledger-required')
  if value.get('fingerprint')!=KEY:raise ValueError('unexpected-historical-key')
  print(json.dumps(migrate_publications(LEGACY_DB,SHARED_DB,value['proof'],value['fingerprint'],backup)));return 0
 parser=__import__('argparse').ArgumentParser();parser.add_argument('--prepare');parser.add_argument('--activate');args=parser.parse_args()
 if bool(args.prepare)==bool(args.activate):raise ValueError('one-owner-action-required')
 return prepare(args.prepare) if args.prepare else activate(args.activate)

if __name__=='__main__':
 try:raise SystemExit(main())
 except Exception as error:
  print(json.dumps({'status':'blocked','errorType':type(error).__name__,'reason':str(error) if isinstance(error,(ValueError,PermissionError)) else 'owner-installation-failed'}));raise SystemExit(1)
