import unittest, tempfile, os
from pathlib import Path
from rss_monitor import Monitor, parse_feed, verify_page
from email.utils import parsedate_to_datetime
BASE=parsedate_to_datetime('Mon, 12 Oct 2026 00:00:00 GMT').timestamp()
SITE='https://gcake119.github.io/gcake-dev/'
def feed(items):
 return '<rss><channel>'+''.join(f'<item><title>{title}</title><link>{SITE}posts/{slug}/</link><guid>{guid}</guid><pubDate>Mon, 12 Oct 2026 00:00:00 GMT</pubDate></item>' for slug,title,guid in items)+'</channel></rss>'
class Tests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.db=str(Path(self.tmp.name)/'monitor.sqlite');self.messages=[];self.items=[];self.bad=False
 def fetch(self,url):
  if url.endswith('rss.xml'): return feed(self.items).encode(),url,'application/rss+xml'
  if self.bad: raise OSError('page offline')
  return f'<html><head><link rel="canonical" href="{url}"></head><body>Article</body></html>'.encode(),url,'text/html'
 def monitor(self):return Monitor(self.db,SITE,self.fetch,self.messages.append,live=True)
 def test_baseline_new_and_restart(self):
  self.items=[('old','Old','g1')];self.assertEqual(self.monitor().poll(BASE+1000),[])
  self.items.append(('new','New','g2'));self.assertEqual(len(self.monitor().poll(BASE+4600)),1)
  self.assertEqual(len(self.messages),1);self.assertIn('New',self.messages[0]);self.assertIn('2026-10-12 08:00',self.messages[0]);self.assertIn(SITE+'posts/new/',self.messages[0])
  self.items[1]=('new','New changed GUID','g3');self.assertEqual(self.monitor().poll(BASE+8200),[]);self.assertEqual(len(self.messages),1)
 def test_page_outage_retries_without_false_notice(self):
  self.monitor().poll(BASE+1000);self.items=[('new','New','g')];self.bad=True
  with self.assertRaises(OSError):self.monitor().poll(BASE+4600)
  self.assertEqual(self.messages,[]);self.bad=False
  self.assertEqual(self.monitor().poll(BASE+4601),[]);self.assertEqual(len(self.monitor().poll(BASE+8200)),1)
 def test_uncertain_send_never_retries(self):
  self.monitor().poll(BASE+1000);self.items=[('new','New','g')]
  def failed(_):raise OSError('response lost')
  with self.assertRaises(OSError):Monitor(self.db,SITE,self.fetch,failed,live=True).poll(BASE+4600)
  self.assertEqual(self.monitor().poll(BASE+8200),[]);self.assertEqual(self.messages,[])
  self.assertIn('uncertain',self.monitor().statuses().values())
 def test_canonical_and_external_guard(self):
  with self.assertRaises(ValueError):verify_page(b'<html>not canonical</html>',SITE+'posts/new/',SITE+'posts/new/','text/html')
  self.assertEqual(parse_feed(b'<rss><channel><item><link>https://evil.test/x</link></item></channel></rss>',SITE),[])
 def test_private_database_and_dry_run_isolation(self):
  self.monitor().poll(BASE+1000);self.assertEqual(os.stat(self.db).st_mode & 0o777,0o600)
  with self.assertRaises(ValueError):Monitor(self.db,SITE,self.fetch,self.messages.append,live=False).poll(BASE+4600)
 def test_legacy_production_state_retains_deduplication(self):
  import sqlite3
  from contextlib import closing
  self.items=[('old','Old','g1')];self.monitor().poll(BASE+1000)
  with closing(sqlite3.connect(self.db)) as db,db:db.execute("DELETE FROM meta WHERE key='site'")
  self.assertEqual(self.monitor().poll(BASE+4600),[])
  self.items.append(('new','New','g2'));self.assertEqual(len(self.monitor().poll(BASE+8200)),1)
  self.assertEqual(len(self.messages),1)
 def test_utf16_entities_and_url_controls_rejected(self):
  raw=('<?xml version="1.0" encoding="UTF-16"?><!DOCTYPE rss [<!ENTITY title "expanded">]><rss><channel/></rss>').encode('utf-16')
  with self.assertRaises(ValueError):parse_feed(raw,SITE)
  from rss_monitor import canonical_url
  with self.assertRaises(ValueError):canonical_url(SITE+'posts/ne\nw/',SITE)
 def test_public_revision_proof_rejects_stale_page(self):
  url=SITE+'posts/new/'
  html=f'<html><head><link rel="canonical" href="{url}"><meta name="gcake-source-revision" content="expected"></head></html>'.encode()
  verify_page(html,url,url,'text/html',revision='expected')
  with self.assertRaises(ValueError):verify_page(html,url,url,'text/html',revision='stale')
if __name__=='__main__':unittest.main()
