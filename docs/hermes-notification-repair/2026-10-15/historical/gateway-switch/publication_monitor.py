"""Hourly publication observer. Publication and delivery authorities remain separate."""
import argparse
from contextlib import closing
from datetime import datetime, timezone, timedelta
import fcntl
from html.parser import HTMLParser
import json
import math
import os
import re
import secrets
from pathlib import Path
import sqlite3
import stat
import tempfile
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit, urljoin
from rss_monitor import SITE, LIMIT, canonical_url, parse_feed, verify_page, validate_loopback, MOCK_METHOD

HOUR = 3600
TAIPEI = timezone(timedelta(hours=8))
CRON_KEYS = ('HERMES_CRON_JOB_ID','HERMES_CRON_EXECUTION_ID','HERMES_CRON_SCHEDULED_INSTANT')
GATEWAY_CREDENTIAL_FILE=Path('/Users/hermes/.hermes/.env')


def invocation_identity(value):
    if not isinstance(value,str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._:-]{0,127}',value):
        raise ValueError('Invalid cron invocation identity')
    return value


def scheduled_context(explicit, live, now):
    values=[os.environ.get(key) for key in CRON_KEYS]
    if live or any(value is not None for value in values):
        job,execution,scheduled=values
        job=invocation_identity(job);execution=invocation_identity(execution)
        at=instant(scheduled)
        if explicit is not None and instant(explicit)!=at:
            raise ValueError('Conflicting cron scheduled time')
    else:
        # Explicit fixture input is allowed only for local, isolated dry-run.
        job=execution=None;at=instant(explicit)
    if at>now or not math.isfinite(at):raise ValueError('Invalid scheduled round')
    return at,job,execution


class DeliveryRejected(Exception):
    """Transport has positively confirmed non-delivery; a later round may retry."""
    def __init__(self, rejection_reason='unspecified', error_code=None):
        allowed=('unspecified','notify_disabled','invalid_bot_token','invalid_chat_id','telegram_rejected',
                 'invalid_credential_source','gateway_credentials_unavailable','gateway_bot_identity_changed')
        self.rejection_reason=rejection_reason if rejection_reason in allowed else 'unspecified'
        self.error_code=error_code if type(error_code) is int else None
        super().__init__(self.rejection_reason)


def delivery_tables(db):
    db.execute('''CREATE TABLE IF NOT EXISTS monitor_delivery_attempts(
        attempt_id INTEGER PRIMARY KEY,event_id TEXT NOT NULL,status TEXT NOT NULL,
        attempted_at REAL NOT NULL,error_type TEXT,reason_type TEXT,
        error_code INTEGER,message_id INTEGER)''')
    if 'rejection_reason' not in {row[1] for row in db.execute('PRAGMA table_info(monitor_delivery_attempts)')}:
        db.execute('ALTER TABLE monitor_delivery_attempts ADD COLUMN rejection_reason TEXT')


def deliver_recorded(db, event_id, sender, message):
    """Journal intent before transport; never persist exception text or URLs."""
    delivery_tables(db)
    attempt = db.execute('INSERT INTO monitor_delivery_attempts(event_id,status,attempted_at) VALUES(?,?,?)',
                         (event_id,'intent',time.time())).lastrowid
    db.commit()
    error_type=reason_type=error_code=message_id=rejection_reason=None
    try:
        ack=sender(message) if sender is not None else None
        message_id=ack if type(ack) is int else None
        status='sent' if sender is not None else 'verified-dry-run'
    except Exception as error:
        status='rejected' if isinstance(error,DeliveryRejected) else 'unknown'
        if isinstance(error,DeliveryRejected):rejection_reason=error.rejection_reason
        # Fixed vocabulary: even custom exception class names can contain secrets.
        allowed=('DeliveryRejected','TimeoutError','URLError','HTTPError','OSError',
                 'ConnectionError','ConnectionResetError','BrokenPipeError',
                 'JSONDecodeError','ValueError','UnicodeDecodeError')
        error_type=type(error).__name__ if type(error).__name__ in allowed else 'Exception'
        reason=getattr(error,'reason',None)
        reason_type=type(reason).__name__ if type(reason).__name__ in allowed else None
        code=error.error_code if isinstance(error,DeliveryRejected) else error.code if isinstance(error,urllib.error.HTTPError) else getattr(reason if isinstance(reason,OSError) else error,'errno',None)
        error_code=code if type(code) is int else None
    db.execute('UPDATE monitor_delivery_attempts SET status=?,error_type=?,reason_type=?,error_code=?,message_id=?,rejection_reason=? WHERE attempt_id=?',
               (status,error_type,reason_type,error_code,message_id,rejection_reason,attempt))
    # The caller updates event/outbox in this same completion transaction.
    return status


