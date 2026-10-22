"""Event-driven Substack attention delivery via the existing Hermes home channel."""
import argparse
import contextlib
from datetime import datetime,timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import stat
import sys
import time

class HermesSelectionMismatch(ValueError):
    """Rejected before credentials or transport; safe to await a repaired selection."""

AUTHORITY=Path('/usr/local/share/gcake-hermes-runtime')
REASONS={
    'DISTRIBUTION_MANUAL_REQUIRED':'同步需要人工確認，請查看保留的原始錯誤與操作紀錄',
    'SUBSTACK_BACKGROUND_ATTENDED_REQUIRED':'需要前景操作才能新增、更新或復原',
    'SUBSTACK_DRAFT_PREPARATION_REQUIRED':'待備稿：原稿已就緒，需要前景建立或核對完整草稿；背景不會排程或寄送',
    'SUBSTACK_CONTENT_SYNC_REQUIRED':'內容待同步／驗證：需要前景比對同一篇文章，確認差異後更新，不重新發布或重寄',
    'SUBSTACK_SCHEDULE_CANCEL_REQUIRED':'待解除排程：尚未確認解除，Substack 仍可能依最後確認時段發布',
    'SUBSTACK_SCHEDULE_POSTPONE_REQUIRED':'待調整排程：尚未確認延期，Substack 仍可能依最後確認時段發布',
    'SUBSTACK_SCHEDULE_RECONCILIATION_REQUIRED':'排程操作結果未明：請前景讀回原文章確認，勿重做或另建文章',
}

@contextlib.contextmanager
def stage(name):
    try:yield
    except Exception as error:
        if not hasattr(error,'stage'):error.stage=name
        raise

def failure_report(error):
    result={'status':'blocked','errorType':type(error).__name__,'stage':getattr(error,'stage','startup'),'humanReceived':False}
    if isinstance(error,OSError) and isinstance(error.errno,int):result['errno']=error.errno
    return result

def publication_time(value):
    if not isinstance(value,str) or len(value)>40:raise ValueError('invalid-publication-time')
    stamp=datetime.fromisoformat(value.replace('Z','+00:00'))
    if stamp.tzinfo is None:raise ValueError('invalid-publication-time')
    return stamp

