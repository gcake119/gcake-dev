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

if __name__=='__main__':
    try:raise SystemExit(activate())
    except Exception as error:
        print(json.dumps({'status':'blocked','errorType':type(error).__name__,'reason':str(error) if isinstance(error,(ValueError,PermissionError)) else 'owner operation failed; preserve existing state'}));raise SystemExit(1)
