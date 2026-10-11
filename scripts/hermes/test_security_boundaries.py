"""Regression checks never open real network transports or production state."""
from contextlib import closing
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from rss_monitor import Monitor, SITE, telegram_send, _telegram_request


class SecurityBoundaries(unittest.TestCase):
    def setUp(self):
        self.tmp = self.enterContext(tempfile.TemporaryDirectory())
        self.home = Path(self.tmp)
        self.db = self.home / 'test.sqlite'
        self.site = 'http://127.0.0.1:4199/review/'
        self.enterContext(patch.dict(os.environ, HERMES_RSS_NOTIFY_ENABLED='false',
                                     TELEGRAM_BOT_TOKEN='123:FAKE_TEST_TOKEN', TELEGRAM_CHAT_ID='456'))
        self.network = self.enterContext(patch('rss_monitor.urllib.request.build_opener',
                                              side_effect=AssertionError('Real transport must never open')))

    def test_direct_telegram_transport_requires_activation(self):
        with self.assertRaisesRegex(ValueError, 'disabled'):
            telegram_send('must not send')
        self.network.assert_not_called()

    def test_mock_transport_cannot_select_real_endpoint_or_chat(self):
        cases = [('https://api.telegram.org/bot0:TEST_ONLY/sendMessage', '0'),
                 ('http://127.0.0.1:4200/bot0:TEST_ONLY/sendMessage', '456')]
        for url, chat in cases:
            with self.subTest(url=url, chat=chat), self.assertRaises(ValueError):
                _telegram_request('must not send', url, chat, mock=True)
        self.network.assert_not_called()

    def test_test_mode_rejects_wrapped_production_sender(self):
        with self.assertRaises(ValueError):
            Monitor(self.db, self.site, sender=lambda text: telegram_send(text),
                    test_delivery=True, mock_api='http://127.0.0.1:4200/')
        self.network.assert_not_called()

    def test_live_monitor_requires_activation_even_before_baseline(self):
        with self.assertRaisesRegex(ValueError, 'disabled'):
            Monitor(self.db, SITE, fetcher=lambda _: self.fail('Unexpected fetch'), live=True)
        self.assertFalse(self.db.exists())

    def test_uninitialized_default_live_path_is_reserved_in_all_nonlive_modes(self):
        reserved = self.home / '.local/state/gcake-rss/live.sqlite'
        with patch('rss_monitor.Path.home', return_value=self.home):
            for mode in ('dry-run', 'test-delivery'):
                with self.subTest(mode=mode), self.assertRaises(ValueError):
                    Monitor(reserved, self.site, test_delivery=mode == 'test-delivery',
                            mock_api='http://127.0.0.1:4200/' if mode == 'test-delivery' else None).poll()
        self.assertFalse(reserved.exists())
        self.assertFalse(Path(str(reserved) + '.lock').exists())

    def test_rejected_production_db_is_not_modified(self):
        with closing(sqlite3.connect(self.db)) as db, db:
            db.execute('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
            db.executemany('INSERT INTO meta VALUES (?,?)', [('mode', 'live'), ('site', SITE)])
        self.db.chmod(0o640)
        original = self.db.read_bytes()
        with self.assertRaises(ValueError):
            Monitor(self.db, self.site).statuses()
        with self.assertRaises(ValueError):
            Monitor(self.db, self.site).poll()
        self.assertEqual(self.db.read_bytes(), original)
        self.assertEqual(self.db.stat().st_mode & 0o777, 0o640)
        self.assertFalse(Path(str(self.db) + '.lock').exists())

    def test_disabling_live_after_construction_blocks_poll_and_send(self):
        with patch.dict(os.environ, HERMES_RSS_NOTIFY_ENABLED='true'):
            monitor = Monitor(self.db, SITE, fetcher=lambda _: self.fail('Unexpected fetch'), live=True)
        with self.assertRaisesRegex(ValueError, 'disabled'):
            monitor.poll()
        with self.assertRaisesRegex(ValueError, 'disabled'):
            _telegram_request('must not send', 'https://api.telegram.org/bot123:FAKE_TEST_TOKEN/sendMessage', '456')
        self.assertFalse(self.db.exists())
        self.network.assert_not_called()

    def test_symlinks_hardlinks_and_reserved_parent_aliases_are_rejected(self):
        self.db.write_bytes(b'untouched test file')
        symbolic = self.home / 'symbolic.sqlite'
        symbolic.symlink_to(self.db)
        hard = self.home / 'hard.sqlite'
        os.link(self.db, hard)
        for alias in (symbolic, hard):
            with self.subTest(alias=alias), self.assertRaises(ValueError):
                Monitor(alias, self.site)
        reserved_dir = self.home / '.local/state/gcake-rss'
        reserved_dir.mkdir(parents=True)
        parent_alias = self.home / 'state-alias'
        parent_alias.symlink_to(reserved_dir, target_is_directory=True)
        with patch('rss_monitor.Path.home', return_value=self.home), self.assertRaises(ValueError):
            Monitor(parent_alias / 'live.sqlite', self.site)
        self.assertFalse((reserved_dir / 'live.sqlite').exists())
        self.assertEqual(self.db.read_bytes(), b'untouched test file')
        self.network.assert_not_called()

    def test_status_does_not_create_missing_database(self):
        with self.assertRaises((ValueError, sqlite3.OperationalError)):
            Monitor(self.db, self.site).statuses()
        self.assertFalse(self.db.exists())


if __name__ == '__main__':
    unittest.main()