def validate_publications(items):
    if not isinstance(items,list) or len(items)>100:raise ValueError('invalid-publications')
    for p in items:
        if not isinstance(p,dict) or set(p)!={'slug','id','revision','title','actualAt','confirmedAt','differenceSeconds'}:raise ValueError('invalid-publication')
        if not isinstance(p['slug'],str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',p['slug']) or len(p['slug'])>180 or not isinstance(p['id'],str) or not re.fullmatch(r'[0-9]{1,30}',p['id']) or not isinstance(p['revision'],str) or not re.fullmatch(r'sha256:[a-f0-9]{64}',p['revision']):raise ValueError('invalid-publication-identity')
        if not isinstance(p['title'],str) or not 1<=len(p['title'])<=300 or re.search(r'[\x00-\x1f\x7f]',p['title']):raise ValueError('invalid-publication-title')
        actual=publication_time(p['actualAt']);confirmed=publication_time(p['confirmedAt']);delta=p['differenceSeconds']
        if type(delta) not in (int,float) or not math.isfinite(delta) or abs((actual-confirmed).total_seconds()-delta)>0.000001:raise ValueError('invalid-publication-difference')
    if len({p['slug'] for p in items})!=len(items):raise ValueError('duplicate-publication')
    return items

def publication_key(p):
    # Title, raw Git metadata and check times cannot turn one publication into another event.
    return 'publication:'+hashlib.sha256(json.dumps([p['id'],p['revision'],publication_time(p['actualAt']).isoformat()],separators=(',',':')).encode()).hexdigest()

def publication_message(p):
    return '\n'.join(['Substack 同步發布驗證完成',p['title'],'https://gcakedev.substack.com/p/'+p['slug']])

def acknowledge(response):
    mid=response.get('message_id') if isinstance(response,dict) else None
    if not isinstance(response,dict) or response.get('success') is not True or response.get('skipped') or response.get('partial_success') or response.get('error') or isinstance(mid,bool) or not re.fullmatch(r'[1-9][0-9]*',str(mid)):raise ValueError('unconfirmed-ack')
    return str(mid)

def read_snapshot(file,uid,now):
    fd=os.open(file,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
    with os.fdopen(fd,'rb') as stream:
        info=os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid!=uid or info.st_nlink!=1 or info.st_mode&0o077:raise ValueError('invalid-feed-owner-or-mode')
        raw=stream.read(65537)
    if len(raw)>65536:raise ValueError('feed-too-large')
    value=json.loads(raw)
    if not isinstance(value,dict) or type(value.get('schema')) is not int or value['schema'] not in (1,2) or set(value)!=({'schema','generatedAt','issues'} if value['schema']==1 else {'schema','generatedAt','issues','publications'}):raise ValueError('invalid-feed-schema')
    stamp=datetime.fromisoformat(value['generatedAt'].replace('Z','+00:00'))
    if stamp.tzinfo is None or not -5<=now-stamp.timestamp()<=3600:raise ValueError('stale-feed')
    issues=value['issues']
    if not isinstance(issues,list) or len(issues)>100:raise ValueError('invalid-issues')
    normalized=[]
    for issue in issues:
        if not isinstance(issue,dict) or set(issue)!={'slug','code'} or not isinstance(issue['slug'],str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',issue['slug']) or len(issue['slug'])>180 or issue['code'] not in REASONS:raise ValueError('invalid-issue')
        normalized.append(dict(slug=issue['slug'],code=issue['code']))
    normalized.sort(key=lambda x:x['slug'])
    if len({x['slug'] for x in normalized})!=len(normalized):raise ValueError('duplicate-issue')
    return normalized,validate_publications(value.get('publications',[]))

def atomic_receipt(file,value):
    temporary=Path(str(file)+'.'+str(os.getpid()))
    try:
        fd=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
        with os.fdopen(fd,'w') as stream:
            json.dump(value,stream,ensure_ascii=False);stream.write('\n');stream.flush();os.fsync(stream.fileno())
        os.replace(temporary,file)
    finally:
        try:temporary.unlink()
        except FileNotFoundError:pass

def message(issues):
    lines=[f'Substack 有 {len(issues)} 項前景待辦。背景僅觀察，不會操作 Chrome。']
    for issue in issues[:8]:
        lines.extend(['',issue['slug'][:80],REASONS[issue['code']],'https://gcake119.github.io/gcake-dev/posts/'+issue['slug']+'/'])
    if len(issues)>8:lines.extend(['',f'另有 {len(issues)-8} 項，請查看同步結果。'])
    return '\n'.join(lines)

def consume(feed,database,receipt,producer_uid,sender,now=None):
    now=time.time() if now is None else now
    with stage('feed-read'):issues,publications=read_snapshot(feed,producer_uid,now)
    fingerprint=hashlib.sha256(json.dumps(issues,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    report={'status':'clear','humanReceived':False,'issueCount':len(issues),'updatedAt':datetime.fromtimestamp(now,timezone.utc).isoformat()}
    # State dir is Hermes-private; never accept an alternate symlink database.
    if Path(database).is_symlink():raise ValueError('invalid-state-path')
    with stage('ledger'),contextlib.closing(sqlite3.connect(database,timeout=5)) as db:
        with stage('ledger-mode'):os.chmod(database,0o600)
        db.execute('PRAGMA synchronous=FULL')
        db.execute('CREATE TABLE IF NOT EXISTS active(singleton INTEGER PRIMARY KEY CHECK(singleton=1),fingerprint TEXT)')
        db.execute('CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,fingerprint TEXT,status TEXT,message_id TEXT,error_type TEXT,human_received INTEGER NOT NULL DEFAULT 0)')
        db.commit();db.execute('BEGIN IMMEDIATE')
        current=db.execute('SELECT fingerprint FROM active WHERE singleton=1').fetchone()
        prior_issue=db.execute('SELECT id,status,message_id FROM events WHERE fingerprint=? ORDER BY id DESC LIMIT 1',(fingerprint,)).fetchone() if current and current[0]==fingerprint else None
        if not issues:
            db.execute('INSERT OR REPLACE INTO active VALUES(1,NULL)');db.commit()
        elif current and current[0]==fingerprint and (not prior_issue or prior_issue[1]!='not_sent'):
            prior=prior_issue;db.commit()
            report.update(status='quiet' if prior and prior[1]=='sent' else 'unknown',eventId=prior[0] if prior else None)
        else:
            event=db.execute("INSERT INTO events(fingerprint,status) VALUES(?,'intent')",(fingerprint,)).lastrowid
            db.execute('INSERT OR REPLACE INTO active VALUES(1,?)',(fingerprint,));db.commit()
            report.update(status='intent',eventId=event)
            with stage('receipt-write'):atomic_receipt(receipt,report)
            try:
                with stage('sender'):response=sender(message(issues))
                mid=acknowledge(response)
                db.execute("UPDATE events SET status='sent',message_id=? WHERE id=?",(str(mid),event));db.commit();report.update(status='sent',messageId=str(mid))
            except Exception as error:
                outcome='not_sent' if isinstance(error,HermesSelectionMismatch) else 'unknown'
                db.execute("UPDATE events SET status=?,error_type=? WHERE id=?",(outcome,type(error).__name__,event));db.commit();report.update(status=outcome,errorType=type(error).__name__,stage=getattr(error,'stage','sender'),**({'errno':error.errno} if isinstance(error,OSError) and isinstance(error.errno,int) else {}))
        publication_reports=[]
        for publication in publications:
            key=publication_key(publication);db.execute('BEGIN IMMEDIATE')
            prior=db.execute('SELECT id,status,message_id FROM events WHERE fingerprint=? ORDER BY id DESC LIMIT 1',(key,)).fetchone()
            if prior and prior[1]!='not_sent':
                db.commit();publication_reports.append({'eventId':prior[0],'status':'quiet' if prior[1]=='sent' else 'unknown',**({'messageId':prior[2]} if prior[1]=='sent' else {})});continue
            event=db.execute("INSERT INTO events(fingerprint,status) VALUES(?,'intent')",(key,)).lastrowid;db.commit()
            item={'eventId':event,'status':'intent'}
            with stage('receipt-write'):atomic_receipt(receipt,dict(report,publication=item))
            try:
                with stage('sender'):mid=acknowledge(sender(publication_message(publication)))
                db.execute("UPDATE events SET status='sent',message_id=? WHERE id=?",(mid,event));db.commit();item.update(status='sent',messageId=mid)
            except Exception as error:
                outcome='not_sent' if isinstance(error,HermesSelectionMismatch) else 'unknown'
                db.execute("UPDATE events SET status=?,error_type=? WHERE id=?",(outcome,type(error).__name__,event));db.commit();item.update(status=outcome,errorType=type(error).__name__,stage=getattr(error,'stage','sender'))
            publication_reports.append(item)
        if publication_reports:
            statuses=[report['status']]+[p['status'] for p in publication_reports]
            report.update(publications=publication_reports,status='unknown' if 'unknown' in statuses else 'sent' if 'sent' in statuses else 'not_sent' if 'not_sent' in statuses else 'quiet')
    with stage('receipt-write'):atomic_receipt(receipt,report)
    return report

def hermes_selection(code):
    """Read only the selected-release metadata, before any intent or credential access."""
    root=AUTHORITY
    active=json.loads((root/'active.json').read_text());gate=json.loads((root/'gate.json').read_text())
    expected=root/'releases'/active['digest']/'code'
    if active.get('mode')!='live' or gate.get('mode')!='live' or gate.get('status')!='ready' or gate.get('digest')!=active['digest'] or Path(code)!=expected:raise HermesSelectionMismatch('hermes-selection-changed')
    return expected

def hermes_sender(code):
    """Recheck selection immediately before importing the official sender."""
    expected=hermes_selection(code)
    sys.path.insert(0,str(expected))
    from hermes_cli.send_cmd import _load_hermes_env
    from tools.send_message_tool import send_message_tool
    _load_hermes_env()
    return lambda text:json.loads(send_message_tool({'action':'send','target':'telegram','message':text}))

def main():
    p=argparse.ArgumentParser();p.add_argument('--feed',required=True);p.add_argument('--state',required=True);p.add_argument('--receipt',required=True);p.add_argument('--producer-uid',type=int,required=True);p.add_argument('--hermes-code',required=True);args=p.parse_args()
    try:
        with stage('selection'):hermes_selection(args.hermes_code)
        # Import/configuration is lazy: repeated snapshots require no credential access.
        def send(text):return hermes_sender(args.hermes_code)(text)
        result=consume(Path(args.feed),Path(args.state),Path(args.receipt),args.producer_uid,send)
        print(json.dumps(result));return 1 if result['status']=='unknown' else 0
    except Exception as error:
        result=failure_report(error)
        try:atomic_receipt(Path(args.receipt),result)
        except Exception as receipt_error:result['receiptErrorType']=type(receipt_error).__name__
        print(json.dumps(result));return 1

if __name__=='__main__':raise SystemExit(main())