def delivery_health(path):
    with closing(sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro',uri=True)) as db:
        has_events=db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='monitor_events'").fetchone()
        ids={row[0] for row in db.execute("SELECT event_id FROM monitor_events WHERE status IN ('intent','unknown','rejected')")} if has_events else set()
        ids.update('article:'+row[0] for row in db.execute("SELECT url FROM outbox WHERE status='uncertain'"))
        return len(ids)


def instant(value):
    if not isinstance(value, str):
        raise ValueError('Timestamp missing')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('Explicit timezone required')
    return result.timestamp()


def taipei(value):
    return datetime.fromtimestamp(value, TAIPEI).strftime('%Y-%m-%d %H:%M')


def summary_articles(observation):
    summary = observation.get('summary')
    if not isinstance(summary, dict) or summary.get('schemaVersion') != 1 or summary.get('complete') is not True:
        raise ValueError('Incomplete authority')
    start, end = observation['window']
    request_id=observation.get('requestId')
    skew=0
    if request_id is not None:
        if not re.fullmatch(r'[0-9a-f]{32}',request_id) or summary.get('requestId')!=request_id:
            raise ValueError('Authority request mismatch')
        skew=5
    if not start-skew <= instant(summary['generatedAt']) <= end+skew:
        raise ValueError('Stale authority')
    if not summary.get('gitRevision') or type(summary.get('queueVersion')) is not int or summary['queueVersion'] < 0:
        raise ValueError('Source metadata missing')
    articles = summary.get('articles')
    if not isinstance(articles, list) or len(articles) > 10000:
        raise ValueError('Incomplete catalogue')
    seen = set()
    for row in articles:
        if not isinstance(row, dict):
            raise ValueError('Invalid catalogue entry')
        url = canonical_url(row['canonicalUrl'], SITE)
        if url in seen or row['articleId'] != url.rstrip('/').rsplit('/', 1)[1]:
            raise ValueError('Invalid catalogue identity')
        seen.add(url)
        if row.get('kind') not in ('series', 'standalone') or row.get('scheduleState') not in ('confirmed','estimate-only','unscheduled','paused','cancelled','unknown'):
            raise ValueError('Invalid classification')
        if row['scheduleState'] == 'confirmed':
            if not isinstance(row.get('commitment'), dict):
                raise ValueError('Invalid commitment')
            if not isinstance(row['commitment'].get('identity'), str) or not row['commitment']['identity']:
                raise ValueError('Commitment identity missing')
            instant(row['commitment']['scheduledAt'])
        elif 'commitment' in row:
            raise ValueError('Unconfirmed commitment')
    return articles


def evidence(row, item, page, now):
    """Only explicit 404/410 is absence; a matching page without RSS is inconsistent."""
    url = row['canonicalUrl']
    if not isinstance(page, dict):
        return 'unknown'
    if page.get('status') in (404, 410):
        return 'absent' if item is None else 'inconsistent'
    if page.get('status') != 200 or page.get('canonicalUrl') != url:
        return 'unknown'
    try:
        date = instant(page['publishedAt'])
        if date > now:
            return 'inconsistent'
        if item is not None and canonical_url(item['url'], SITE) == url and item['guid'] in (url, url.rstrip('/')) and instant(item['publishedAt']) == date:
            return 'public'
    except (ValueError, KeyError, TypeError):
        return 'unknown'
    return 'inconsistent'


class PublicationMonitor:
    def __init__(self, db, observer, sender=None, mode='dry-run'):
        if mode not in ('live', 'dry-run', 'test'):
            raise ValueError('Unknown mode')
        self.path = Path(db).resolve()
        self.observer, self.sender, self.mode = observer, sender, mode
        reserved = Path.home()/'.local/state/gcake-rss/live.sqlite'
        if mode == 'test' and (self.path == reserved.resolve() or self.path.is_relative_to(Path('/Users/hermes'))):
            raise ValueError('Test transport cannot open production state')
        if mode == 'live' and (sender is not send_notification or os.environ.get('HERMES_RSS_NOTIFY_ENABLED') != 'true'):
            raise ValueError('Live activation missing')
        self.original = Path(db)

    def _validate_path(self):
        for path in (self.original, Path(str(self.original)+'.lock')):
            if path.is_symlink() or (path.exists() and path.stat().st_nlink != 1):
                raise ValueError('Unsafe state path')

    def _open(self):
        self._validate_path()
        if not self.path.exists():
            if self.mode != 'test':
                raise ValueError('Missing state: explicit initialization required')
            self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            with closing(sqlite3.connect(self.path)) as db, db:
                db.executescript('CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE outbox(url TEXT PRIMARY KEY,guid TEXT,status TEXT NOT NULL);')
                db.executemany('INSERT INTO meta VALUES(?,?)',[('mode','live'),('site',SITE)])
            os.chmod(self.path,0o600)
        with closing(sqlite3.connect(self.path.as_uri()+'?mode=ro',uri=True)) as db:
            columns = {table: [r[1] for r in db.execute('PRAGMA table_info('+table+')')] for table in ('meta','outbox')}
            if columns != {'meta':['key','value'], 'outbox':['url','guid','status']}:
                raise ValueError('Unrecognized state schema')
            meta = dict(db.execute('SELECT key,value FROM meta'))
            for key in ('initialized','next_check','monitor_last_round'):
                if key in meta:
                    value = float(meta[key])
                    if not math.isfinite(value) or value < 0:
                        raise ValueError('Corrupt observation marker')
            if 'failures' in meta and (not meta['failures'].isdigit() or int(meta['failures']) < 0):
                raise ValueError('Corrupt failure counter')
            if 'initialized' not in meta and db.execute('SELECT COUNT(*) FROM outbox').fetchone()[0]:
                raise ValueError('Missing historical baseline marker')
            if meta.get('site', SITE) != SITE or meta.get('mode','live') not in ('live','dry-run'):
                raise ValueError('Incompatible state scope')
            if self.mode == 'live' and meta.get('mode','live') != 'live':
                raise ValueError('Live and dry state must stay separate')
        return meta

    def run_round(self, round_at, now, *, job_id=None, execution_id=None):
        if not all(isinstance(v, (int,float)) and math.isfinite(v) for v in (round_at,now)) or round_at > now:
            raise ValueError('Invalid scheduled round')
        if job_id is not None or execution_id is not None:
            invocation_identity(job_id);invocation_identity(execution_id)
        elif self.mode=='live':
            raise ValueError('Live monitoring requires scheduler identity')
        if self.mode == 'dry-run':
            self._open()
            # A consistent ro backup sees committed WAL and never consumes live identities.
            with tempfile.TemporaryDirectory(prefix='gcake-monitor-dry-') as tmp:
                target = Path(tmp)/'state.sqlite'
                with closing(sqlite3.connect(self.path.as_uri()+'?mode=ro',uri=True)) as source, closing(sqlite3.connect(target)) as copy:
                    source.backup(copy)
                    # Backup can inherit WAL mode. The private copy needs no WAL;
                    # DELETE permits older SQLite read-only opens without SHM.
                    copy.execute('PRAGMA journal_mode=DELETE')
                simulation = PublicationMonitor(target,self.observer,sender=None,mode='test')
                return simulation.run_round(round_at,now,job_id=job_id,execution_id=execution_id)
        self._open()
        with open(str(self.path)+'.lock','a') as lock:
            os.chmod(str(self.path)+'.lock',0o600)
            try:
                fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            except BlockingIOError:
                return []
            self._open()
            with closing(sqlite3.connect(self.path)) as db:
                return self._round(db,round_at,now,job_id,execution_id)

    def _round(self, db, round_at, now, job_id, execution_id):
        meta = dict(db.execute('SELECT key,value FROM meta'))
        bound_job=meta.get('monitor_job_id')
        if bound_job is not None and bound_job!=job_id:
            raise ValueError('State belongs to another scheduler job')
        if execution_id is not None and db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='monitor_invocations'").fetchone():
            old=db.execute('SELECT job_id,round_at FROM monitor_invocations WHERE execution_id=?',(execution_id,)).fetchone()
            if old is not None and old!=(job_id,round_at):
                raise ValueError('Execution identity reused for another occurrence')
        db.executescript('''
            CREATE TABLE IF NOT EXISTS monitor_events(event_id TEXT PRIMARY KEY,kind TEXT NOT NULL,url TEXT,message TEXT NOT NULL,status TEXT NOT NULL,human_received INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS monitor_items(item TEXT PRIMARY KEY,bad INTEGER NOT NULL,good INTEGER NOT NULL,episode INTEGER NOT NULL,active INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS monitor_commitments(url TEXT PRIMARY KEY,identity TEXT,scheduled_at TEXT,episode INTEGER NOT NULL,state TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS monitor_invocations(execution_id TEXT PRIMARY KEY,job_id TEXT NOT NULL,round_at REAL NOT NULL);
        ''')
        if job_id is not None:
            db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)',('monitor_job_id',job_id))
            db.execute('INSERT OR IGNORE INTO monitor_invocations VALUES(?,?,?)',(execution_id,job_id,round_at))
        previous = float(meta.get('monitor_last_round','-inf'))
        if round_at <= previous:
            db.commit()
            return []
        if previous != float('-inf') and not HOUR <= round_at-previous < 2*HOUR:
            db.execute('UPDATE monitor_items SET bad=0,good=0')
        # A process interrupted after sending can never safely replay its intent.
        db.execute("UPDATE monitor_events SET status='unknown' WHERE status='intent'")
        try:
            observation = self.observer(now)
        except Exception:
            observation = dict(summary=None,feed=None,pages={})
        try:
            articles = summary_articles(observation)
            summary_ok = True
        except (ValueError,KeyError,TypeError):
            articles, summary_ok = [], False
        feed = observation.get('feed')
        feed_ok = isinstance(feed,list)
        by_url = {}
        if feed_ok:
            try:
                for item in feed:
                    url = canonical_url(item['url'],SITE)
                    instant(item['publishedAt'])
                    if url in by_url:
                        raise ValueError('Duplicate feed identity')
                    by_url[url] = item
            except (ValueError,TypeError,KeyError):
                feed_ok = False
        if not summary_ok:
            db.execute("UPDATE monitor_items SET bad=0,good=0 WHERE item LIKE 'article:%'")
        known = set(json.loads(meta.get('monitor_known_articles','[]')))
        if summary_ok:
            current = {row['canonicalUrl'] for row in articles}
            db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)',('monitor_unknown_articles',json.dumps(sorted(known-current))))
            db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)',('monitor_known_articles',json.dumps(sorted(known|current))))
        pages = observation.get('pages',{})
        complete = summary_ok and feed_ok and set(by_url).issubset({a['canonicalUrl'] for a in articles})
        if 'initialized' not in meta:
            baseline = []
            for row in articles:
                url = row['canonicalUrl']
                state = evidence(row,by_url.get(url),pages.get(url),now)
                if state == 'public':
                    baseline.append((url,by_url[url]['guid'],'baseline'))
                elif state != 'absent':
                    complete = False
            if complete:
                db.executemany('INSERT OR IGNORE INTO outbox VALUES(?,?,?)',baseline)
                db.execute('INSERT INTO meta VALUES(?,?)',('initialized',str(now)))
            db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)',('monitor_last_round',str(round_at)))
            db.commit()
            return []
        events = []
        recoveries = []
        observed_health = {'RSS':feed_ok, 'summary':summary_ok}
        for name, healthy in [('RSS',feed_ok),('summary',summary_ok)]:
            event = self._streak(db,name,healthy)
            if event:
                recoveries.append(event)
        for row in articles:
            url = row['canonicalUrl']
            episode = self._commitment(db,row)
            item = by_url.get(url) if feed_ok else None
            state = evidence(row,item,pages.get(url),now) if feed_ok else 'unknown'
            observed_health['article:'+url] = state == 'public'
            due = row['scheduleState']=='confirmed' and now >= instant(row['commitment']['scheduledAt'])+HOUR
            monitored = bool(item) or due
            recovery = self._streak(db,'article:'+url,state=='public',observed=monitored and feed_ok) if monitored else self._streak(db,'article:'+url,False,observed=False)
            if state == 'public':
                publication_id = 'article:'+url
                managed = db.execute('SELECT status FROM monitor_events WHERE event_id=?',(publication_id,)).fetchone()
                historical = db.execute('SELECT status FROM outbox WHERE url=?',(url,)).fetchone()
                blocked = historical and not (managed and managed[0]=='rejected')
                if not blocked:
                    late = db.execute("SELECT 1 FROM monitor_events WHERE event_id=? AND status='sent'",('overdue:'+url+':'+str(episode),)).fetchone() if episode is not None else None
                    title = ''.join(c if ord(c)>=32 and ord(c)!=127 else ' ' for c in item['title'])[:500]
                    message = title+'\n'+url+'\n台北發布時間：'+taipei(instant(item['publishedAt']))
                    if late:
                        message += '\n逾期已解除：本輪 RSS 與正式頁面已確認公開。'
                    events.append((publication_id,'article',url,message))
                    # The publication message consumes this item's pending evidence recovery.
                    db.execute('UPDATE monitor_items SET active=0,bad=0,good=0 WHERE item=?',('article:'+url,))
                    recovery = None
            elif due and state == 'absent' and feed_ok and complete:
                key = 'overdue:'+url+':'+str(episode)
                events.append((key,'overdue',url,'逾期尚未公開：'+row['articleId']+'\n'+url+'\n正式時間（台北）：'+taipei(instant(row['commitment']['scheduledAt']))+'\n查核時間（台北）：'+taipei(now)))
            if recovery:
                recoveries.append(recovery)
        existing_keys = {event[0] for event in events}
        for key,kind,url,message in db.execute("SELECT event_id,kind,url,message FROM monitor_events WHERE status='rejected' AND kind='recovery'"):
            item_name = key.rsplit(':',1)[0][len('recovery:'):]
            if observed_health.get(item_name) and key not in existing_keys:
                events.append((key,kind,url,message))
        if recoveries:
            # Independent source episodes remain individually durable even when grouped.
            for key,name in recoveries:
                events.append((key,'recovery',None,'恢復：'+name+'，最近連續兩輪查核正常（非兩輪間持續健康保證）。'))
        db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)',('monitor_last_round',str(round_at)))
        db.commit()
        delivered = []
        for key,kind,url,message in events:
            prior = db.execute('SELECT status FROM monitor_events WHERE event_id=?',(key,)).fetchone()
            if prior and prior[0] != 'rejected':
                continue
            db.execute('INSERT OR REPLACE INTO monitor_events(event_id,kind,url,message,status,human_received) VALUES(?,?,?,?,?,0)',(key,kind,url,message,'intent'))
            if kind == 'article':
                db.execute('INSERT OR IGNORE INTO outbox VALUES(?,?,?)',(url,by_url[url]['guid'],'uncertain'))
            db.commit()
            status = deliver_recorded(db,key,self.sender,message)
            db.execute('UPDATE monitor_events SET status=? WHERE event_id=?',(status,key))
            if kind=='article' and status in ('sent','verified-dry-run'):
                db.execute('UPDATE outbox SET status=? WHERE url=?',(status,url))
            db.commit()
            if status in ('sent','verified-dry-run'):
                delivered.append(message)
        return delivered

    def _streak(self, db, item, healthy, observed=True):
        record = db.execute('SELECT bad,good,episode,active FROM monitor_items WHERE item=?',(item,)).fetchone() or (0,0,0,0)
        bad,good,episode,active = record
        event = None
        if not observed:
            bad=good=0
        elif healthy:
            bad=0
            good = good+1 if active else 0
            if active and good>=2:
                active=0;good=0
                event=('recovery:'+item+':'+str(episode),item)
        else:
            good=0;bad+=1
            if bad>=2 and not active:
                active=1;episode+=1
        db.execute('INSERT OR REPLACE INTO monitor_items VALUES(?,?,?,?,?)',(item,bad,good,episode,active))
        return event

    def _commitment(self, db, row):
        url,state = row['canonicalUrl'],row['scheduleState']
        old = db.execute('SELECT identity,scheduled_at,episode,state FROM monitor_commitments WHERE url=?',(url,)).fetchone()
        if state=='confirmed':
            identity,at = row['commitment']['identity'],row['commitment']['scheduledAt']
            changed = not old or old[0]!=identity or instant(old[1])!=instant(at) or old[3]=='cancelled'
            episode = (old[2]+1 if old else 1) if changed else old[2]
            db.execute('INSERT OR REPLACE INTO monitor_commitments VALUES(?,?,?,?,?)',(url,identity,at,episode,state))
            return episode
        if old and state in ('paused','cancelled'):
            db.execute('UPDATE monitor_commitments SET state=? WHERE url=?',(state,url))
            return None
        return old[2] if old and old[3] != 'cancelled' else None


