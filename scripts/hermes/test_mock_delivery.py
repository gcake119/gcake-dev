"""Acceptance at the CLI/HTTP boundary; never contacts Telegram or uses real secrets."""
from contextlib import closing, contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import sys
import tempfile
import threading
import unittest

SCRIPT = Path(__file__).with_name('rss_monitor.py')


@contextmanager
def server(handler):
    http = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    worker = threading.Thread(target=http.serve_forever, daemon=True)
    worker.start()
    try:
        yield f'http://127.0.0.1:{http.server_port}/'
    finally:
        http.shutdown()
        http.server_close()
        worker.join()


class MockDeliveryAcceptance(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = Path(self.tmp.name) / 'test.sqlite'
        self.items = ['old']
        self.guid = 'original'
        self.page_status = 200
        self.bad_canonical = False
        self.redirect_page = False
        self.drop_reply = False
        self.redirect_api = False
        self.requests = []
        self.site_requests = []
        test = self

        class Site(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def do_GET(self):
                test.site_requests.append(self.path)
                if self.path == '/review/rss.xml':
                    body = '<rss><channel>' + ''.join(
                        f'<item><title>{slug}</title><link>{test.site}posts/{slug}/</link>'
                        f'<guid>{test.guid}-{slug}</guid><pubDate>Mon, 12 Oct 2020 00:00:00 GMT</pubDate></item>'
                        for slug in test.items) + '</channel></rss>'
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/rss+xml')
                else:
                    self.send_response(302 if test.redirect_page else test.page_status)
                    if test.redirect_page:
                        self.send_header('Location', test.api + 'forbidden')
                    self.send_header('Content-Type', 'text/html')
                    canonical = test.site + 'posts/wrong/' if test.bad_canonical else test.site.rstrip('/') + self.path[len('/review'):]
                    body = f'<html><head><link rel="canonical" href="{canonical}"></head></html>'
                self.end_headers()
                self.wfile.write(body.encode())

        class Telegram(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def do_GET(self):
                test.requests.append(('GET', self.path, None))
                self.send_response(200)
                self.end_headers()

            def do_POST(self):
                payload = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                test.requests.append(('POST', self.path, payload))
                if test.drop_reply:
                    self.connection.shutdown(socket.SHUT_RDWR)
                    self.connection.close()
                    return
                self.send_response(302 if test.redirect_api else 200)
                if test.redirect_api:
                    self.send_header('Location', test.site + 'forbidden')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"ok":true,"result":{"message_id":1}}')

        self.site = self.enterContext(server(Site)) + 'review/'
        self.api = self.enterContext(server(Telegram))

    def cli(self, *extra, success=True):
        env = dict(os.environ, HERMES_RSS_NOTIFY_ENABLED='false', EDITORIAL_RELEASE_ENABLED='false',
                   TELEGRAM_BOT_TOKEN='REAL_CREDENTIAL_MUST_NOT_BE_USED', TELEGRAM_CHAT_ID='REAL_CHAT_MUST_NOT_BE_USED',
                   http_proxy=self.api, https_proxy=self.api, HTTP_PROXY=self.api, HTTPS_PROXY=self.api,
                   no_proxy='', NO_PROXY='')
        result = subprocess.run([sys.executable, str(SCRIPT), '--test-delivery', '--site', self.site,
                                 '--telegram-api', self.api, '--db', str(self.db), *extra],
                                env=env, capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        self.assertNotIn('REAL_CREDENTIAL', result.stdout + result.stderr)
        return result

    def allow_retry(self):
        with closing(sqlite3.connect(self.db)) as db, db:
            db.execute("UPDATE meta SET value='0' WHERE key='next_check'")

    def test_baseline_verified_send_restart_and_guid_dedup(self):
        self.cli()
        self.assertEqual(self.requests, [])
        self.items.append('new')
        self.cli()
        self.assertEqual(len(self.requests), 1)
        method, path, data = self.requests[0]
        self.assertEqual((method, path), ('POST', '/bot0:TEST_ONLY/sendMessage'))
        self.assertEqual(data['chat_id'], '0')
        self.assertEqual(data['text'], f'new\n{self.site}posts/new/\n台北發佈時間：2020-10-12 08:00')
        self.assertTrue(data['disable_web_page_preview'])
        self.guid = 'changed'
        self.cli()
        self.assertEqual(len(self.requests), 1)
        self.assertEqual(json.loads(self.cli('--status').stdout)[self.site + 'posts/new/'], 'sent')
        self.assertEqual(os.stat(self.db).st_mode & 0o777, 0o600)

    def test_page_outage_canonical_backoff_then_recovery(self):
        self.cli()
        self.items.append('new')
        self.page_status = 503
        self.cli(success=False)
        previous = len(self.site_requests)
        self.cli()
        self.assertEqual(len(self.site_requests), previous)
        self.assertEqual(self.requests, [])
        self.allow_retry()
        self.page_status = 200
        self.bad_canonical = True
        self.cli(success=False)
        self.assertEqual(self.requests, [])
        self.allow_retry()
        self.bad_canonical = False
        self.cli()
        self.assertEqual(len(self.requests), 1)

    def test_lost_reply_stays_uncertain_without_resend(self):
        self.cli()
        self.items.append('new')
        self.drop_reply = True
        self.cli(success=False)
        self.assertEqual(len(self.requests), 1)
        self.drop_reply = False
        self.allow_retry()
        self.cli()
        self.assertEqual(len(self.requests), 1)
        self.assertEqual(json.loads(self.cli('--status').stdout)[self.site + 'posts/new/'], 'uncertain')

    def test_test_options_fail_closed(self):
        cases = [('--site', 'https://gcake119.github.io/gcake-dev/'),
                 ('--site', 'http://localhost:1234/review/'),
                 ('--telegram-api', 'https://api.telegram.org/'),
                 ('--telegram-api', 'http://127.0.0.1:1234/?secret=x'),
                 ('--telegram-api', 'http://user@127.0.0.1:1234/'),
                 ('--telegram-api', 'http://127.0.0.1:1234/path/'),
                 ('--site', 'http://127.0.0.1:1234/re\nview/'),
                 ('--site', 'http://127.0.0.2:1234/'),
                 ('--telegram-api', 'http://127.0.0.1:0/'),
                 ('--telegram-api', 'http://127.0.0.1:65536/'),
                 ('--live',), ('--dry-run',), ('--db', '')]
        for args in cases:
            with self.subTest(args=args):
                self.cli(*args, success=False)
        self.assertEqual(self.requests, [])
        self.assertEqual(self.site_requests, [])

    def test_site_and_mode_state_cannot_be_reused(self):
        self.cli()
        previous = len(self.site_requests)
        self.cli('--site', self.site + 'other/', success=False)
        self.cli('--site', self.site + 'other/', '--status', success=False)
        result = subprocess.run([sys.executable, str(SCRIPT), '--site', self.site, '--db', str(self.db)],
                                capture_output=True, text=True, timeout=10)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.requests, [])
        self.assertEqual(len(self.site_requests), previous)

    def test_required_test_parameters_and_production_guards(self):
        env = dict(os.environ, HERMES_RSS_NOTIFY_ENABLED='false')
        cases = [('--test-delivery', '--site', self.site, '--telegram-api', self.api),
                 ('--test-delivery', '--site', self.site, '--db', str(self.db)),
                 ('--telegram-api', self.api),
                 ('--live',), ('--live', '--site', self.site)]
        for args in cases:
            with self.subTest(args=args):
                result = subprocess.run([sys.executable, str(SCRIPT), *args], env=env,
                                        capture_output=True, text=True, timeout=10)
                self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.requests, [])
        self.assertEqual(self.site_requests, [])

    def test_mock_database_cannot_become_live_or_legacy_unbound(self):
        from rss_monitor import Monitor, SITE
        self.cli()
        def forbidden_fetch(_):
            self.fail('State guard must reject before any production request')
        with self.assertRaises(ValueError):
            Monitor(self.db, SITE, fetcher=forbidden_fetch, live=True).poll()
        with self.assertRaises(ValueError):
            Monitor(self.db, SITE, fetcher=forbidden_fetch, live=True).statuses()
        with closing(sqlite3.connect(self.db)) as db, db:
            db.execute("DELETE FROM meta WHERE key='site'")
        self.cli(success=False)

    def test_page_and_api_redirects_are_not_followed(self):
        self.cli()
        self.items.append('new')
        self.redirect_page = True
        self.cli(success=False)
        self.assertEqual(self.requests, [])
        self.allow_retry()
        self.redirect_page = False
        self.redirect_api = True
        self.cli(success=False)
        self.assertEqual(len(self.requests), 1)
        self.assertNotIn('/review/forbidden', self.site_requests)
        self.allow_retry()
        self.cli()
        self.assertEqual(len(self.requests), 1)


if __name__ == '__main__':
    unittest.main()
