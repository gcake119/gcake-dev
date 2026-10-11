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

def validate_site(site, dry=False):
    if site == SITE:
        return
    u = urlsplit(site)
    if dry and u.scheme == 'http' and u.hostname == '127.0.0.1' and not u.username and not u.password and not u.query and not u.fragment and site.endswith('/'):
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
    with urllib.request.build_opener(NoRedirect).open(req, timeout=20) as response:
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
    token = os.environ['TELEGRAM_BOT_TOKEN']
    chat = os.environ['TELEGRAM_CHAT_ID']
    if not re.fullmatch(r'\d+:[A-Za-z0-9_-]+', token) or not re.fullmatch(r'-?\d+', chat):
        raise ValueError('Invalid Telegram configuration')
    data = json.dumps({'chat_id': chat, 'text': message, 'disable_web_page_preview': True}).encode()
    req = urllib.request.Request('https://api.telegram.org/bot' + token + '/sendMessage', data=data,
                                 headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.build_opener(NoRedirect).open(req, timeout=20) as response:
        result = json.loads(response.read(65536))
        if not result.get('ok'):
            raise ValueError('Telegram response unsuccessful')

class Monitor:
    def __init__(self, db_path, site=SITE, fetcher=fetch, sender=telegram_send, live=False):
        validate_site(site, dry=not live)
        self.path, self.site, self.fetch, self.send, self.live = Path(db_path), site, fetcher, sender, live
    def statuses(self):
        with closing(sqlite3.connect(self.path)) as db:
            return dict(db.execute('SELECT url,status FROM outbox'))
    def poll(self, now=None):
        now = time.time() if now is None else now
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        if self.path.is_symlink() or Path(str(self.path)+'.lock').is_symlink():
            raise ValueError('Unsafe state path')
        os.umask(0o077)
        with open(str(self.path)+'.lock', 'a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with closing(sqlite3.connect(self.path)) as db, db:
                os.chmod(self.path, 0o600)
                db.execute('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
                db.execute('CREATE TABLE IF NOT EXISTS outbox (url TEXT PRIMARY KEY, guid TEXT, status TEXT NOT NULL)')
                meta = dict(db.execute('SELECT key,value FROM meta'))
                mode = 'live' if self.live else 'dry-run'
                if meta.get('mode', mode) != mode:
                    raise ValueError('Dry-run and live require separate databases')
                db.execute('INSERT OR IGNORE INTO meta VALUES (?,?)', ('mode', mode))
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
                        db.execute('INSERT INTO outbox VALUES (?,?,?)', (item['url'], item['guid'], 'uncertain' if self.live else 'verified-dry-run'))
                        db.commit()
                        if self.live:
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
    p.add_argument('--live', action='store_true')
    p.add_argument('--dry-run', action='store_true')
    p.add_argument('--status', action='store_true')
    args = p.parse_args()
    if args.live and args.dry_run:
        p.error('Choose live or dry-run')
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
    m = Monitor(db, args.site, live=args.live)
    if args.status:
        print(json.dumps(m.statuses(), ensure_ascii=False, indent=2))
    else:
        for message in m.poll():
            print(message if not args.live else 'Verified new article notification sent')

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # urllib errors can contain the bot token in the request URL; never print them.
        print('RSS check failed (' + type(error).__name__ + '); retry/backoff or inspect private outbox status')
        raise SystemExit(1)
