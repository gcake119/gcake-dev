"""Owner-only activation. No gateway restart, credential copy or timer job."""
import hashlib
import json
import os
from pathlib import Path
import plistlib
import pwd
import re
import shutil
import stat
import subprocess
import sys
import time

BASE=Path('/Users/caiyijun/Library/Application Support/gcake-distribution/installed-hermes-attention-20261017')
SHARED=Path('/Users/Shared/gcake-substack-hermes')
CONTROL=Path('/usr/local/share/gcake-substack-attention')
DAEMON=Path('/Library/LaunchDaemons/dev.gcake.substack-hermes-notify.plist')
AUTHORITY=Path('/usr/local/share/gcake-hermes-runtime')
AGENT=Path('/Users/caiyijun/Library/LaunchAgents/dev.gcake.distribution-sync.plist')
LABEL='dev.gcake.substack-hermes-notify'
NODE='/opt/homebrew/Cellar/node@22/22.23.3_2/bin/node'

def run(args,**kwargs):return subprocess.run(args,check=True,**kwargs)
def digest(file):return hashlib.sha256(Path(file).read_bytes()).hexdigest()
def validate_pin_name(name):
    if not isinstance(name,str) or Path(name).is_absolute() or '..' in Path(name).parts or name.startswith('node_modules/'):raise ValueError('invalid-pin-name')

def regular(file,uid):
    info=Path(file).lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid!=uid or info.st_mode&0o022 or info.st_nlink!=1:raise ValueError('invalid-file-ownership')

def service_spec(python,code,uid):
    return dict(Label=LABEL,UserName='hermes',GroupName='staff',ProgramArguments=[str(python),'-I','-B',str(CONTROL/'consumer.py'),'--feed',str(SHARED/'input/status.json'),'--state',str(SHARED/'state/events.sqlite'),'--receipt',str(SHARED/'receipts/current.json'),'--producer-uid',str(uid),'--hermes-code',str(code)],EnvironmentVariables={'HERMES_HOME':'/Users/hermes/.hermes','HOME':'/Users/hermes','PATH':'/usr/bin:/bin:/usr/sbin:/sbin'},RunAtLoad=True,KeepAlive=False,WatchPaths=[str(SHARED/'input')],ThrottleInterval=15,ProcessType='Background',StandardOutPath=str(SHARED/'state/stdout.log'),StandardErrorPath=str(SHARED/'state/stderr.log'))

def acl_read(directory,user):
    run(['/bin/chmod','+a',f'user:{user} allow list,search,readattr,readextattr,readsecurity',str(directory)])
    run(['/bin/chmod','+a',f'user:{user} allow read,readattr,readextattr,readsecurity,file_inherit,only_inherit',str(directory)])

