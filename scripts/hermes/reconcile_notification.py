"""Explicit one-event resend; never run this from the hourly scheduler."""
import argparse
from contextlib import closing
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import time
from publication_monitor import deliver_recorded, send_notification


def resend_once(path, event_id, operation, message_sha256, sender, backup_dir, *, predecessor=None):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,99}',operation):
        raise ValueError('Invalid reconciliation identity')
    if predecessor is not None and (predecessor==operation or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,99}',predecessor)):
        raise ValueError('Invalid predecessor identity')
    original=Path(path)
    for item in (original,Path(str(original)+'.lock')):
        if item.is_symlink() or (item.exists() and item.stat().st_nlink!=1):
            raise ValueError('Unsafe state path')
    if not original.is_file():raise ValueError('Existing state required')
    path=original.resolve()
    with open(str(path)+'.lock','a') as lock:
        os.chmod(str(path)+'.lock',0o600)
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        with closing(sqlite3.connect(path)) as db:
            row=db.execute('SELECT kind,url,message,status,human_received FROM monitor_events WHERE event_id=?',(event_id,)).fetchone()
            if not row or row[0]!='article' or event_id!='article:'+row[1] or row[3:]!=('unknown',0):
                raise ValueError('Expected unreceived uncertain article')
            if db.execute('SELECT status FROM outbox WHERE url=?',(row[1],)).fetchone()!=('uncertain',):
                raise ValueError('Expected uncertain outbox')
            if hashlib.sha256(row[2].encode()).hexdigest()!=message_sha256:
                raise ValueError('Message changed')
            has_journal=db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='monitor_reconciliations'").fetchone()
            if predecessor is None:
                if has_journal and db.execute('SELECT 1 FROM monitor_reconciliations WHERE operation=? OR event_id=?',(operation,event_id)).fetchone():
                    raise ValueError('Reconciliation already consumed')
            else:
                old=db.execute('SELECT event_id,status FROM monitor_reconciliations WHERE operation=?',(predecessor,)).fetchone() if has_journal else None
                if old!=(event_id,'unknown') or db.execute('SELECT 1 FROM monitor_reconciliations WHERE operation=?',(operation,)).fetchone():
                    raise ValueError('Expected original failed reconciliation')
                last=db.execute('SELECT status,error_type FROM monitor_delivery_attempts WHERE event_id=? ORDER BY attempt_id DESC LIMIT 1',(event_id,)).fetchone()
                if last!=('rejected','DeliveryRejected'):
                    raise ValueError('Predecessor was not definitely rejected')
            has_continuation=db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='monitor_reconciliation_continuations'").fetchone()
            if has_continuation and db.execute('SELECT 1 FROM monitor_reconciliation_continuations WHERE event_id=? OR operation=?',(event_id,operation)).fetchone():
                raise ValueError('Continuation already consumed')
            backups=Path(backup_dir)
            if backups.is_symlink():raise ValueError('Unsafe backup directory')
            backups.mkdir(mode=0o700,parents=True,exist_ok=True)
            info=backups.stat()
            if info.st_uid!=os.geteuid() or info.st_mode&0o077:
                raise ValueError('Private backup directory required')
            backup=backups/(operation+'.sqlite')
            fd=os.open(backup,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
            os.close(fd)
            try:
                with closing(sqlite3.connect(backup)) as copy:
                    db.backup(copy)
                    if copy.execute('PRAGMA integrity_check').fetchone()!=('ok',):
                        raise ValueError('Backup verification failed')
                with open(backup,'rb') as stream:os.fsync(stream.fileno())
            except BaseException:
                backup.unlink()
                raise
            if predecessor is None:
                journal='monitor_reconciliations'
                db.execute('''CREATE TABLE IF NOT EXISTS monitor_reconciliations(
                    operation TEXT PRIMARY KEY,event_id TEXT UNIQUE NOT NULL,
                    status TEXT NOT NULL,created_at REAL NOT NULL,backup TEXT NOT NULL)''')
                db.execute('INSERT INTO monitor_reconciliations VALUES(?,?,?,?,?)',
                           (operation,event_id,'intent',time.time(),str(backup)))
            else:
                journal='monitor_reconciliation_continuations'
                db.execute('''CREATE TABLE IF NOT EXISTS monitor_reconciliation_continuations(
                    operation TEXT PRIMARY KEY,event_id TEXT UNIQUE NOT NULL,
                    predecessor TEXT UNIQUE NOT NULL,status TEXT NOT NULL,
                    created_at REAL NOT NULL,backup TEXT NOT NULL)''')
                db.execute('INSERT INTO monitor_reconciliation_continuations VALUES(?,?,?,?,?,?)',
                           (operation,event_id,predecessor,'intent',time.time(),str(backup)))
            db.commit()
            def acknowledged(message):
                ack=sender(message)
                if type(ack) is not int:raise ValueError('Uncertain acknowledgement')
                return ack
            outcome=deliver_recorded(db,event_id,acknowledged,row[2])
            # Even an explicit rejection consumes this authorization. Retain the
            # original unknown event so the scheduler cannot retry the resend.
            status='sent' if outcome=='sent' else 'unknown'
            db.execute('UPDATE monitor_events SET status=? WHERE event_id=?',(status,event_id))
            if status=='sent':db.execute("UPDATE outbox SET status='sent' WHERE url=?",(row[1],))
            db.execute('UPDATE '+journal+' SET status=? WHERE operation=?',(status,operation))
            db.commit()
            attempt=db.execute('SELECT message_id,error_type,reason_type,rejection_reason,error_code FROM monitor_delivery_attempts WHERE event_id=? ORDER BY attempt_id DESC LIMIT 1',(event_id,)).fetchone()
            return dict(status=status,transport_status=outcome,operation=operation,predecessor=predecessor,event_id=event_id,
                        backup=str(backup),message_id=attempt[0],error_type=attempt[1],reason_type=attempt[2],
                        rejection_reason=attempt[3],error_code=attempt[4],human_received=False)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db',required=True)
    parser.add_argument('--event-id',required=True)
    parser.add_argument('--operation',required=True)
    parser.add_argument('--message-sha256',required=True)
    parser.add_argument('--backup-dir',required=True)
    parser.add_argument('--predecessor',help='Explicit owner-authorized continuation of one definitely rejected operation')
    args=parser.parse_args()
    result=resend_once(args.db,args.event_id,args.operation,args.message_sha256,send_notification,args.backup_dir,predecessor=args.predecessor)
    print(json.dumps(result))
    return 0 if result['status']=='sent' else 1


if __name__=='__main__':
    try:raise SystemExit(main())
    except Exception as error:
        print(json.dumps(dict(status='blocked',error_type=type(error).__name__)))
        raise SystemExit(1)
