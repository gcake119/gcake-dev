#!/usr/bin/env python3
"""Deterministic, unauthenticated GET-only verifier. No publishing or repair capability."""
import argparse
import contextlib
import datetime as dt
import email.utils
import html.parser
import http.client
import json
import hashlib
import re
import signal
import os
import subprocess
import tempfile
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass

RAW = 'https://raw.githubusercontent.com/gcake119/gcake-dev/'
WEB = 'https://github.com/gcake119/gcake-dev'
SLUG = 'ithome-2026-chatgpt-writing-workflow'
TITLE = '我是怎麼跟 ChatGPT 協作寫完 30 篇系列文的'
POST = 'src/content/posts/ithome-2026-extensions/' + SLUG + '.md'
MANIFEST = 'src/content/series/ithome-2026-extensions.yaml'
EARLIEST = '2026-10-12T07:00:00+08:00'
GIT_URL = WEB + '.git'
RUN_LIST = WEB + '/actions/workflows/editorial-release.yml'
DEPLOY_LIST = WEB + '/deployments'
PAGES_RUN_LIST = WEB + '/actions/workflows/deploy-pages.yml'
PAGES_WORKFLOW_HASH = '5bc44c7c70ecb2ce1698b1ab8125cf15ac2f3c56eda06dc8ca5533c00bae0373'
SOURCE_PATHS = {POST, MANIFEST, '.github/workflows/deploy-pages.yml', 'astro.config.mjs', 'src/data/site.ts', 'src/lib/content/catalog.ts', 'src/pages/rss.xml.ts', 'src/content.config.ts', 'src/lib/content/local-posts.ts'}
SHA = re.compile(r'^[a-f0-9]{40}$')
LIMIT = 6 * 1024 * 1024


@dataclass(frozen=True)
class Response:
    status: int
    body: str


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_): return None


@contextlib.contextmanager
def hard_request_timeout(seconds):
    """POSIX request wall-clock timer; isolated main process, never replace an existing timer."""
    if seconds <= 0 or signal.getitimer(signal.ITIMER_REAL)[0]:
        raise ValueError('invalid or already active request timer')
    previous = signal.getsignal(signal.SIGALRM)
    def expired(_signum, _frame): raise TimeoutError('public request deadline')
    signal.signal(signal.SIGALRM, expired)
    signal.setitimer(signal.ITIMER_REAL, min(15, seconds))
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)


class PublicReader:
    """Fixed route allowlist, no credentials, proxies, redirects or write requests."""
    def __init__(self):
        self.site = None
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def allow_site(self, site):
        u = urllib.parse.urlsplit(site)
        if u.scheme != 'https' or u.netloc != 'gcake119.github.io' or u.query or u.fragment or u.path != '/gcake-dev':
            raise ValueError('unapproved site')
        self.site = site

    def __call__(self, url, timeout):
        u = urllib.parse.urlsplit(url)
        if u.scheme != 'https' or u.username or u.password or u.fragment:
            raise ValueError('unsafe public URL')
        allowed = url in (RUN_LIST, PAGES_RUN_LIST, DEPLOY_LIST)
        if url.startswith(WEB + '/'):
            suffix = url[len(WEB):]
            allowed |= bool(re.fullmatch(r'/actions/runs/[1-9][0-9]*(?:/job/[1-9][0-9]*)?|/commit/[a-f0-9]{40}/checks/[1-9][0-9]*/logs/[1-9][0-9]{0,2}', suffix))
        if url.startswith(RAW):
            parts = url[len(RAW):].split('/', 1)
            allowed |= len(parts) == 2 and bool(SHA.fullmatch(parts[0])) and parts[1] in SOURCE_PATHS
        if self.site:
            allowed |= url in (self.site + '/posts/' + SLUG + '/', self.site + '/rss.xml')
        if not allowed:
            raise ValueError('route outside read-only allowlist')
        request = urllib.request.Request(url, headers={'User-Agent': 'gcake-public-release-acceptance/2', 'Accept': 'text/html,application/xml;q=0.9,*/*;q=0.8'}, method='GET')
        try:
            with hard_request_timeout(timeout), self.opener.open(request, timeout=min(15, timeout)) as response:
                if 'json' in getattr(response, 'headers', {}).get('Content-Type', '').lower(): raise ValueError('JSON API response prohibited')
                body = response.read(LIMIT + 1)
                if len(body) > LIMIT: raise ValueError('public response too large')
                return Response(response.status, body.decode('utf-8'))
        except urllib.error.HTTPError as error:
            # Do not print, parse or forward error response bodies.
            return Response(error.code, '')