def activate(base=BASE):
    if os.geteuid()!=0:raise PermissionError('owner authentication required: run the prepared activation command with sudo')
    if Path(base)!=BASE:raise ValueError('unexpected-bundle')
    owner=pwd.getpwnam('caiyijun');hermes=pwd.getpwnam('hermes');uid=owner.pw_uid
    bundle=BASE/'activation.json';regular(bundle,uid);prepared=json.loads(bundle.read_text())
    for relative,key in [('runtime/scripts/hermes/substack_attention.py','consumerSha256'),('handoff/activate.py','installerSha256'),('candidate-agent.plist','agentSha256'),('unattended.json','policySha256'),('acceptance.json','acceptanceSha256')]:
        regular(BASE/relative,uid)
        if digest(BASE/relative)!=prepared[key]:raise ValueError('prepared-artifact-changed')
    if json.loads((BASE/'unattended.json').read_text()).get('unattended',{}).get('notifyViaHermes') is not True:raise ValueError('notification-not-enabled')
    if digest(AGENT)!=prepared['previousAgentSha256']:raise ValueError('active-scheduler-changed')
    original=AGENT.read_bytes();old=plistlib.loads(original)
    if old.get('Label')!='dev.gcake.distribution-sync':raise ValueError('unexpected-agent')
    if digest(AUTHORITY/'active.json')!=prepared['selectorSha256'] or digest(AUTHORITY/'gate.json')!=prepared['gateSha256']:raise ValueError('hermes-selection-changed')
    active=json.loads((AUTHORITY/'active.json').read_text());gate=json.loads((AUTHORITY/'gate.json').read_text())
    if not re.fullmatch(r'[a-f0-9]{64}',active.get('digest','')) or active.get('mode')!='live' or gate.get('digest')!=active['digest'] or gate.get('mode')!='live' or gate.get('status')!='ready':raise ValueError('hermes-not-ready')
    selected=AUTHORITY/'releases'/active['digest'];python=selected/'runtime/bin/python3.11';code=selected/'code';regular(python,0)
    for item in [code,selected]:
        info=item.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid!=0 or info.st_mode&0o022:raise ValueError('untrusted-hermes-code')
    regular(code/'hermes_cli/send_cmd.py',0);regular(code/'tools/send_message_tool.py',0)
    manifest=json.loads((BASE/'runtime-sha256.json').read_text())
    for name,expected in manifest.items():
        validate_pin_name(name);regular(BASE/'runtime'/name,uid)
        if not re.fullmatch(r'[a-f0-9]{64}',expected) or digest(BASE/'runtime'/name)!=expected:raise ValueError('runtime-pin-mismatch')
    for name in ['scripts/publishing/distribution-attention.ts','scripts/publishing/sync-distribution.ts','scripts/hermes/substack_attention.py']:
        if name not in manifest:raise ValueError('incomplete-runtime-pin')
    lock=Path(old['ProgramArguments'][old['ProgramArguments'].index('--lock')+1])
    status=subprocess.check_output(['/bin/launchctl','print',f'gui/{uid}/dev.gcake.distribution-sync'],text=True)
    if '\n\tstate = not running\n' not in status or lock.exists():raise ValueError('active-sync-writer')
    prior_output=Path(old['ProgramArguments'][old['ProgramArguments'].index('--out')+1])
    available=sorted(prior_output.glob('round-*/result.json'),key=lambda p:p.stat().st_mtime)
    if not available or time.time()-available[-1].stat().st_mtime>3600:raise ValueError('fresh-round-required')
    latest=available[-1];regular(latest,uid)
    if any(p.exists() or p.is_symlink() for p in [SHARED,CONTROL,DAEMON]):raise ValueError('bridge-already-exists-preserve-state')
    # All validation precedes privileged mutations. Installed sender is root-owned and runs as Hermes.
    CONTROL.mkdir(mode=0o755);SHARED.mkdir(mode=0o755)
    target=CONTROL/'consumer.py';target.write_bytes((BASE/'runtime/scripts/hermes/substack_attention.py').read_bytes());target.chmod(0o444)
    if digest(target)!=prepared['consumerSha256']:raise ValueError('installed-consumer-mismatch')
    for name,identity in [('input',owner),('receipts',hermes),('state',hermes)]:
        directory=SHARED/name;directory.mkdir(mode=0o700);os.chown(directory,identity.pw_uid,identity.pw_gid)
    acl_read(SHARED/'input','hermes');acl_read(SHARED/'receipts','caiyijun')
    specification=service_spec(python,code,uid)
    DAEMON.write_bytes(plistlib.dumps(specification));DAEMON.chmod(0o644)
    # Seed from the latest completed safe round as the producer user, never as root.
    seed=BASE/'runtime/scripts/publishing/distribution-attention.ts'
    run(['/usr/bin/sudo','-u','caiyijun',NODE,'--import','tsx',str(seed),'--seed',str(latest)],cwd=BASE/'runtime')
    run(['/bin/launchctl','bootstrap','system',str(DAEMON)])
    receipt=SHARED/'receipts/current.json';deadline=time.monotonic()+45;report={}
    while time.monotonic()<deadline:
        try:report=json.loads(receipt.read_text())
        except FileNotFoundError:pass
        if report.get('status') in ('sent','unknown','blocked','clear'):break
        time.sleep(1)
    if report.get('status')!='sent':
        print(json.dumps({'status':'activation_pending','delivery':report,'safeSchedulerPreserved':True,'automaticResend':False}));return 1
    # Only a real Hermes acknowledgement enables ongoing snapshots. Preserve safe scheduler on failure.
    if lock.exists():raise ValueError('sync-started-before-cutover')
    run(['/bin/launchctl','bootout',f'gui/{uid}/dev.gcake.distribution-sync'])
    try:
        shutil.copyfile(BASE/'candidate-agent.plist',AGENT);AGENT.chmod(0o600);os.chown(AGENT,uid,owner.pw_gid)
        run(['/bin/launchctl','bootstrap',f'gui/{uid}',str(AGENT)])
    except BaseException:
        AGENT.write_bytes(original);AGENT.chmod(0o600);os.chown(AGENT,uid,owner.pw_gid)
        run(['/bin/launchctl','bootstrap',f'gui/{uid}',str(AGENT)])
        raise
    result={'status':'activated','delivery':report,'gatewayChanged':False,'newTimerJobs':0,'humanReceived':False}
    (CONTROL/'activation-receipt.json').write_text(json.dumps(result)+'\n')
    print(json.dumps(result));return 0

