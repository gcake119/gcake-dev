#!/usr/bin/env python3
"""Hourly, single-owner RSS outbox. Defaults to dry-run; secrets stay in environment."""
import argparse
from contextlib import closing
from datetime import timezone, timedelta
from email.utils import parsedate_to_datetime
import fcntl
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sqlite3
import time
import urllib.request
from urllib.parse import urlsplit, urljoin
import xml.etree.ElementTree as ET

SITE = 'https://gcake119.github.io/gcake-dev/'
LIMIT = 8 * 1024 * 1024
MOCK_METHOD = 'bot0:TEST_ONLY/sendMessage'

def require_live_activation():
    if os.environ.get('HERMES_RSS_NOTIFY_ENABLED') != 'true':
        raise ValueError('Live notifications disabled')

def validate_loopback(url, api=False):
    if re.search(r'[\x00-\x20\x7f]', url):
        raise ValueError('URL control characters')
    u = urlsplit(url)
    if (u.scheme != 'http' or u.hostname != '127.0.0.1' or u.username or u.password
            or not u.port or u.netloc != f'127.0.0.1:{u.port}' or u.query or u.fragment
            or not re.fullmatch(r'/(?:[a-z0-9_-]+/)*', u.path)
            or (api and u.path != '/')):
        raise ValueError('Test transport requires explicit numeric IPv4 loopback and port')

def validate_site(site, dry=False):
    if site == SITE:
        return
    if dry:
        validate_loopback(site)
        return
    raise ValueError('Unapproved canonical site')

def canonical_url(url, site):
    if re.search(r'[\x00-\x20\x7f]', url):
        raise ValueError('URL control characters')
    u, base = urlsplit(url), urlsplit(site)
    prefix = base.path.rstrip('/') + '/posts/'
    if u.scheme != base.scheme or u.netloc != base.netloc or u.query or u.fragment or not re.fullmatch(re.escape(prefix) + r'[a-z0-9]+(?:-[a-z0-9]+)*/?', u.path):
        raise ValueError('Not a canonical local article URL')
    return url.rstrip('/') + '/'

def parse_feed(raw, site):
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError as error:
        raise ValueError('RSS must be UTF-8') from error
    if len(raw) > LIMIT or '\x00' in text or '<!DOCTYPE' in text.upper() or '<!ENTITY' in text.upper():
        raise ValueError('Unsafe RSS')
    root = ET.fromstring(text)
    if root.tag != 'rss' or root.find('channel') is None:
        raise ValueError('Invalid RSS channel')
    items = {}
    for item in root.findall('./channel/item'):
        try:
            url = canonical_url(item.findtext('link') or '', site)
        except ValueError:
            continue  # external iThome entries are not new local publications
        date = parsedate_to_datetime(item.findtext('pubDate') or '')
        if date.tzinfo is None:
            raise ValueError('RSS publication timezone missing')
        items[url] = dict(url=url, guid=item.findtext('guid') or url,
                          title=item.findtext('title') or url, date=date)
    return list(items.values())

class CanonicalParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
        self.revisions = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and 'canonical' in attrs.get('rel', '').lower().split():
            self.urls.append(attrs.get('href'))
        if tag == 'meta' and attrs.get('name') == 'gcake-source-revision':
            self.revisions.append(attrs.get('content'))

def verify_page(raw, expected, final_url, content_type, revision=None):
    if 'text/html' not in content_type.lower() or final_url.rstrip('/') != expected.rstrip('/'):
        raise ValueError('Article did not return canonical HTML')
    parser = CanonicalParser()
    parser.feed(raw.decode('utf-8'))
    if len(parser.urls) != 1 or parser.urls[0].rstrip('/') != expected.rstrip('/'):
        raise ValueError('Article canonical mismatch')
    if revision and parser.revisions != [revision]:
        raise ValueError('Article source revision mismatch')

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Unexpected HTTP redirect')

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'gcake-editorial-rss/1', 'Cache-Control': 'no-cache'})
    # A loopback fixture must not be sent through a configured external proxy.
    handlers = [NoRedirect]
    if urlsplit(url).hostname == '127.0.0.1':
        handlers.append(urllib.request.ProxyHandler({}))
    with urllib.request.build_opener(*handlers).open(req, timeout=20) as response:
        if response.status != 200:
            raise ValueError('Public URL unavailable')
        raw = response.read(LIMIT + 1)
        if len(raw) > LIMIT:
            raise ValueError('Public response too large')
        return raw, response.url, response.headers.get('Content-Type', '')

def verify_public(url, site=SITE, revision=None):
    expected = canonical_url(url, site)
    raw, final, _ = fetch(urljoin(site, 'rss.xml'))
    if final != urljoin(site, 'rss.xml'):
        raise ValueError('RSS redirected')
    if expected not in {item['url'] for item in parse_feed(raw, site)}:
        raise ValueError('Expected article absent from RSS')
    verify_page(*_page_args(expected), revision=revision)