class PublicGit:
    """One bounded public fetch; no host Git config, checkout, hooks, helpers or LFS."""
    def __init__(self, deadline, monotonic=time.monotonic):
        self.deadline = deadline; self.monotonic = monotonic; self.tmp = None
    def __enter__(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='gcake-public-evidence-')
        self.path = Path(self.tmp.name) / 'snapshot.git'
        self.home = Path(self.tmp.name) / 'home'; self.home.mkdir()
        try:
            self.command('init', '--bare', str(self.path), repository=False)
            self.command('fetch', '--no-tags', '--depth=200', GIT_URL, 'refs/heads/main')
            return self
        except BaseException:
            self.tmp.cleanup(); raise
    def __exit__(self, *_): self.tmp.cleanup()
    def command(self, *args, repository=True):
        remaining = self.deadline - self.monotonic()
        if remaining <= 0: raise EvidenceUnavailable('公開Git查核已到時間上限')
        env = {'PATH': '/usr/bin:/bin', 'HOME': str(self.home), 'LC_ALL': 'en_US.UTF-8',
               'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null',
               'GIT_TERMINAL_PROMPT': '0', 'GIT_ASKPASS': '/usr/bin/false'}
        command = ['/usr/bin/git', '-c', 'credential.helper=', '-c', 'http.proxy=',
                   '-c', 'http.followRedirects=false', '-c', 'core.hooksPath=/dev/null',
                   '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always']
        if repository: command += ['--git-dir=' + str(self.path)]
        process = subprocess.Popen(command + list(args), env=env, cwd=self.tmp.name,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        try:
            stdout, _ = process.communicate(timeout=min(45, remaining))
        except BaseException:
            try: os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError: pass
            process.communicate()
            raise
        if process.returncode or len(stdout) > LIMIT:
            raise EvidenceUnavailable('公開Git無法讀取或輸出超過上限；未使用憑證')
        return stdout.decode('utf-8')

    def history(self):
        # A shallow boundary after the earliest date means history is incomplete.
        tip = self.command('rev-parse', 'FETCH_HEAD').strip()
        if not SHA.fullmatch(tip): raise EvidenceUnavailable('公開Git SHA不合法')
        shallow = self.path / 'shallow'
        if shallow.exists():
            for sha in shallow.read_text().splitlines():
                if instant(self.command('show', '-s', '--format=%cI', sha).strip()) >= instant(EARLIEST):
                    raise EvidenceUnavailable('公開Git歷史截斷，不能證明唯一發布提交')
        shas = self.command('log', 'FETCH_HEAD', '--since=2026-10-11T23:00:00Z', '--format=%H', '--', POST).splitlines()
        if len(shas) > 12: raise EvidenceUnavailable('提交候選超過查核上限')
        result = []
        for sha in shas:
            values = self.command('show', '-s', '--format=%H%x00%P%x00%cI%x00%an%x00%ae%x00%B', sha).split('\x00', 5)
            if len(values) != 6 or not SHA.fullmatch(values[0]): raise EvidenceUnavailable('公開Git提交格式不合法')
            result.append({'sha': values[0], 'parent': values[1], 'date': values[2], 'author': values[3], 'email': values[4], 'message': values[5].strip(),
                           'files': self.command('diff-tree', '--no-commit-id', '--name-only', '-r', sha).splitlines()})
        return tip, result
    def source(self, sha, path):
        if not SHA.fullmatch(sha) or path not in SOURCE_PATHS: raise ValueError('unapproved Git source')
        return self.command('show', sha + ':' + path)


class VisibleParser(html.parser.HTMLParser):
    """Evidence ignores hidden/inert markup and scripts, including hidden ancestors."""
    VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
    def __init__(self, convert_charrefs=True):
        super().__init__(convert_charrefs=convert_charrefs); self.visibility = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs); style = a.get('style','').lower()
        hidden = (bool(self.visibility and self.visibility[-1][1]) or tag in ('script','style','template','noscript') or
                  'hidden' in a or 'inert' in a or a.get('aria-hidden','').lower() == 'true' or
                  bool(re.search(r'(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)',style)))
        if tag not in self.VOID: self.visibility.append((tag, hidden))
        if not hidden: self.visible_starttag(tag, attrs)
    def handle_endtag(self, tag):
        indices = [i for i,(name,_) in enumerate(self.visibility) if name == tag]
        if not indices: return
        index = indices[-1]; hidden = self.visibility[index][1]
        if not hidden: self.visible_endtag(tag)
        self.visibility = self.visibility[:index]
    def handle_data(self, data):
        if not self.visibility or not self.visibility[-1][1]: self.visible_data(data)
    def visible_starttag(self, tag, attrs): pass
    def visible_endtag(self, tag): pass
    def visible_data(self, data): pass


class CheckoutLogParser(VisibleParser):
    def __init__(self):
        super().__init__(); self.depth = 0; self.active = None; self.rows = []
    def visible_starttag(self, tag, attrs):
        if tag == 'div':
            self.depth += 1
            if 'js-log-line' in dict(attrs).get('class','').split():
                if self.active is not None: raise ValueError('nested log rows')
                self.active = [self.depth, '']
    def visible_data(self, data):
        if self.active is not None: self.active[1] += data
    def visible_endtag(self, tag):
        if tag == 'div':
            if self.active is not None and self.depth == self.active[0]:
                self.rows.append(re.sub(r'^\d{4}-\d\d-\d\dT\S+Z\s+', '', normalized(self.active[1])))
                self.active = None
            self.depth -= 1


