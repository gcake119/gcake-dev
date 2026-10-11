import unittest, tempfile
from pathlib import Path
from rss_poller import Poller, verify_page
BASE='https://gcake119.github.io/gcake-dev/'
def feed(slugs):
 return '<rss><channel>'+''.join(f'<item><title>{s}</title><link>{BASE}posts/{s}/</link><guid>{BASE}posts/{s}/</guid><pubDate>Mon, 12 Oct 2026 07:00:00 +0800</pubDate></item>' for s in slugs)+'</channel></rss>'
def page(slug):
 return '<html><link rel="canonical" href="'+BASE+'posts/'+slug+'/"><script type="application/ld+json">{"@type":"BlogPosting","headline":"'+slug+'","datePublished":"2026-10-12T07:00:00+08:00"}</script></html>'
class Tests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.state=Path(self.tmp.name)/'state.json';self.sent=[]
 def tearDown(self):self.tmp.cleanup()
 def runner(self,send=None):return Poller(self.state,BASE,lambda url:page(url.rstrip('/').split('/')[-1]),send or (lambda message:self.sent.append(message)),lambda:0)
 def test_baseline_restart_canonical_dedupe(self):
  self.runner().poll(feed(['old']));self.assertEqual(self.sent,[])
  self.runner().poll(feed(['new','old']));self.assertEqual(len(self.sent),1);self.assertIn('Asia/Taipei',self.sent[0])
  self.runner().poll(feed(['new','old']));self.assertEqual(len(self.sent),1)
 def test_unknown_send_survives_restart_without_duplicate(self):
  self.runner().poll(feed(['old']))
  def lost(_):raise TimeoutError('unknown')
  result=self.runner(lost).poll(feed(['new','old']));self.assertEqual(result['unknown'],1)
  self.runner().poll(feed(['new','old']));self.assertEqual(self.sent,[])
 def test_bad_page_feed_outage_backoff(self):
  p=self.runner();p.poll(feed(['old']))
  broken=Poller(self.state,BASE,lambda url:'<html>not article</html>',lambda msg:self.sent.append(msg),lambda:0)
  result=broken.poll(feed(['new','old']));self.assertGreater(result['retry_at'],0);self.assertEqual(self.sent,[])
  self.assertFalse(verify_page('<html></html>',BASE+'posts/new/','new'))
 def test_two_pollers_use_exclusive_lock(self):
  import fcntl
  lock=self.state.with_suffix('.lock');f=lock.open('a');fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)
  with self.assertRaises(BlockingIOError):self.runner().poll(feed(['old']))
  f.close()
if __name__=='__main__':unittest.main()