class PageMetadata(HTMLParser):
    def __init__(self):
        super().__init__();self.script=False;self.text=[];self.dates=[]

    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='script' and attrs.get('type')=='application/ld+json':
            self.script=True;self.text=[]

    def handle_data(self,data):
        if self.script:self.text.append(data)

    def handle_endtag(self,tag):
        if tag=='script' and self.script:
            self.script=False
            self._dates(json.loads(''.join(self.text)))

    def _dates(self,value):
        if isinstance(value,list):
            for item in value:self._dates(item)
        elif isinstance(value,dict):
            if value.get('@type') in ('BlogPosting','Article') and isinstance(value.get('datePublished'),str):
                self.dates.append(value['datePublished'])
            if '@graph' in value:self._dates(value['@graph'])


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args):
        raise ValueError('Redirect refused')


class PublicationObserver:
    def __init__(self, summary_url, secret, opener=None, sleep=time.sleep, clock=time.time, allow_loopback=False):
        u=urlsplit(summary_url)
        loopback=allow_loopback and u.scheme=='http' and u.hostname=='127.0.0.1' and u.port
        if not (loopback or u.scheme=='https') or u.username or u.password or u.query or u.fragment or u.path!='/api/v1/monitoring/publications':
            raise ValueError('Restricted summary URL required')
        self.url,self.secret=summary_url,secret
        self.open=opener or urllib.request.build_opener(NoRedirect,urllib.request.ProxyHandler({})).open
        self.sleep,self.clock=sleep,clock

    def _get(self,url,authorization=None,request_id=None):
        headers={'Cache-Control':'no-cache','User-Agent':'gcake-publication-monitor/1'}
        if request_id is not None:headers['X-Gcake-Observation-Id']=request_id
        if authorization:headers['Authorization']='Bearer '+authorization
        for attempt in range(3):
            try:
                with self.open(urllib.request.Request(url,headers=headers),timeout=20) as response:
                    if response.url!=url:raise ValueError('Redirect refused')
                    raw=response.read(LIMIT+1)
                    if len(raw)>LIMIT:raise ValueError('Response bound')
                    return raw,response.headers.get('Content-Type','')
            except urllib.error.HTTPError as error:
                error.close()
                if error.code not in (429,500,502,503,504) or attempt==2:raise
            except (OSError,TimeoutError):
                if attempt==2:raise
            self.sleep((2,5)[attempt])

    def __call__(self, now):
        result={'summary':None,'feed':None,'pages':{}}
        result['requestId']=secrets.token_hex(16)
        start=self.clock()
        try:
            raw,_=self._get(self.url,self.secret,result['requestId'])
            result['summary']=json.loads(raw)
        except Exception:
            pass
        result['window']=[start,self.clock()]
        try:
            raw,_=self._get(urljoin(SITE,'rss.xml'))
            result['feed']=[dict(url=item['url'],guid=item['guid'],title=item['title'],publishedAt=item['date'].isoformat()) for item in parse_feed(raw,SITE)]
        except Exception:
            pass
        try:
            articles=summary_articles(result)
        except (ValueError,TypeError,KeyError):
            articles=[]
        for row in articles:
            url=row['canonicalUrl']
            try:
                raw,mime=self._get(url)
                verify_page(raw,url,url,mime)
                parser=PageMetadata();parser.feed(raw.decode('utf-8'))
                if len(parser.dates)!=1:raise ValueError('Publication metadata missing')
                result['pages'][url]=dict(status=200,canonicalUrl=url,publishedAt=parser.dates[0])
            except urllib.error.HTTPError as error:
                result['pages'][url]=dict(status=error.code)
            except Exception:
                result['pages'][url]=dict(status=0)
        return result