class WebParser(VisibleParser):
    """Only static document evidence. Never evaluate scripts or follow internal endpoints."""
    def __init__(self):
        super().__init__(convert_charrefs=True); self.links = []; self.texts = []; self.regions = []; self.depth = 0; self.active = None
    def visible_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a': self.links.append(attrs.get('href', ''))
        if tag == 'div':
            self.depth += 1
            if attrs.get('role') == 'region' and attrs.get('aria-label') == 'Workflow run summary':
                self.active = [self.depth, [], []]
        if self.active:
            if tag == 'a': self.active[1].append(attrs.get('href', ''))
    def visible_data(self, data):
        self.texts.append(data)
        if self.active: self.active[2].append(data)
    def visible_endtag(self, tag):
        if tag == 'div':
            if self.active and self.depth == self.active[0]:
                self.regions.append(self.active); self.active = None
            self.depth -= 1


def public_scheduled_runs(source):
    parser = WebParser(); parser.feed(source)
    return sorted({WEB + path[len('/gcake119/gcake-dev'):] for path in parser.links
                   if re.fullmatch(r'/gcake119/gcake-dev/actions/runs/[1-9][0-9]*', path)}, key=lambda url:int(url.rsplit('/',1)[-1]), reverse=True)


class RunParser(WebParser):
    def __init__(self):
        super().__init__(); self.jobs = []; self.job = None
    def visible_starttag(self, tag, attrs):
        super().visible_starttag(tag, attrs); a = dict(attrs)
        if tag == 'streaming-graph-job':
            if self.job is not None: raise ValueError('nested jobs')
            self.job = {'name': a.get('data-job-id'), 'group': a.get('data-group-id', ''), 'urls': [], 'statuses': [], 'sites': []}
        if self.job is not None:
            if tag == 'a' and a.get('id') == 'workflow-job-name-' + str(self.job['name']): self.job['urls'].append(a.get('href', ''))
            if tag == 'a' and a.get('href', '').startswith('https://'): self.job['sites'].append(a['href'])
            if tag == 'svg' and 'aria-label' in a: self.job['statuses'].append(a['aria-label'].strip())
    def visible_endtag(self, tag):
        if tag == 'streaming-graph-job' and self.job is not None:
            self.jobs.append(self.job); self.job = None
        super().visible_endtag(tag)
    def record(self, url, workflow):
        if len(self.regions) != 1: raise ValueError('ambiguous summary')
        _, links, texts = self.regions[0]; text = normalized(' '.join(texts))
        revisions = {x.rsplit('/', 1)[-1] for x in links if re.fullmatch(r'/gcake119/gcake-dev/commit/[a-f0-9]{40}', x)}
        if len(revisions) != 1 or '/gcake119/gcake-dev/actions/workflows/' + workflow not in self.links:
            raise ValueError('missing source revision/workflow')
        event = 'schedule' if text.startswith('Triggered via schedule') else 'workflow_dispatch' if text.startswith('Manually triggered') else 'other'
        state = re.search(r'\bStatus (Success|Failure|Skipped|In progress|Queued)\b', text)
        record = {'url': url, 'event': event, 'head_sha': next(iter(revisions)), 'status': state[1] if state else 'unknown',
                  'main': '/gcake119/gcake-dev/tree/refs/heads/main' in links, 'jobs': []}
        prefix = url[len('https://github.com'):]
        for j in self.jobs:
            if len(j['urls']) != 1 or not re.fullmatch(re.escape(prefix) + r'/job/[1-9][0-9]*', j['urls'][0]): continue
            if len(j['statuses']) != 1: continue
            j['status'] = {'completed successfully:': 'success', 'failed:': 'failure', 'skipped:': 'skipped'}.get(j['statuses'][0], 'unknown')
            j['url'] = 'https://github.com' + j['urls'][0]
            record['jobs'].append(j)
        return record


