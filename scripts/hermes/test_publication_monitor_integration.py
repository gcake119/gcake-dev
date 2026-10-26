from contextlib import closing
from datetime import datetime,timezone
import io
import json
import sqlite3
import threading
import unittest
import urllib.error
from unittest.mock import patch
from publication_monitor import PublicationObserver, PublicationMonitor
from rss_monitor import SITE
from test_publication_monitor_acceptance import Acceptance, article, BASE


class Persistence(Acceptance):
    # Inherit fixtures only: hide inherited acceptance tests to avoid counting twice.
    pass


for _name in list(dir(Persistence)):
    if _name.startswith('test_'):
        setattr(Persistence,_name,None)


class Integration(Persistence):
    def test_wal_read_copy_preserves_committed_notifications_and_live_database(self):
        self.initialize()
        with closing(sqlite3.connect(self.db)) as writer:
            writer.execute('PRAGMA journal_mode=WAL');writer.execute("INSERT INTO outbox VALUES(?,?,?)",(SITE+'posts/a/','guid','sent'));writer.commit()
            before=list(writer.iterdump())
            self.articles=[article()];self.publish()
            self.step(0,monitor=self.monitor(mode='dry-run'))
            self.assertEqual(list(writer.iterdump()),before)
            self.assertEqual(self.messages,[])
        self.step(1);self.assertEqual(self.messages,[])

    def test_two_real_overlapping_instances_and_restart_deliver_once(self):
        self.initialize();self.articles=[article()];self.publish()
        entered=threading.Event();release=threading.Event();errors=[]
        def sender(message):
            entered.set();release.wait(5);self.messages.append(message)
        def first():
            try:self.step(0,monitor=self.monitor(sender))
            except Exception as error:errors.append(error)
        thread=threading.Thread(target=first);thread.start()
        try:
            self.assertTrue(entered.wait(5))
            self.assertEqual(self.step(0),[])
        finally:release.set();thread.join(5)
        self.assertFalse(thread.is_alive());self.assertEqual(errors,[])
        self.step(1);self.assertEqual(len(self.messages),1)

    def test_crash_after_delivery_intent_is_uncertain_after_restart(self):
        self.initialize();self.articles=[article()];self.publish()
        class Crash(BaseException):pass
        def sender(message):raise Crash()
        with self.assertRaises(Crash):self.step(0,monitor=self.monitor(sender))
        self.step(1);self.assertEqual(self.messages,[])
        with sqlite3.connect(self.db) as db:
            self.assertEqual(db.execute('SELECT status FROM monitor_events').fetchone()[0],'unknown')
            self.assertEqual(db.execute('SELECT status FROM outbox').fetchone()[0],'uncertain')

    def test_unknown_schema_or_missing_live_state_fails_without_rebaseline(self):
        with sqlite3.connect(self.db) as db:db.executescript('CREATE TABLE private_unknown(value TEXT); INSERT INTO private_unknown VALUES("retain");')
        before=self.db.read_bytes()
        with self.assertRaises(ValueError):self.step(0)
        self.assertEqual(self.db.read_bytes(),before)

    def test_missing_catalogue_entry_is_diagnostic_unknown_not_cancellation(self):
        self.initialize();self.articles=[article()];self.pages[article()['canonicalUrl']]=dict(status=404);self.step(1)
        self.articles=[];self.step(2)
        with sqlite3.connect(self.db) as db:
            unknown=json.loads(db.execute('SELECT value FROM meta WHERE key=?',('monitor_unknown_articles',)).fetchone()[0])
            self.assertIn(article()['canonicalUrl'],unknown)
        self.assertEqual(len(self.messages),1)

    def test_summary_failure_breaks_article_recovery_streak(self):
        self.initialize();self.articles=[article()];self.publish(wrong=True);self.step(0);self.step(1)
        self.feed=[];self.pages[article()['canonicalUrl']]=dict(status=404);self.articles=[article(state='estimate-only')]
        self.bad_summary=True;self.step(2);self.bad_summary=False
        self.step(3);self.assertEqual(self.messages,[])

    def test_rejected_recovery_is_retried_on_next_healthy_round(self):
        from publication_monitor import DeliveryRejected
        self.initialize();self.bad_feed=True;self.step(0);self.step(1);self.bad_feed=False;self.step(2)
        self.step(3,monitor=self.monitor(lambda message: (_ for _ in ()).throw(DeliveryRejected())))
        self.step(4);self.assertEqual(len(self.messages),1)