def diagnostic_code(root=SHARED,producer_uid=501,reader=CONTROL/'consumer.py',reader_sha=None):
    # No Hermes import, credentials, feed replay or persistent ledger changes.
    if reader_sha is not None and not re.fullmatch(r'[a-f0-9]{64}',reader_sha):raise ValueError('invalid-reader-pin')
    return "ROOT="+repr(str(root))+"\nPRODUCER_UID="+str(producer_uid)+"\nREADER="+repr(str(reader))+"\nREADER_SHA="+repr(reader_sha)+"\n"+r"""
import hashlib,json,os,sqlite3,stat,sys,tempfile,time
from pathlib import Path
root=Path(ROOT);results=[]
def probe(stage,fn):
    try:fn();results.append({'stage':stage,'status':'passed'})
    except Exception as error:results.append({'stage':stage,'status':'blocked','errorType':type(error).__name__,'errno':getattr(error,'errno',None)})
def feed():
    if not isinstance(READER_SHA,str):raise ValueError('unqualified-reader')
    source=Path(READER).read_bytes()
    if hashlib.sha256(source).hexdigest()!=READER_SHA:raise ValueError('reader-pin-changed')
    namespace={'__name__':'readonly_diagnostic','__file__':READER}
    exec(compile(source,READER,'exec'),namespace)
    namespace['read_snapshot'](root/'input/status.json',PRODUCER_UID,time.time())
def writable(directory):
    fd,name=tempfile.mkstemp(prefix='.access-probe-',dir=directory)
    try:os.write(fd,b'probe');os.fsync(fd)
    finally:os.close(fd);os.unlink(name)
def ledger_mode():
    file=root/'state/events.sqlite'
    if not file.exists():return
    info=file.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_nlink!=1:raise ValueError('invalid-ledger')
    if info.st_uid!=os.getuid():raise PermissionError(1,'ledger owner mismatch')
def ledger():
    file=root/'state/events.sqlite'
    if not file.exists():return
    db=sqlite3.connect('file:'+str(file)+'?mode=rw',uri=True,timeout=5)
    try:db.execute('BEGIN IMMEDIATE');db.execute('SELECT name FROM sqlite_master LIMIT 1').fetchall();db.execute('ROLLBACK')
    finally:db.close()
probe('feed-read',feed);probe('ledger-directory',lambda:writable(root/'state'));probe('ledger-mode',ledger_mode);probe('ledger-open',ledger);probe('receipt-write',lambda:writable(root/'receipts'))
print(json.dumps({'uid':os.getuid(),'checks':results}))
"""