def _send_delivery(message, url, chat):
    request = urllib.request.Request(url, data=json.dumps({'chat_id':chat,'text':message,'disable_web_page_preview':True}).encode(), headers={'Content-Type':'application/json'}, method='POST')
    opener = urllib.request.build_opener(NoRedirect,urllib.request.ProxyHandler({}))
    try:
        with opener.open(request,timeout=20) as response:
            raw=response.read(65537)
    except urllib.error.HTTPError as error:
        try:raw=error.read(65537)
        finally:error.close()
    if len(raw)>65536:raise ValueError('Delivery response bound')
    result=json.loads(raw)
    if isinstance(result,dict) and result.get('ok') is False and type(result.get('error_code')) is int:
        raise DeliveryRejected('telegram_rejected',result['error_code'])
    if not isinstance(result,dict) or result.get('ok') is not True or not isinstance(result.get('result'),dict) or type(result['result'].get('message_id')) is not int:
        raise ValueError('Uncertain acknowledgement')
    return result['result']['message_id']


def send_notification(message):
    readiness,token,chat=_notification_configuration()
    if readiness['rejection_reason'] is not None:
        raise DeliveryRejected(readiness['rejection_reason'])
    return _send_delivery(message,'https://api.telegram.org/bot'+token+'/sendMessage',chat)