class Response(io.BytesIO):
    def __init__(self,url,raw,mime='application/json'):
        super().__init__(raw);self.url=url;self.headers={'Content-Type':mime}


class Transport(unittest.TestCase):
    def test_request_bound_fresh_summary_tolerates_small_clock_skew(self):
        from publication_monitor import summary_articles
        at=datetime.fromtimestamp(BASE+1,timezone.utc).isoformat()
        summary=dict(schemaVersion=1,generatedAt=at,gitRevision='rev',queueVersion=1,complete=True,articles=[],requestId='a'*32)
        observed=dict(summary=summary,window=[BASE,BASE+.1],requestId='a'*32)
        self.assertEqual(summary_articles(observed),[])
        summary['requestId']='b'*32
        with self.assertRaises(ValueError):summary_articles(observed)
        summary['requestId']='a'*32
        summary['generatedAt']=datetime.fromtimestamp(BASE+6,timezone.utc).isoformat()
        with self.assertRaises(ValueError):summary_articles(observed)

    def test_actual_observer_parses_rss_canonical_and_jsonld_without_real_network(self):
        at=datetime.fromtimestamp(BASE,timezone.utc).isoformat();row=article();summary=dict(schemaVersion=1,generatedAt=at,gitRevision='rev',queueVersion=1,complete=True,articles=[row])
        seen=[]
        def opener(request,timeout):
            seen.append(request)
            if request.full_url.endswith('/api/v1/monitoring/publications'):
                self.assertEqual(request.get_header('Authorization'),'Bearer fixture-secret')
                return Response(request.full_url,json.dumps(dict(summary,requestId=request.get_header('X-gcake-observation-id'))).encode())
            self.assertIsNone(request.get_header('Authorization'))
            if request.full_url.endswith('rss.xml'):
                rss=f'<rss><channel><item><link>{row["canonicalUrl"]}</link><guid>{row["canonicalUrl"]}</guid><title>Article</title><pubDate>Wed, 14 Oct 2026 23:00:00 GMT</pubDate></item></channel></rss>'
                return Response(request.full_url,rss.encode(),'application/rss+xml')
            html='<link rel="canonical" href="'+row['canonicalUrl']+'"><script type="application/ld+json">'+json.dumps({'@type':'BlogPosting','datePublished':at})+'</script>'
            return Response(request.full_url,html.encode(),'text/html')
        ticks=iter([BASE,BASE+1,BASE+10,BASE+110,BASE+111])
        observer=PublicationObserver('http://127.0.0.1:1/api/v1/monitoring/publications','fixture-secret',opener=opener,clock=lambda:next(ticks),allow_loopback=True)
        with patch('urllib.request.OpenerDirector.open',side_effect=AssertionError('real network forbidden')):
            observation=observer(BASE)
        self.assertEqual(len(seen),3);self.assertEqual(observation['pages'][row['canonicalUrl']]['publishedAt'],at)
        self.assertEqual(observation['window'],[BASE,BASE+1])
        self.assertEqual(observation['publicWindow'],[BASE+10,BASE+111])
        self.assertEqual(observation['pages'][row['canonicalUrl']]['observedAt'],BASE+110)

    def test_read_retries_three_attempts_but_no_retry_for_auth_or_malformed_response(self):
        for code,expected in [(503,3),(429,3),(401,1),(403,1),(404,1)]:
            calls=[];delays=[]
            def fail(request,timeout):
                calls.append(request);raise urllib.error.HTTPError(request.full_url,code,'bounded',{},io.BytesIO(b''))
            observer=PublicationObserver('http://127.0.0.1:1/api/v1/monitoring/publications','fixture',opener=fail,sleep=delays.append,allow_loopback=True)
            with self.assertRaises(urllib.error.HTTPError):observer._get(observer.url)
            self.assertEqual(len(calls),expected);self.assertEqual(delays,[2,5] if expected==3 else [])


if __name__=='__main__':unittest.main()
