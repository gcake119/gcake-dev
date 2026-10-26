import copy
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from publication_monitor import PublicationMonitor
from rss_monitor import SITE


def timestamp(value):
    return datetime.fromisoformat(value).timestamp()


BASE = timestamp('2026-10-15T07:00:00+08:00')


def article(slug='a', state='confirmed', at=BASE, episode='commit-1', kind='standalone'):
    row = dict(articleId=slug, canonicalUrl=SITE+'posts/'+slug+'/', kind=kind, scheduleState=state)
    if state == 'confirmed':
        row['commitment'] = dict(identity=episode, scheduledAt=datetime.fromtimestamp(at, timezone.utc).isoformat())
    return row


class Acceptance(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = Path(self.tmp.name)/'test.sqlite'
        self.articles = []
        self.feed = []
        self.pages = {}
        self.messages = []
        self.bad_feed = False
        self.bad_summary = False
        self.stale = False
        self.public_window = None

    def observe(self, now):
        result = dict(summary=None if self.bad_summary else dict(schemaVersion=1, generatedAt=datetime.fromtimestamp(now-(7200 if self.stale else 0), timezone.utc).isoformat(), gitRevision='rev', queueVersion=1, complete=True, articles=copy.deepcopy(self.articles)), feed=None if self.bad_feed else copy.deepcopy(self.feed), pages=copy.deepcopy(self.pages), window=[now, now])
        if self.public_window is not None:result['publicWindow'] = self.public_window
        return result

    def old_fetch(self, url):
        # Transitional product bridge uses the existing installed RSS seam.
        if url.endswith('rss.xml'):
            from email.utils import format_datetime
            raw='<rss><channel>'+''.join('<item><title>'+x['title']+'</title><link>'+x['url']+'</link><guid>'+x['guid']+'</guid><pubDate>'+format_datetime(datetime.fromisoformat(x['publishedAt']))+'</pubDate></item>' for x in self.feed)+'</channel></rss>'
            return raw.encode(), url, 'application/rss+xml'
        page=self.pages.get(url, {})
        return ('<link rel="canonical" href="'+page.get('canonicalUrl', url)+'">').encode(), url, 'text/html'

    def monitor(self, sender=None, mode='test'):
        return PublicationMonitor(self.db, self.observe, sender or self.messages.append, mode=mode)

    def step(self, hour, now=None, monitor=None):
        return (monitor or self.monitor()).run_round(BASE+hour*3600, BASE+hour*3600 if now is None else now)

    def publish(self, slug='a', date=BASE, wrong=False):
        url=SITE+'posts/'+slug+'/'
        at=datetime.fromtimestamp(date, timezone.utc).isoformat()
        self.feed.append(dict(url=url,guid=url,title='Title '+slug,publishedAt=at))
        self.pages[url]=dict(status=200, canonicalUrl=SITE if wrong else url, publishedAt=at)

    def initialize(self):
        self.step(-1)
        self.messages.clear()

    def test_all_article_types_new_series_and_updates(self):
        self.initialize()
        self.articles=[article('new', kind='series'), article('member',kind='series'), article('alone')]
        for row in self.articles:
            self.publish(row['articleId'])
        self.step(0)
        self.assertEqual(len(self.messages),3)
        self.assertIn('台北', '\n'.join(self.messages))
        self.feed[0]['title']='Changed'; self.feed[0]['guid']='changed-guid'
        self.step(1);self.assertEqual(len(self.messages),3)
        self.step(2);self.assertEqual(len(self.messages),3)

    def test_delayed_publication_separates_schedule_from_successful_page_confirmation(self):
        self.initialize()
        planned=timestamp('2026-10-26T07:00:00+08:00')
        confirmed=timestamp('2026-10-26T09:24:50+08:00')
        started=timestamp('2026-10-26T09:23:00+08:00')
        self.articles=[article('late',at=planned)];self.publish('late',date=planned)
        url=self.articles[0]['canonicalUrl'];self.pages[url]['observedAt']=confirmed
        self.public_window=[started,confirmed+10]
        self.monitor().run_round(started,started)
        expected='Title late\n'+url+'\n原定發布時間（台北）：2026-10-26 07:00\n公開確認時間（台北）：2026-10-26 09:24'
        self.assertEqual(self.messages,[expected])
        self.pages[url]['observedAt']=confirmed+3600;self.public_window=[started+3600,confirmed+3610]
        self.monitor().run_round(started+3600,started+3600)
        self.assertEqual(self.messages,[expected])
        with sqlite3.connect(self.db) as db:
            self.assertEqual(db.execute("SELECT message,status FROM monitor_events WHERE event_id=?",('article:'+url,)).fetchone(),(expected,'sent'))

    def test_missing_schedule_and_invalid_confirmation_are_explicitly_unknown(self):
        self.initialize();self.articles=[article('manual',state='unscheduled')];self.publish('manual')
        self.step(0)
        self.assertIn('原定發布時間（台北）：未提供',self.messages[0])
        self.assertIn('公開確認時間（台北）：未記錄',self.messages[0])

    def test_invalid_confirmation_never_uses_metadata_or_round_time(self):
        cases=[(True,[BASE,BASE+1]),(float('nan'),[BASE,BASE+1]),
               (float('inf'),[BASE,BASE+1]),(BASE-1,[BASE,BASE+1]),
               (BASE+2,[BASE,BASE+1]),(BASE,[BASE+1,BASE]),
               (BASE,[False,BASE]),(BASE,[BASE,float('inf')]),
               (BASE,None),(BASE,[BASE]),('2026-10-15T07:00:00+08:00',[BASE,BASE+1])]
        for index,(observed,window) in enumerate(cases):
            with self.subTest(index=index):
                self.db=Path(self.tmp.name)/('invalid-'+str(index)+'.sqlite')
                self.articles=[];self.feed=[];self.pages={};self.messages=[];self.initialize()
                self.articles=[article()];self.publish()
                self.pages[article()['canonicalUrl']]['observedAt']=observed
                self.public_window=window;self.step(0)
                self.assertEqual(len(self.messages),1)
                self.assertTrue(self.messages[0].endswith('公開確認時間（台北）：未記錄'))

    def test_initial_history_and_partial_baseline(self):
        self.articles=[article()];self.publish();self.pages[article()['canonicalUrl']]=dict(status=503)
        self.step(-1);self.assertEqual(self.messages,[])
        with sqlite3.connect(self.db) as db:
            self.assertNotIn('initialized',dict(db.execute('SELECT key,value FROM meta')))
        self.pages.clear();self.feed.clear();self.publish();self.step(0)
        self.step(1);self.assertEqual(self.messages,[])

    def test_transition_preserves_sent_uncertain_baseline_and_new_arrival(self):
        with sqlite3.connect(self.db) as db:
            db.executescript('CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE outbox(url TEXT PRIMARY KEY,guid TEXT,status TEXT NOT NULL);')
            db.executemany('INSERT INTO meta VALUES(?,?)',[('mode','live'),('site',SITE),('initialized',str(BASE-3600))])
            db.executemany('INSERT INTO outbox VALUES(?,?,?)',[(SITE+'posts/'+slug+'/',slug,status) for slug,status in [('old','sent'),('unknown','uncertain'),('history','baseline')]])
        self.articles=[article(x) for x in ['old','unknown','history','new']]
        for row in self.articles:self.publish(row['articleId'])
        # Test mode may operate only private fixture state explicitly bound to this transport.
        self.step(0)
        self.assertEqual(len(self.messages),1)
        self.assertIn('/new/',self.messages[0])
        with sqlite3.connect(self.db) as db:
            self.assertEqual(db.execute('SELECT status FROM outbox WHERE url=?',(SITE+'posts/unknown/',)).fetchone()[0],'uncertain')

    def test_exact_grace_and_unaligned_repeated_overdue(self):
        for seconds, expected in [(3599,0),(3600,1)]:
            self.db=Path(self.tmp.name)/('boundary-'+str(seconds)+'.sqlite')
            self.initialize();self.articles=[article()];self.pages[article()['canonicalUrl']]=dict(status=404)
            self.step(0,now=BASE+seconds)
            self.assertEqual(len(self.messages),expected)
            self.messages.clear()
        self.db=Path(self.tmp.name)/'unaligned.sqlite';self.initialize();self.articles=[article()];self.pages[article()['canonicalUrl']]=dict(status=410)
        for hour in [0,1,2]:self.step(hour, now=BASE+2400+hour*3600)
        self.assertEqual(len(self.messages),1)
        self.assertIn('08:40',self.messages[0]);self.assertIn('07:00',self.messages[0])

    def test_failed_or_stale_reads_estimate_and_page_before_rss(self):
        self.initialize();self.articles=[article()];self.pages[article()['canonicalUrl']]=dict(status=404)
        for source in ['bad_summary','bad_feed','stale']:
            setattr(self,source,True);self.step(2);setattr(self,source,False)
        self.articles=[article(state='estimate-only')];self.step(3)
        self.articles=[article()];self.pages[article()['canonicalUrl']]=dict(status=503);self.step(4)
        self.pages[article()['canonicalUrl']]=dict(status=200,canonicalUrl=article()['canonicalUrl'],publishedAt=datetime.fromtimestamp(BASE,timezone.utc).isoformat());self.step(5)
        self.assertEqual(self.messages,[])

    def test_wrong_page_future_date_and_unknown_observations(self):
        self.initialize();self.articles=[article()];self.publish(wrong=True);self.step(0)
        self.feed.clear();self.publish(date=BASE+7200);self.step(1)
        self.assertEqual(self.messages,[])

    def test_pause_reschedule_cancel_and_missing_are_not_recovery(self):
        self.initialize();self.articles=[article()];self.pages[article()['canonicalUrl']]=dict(status=404);self.step(1)
        self.assertEqual(len(self.messages),1)
        for hour,state in [(2,'paused'),(3,'cancelled'),(4,'unscheduled')]:self.articles=[article(state=state)];self.step(hour)
        self.articles=[];self.step(5);self.assertEqual(len(self.messages),1)
        self.articles=[article(at=BASE+7*3600,episode='commit-2')];self.step(6);self.assertEqual(len(self.messages),1)
        self.step(8);self.assertEqual(len(self.messages),2)

    def test_two_bad_two_good_recovery_and_normal_quiet(self):
        self.initialize()
        self.bad_feed=True;self.step(2);self.step(3);self.assertEqual(self.messages,[])
        self.bad_feed=False;self.step(4);self.assertEqual(self.messages,[])
        self.step(5);self.assertEqual(len(self.messages),1)
        self.assertIn('恢復',self.messages[0]);self.step(6);self.assertEqual(len(self.messages),1)

    def test_flapping_independent_and_missed_rounds(self):
        self.initialize();self.bad_feed=True;self.step(0);self.bad_feed=False;self.bad_summary=True;self.step(1);self.bad_summary=False;self.step(2);self.assertEqual(self.messages,[])
        self.bad_feed=True;self.step(3);self.step(4);self.bad_feed=False;self.step(5)
        self.step(7);self.assertEqual(self.messages,[])
        self.bad_feed=True;self.step(8);self.bad_feed=False;self.step(9);self.step(10)
        self.assertEqual(len(self.messages),1)

    def test_duplicate_round_and_restart_do_not_count_retries(self):
        self.initialize();self.bad_feed=True;self.step(0);self.step(0);self.step(0);self.bad_feed=False;self.step(1);self.step(2)
        self.assertEqual(self.messages,[])
        self.bad_feed=True;self.step(3);self.step(4);self.bad_feed=False;self.step(5);self.step(6)
        self.assertEqual(len(self.messages),1)

    def test_late_article_combines_recovery_independent_source_kept(self):
        self.initialize();self.articles=[article()];self.pages[article()['canonicalUrl']]=dict(status=404);self.step(1);self.assertEqual(len(self.messages),1)
        self.bad_feed=True;self.step(2);self.step(3);self.bad_feed=False;self.publish();self.step(4)
        self.assertEqual(len(self.messages),2);self.assertIn('逾期已解除',self.messages[1])
        self.step(5);self.assertEqual(len(self.messages),3);self.assertIn('RSS',self.messages[2])
        self.step(6);self.assertEqual(len(self.messages),3)

    def test_unknown_intent_never_resends_and_definite_failure_can_retry(self):
        self.initialize();self.articles=[article()];self.publish()
        def unknown(message):
            with sqlite3.connect(self.db) as db:
                self.assertEqual(db.execute('SELECT status FROM monitor_events').fetchone()[0],'intent')
            raise TimeoutError('response lost')
        self.step(0,monitor=self.monitor(unknown));self.step(1);self.assertEqual(self.messages,[])
        with sqlite3.connect(self.db) as db:self.assertEqual(db.execute('SELECT status FROM monitor_events').fetchone()[0],'unknown')
        self.articles.append(article('b'));self.publish('b')
        from publication_monitor import DeliveryRejected
        self.step(2,monitor=self.monitor(lambda message: (_ for _ in ()).throw(DeliveryRejected())))
        self.step(3);self.assertEqual(len(self.messages),1)
        with sqlite3.connect(self.db) as db:
            self.assertEqual(db.execute("SELECT human_received FROM monitor_events WHERE status='sent'").fetchone()[0],0)

    def test_dry_run_keeps_live_fixture_state_unchanged(self):
        self.initialize();self.articles=[article()];self.publish()
        before=self.db.read_bytes()
        self.step(0,monitor=self.monitor(mode='dry-run'))
        self.assertEqual(self.messages,[]);self.assertEqual(self.db.read_bytes(),before)


if __name__=='__main__':
    unittest.main()
