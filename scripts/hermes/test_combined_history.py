from contextlib import closing
import sqlite3
import unittest
import test_publication_monitor_acceptance as acceptance
from verify_combined_gateway import snapshot


class CombinedHistory(unittest.TestCase):
    setUp = acceptance.Acceptance.setUp
    observe = acceptance.Acceptance.observe
    monitor = acceptance.Acceptance.monitor
    step = acceptance.Acceptance.step
    publish = acceptance.Acceptance.publish
    initialize = acceptance.Acceptance.initialize
    def test_successive_round_preserves_history_without_resend(self):
        self.initialize()
        self.articles = [acceptance.article()]
        self.publish()
        self.step(0)
        before = snapshot(self.db)
        self.messages.clear()
        self.step(1)
        self.assertEqual(self.messages, [])
        self.assertEqual(snapshot(self.db), before)
        with closing(sqlite3.connect(self.db)) as conn:
            self.assertEqual(float(dict(conn.execute('SELECT key,value FROM meta'))['monitor_last_round']), acceptance.BASE+3600)

    def test_history_snapshot_detects_changed_delivery_status(self):
        self.initialize()
        self.articles = [acceptance.article()]
        self.publish()
        self.step(0)
        before = snapshot(self.db)
        with closing(sqlite3.connect(self.db)) as conn, conn:
            conn.execute("UPDATE outbox SET status='uncertain'")
        self.assertNotEqual(snapshot(self.db), before)


if __name__ == '__main__': unittest.main()