def repair_existing(consumer,expected_sha,apply=False):
    if os.geteuid()!=0:raise PermissionError('administrator authentication required for existing Hermes service')
    owner=pwd.getpwnam('caiyijun');hermes=pwd.getpwnam('hermes')
    if owner.pw_uid!=501 or hermes.pw_uid!=502:raise ValueError('service-account-changed')
    consumer=Path(consumer);regular(consumer,owner.pw_uid)
    if not re.fullmatch(r'[a-f0-9]{64}',expected_sha) or digest(consumer)!=expected_sha:raise ValueError('consumer-pin-mismatch')
    regular(DAEMON,0);spec=plistlib.loads(DAEMON.read_bytes())
    if spec.get('UserName')!='hermes' or spec.get('Label')!=LABEL or spec.get('WatchPaths')!=[str(SHARED/'input')] or 'StartInterval' in spec:raise ValueError('service-contract-changed')
    args=spec['ProgramArguments'];python=Path(args[0]);regular(python,0)
    if args[1:4]!=['-I','-B',str(CONTROL/'consumer.py')]:raise ValueError('consumer-command-changed')
    status=subprocess.check_output(['/bin/launchctl','print','system/'+LABEL],text=True)
    if '\n\tstate = not running\n' not in status:raise ValueError('consumer-running-preserve-state')
    for directory in [SHARED,SHARED/'input',SHARED/'state',SHARED/'receipts',CONTROL]:
        info=directory.lstat()
        if not stat.S_ISDIR(info.st_mode):raise ValueError('unsafe-service-directory')
    regular(CONTROL/'consumer.py',0)
    def diagnose():
        value=json.loads(subprocess.check_output(['/usr/bin/sudo','-u','hermes',str(python),'-I','-B','-c',diagnostic_code(reader_sha=digest(CONTROL/'consumer.py'))],text=True,cwd='/'))
        if value.get('uid')!=hermes.pw_uid:raise ValueError('diagnostic-user-mismatch')
        return value
    before=diagnose();changes=[]
    evidence=CONTROL/('diagnosis-'+str(time.time_ns())+'.json');evidence.write_text(json.dumps(before)+'\n');evidence.chmod(0o444)
    if apply:
        for check in before['checks']:
            if check['status']=='passed':continue
            if check['errorType'] not in ('PermissionError','OperationalError'):continue
            stage=check['stage']
            if stage=='feed-read':
                regular(SHARED/'input/status.json',owner.pw_uid)
                acl_read(SHARED/'input','hermes')
                run(['/bin/chmod','+a','user:hermes allow read,readattr',str(SHARED/'input/status.json')]);changes.append('feed-read-acl')
            elif stage in ('ledger-directory','ledger-mode','ledger-open','receipt-write'):
                candidates=[SHARED/('receipts' if stage=='receipt-write' else 'state')]
                if stage.startswith('ledger'):
                    candidates.extend(SHARED/'state'/name for name in ['events.sqlite','events.sqlite-wal','events.sqlite-shm','events.sqlite-journal'])
                for item in candidates:
                    if not item.exists():continue
                    info=item.lstat()
                    if not (stat.S_ISREG(info.st_mode) and info.st_nlink==1 or stat.S_ISDIR(info.st_mode)):raise ValueError('unsafe-state-item')
                    if info.st_uid==0:
                        os.chown(item,hermes.pw_uid,hermes.pw_gid);os.chmod(item,0o700 if stat.S_ISDIR(info.st_mode) else 0o600);changes.append(stage+'-root-owned-item')
                    elif info.st_uid!=hermes.pw_uid:raise ValueError('state-owned-by-another-user')
                    elif info.st_mode&0o700!=(0o700 if stat.S_ISDIR(info.st_mode) else 0o600):
                        os.chmod(item,0o700 if stat.S_ISDIR(info.st_mode) else 0o600);changes.append(stage+'-owner-mode')
    after=diagnose() if apply else before
    passed=all(x['status']=='passed' for x in after['checks'])
    result={'status':'qualified' if passed else 'blocked','before':before,'after':after,'repairs':changes,'ledgerReset':False,'notificationsSent':0,'timerChanged':False}
    if apply and passed:
        target=CONTROL/'consumer.py';regular(target,0)
        backup=CONTROL/('consumer-'+digest(target)+'.py')
        if not backup.exists():backup.write_bytes(target.read_bytes());backup.chmod(0o444)
        temporary=CONTROL/('.consumer-'+expected_sha)
        if temporary.exists():raise ValueError('prepared-install-already-exists')
        try:
            temporary.write_bytes(consumer.read_bytes());temporary.chmod(0o444)
            if digest(temporary)!=expected_sha:raise ValueError('staged-consumer-mismatch')
            os.replace(temporary,target)
        finally:
            if temporary.exists():temporary.unlink()
        result.update(status='installed-awaiting-natural-feed',consumerSha256=expected_sha)
        (CONTROL/'repair-receipt.json').write_text(json.dumps(result)+'\n');(CONTROL/'repair-receipt.json').chmod(0o644)
    (CONTROL/'repair-receipt.json').write_text(json.dumps(result)+'\n');(CONTROL/'repair-receipt.json').chmod(0o644)
    print(json.dumps(result));return 0 if passed else 1

LEGACY_CONSUMER_SHA='34646a0a98be86d6e1adccac9c60e2507074fbd02c88df0a057432ebd0a88ae6'