def _page_args(url):
    raw, final, mime = fetch(url)
    return raw, url, final, mime

def telegram_send(message):
    require_live_activation()
    token = os.environ['TELEGRAM_BOT_TOKEN']
    chat = os.environ['TELEGRAM_CHAT_ID']
    if not re.fullmatch(r'\d+:[A-Za-z0-9_-]+', token) or not re.fullmatch(r'-?\d+', chat):
        raise ValueError('Invalid Telegram configuration')
    _telegram_request(message, 'https://api.telegram.org/bot' + token + '/sendMessage', chat)

def mock_telegram_sender(api):
    validate_loopback(api, api=True)
    return lambda message: _telegram_request(message, api + MOCK_METHOD, '0', mock=True)

def _telegram_request(message, url, chat, mock=False):
    if mock:
        if not url.endswith('/' + MOCK_METHOD) or chat != '0':
            raise ValueError('Invalid synthetic Telegram target')
        validate_loopback(url[:-len(MOCK_METHOD)], api=True)
    else:
        require_live_activation()
        u = urlsplit(url)
        if (u.scheme != 'https' or u.netloc != 'api.telegram.org' or u.query or u.fragment
                or not re.fullmatch(r'/bot\d+:[A-Za-z0-9_-]+/sendMessage', u.path)
                or not re.fullmatch(r'-?\d+', chat)):
            raise ValueError('Invalid production Telegram target')
    data = json.dumps({'chat_id': chat, 'text': message, 'disable_web_page_preview': True}).encode()
    req = urllib.request.Request(url, data=data,
                                 headers={'Content-Type': 'application/json'}, method='POST')
    handlers = [NoRedirect]
    if mock:
        handlers.append(urllib.request.ProxyHandler({}))
    with urllib.request.build_opener(*handlers).open(req, timeout=20) as response:
        raw = response.read(65537)
        if response.status != 200 or len(raw) > 65536:
            raise ValueError('Invalid Telegram response')
        result = json.loads(raw)
        if result.get('ok') is not True:
            raise ValueError('Telegram response unsuccessful')

