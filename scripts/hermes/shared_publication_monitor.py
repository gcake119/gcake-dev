"""Substack successes within the original-site Hermes occurrence and private ledger."""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import secrets
import sqlite3
import sys
import time
import publication_monitor as original
from substack_attention import publication_key, publication_message, validate_publications, publication_time


def substack_authority(observation, now):
    original.summary_articles(observation)
    block = observation['summary'].get('substackPublications')
    if not isinstance(block, dict) or block.get('complete') is not True:
        raise ValueError('Substack authority unavailable')
    publications = validate_publications(block.get('publications'))
    if len({p['id'] for p in publications}) != len(publications):
        raise ValueError('Duplicate public identity')
    if any(publication_time(p['actualAt']).timestamp() > now + 5 for p in publications):
        raise ValueError('Future publication')
    return publications


def run_substack_round(db, observation, round_at, now, job_id, execution_id, sender):
    """The existing Pages round must have durably accepted this same occurrence."""
    if not callable(sender):raise ValueError('Live sender required')
    original.invocation_identity(job_id); original.invocation_identity(execution_id)
    if not all(isinstance(value,(int,float)) and math.isfinite(value) for value in (round_at,now)) or round_at > now:
        raise ValueError('Invalid occurrence')
    meta = dict(db.execute('SELECT key,value FROM meta'))
    accepted = db.execute('SELECT job_id,round_at FROM monitor_invocations WHERE execution_id=?',(execution_id,)).fetchone()
    if meta.get('monitor_job_id') != job_id or accepted != (job_id,round_at) or float(meta.get('monitor_last_round','-inf')) != round_at:
        raise ValueError('Unaccepted original monitor occurrence')
    try:
        publications = substack_authority(observation,now)
    except (ValueError,KeyError,TypeError,AttributeError):
        return {'status':'inconclusive','sent':0,'eligible':0}
    sent = suppressed = 0
    for publication in publications:
        key = publication_key(publication)
        db.execute('BEGIN IMMEDIATE')
        prior = db.execute('SELECT status FROM monitor_events WHERE event_id=?',(key,)).fetchone()
        if prior and prior[0] != 'rejected':
            db.commit(); suppressed += 1; continue
        message = publication_message(publication)
        url = 'https://gcakedev.substack.com/p/' + publication['slug']
        db.execute('INSERT OR REPLACE INTO monitor_events(event_id,kind,url,message,status,human_received) VALUES(?,?,?,?,?,0)',(key,'substack',url,message,'intent'))
        db.commit()
        def acknowledged(text):
            ack = sender(text)
            if type(ack) is not int or ack <= 0:
                raise ValueError('Uncertain acknowledgement')
            return ack
        status = original.deliver_recorded(db,key,acknowledged,message)
        db.execute('UPDATE monitor_events SET status=? WHERE event_id=?',(status,key));db.commit()
        if status == 'sent':sent += 1
    result = {'status':'sent' if sent else 'suppressed' if suppressed else 'clear','sent':sent,'eligible':len(publications),'suppressed':suppressed}
    receipt = dict(result,jobId=job_id,executionId=execution_id,roundAt=round_at,observedAt=now,requestId=observation.get('requestId'),implementationSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
    db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)',('monitor_substack_last_observation',json.dumps(receipt,separators=(',',':'))));db.commit()
    return result


def qualify():
    """Read the same authority and original sender readiness; no ledger or transport."""
    observer = original.PublicationObserver(os.environ['PUBLICATION_MONITOR_SUMMARY_URL'],os.environ['PUBLICATION_MONITOR_READ_SECRET'])
    request_id = secrets.token_hex(16);start=time.time()
    raw,_=observer._get(observer.url,observer.secret,request_id)
    observation={'summary':json.loads(raw),'requestId':request_id,'window':[start,time.time()]}
    publications=substack_authority(observation,time.time())
    readiness=original.notification_readiness()
    report={'status':'qualified' if readiness['rejection_reason'] is None else 'blocked','uid':os.geteuid(),'readiness':readiness,'publications':[{'id':p['id'],'slug':p['slug'],'key':publication_key(p)} for p in publications],'notificationsSent':0,'ledgerChanged':False}
    print(json.dumps(report));return 0 if report['status']=='qualified' else 1


def main():
    if sys.argv[1:]==['--qualify']:return qualify()
    parser=argparse.ArgumentParser();parser.add_argument('--db',required=True);parser.add_argument('--round-at');parser.add_argument('--live',action='store_true');args=parser.parse_args()
    if not args.live:
        # Keep the original read-only backup simulation and its live-state isolation.
        return original.main()
    now=time.time();round_at,job_id,execution_id=original.scheduled_context(args.round_at,True,now)
    observer=original.PublicationObserver(os.environ['PUBLICATION_MONITOR_SUMMARY_URL'],os.environ['PUBLICATION_MONITOR_READ_SECRET'])
    captured={}
    def observe(at):
        captured['value']=observer(at);return captured['value']
    monitor=original.PublicationMonitor(args.db,observe,sender=original.send_notification,mode='live')
    pages=monitor.run_round(round_at,now,job_id=job_id,execution_id=execution_id)
    result={'status':'no-fresh-occurrence','sent':0,'eligible':0}
    if 'value' in captured:
        monitor._open()
        with open(str(monitor.path)+'.lock','a') as lock:
            try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            except BlockingIOError:result={'status':'busy','sent':0,'eligible':0}
            else:
                with closing(sqlite3.connect(monitor.path)) as db:
                    result=run_substack_round(db,captured['value'],round_at,time.time(),job_id,execution_id,original.send_notification)
    unresolved=original.delivery_health(args.db)
    print(json.dumps({'mode':'live','originalSiteMessages':len(pages),'substack':result,'unresolvedNotifications':unresolved}))
    return 1 if unresolved else 0


if __name__=='__main__':
    try:raise SystemExit(main())
    except Exception as error:
        print(json.dumps({'status':'blocked','errorType':type(error).__name__}));raise SystemExit(1)