def reconcile_selection_rejection(db,event_id,fingerprint,proof):
    # Only authenticated caller supplies filesystem proof. Never reinterpret a transport failure.
    if proof.get('consumerSha256')!=LEGACY_CONSUMER_SHA or proof.get('oldCode')==proof.get('selectedCode') or not all(type(proof.get(key)) in (int,float) and 0<proof[key]<proof.get('eventTime',0) for key in ['activeMtime','gateMtime','daemonMtime','consumerMtime']):raise ValueError('unproven-pretransport-rejection')
    marker='ConfirmedPretransportSelectionMismatch:'+str(event_id)
    db.execute('BEGIN IMMEDIATE')
    try:
        original=db.execute('SELECT fingerprint,status,message_id,error_type,human_received FROM events WHERE id=?',(event_id,)).fetchone()
        if original!=(fingerprint,'unknown',None,'ValueError',0):raise ValueError('historical-event-changed')
        latest=db.execute('SELECT id,status,error_type FROM events WHERE fingerprint=? ORDER BY id DESC LIMIT 1',(fingerprint,)).fetchone()
        if latest==(event_id,'unknown','ValueError'):
            db.execute("INSERT INTO events(fingerprint,status,error_type) VALUES(?,'not_sent',?)",(fingerprint,marker))
        elif latest[1:]!=('not_sent',marker):raise ValueError('subsequent-delivery-state-preserved')
        db.commit()
    except BaseException:db.rollback();raise

def selection_spec(spec,digest_value):
    if not re.fullmatch(r'[a-f0-9]{64}',digest_value):raise ValueError('invalid-selection')
    selected=AUTHORITY/'releases'/digest_value
    result=dict(spec);args=list(spec['ProgramArguments'])
    args[0]=str(selected/'runtime/bin/python3.11');args[args.index('--hermes-code')+1]=str(selected/'code')
    result.update(ProgramArguments=args,RunAtLoad=False)
    return result