def gateway_token():
    """Read one unique literal credential; never execute/import other settings."""
    try:
        fd=os.open(GATEWAY_CREDENTIAL_FILE,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
        with os.fdopen(fd,'rb') as stream:
            info=os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_nlink!=1 or info.st_uid not in (0,os.geteuid()) or info.st_mode&0o077:
                raise ValueError('private-owner-source-required')
            raw=stream.read(1024*1024+1)
        if len(raw)>1024*1024:raise ValueError('source-too-large')
        lines=re.findall(r'^[ \t]*(?:export[ \t]+)?TELEGRAM_BOT_TOKEN[ \t]*=[ \t]*(.*)$',raw.decode('utf-8-sig'),re.MULTILINE)
        if len(lines)!=1:raise ValueError('unique-token-required')
        token_pattern=r'(\d+:[A-Za-z0-9_-]+)'
        value=re.fullmatch(r'(?:'+token_pattern+'|"'+token_pattern+'"|\''+token_pattern+r"\')[ \t]*(?:#.*)?",lines[0].rstrip('\r'))
        if value is None:raise ValueError('literal-token-required')
        return next(group for group in value.groups() if group is not None)
    except (OSError,ValueError,UnicodeError):
        raise DeliveryRejected('gateway_credentials_unavailable') from None


def _notification_configuration():
    enabled=os.environ.get('HERMES_RSS_NOTIFY_ENABLED')=='true'
    token,chat=os.environ.get('TELEGRAM_BOT_TOKEN',''),os.environ.get('TELEGRAM_CHAT_ID','')
    source=os.environ.get('HERMES_RSS_TELEGRAM_CREDENTIAL_SOURCE','legacy')
    source_error=None
    if source not in ('legacy','gateway'):
        token='';source_error='invalid_credential_source'
    elif source=='gateway':
        token=''
        if enabled:
            try:
                token=gateway_token()
                expected=os.environ.get('HERMES_RSS_TELEGRAM_EXPECTED_BOT_ID','')
                if not re.fullmatch(r'\d{1,20}',expected) or int(token.split(':',1)[0])!=int(expected):
                    token='';source_error='gateway_bot_identity_changed'
            except DeliveryRejected as error:source_error=error.rejection_reason
    token_ok=bool(re.fullmatch(r'\d+:[A-Za-z0-9_-]+',token))
    chat_ok=bool(re.fullmatch(r'-?\d+',chat))
    reason='notify_disabled' if not enabled else 'invalid_bot_token' if not token_ok else 'invalid_chat_id' if not chat_ok else None
    if enabled and source_error is not None:reason=source_error
    report=dict(notify_enabled=enabled,bot_token_valid=token_ok,chat_id_valid=chat_ok,rejection_reason=reason)
    if source!='legacy':report['credential_source']=source
    return report,token,chat


def notification_readiness():
    """No transport calls; return no credential or recipient values."""
    return _notification_configuration()[0]


def mock_delivery(api):
    validate_loopback(api,api=True)
    return lambda message:_send_delivery(message,api+MOCK_METHOD,'0')


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--db',required=True)
    parser.add_argument('--round-at',help='Explicit local dry-run time; if scheduler context exists it must match')
    parser.add_argument('--live',action='store_true')
    args=parser.parse_args()
    now=time.time()
    round_at,job_id,execution_id=scheduled_context(args.round_at,args.live,now)
    observer=PublicationObserver(os.environ['PUBLICATION_MONITOR_SUMMARY_URL'],os.environ['PUBLICATION_MONITOR_READ_SECRET'])
    monitor=PublicationMonitor(args.db,observer,sender=send_notification if args.live else None,mode='live' if args.live else 'dry-run')
    result=monitor.run_round(round_at,now,job_id=job_id,execution_id=execution_id)
    unresolved=delivery_health(args.db) if args.live else 0
    report={'evaluated_messages':len(result),'mode':monitor.mode}
    if args.live:report['unresolved_notifications']=unresolved
    print(json.dumps(report))
    return 1 if unresolved else 0


if __name__=='__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({'error_type':type(error).__name__}))
        raise SystemExit(1)