class Monitor:
    def __init__(self, db_path, site=SITE, fetcher=fetch, sender=telegram_send, live=False, test_delivery=False, mock_api=None):
        if live:
            require_live_activation()
        if test_delivery:
            if live or sender is not telegram_send or not mock_api:
                raise ValueError('Test delivery requires its own fixed mock transport')
            validate_loopback(site)
            sender = mock_telegram_sender(mock_api)
        elif mock_api:
            raise ValueError('Mock API requires test delivery')
        validate_site(site, dry=not live)
        self.path, self.site, self.fetch, self.send, self.live = Path(db_path), site, fetcher, sender, live
        self.mode = 'test-delivery' if test_delivery else ('live' if live else 'dry-run')
        self.delivering = live or test_delivery
        self.check_state_path()
    def check_state_path(self):
        reserved = Path.home()/'.local/state/gcake-rss/live.sqlite'
        if not self.live and self.path.resolve() == reserved.resolve():
            raise ValueError('Default live state path is reserved')
        for file in (self.path, Path(str(self.path)+'.lock')):
            if file.is_symlink() or (file.exists() and file.stat().st_nlink != 1):
                raise ValueError('Unsafe state path')
    def read_existing_scope(self):
        # Do not mutate an incompatible DB even during setup or status inspection.
        with closing(sqlite3.connect(self.path.resolve().as_uri()+'?mode=ro', uri=True)) as db:
            self.bind_state(db)
    def bind_state(self, db, write=False):
        meta = dict(db.execute('SELECT key,value FROM meta'))
        if meta.get('mode', self.mode) != self.mode or meta.get('site', self.site) != self.site:
            raise ValueError('Notification modes and sites require separate databases')
        if 'initialized' in meta and 'site' not in meta and self.site != SITE:
            raise ValueError('Legacy state is only compatible with the production site')
        if write:
            db.execute('INSERT OR IGNORE INTO meta VALUES (?,?)', ('mode', self.mode))
            db.execute('INSERT OR IGNORE INTO meta VALUES (?,?)', ('site', self.site))
        return meta
    def statuses(self):
        self.check_state_path()
        with closing(sqlite3.connect(self.path.resolve().as_uri()+'?mode=ro', uri=True)) as db:
            self.bind_state(db)
            return dict(db.execute('SELECT url,status FROM outbox'))
    def poll(self, now=None):
        if self.live:
            require_live_activation()
        self.check_state_path()
        now = time.time() if now is None else now
        if self.path.exists():
            self.read_existing_scope()
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        if self.path.is_symlink() or Path(str(self.path)+'.lock').is_symlink():
            raise ValueError('Unsafe state path')
        os.umask(0o077)
        with open(str(self.path)+'.lock', 'a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.check_state_path()
            if self.path.exists():
                self.read_existing_scope()
            with closing(sqlite3.connect(self.path)) as db, db:
                os.chmod(self.path, 0o600)
                db.execute('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
                db.execute('CREATE TABLE IF NOT EXISTS outbox (url TEXT PRIMARY KEY, guid TEXT, status TEXT NOT NULL)')
                meta = self.bind_state(db, write=True)
                def put(key, value):
                    db.execute('INSERT OR REPLACE INTO meta VALUES (?,?)', (key, str(value)))
                if now < float(meta.get('next_check', 0)):
                    return []
                try:
                    raw, final, _ = self.fetch(urljoin(self.site, 'rss.xml'))
                    if final != urljoin(self.site, 'rss.xml'):
                        raise ValueError('RSS redirected')
                    items = parse_feed(raw, self.site)
                    if 'initialized' not in meta:
                        db.executemany('INSERT OR IGNORE INTO outbox VALUES (?,?,?)',
                                       [(i['url'], i['guid'], 'baseline') for i in items])
                        put('initialized', now)
                        put('failures', 0)
                        put('next_check', 0)
                        db.commit()
                        return []
                    messages = []
                    for item in sorted(items, key=lambda i: (i['date'], i['url'])):
                        if db.execute('SELECT 1 FROM outbox WHERE url=?', (item['url'],)).fetchone():
                            continue
                        raw, final, mime = self.fetch(item['url'])
                        verify_page(raw, item['url'], final, mime)
                        if item['date'].timestamp() > now:
                            raise ValueError('Future publication timestamp')
                        date = item['date'].astimezone(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M')
                        title = re.sub(r'[\x00-\x1f\x7f]', ' ', item['title'])[:500]
                        message = f'{title}\n{item["url"]}\n台北發佈時間：{date}'
                        # Persist uncertainty BEFORE network write: a lost reply never auto-resends.
                        db.execute('INSERT INTO outbox VALUES (?,?,?)', (item['url'], item['guid'], 'uncertain' if self.delivering else 'verified-dry-run'))
                        db.commit()
                        if self.delivering:
                            self.send(message)
                            db.execute('UPDATE outbox SET status=? WHERE url=?', ('sent', item['url']))
                            db.commit()
                        messages.append(message)
                    put('failures', 0)
                    put('next_check', 0)
                    db.commit()
                    return messages
                except Exception:
                    failures = int(meta.get('failures', 0)) + 1
                    put('failures', failures)
                    put('next_check', now + min(86400, 300 * 2 ** min(failures - 1, 9)))
                    db.commit()
                    raise

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--site', default=SITE)
    p.add_argument('--verify-url')
    p.add_argument('--revision')
    p.add_argument('--db')
    mode = p.add_mutually_exclusive_group()
    mode.add_argument('--live', action='store_true')
    mode.add_argument('--dry-run', action='store_true')
    mode.add_argument('--test-delivery', action='store_true', help='Loopback-only mock API; no real Telegram credentials')
    p.add_argument('--telegram-api', help='Explicit loopback mock API root; test-delivery only')
    p.add_argument('--status', action='store_true')
    args = p.parse_args()
    if args.test_delivery:
        if not args.db or not args.telegram_api or args.verify_url or args.revision:
            p.error('Test delivery requires explicit --db and --telegram-api, without verification-only options')
        validate_loopback(args.site)
        validate_loopback(args.telegram_api, api=True)
    elif args.telegram_api:
        p.error('--telegram-api requires --test-delivery')
    validate_site(args.site, dry=not args.live)
    if args.verify_url:
        verify_public(args.verify_url, args.site, args.revision)
        print('RSS and canonical HTML verified')
        return
    if args.live and os.environ.get('HERMES_RSS_NOTIFY_ENABLED') != 'true':
        p.error('Live notifications disabled; acceptance and HERMES_RSS_NOTIFY_ENABLED=true required')
    if args.live and (not os.environ.get('TELEGRAM_BOT_TOKEN') or not os.environ.get('TELEGRAM_CHAT_ID')):
        p.error('Private Telegram configuration missing')
    suffix = 'live' if args.live else 'dry-run'
    db = args.db or str(Path.home()/'.local/state/gcake-rss'/f'{suffix}.sqlite')
    m = Monitor(db, args.site, live=args.live, test_delivery=args.test_delivery, mock_api=args.telegram_api)
    if args.status:
        print(json.dumps(m.statuses(), ensure_ascii=False, indent=2))
    else:
        for message in m.poll():
            print('Verified test article notification sent to loopback mock API' if args.test_delivery
                  else ('Verified new article notification sent' if args.live else message))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # urllib errors can contain the bot token in the request URL; never print them.
        print('RSS check failed (' + type(error).__name__ + '); retry/backoff or inspect private outbox status')
        raise SystemExit(1)