def repair_selection(consumer,expected_sha,prepared_file):
    import contextlib,sqlite3
    from datetime import datetime
    if os.geteuid()!=0:raise PermissionError('administrator authentication required for existing notifier selection')
    owner=pwd.getpwnam('caiyijun');hermes=pwd.getpwnam('hermes')
    if (owner.pw_uid,hermes.pw_uid)!=(501,502):raise ValueError('service-account-changed')
    consumer=Path(consumer);prepared_file=Path(prepared_file)
    for file in [consumer,prepared_file]:regular(file,501)
    if digest(consumer)!=expected_sha:raise ValueError('candidate-consumer-changed')
    prepared=json.loads(prepared_file.read_text());selected_digest=prepared['selectedDigest']
    active_file=AUTHORITY/'active.json';gate_file=AUTHORITY/'gate.json';target=CONTROL/'consumer.py'
    for file in [active_file,gate_file,DAEMON,target]:regular(file,0)
    active=json.loads(active_file.read_text());gate=json.loads(gate_file.read_text())
    if active!={'digest':selected_digest,'mode':'live'} or gate!={'digest':selected_digest,'mode':'live','status':'ready'}:raise ValueError('selected-release-changed')
    spec=plistlib.loads(DAEMON.read_bytes());args=spec['ProgramArguments'];old_code=args[args.index('--hermes-code')+1]
    selected_spec=selection_spec(service_spec(args[0],old_code,501),selected_digest)
    prior_receipt=CONTROL/'selection-repair-receipt.json'
    if spec==selected_spec and digest(target)==expected_sha and prior_receipt.exists():
        regular(prior_receipt,0);prior=json.loads(prior_receipt.read_text())
        if prior.get('selectedDigest')!=selected_digest or prior.get('consumerSha256')!=expected_sha or prior.get('reconciledEventId')!=6:raise ValueError('repair-receipt-changed')
        print(json.dumps(dict(prior,status='already-selected-awaiting-natural-feed')));return 0
    if spec!=service_spec(args[0],old_code,501):raise ValueError('existing-notifier-contract-changed')
    status=subprocess.check_output(['/bin/launchctl','print','system/'+LABEL],text=True)
    if '\n\tstate = not running\n' not in status:raise ValueError('notifier-running-preserve-state')
    if digest(target)!=LEGACY_CONSUMER_SHA:raise ValueError('historical-consumer-changed')
    receipt=prepared['receipt'];item=receipt['publications']
    if receipt.get('issueCount')!=0 or item!=[{'eventId':6,'status':'unknown','errorType':'ValueError','stage':'sender'}]:raise ValueError('unexpected-original-receipt')
    proof={'consumerSha256':digest(target),'oldCode':old_code,'selectedCode':str(AUTHORITY/'releases'/selected_digest/'code'),'eventTime':datetime.fromisoformat(receipt['updatedAt']).timestamp(),'activeMtime':max(active_file.stat().st_mtime,active_file.stat().st_ctime),'gateMtime':max(gate_file.stat().st_mtime,gate_file.stat().st_ctime),'daemonMtime':max(DAEMON.stat().st_mtime,DAEMON.stat().st_ctime),'consumerMtime':max(target.stat().st_mtime,target.stat().st_ctime)}
    replacement=selection_spec(spec,selected_digest);python=Path(replacement['ProgramArguments'][0]);regular(python,0)
    code=Path(proof['selectedCode'])
    for directory in [CONTROL,code,code.parent]:
        info=directory.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid!=0 or info.st_mode&0o022:raise ValueError('untrusted-selection-directory')
    for name in ['hermes_cli/send_cmd.py','tools/send_message_tool.py']:regular(code/name,0)
    checks=json.loads(subprocess.check_output(['/usr/bin/sudo','-u','hermes',str(python),'-I','-B','-c',diagnostic_code(reader_sha=LEGACY_CONSUMER_SHA)],text=True,cwd='/'))
    if checks.get('uid')!=502 or any(x['status']!='passed' for x in checks['checks']):
        print(json.dumps({'status':'blocked','stage':'selected-runtime-access','checks':checks,'ledgerChanged':False,'jobChanged':False,'notificationsSent':0}));return 1
    ledger=SHARED/'state/events.sqlite';regular(ledger,502)
    # Hold the SQLite writer lock while preserving and reconciling the exact original event.
    backup=CONTROL/('selection-repair-'+str(time.time_ns()));backup.mkdir(mode=0o700)
    (backup/'daemon.plist').write_bytes(DAEMON.read_bytes());(backup/'consumer.py').write_bytes(target.read_bytes())
    with contextlib.closing(sqlite3.connect(ledger,timeout=5)) as db:
        with contextlib.closing(sqlite3.connect(backup/'events.sqlite')) as copy:db.backup(copy)
        reconcile_selection_rejection(db,6,prepared['fingerprint'],proof)
    # No input file/directory touch. RunAtLoad=false keeps delivery on the next natural snapshot.
    run(['/bin/launchctl','bootout','system/'+LABEL])
    temporary=CONTROL/'.selection-consumer'
    try:
        temporary.write_bytes(consumer.read_bytes());temporary.chmod(0o444);os.replace(temporary,target)
        DAEMON.write_bytes(plistlib.dumps(replacement));DAEMON.chmod(0o644)
        run(['/bin/launchctl','bootstrap','system',str(DAEMON)])
    except BaseException:
        target.write_bytes((backup/'consumer.py').read_bytes());target.chmod(0o444)
        fallback=plistlib.loads((backup/'daemon.plist').read_bytes());fallback['RunAtLoad']=False
        DAEMON.write_bytes(plistlib.dumps(fallback));DAEMON.chmod(0o644)
        run(['/bin/launchctl','bootstrap','system',str(DAEMON)])
        raise
    result={'status':'selected-awaiting-natural-feed','selectedDigest':selected_digest,'consumerSha256':expected_sha,'originalUnknownPreserved':True,'reconciledEventId':6,'proof':proof,'checks':checks,'notificationsSent':0,'ledgerReset':False,'timerChanged':False,'gatewayChanged':False,'runAtLoad':False}
    report=CONTROL/'selection-repair-receipt.json';report.write_text(json.dumps(result)+'\n');report.chmod(0o644)
    print(json.dumps(result));return 0

if __name__=='__main__':
    try:
        if len(sys.argv)>1 and sys.argv[1]=='--repair-selection':
            import argparse
            parser=argparse.ArgumentParser();parser.add_argument('--repair-selection',action='store_true');parser.add_argument('--consumer',required=True);parser.add_argument('--sha256',required=True);parser.add_argument('--prepared',required=True);args=parser.parse_args()
            raise SystemExit(repair_selection(args.consumer,args.sha256,args.prepared))
        if len(sys.argv)>1 and sys.argv[1]=='--repair-existing':
            import argparse
            parser=argparse.ArgumentParser();parser.add_argument('--repair-existing',action='store_true');parser.add_argument('--consumer',required=True);parser.add_argument('--sha256',required=True);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
            raise SystemExit(repair_existing(args.consumer,args.sha256,args.apply))
        raise SystemExit(activate())
    except Exception as error:
        print(json.dumps({'status':'blocked','errorType':type(error).__name__,'reason':str(error) if isinstance(error,(ValueError,PermissionError)) else 'owner operation failed; preserve existing state'}));raise SystemExit(1)