class JobParser(VisibleParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.sections = 0; self.scope = False; self.steps = []; self.completed = False; self.title = ''; self.in_title = False
    def visible_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'section' and a.get('aria-label') == 'Check run summary': self.scope = True
        if not self.scope: return
        if tag == 'a' and a.get('id') == 'check-step-header-title': self.in_title = True
        if tag == 'check-steps': self.sections += 1; self.completed = a.get('data-job-status') == 'completed'
        if tag == 'check-step': self.steps.append(a)
    def visible_data(self, data):
        if self.in_title: self.title += data
    def visible_endtag(self, tag):
        if tag == 'a': self.in_title = False
        if tag == 'section': self.scope = False
    def validate(self, job, run, allow_failure=False):
        if self.sections != 1 or normalized(self.title) != job['name'] or not self.completed or not self.steps: raise ValueError('unsupported job evidence')
        check_id = job['url'].rsplit('/', 1)[-1]
        for step in self.steps:
            allowed = ('success','skipped','failure') if allow_failure else ('success','skipped')
            if step.get('data-conclusion') not in allowed: raise ValueError('incomplete or failed step')
            if not re.fullmatch(r'/gcake119/gcake-dev/commit/' + run['head_sha'] + '/checks/' + check_id + r'/logs/[1-9][0-9]{0,2}', step.get('data-log-url', '')):
                raise ValueError('unrelated step log')
            if instant(step.get('data-started-at')) > instant(step.get('data-completed-at')): raise ValueError('reversed step times')
        return min(instant(s['data-started-at']) for s in self.steps), max(instant(s['data-completed-at']) for s in self.steps)


def checkout_revision(source):
    # Recognized static GitHub log rows only; an arbitrary SHA elsewhere is not proof.
    parser = CheckoutLogParser(); parser.feed(source); rows = parser.rows
    candidates = []
    for index, row in enumerate(rows[:-1]):
        if re.fullmatch(r"(?:\[command\])?(?:/usr/bin/)?git log -1 --format=(?:%H|'%H'|\"%H\")", row) and SHA.fullmatch(rows[index + 1]):
            candidates.append(rows[index + 1])
    if len(candidates) != 1: raise ValueError('no unique checkout revision')
    return candidates[0]


class EvidenceUnavailable(Exception): pass
class Contradiction(Exception): pass


def instant(value):
    if not isinstance(value, str): raise ValueError('missing date')
    result = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None: raise ValueError('date has no offset')
    return result.astimezone(dt.timezone.utc)


def normalized(value): return ' '.join(value.split())


def scalar(value):
    value = value.strip()
    if value.startswith('"'): return json.loads(value)
    if value.startswith("'") and value.endswith("'"): return value[1:-1].replace("''", "'")
    if '\n' in value or value in ('|', '>') or value.startswith(('[', '{', '&', '*', '!')):
        raise ValueError('unsupported source scalar')
    return value


def frontmatter(source):
    match = re.fullmatch(r'---\r?\n(.*?)\r?\n---\r?\n(.*)', source, re.S)
    if not match: raise ValueError('unrecognized frontmatter')
    fields = {}
    for line in match[1].splitlines():
        pair = re.match(r'^([A-Za-z][\w]*):\s*(.*)$', line)
        if pair:
            if pair[1] in fields: raise ValueError('duplicate frontmatter field')
            fields[pair[1]] = scalar(pair[2])
    return fields, match[2]


def members(source):
    result = []
    for line in source.splitlines():
        match = re.match(r'^\s+- slug:\s*(\S+)\s*$', line)
        if match: result.append([match[1], None])
        match = re.match(r'^\s+status:\s*(\S+)\s*$', line)
        if match and result and result[-1][1] is None: result[-1][1] = match[1]
    if not result or any(status not in ('ready', 'published', 'planned', 'draft') for _, status in result):
        raise ValueError('unrecognized manifest members')
    if len({slug for slug, _ in result}) != len(result): raise ValueError('ambiguous manifest')
    return result


def quoted_setting(source, key):
    values = re.findall(r'(?<![\w])' + re.escape(key) + r"\s*:\s*(['\"])([^'\"\n]+)\1", source)
    if len(values) != 1: raise ValueError('unsupported or ambiguous setting: ' + key)
    return values[0][1]


class ArticleParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.h1s = []; self.canonicals = []; self.structured = []; self.h1 = None; self.script = None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'h1': self.h1 = ''
        if tag == 'link' and 'canonical' in attrs.get('rel', '').split(): self.canonicals.append(attrs.get('href'))
        if tag == 'script' and attrs.get('type') == 'application/ld+json': self.script = ''
    def handle_data(self, data):
        if self.h1 is not None: self.h1 += data
        if self.script is not None: self.script += data
    def handle_endtag(self, tag):
        if tag == 'h1' and self.h1 is not None: self.h1s.append(normalized(self.h1)); self.h1 = None
        if tag == 'script' and self.script is not None:
            self.structured.append(json.loads(self.script)); self.script = None


def structured_articles(items):
    result = []
    for value in items:
        if isinstance(value, list): result.extend(structured_articles(value))
        elif isinstance(value, dict):
            types = value.get('@type', [])
            if types == 'BlogPosting' or isinstance(types, list) and 'BlogPosting' in types: result.append(value)
            if '@graph' in value: result.extend(structured_articles(value['@graph']))
    return result


def same_url(value, expected):
    if not isinstance(value, str): return False
    u = urllib.parse.urlsplit(value)
    v = urllib.parse.urlsplit(expected)
    return u.scheme == 'https' and u.netloc == v.netloc and not (u.query or u.fragment or u.username or u.password) and u.path.rstrip('/') == v.path.rstrip('/')


def blank_report():
    return {'schema_version': 1, 'status': 'unconfirmed', 'progress': 'not_started', 'publication_sha': None,
            'article_url': None, 'rss_url': None, 'criteria': {name: {'status': 'unconfirmed', 'reason': '尚未取得足夠公開證據', 'evidence': []} for name in ('commit', 'pages', 'page', 'rss')},
            'blockers': [], 'source_errors': [], 'summary': '', 'attempts': 0}


class Verifier:
    def __init__(self, fetch, monotonic, deadline, git):
        self.git = git; self.fetch = fetch; self.monotonic = monotonic; self.deadline = deadline; self.cache = {}; self.retryable = True; self.current_url = None; self.source_errors = []; self.unavailable = {}

    def text(self, url, immutable=False, missing=False, stage="unknown"):
        self.current_url = url
        if url in self.unavailable: raise EvidenceUnavailable(self.unavailable[url])
        if url in self.cache: return self.cache[url]
        remaining = self.deadline - self.monotonic()
        if remaining <= 0: raise EvidenceUnavailable('唯讀查核已到時間上限')
        try: response = self.fetch(url, min(15, remaining))
        except http.client.HTTPException as error:
            self.retryable = False
            reason = '公開HTTP回應不完整，已捨棄partial內容；未重試' if isinstance(error, http.client.IncompleteRead) else '公開HTTP協定或連線錯誤；未重試'
            self.source_errors.append({'url': url, 'stage': stage, 'error_type': type(error).__name__, 'reason': reason})
            self.unavailable[url] = reason
            raise EvidenceUnavailable(reason) from None
        except (OSError, ValueError, TimeoutError, urllib.error.URLError) as error:
            self.source_errors.append({'url': url, 'stage': stage, 'error_type': type(error).__name__, 'reason': '公開來源無法讀取或來源格式不受支援'})
            self.retryable = False; self.unavailable[url] = '公開來源無法讀取或來源格式不受支援'
            raise EvidenceUnavailable(self.unavailable[url]) from None
        if missing and response.status == 404: self.cache[url] = None; return None
        if response.status != 200:
            self.retryable = False
            self.unavailable[url] = '公開來源 HTTP ' + str(response.status) + '；未使用憑證或跟隨重新導向'
            self.source_errors.append({'url':url,'stage':stage,'error_type':'HTTPStatus','http_status':response.status,'reason':self.unavailable[url]})
            raise EvidenceUnavailable(self.unavailable[url])
        if len(response.body.encode('utf-8')) > LIMIT:
            self.retryable = False; self.unavailable[url] = '公開回應超過安全上限'
            raise EvidenceUnavailable(self.unavailable[url])
        self.cache[url] = response.body
        return response.body

    def data(self, url, immutable=False):
        try: return json.loads(self.text(url, immutable))
        except (json.JSONDecodeError, TypeError):
            self.retryable = False; raise EvidenceUnavailable('公開來源不是有效 JSON') from None

    def set(self, report, name, status, reason, *urls):
        report['criteria'][name] = {'status': status, 'reason': reason, 'evidence': list(urls)}

    def provenance(self, report, parent, at, site):
        rows = []; complete = {}; unknown = False
        for workflow, listing in [('editorial-release.yml', RUN_LIST), ('deploy-pages.yml', PAGES_RUN_LIST)]:
            try:
                source = self.text(listing, immutable=True, stage='actions'); overview = WebParser(); overview.feed(source)
                urls = public_scheduled_runs(source)
                complete[workflow] = len(urls) <= 12 and not any(re.match(r'/gcake119/gcake-dev/actions/workflows/' + re.escape(workflow) + r'\?page=[2-9][0-9]*', link) for link in overview.links)
                for url in urls[:12]:
                    try:
                        parser = RunParser(); parser.feed(self.text(url, immutable=True, stage='actions'))
                        row = parser.record(url, workflow); row['workflow'] = workflow; rows.append(row)
                    except (EvidenceUnavailable, ValueError):
                        complete[workflow] = False
            except (EvidenceUnavailable, ValueError): complete[workflow] = False
        report['observations']['public_runs'] = [{k: r[k] for k in ('url','event','head_sha','status','workflow','main')} for r in rows]
        report['observations']['run_discovery_complete'] = complete
        matching = []
        for row in rows:
            if row['workflow'] != 'editorial-release.yml' or row['event'] != 'schedule' or not row['main'] or row['head_sha'] != parent: continue
            jobs = [j for j in row['jobs'] if j['name'] == 'release' and j['status'] == 'success']
            if len(jobs) != 1:
                if row['status'] != 'Skipped': unknown = True
                continue
            job = jobs[0]
            try:
                parser = JobParser(); parser.feed(self.text(job['url'], immutable=True, stage='actions')); start, end = parser.validate(job, row)
                if start <= at <= end: matching.append({'url':row['url'],'job_url':job['url'],'head_sha':parent,'started_at':start.isoformat(),'completed_at':end.isoformat()})
            except (EvidenceUnavailable, ValueError): unknown = True
        if SHA.fullmatch(report['publication_sha'] or '') and report['observations'].get('ready_to_published') and parent and at and len(matching) == 1 and not unknown and complete.get('editorial-release.yml'):
            report['observations']['scheduled_run'] = matching[0]
            self.set(report, 'commit', 'passed', '原子ready→published與唯一scheduled main run的父SHA及成功release時間相符', WEB + '/commit/' + report['publication_sha'], matching[0]['url'], matching[0]['job_url'])
        deliveries = []
        for row in rows:
            if not report['publication_sha'] or not row['main']: continue
            jobs = {name: [j for j in row['jobs'] if j['name'] == name and j['status'] in (('success',) if name == 'build' else ('success','failure'))] for name in ('build','deploy')}
            if any(len(v) != 1 for v in jobs.values()): continue
            build, deploy = jobs['build'][0], jobs['deploy'][0]
            if 'env_github-pages_' not in deploy['group']: continue
            if deploy['status'] == 'success' and not any(same_url(url, site + '/') for url in deploy['sites']): continue
            try:
                # Only the researched, reviewed Pages workflow contract is supported.
                if row['workflow'] != 'deploy-pages.yml': continue
                workflow = self.git.source(row['head_sha'], '.github/workflows/deploy-pages.yml')
                if hashlib.sha256(workflow.encode()).hexdigest() != PAGES_WORKFLOW_HASH: continue
                parser = JobParser(); parser.feed(self.text(build['url'], immutable=True, stage='actions')); build_start, build_end = parser.validate(build, row)
                checkouts = [s for s in parser.steps if re.match(r'Checkout\b|Run actions/checkout@', s.get('data-name','')) and s.get('data-conclusion') == 'success']
                if len(checkouts) != 1: continue
                log_url = 'https://github.com' + checkouts[0]['data-log-url']
                source_sha = checkout_revision(self.text(log_url, immutable=True, stage='pages'))
                report['observations'].setdefault('pages_builds',[]).append({'run_url':row['url'],'run_head_sha':row['head_sha'],'source_sha':source_sha,'build_job':build['url'],'deploy_job':deploy['url'],'checkout_log':log_url})
                if source_sha == report['publication_sha']:
                    deploy_parser = JobParser(); deploy_parser.feed(self.text(deploy['url'], immutable=True, stage='pages'))
                    deploy_start, deploy_end = deploy_parser.validate(deploy, row, allow_failure=deploy['status']=='failure')
                    if deploy_start < build_end: continue
                    if (deploy['status']=='failure') != any(step['data-conclusion']=='failure' for step in deploy_parser.steps): continue
                    deliveries.append((deploy_end,row,build,deploy,log_url,source_sha))
            except (EvidenceUnavailable, ValueError, KeyError): continue
        if deliveries:
            newest = max(item[0] for item in deliveries)
            latest = [item for item in deliveries if item[0] == newest]
            if len({item[3]['status'] for item in latest}) != 1: return
            end,row,build,deploy,log_url,source_sha = latest[0]
            report['observations']['pages_source_sha'] = source_sha
            report['observations']['pages_completed_at'] = end.isoformat()
            state = 'failed' if deploy['status']=='failure' else 'passed'
            reason = '已證明同一發文SHA建置，但同run的github-pages部署明確失敗' if state=='failed' else '公開checkout runtime完整SHA與發文相同，同run建置／github-pages部署成功'
            self.set(report,'pages',state,reason,row['url'],build['url'],deploy['url'],log_url)


    def snapshot(self):
        report = blank_report(); report['source_errors'] = self.source_errors; stage = 'commit'
        try:
            tip, entries = self.git.history()
            report['observations'] = {'repository_sha': tip}
            candidates = [entry for entry in entries if re.fullmatch(r'Publish ' + SLUG + r' \[release:[A-Za-z0-9_-]{1,100}\]', entry['message'])]
            published = None; parent = None; at = None; sha = tip
            if len(candidates) == 1:
                try:
                    commit = candidates[0]; sha = commit['sha']; report['publication_sha'] = sha
                    parent = commit['parent']; at = instant(commit['date'])
                    if not SHA.fullmatch(parent): raise EvidenceUnavailable('不是可核對的單一父提交')
                    # Bot identity is corroborating evidence, never substitutes for scheduled job provenance.
                    if not commit['author'].endswith('[bot]') or not commit['email'].endswith('@users.noreply.github.com'):
                        raise EvidenceUnavailable('缺少Git bot身分；不能證明自動發文')
                    before, before_body = frontmatter(self.git.source(parent, POST))
                    after, after_body = frontmatter(self.git.source(sha, POST))
                    old_manifest = members(self.git.source(parent, MANIFEST))
                    new_manifest = members(self.git.source(sha, MANIFEST))
                    if before.get('status') != 'ready' or after.get('status') != 'published':
                        self.retryable = False; raise EvidenceUnavailable('不是 ready→published 的發文提交')
                    if before_body != after_body or before.get('title') != TITLE or after.get('title') != TITLE or before.get('series') != 'ithome-2026-extensions' or after.get('series') != before.get('series'):
                        raise Contradiction('發布提交變更正文、標題或系列身分')
                    if [x[0] for x in old_manifest] != [x[0] for x in new_manifest] or old_manifest[0][0] != SLUG or old_manifest[0][1] != 'ready' or new_manifest[0][1] != 'published' or old_manifest[1:] != new_manifest[1:]:
                        raise Contradiction('manifest 首篇發布狀態或原篇序不相符')
                    if set(commit['files']) != {POST, MANIFEST}:
                        raise EvidenceUnavailable('不是僅文章与manifest的原子發布提交')
                    published = instant(after.get('publishedAt'))
                    if published < instant(EARLIEST) or at < instant(EARLIEST): raise Contradiction('實際提交或發布時間早於核准時段')
                    report['observations']['ready_to_published'] = True
                    report['observations']['commit_time'] = commit['date']
                    report['observations']['parent_sha'] = parent
                    report['observations']['article_transition'] = {'before':before['status'],'after':after['status'],'published_at':after.get('publishedAt')}
                    report['observations']['manifest_transition'] = {'before':old_manifest,'after':new_manifest}
                    report['observations']['changed_files'] = commit['files']
                    self.set(report, 'commit', 'unconfirmed', '公開Git確認ready→published且正文篇序保留；仍缺scheduled release工作時間的公開證據', WEB + '/commit/' + sha)
                except (EvidenceUnavailable, ValueError, KeyError) as error:
                    sha = tip; parent = None; at = None; report['publication_sha'] = None
                    self.set(report, 'commit', 'unconfirmed', '發文來源證據不足；仍查核固定main版本的公開內容', WEB + '/commit/' + tip)
                    current, _ = frontmatter(self.git.source(tip, POST))
                    if current.get('status') == 'published': published = instant(current.get('publishedAt'))
            else:
                self.set(report, 'commit', 'unconfirmed', '沒有唯一自動發布提交；使用main固定版本查核頁面与RSS，不假設已發文', WEB + '/commits/main/' + POST)
                current, _ = frontmatter(self.git.source(tip, POST))
                report['observations']['article_status'] = current.get('status')
                if current.get('title') != TITLE: raise EvidenceUnavailable('main文章身分不相符')
                if current.get('status') == 'published': published = instant(current.get('publishedAt'))
            stage = 'pages'; report['progress'] = 'deploying'
            config_url = RAW + sha + '/astro.config.mjs'
            config = self.git.source(sha, 'astro.config.mjs')
            site = quoted_setting(config, 'site').rstrip('/') + quoted_setting(config, 'base').rstrip('/')
            site_source = self.git.source(sha, 'src/data/site.ts')
            if quoted_setting(site_source, 'url').rstrip('/') != site or quoted_setting(site_source, 'basePath') != quoted_setting(config, 'base'):
                raise EvidenceUnavailable('公開站台設定不一致')
            if not re.fullmatch(r'https://gcake119\.github\.io/gcake-dev', site): raise EvidenceUnavailable('站台不在核准公開origin')
            loader = self.git.source(sha, 'src/content.config.ts')
            slug_rule = self.git.source(sha, 'src/lib/content/local-posts.ts')
            if 'generateId: ({ entry }) => localPostSlugFromEntry(entry)' not in loader or "entry.split(/[\\\\/]/).at(-1)" not in slug_rule or "filename.replace(MARKDOWN_EXTENSION, '')" not in slug_rule:
                raise EvidenceUnavailable('文章slug規則不受支援，不能猜測URL')
            catalog = self.git.source(sha, 'src/lib/content/catalog.ts')
            if 'href: `${site.basePath}/posts/${p.id}/`' not in catalog: raise EvidenceUnavailable('文章路由格式不受支援，不能猜測URL')
            rss_source = self.git.source(sha, 'src/pages/rss.xml.ts')
            if '@astrojs/rss' not in rss_source or not re.search(r'\bGET\(', rss_source) or 'post.href' not in rss_source:
                raise EvidenceUnavailable('RSS來源與文章連結格式無法確認')
            page_url = site + '/posts/' + SLUG + '/'; rss_url = site + '/rss.xml'
            report['article_url'] = page_url; report['rss_url'] = rss_url
            if hasattr(self.fetch, 'allow_site'): self.fetch.allow_site(site)
            # Static run summaries expose event/head SHA but not the release job start/end
            # or exact deployed artifact revision. Never infer either from overall success.
            self.set(report, 'pages', 'unconfirmed', '公開靜態頁尚不能證明同一publication SHA的成功Pages部署；不以workflow初始SHA或綠燈代替', RUN_LIST)
            self.retryable = False
            stage = 'page'; report['progress'] = 'not_public'
            try: page = self.text(page_url, missing=True, stage="page")
            except EvidenceUnavailable as error:
                page = None; self.set(report, 'page', 'unconfirmed', str(error), page_url)
            if page is not None:
                try:
                    parser = ArticleParser(); parser.feed(page)
                    articles = structured_articles(parser.structured)
                    valid = len(parser.h1s) == 1 and parser.h1s[0] == normalized(TITLE) and len(parser.canonicals) == 1 and same_url(parser.canonicals[0], page_url) and len(articles) == 1
                    if valid:
                        article = articles[0]
                        entity = article.get('mainEntityOfPage', {})
                        valid = article.get('headline') == TITLE and isinstance(entity, dict) and same_url(entity.get('@id'), page_url) and instant(article.get('datePublished')) == published
                    report['observations']['page'] = {'http_status':200,'h1':parser.h1s,'canonical':parser.canonicals,'headline':articles[0].get('headline') if len(articles)==1 else None,'published_at':articles[0].get('datePublished') if len(articles)==1 else None}
                    self.set(report, 'page', 'passed' if valid else 'failed', '正式頁面標題、canonical、文章身分及日期相符' if valid else 'HTTP200文章身分、canonical、標題或日期不相符', page_url, config_url)
                except (ValueError, TypeError, KeyError):
                    self.set(report, 'page', 'unconfirmed', '文章頁格式或日期無法解析；RSS仍獨立查核', page_url)
            if page is None and report['criteria']['page']['reason'] == '尚未取得足夠公開證據': self.set(report, 'page', 'unconfirmed', '正式文章HTTP404，尚未公開；不判定發文失敗', page_url)
            stage = 'rss'
            try: rss = self.text(rss_url, missing=True, stage="rss")
            except EvidenceUnavailable as error:
                rss = None; self.set(report, 'rss', 'unconfirmed', str(error), rss_url)
            if rss is not None:
                if '<!DOCTYPE' in rss.upper() or '<!ENTITY' in rss.upper(): raise EvidenceUnavailable('RSS宣告不在安全解析範圍')
                tree = ET.fromstring(rss)
                if tree.tag != 'rss': raise EvidenceUnavailable('來源不是RSS格式')
                items = tree.findall('./channel/item')
                matches = [item for item in items if same_url(item.findtext('link'), page_url) or same_url(item.findtext('guid'), page_url) or item.findtext('title') == TITLE]
                if len(matches) == 1:
                    item = matches[0]
                    rss_date = email.utils.parsedate_to_datetime(item.findtext('pubDate', ''))
                    valid = item.findtext('title') == TITLE and same_url(item.findtext('link'), page_url) and same_url(item.findtext('guid'), page_url) and rss_date.tzinfo is not None and rss_date.astimezone(dt.timezone.utc) == published
                    report['observations']['rss'] = {'http_status':200,'title':item.findtext('title'),'link':item.findtext('link'),'guid':item.findtext('guid'),'published_at':item.findtext('pubDate')}
                    self.set(report, 'rss', 'passed' if valid else 'failed', 'RSS標題、link、GUID與發布日期相符' if valid else 'RSS文章身分、連結或日期不相符', rss_url)
                elif matches: self.set(report, 'rss', 'failed', 'RSS同篇身分有多筆矛盾項目', rss_url)
                else: self.set(report, 'rss', 'unconfirmed', 'RSS尚未收錄首篇；不判定發文失敗', rss_url)
            self.provenance(report, parent, at, site)
        except Contradiction as error:
            self.set(report, stage, 'failed', str(error))
        except (EvidenceUnavailable, ValueError, KeyError, TypeError, AttributeError, ET.ParseError) as error:
            reason = str(error) if isinstance(error, EvidenceUnavailable) else '公開證據格式不受支援，未進行猜測或使用憑證'
            report['blockers'].append(reason)
            if not isinstance(error, EvidenceUnavailable): self.retryable = False
            self.set(report, stage, 'unconfirmed', reason, *([self.current_url] if self.current_url else []))
            if not self.retryable: report['progress'] = 'source_unavailable'
        statuses = [c['status'] for c in report['criteria'].values()]
        report['status'] = 'failed' if 'failed' in statuses else 'passed' if all(s == 'passed' for s in statuses) else 'unconfirmed'
        if report['source_errors']: report['progress'] = 'source_unavailable'
        if all(report['criteria'][n]['status'] == 'passed' for n in ('page','rss')): report['progress'] = 'public_provenance_pending'
        elif report['criteria']['page']['status'] == 'passed': report['progress'] = 'public_rss_pending'
        elif report['criteria']['rss']['status'] == 'passed': report['progress'] = 'rss_visible_page_unconfirmed'
        if report['status'] == 'passed': report['progress'] = 'verified_public'
        if report['status'] == 'failed': report['progress'] = 'explicit_failure'
        report['blockers'].extend(c['reason'] for c in report['criteria'].values() if c['status'] == 'unconfirmed' and c['reason'] not in report['blockers'])
        report['summary'] = {'passed': '四項證據齊全，發布驗收通過。', 'failed': '取得明確錯誤或矛盾證據；不得重複發文。', 'unconfirmed': '目前未確認；不是因07：10未公開而判定失敗，不得重複發文。'}[report['status']]
        if report['progress'] == 'public_provenance_pending': report['summary'] = '正式文章與RSS已確認公開；自動發文來源或部署版本仍未確認，不得重複發文。'
        return report


def run(fetch=None, monotonic=time.monotonic, sleep=time.sleep, max_wait=1200, interval=120, git=None):
    if not 0 <= max_wait <= 1200 or not 30 <= interval <= 300: raise ValueError('invalid bounded polling configuration')
    deadline = monotonic() + (max_wait if max_wait else 60)
    def verify(snapshot):
        verifier = Verifier(fetch or PublicReader(), monotonic, deadline, snapshot)
        report = verifier.snapshot(); report['attempts'] = 1
        # Unknown web provenance cannot be fixed by blindly polling or API fallback.
        return report
    if git is not None: return verify(git)
    try:
        with PublicGit(deadline, monotonic) as snapshot: return verify(snapshot)
    except (EvidenceUnavailable, OSError, ValueError, subprocess.TimeoutExpired):
        report = blank_report(); report['attempts'] = 1; report['progress'] = 'source_unavailable'
        report['criteria']['commit']['reason'] = '公開Git無法讀取、逾時或歷史不完整；未使用API或憑證'
        report['criteria']['commit']['evidence'] = [GIT_URL]
        report['blockers'] = [report['criteria']['commit']['reason']]
        report['blockers'].extend(c['reason'] for c in report['criteria'].values() if c['status'] == 'unconfirmed' and c['reason'] not in report['blockers'])
        report['summary'] = '目前未確認；來源無法讀取，不得重複發文。'
        return report


def main(argv=None, fetch=None, git=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--max-wait', type=int, default=1200, choices=range(0, 1201), metavar='0..1200')
    parser.add_argument('--interval', type=int, default=120, choices=range(30, 301), metavar='30..300')
    args = parser.parse_args(argv)
    print(json.dumps(run(fetch=fetch, git=git, max_wait=args.max_wait, interval=args.interval), ensure_ascii=False, indent=2))


if __name__ == '__main__': main()
