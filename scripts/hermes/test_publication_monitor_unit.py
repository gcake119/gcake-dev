import unittest
from publication_monitor import instant, evidence, summary_articles, taipei
from rss_monitor import SITE
from test_publication_monitor_acceptance import article, BASE
from datetime import datetime,timezone


class Unit(unittest.TestCase):
    def test_explicit_timezone_and_taipei(self):
        self.assertEqual(taipei(BASE),'2026-10-15 07:00')
        for value in ['2026-10-15','2026-10-15T07:00:00',None]:
            with self.assertRaises(ValueError):instant(value)

    def test_absence_and_page_metadata_boundaries(self):
        row=article();url=row['canonicalUrl'];at=datetime.fromtimestamp(BASE,timezone.utc).isoformat()
        item=dict(url=url,guid=url,title='a',publishedAt=at)
        page=dict(status=200,canonicalUrl=url,publishedAt=at)
        self.assertEqual(evidence(row,item,page,BASE),'public')
        self.assertEqual(evidence(row,None,page,BASE),'inconsistent')
        self.assertEqual(evidence(row,item,page,BASE-1),'inconsistent')
        for status in [401,403,500,503,0]:self.assertEqual(evidence(row,None,dict(status=status),BASE),'unknown')
        for status in [404,410]:self.assertEqual(evidence(row,None,dict(status=status),BASE),'absent')
        item['guid']='different-identity';self.assertNotEqual(evidence(row,item,page,BASE),'public')
        page['canonicalUrl']=SITE;self.assertEqual(evidence(row,item,page,BASE),'unknown')

    def test_failed_stale_incomplete_or_ambiguous_summary(self):
        at=datetime.fromtimestamp(BASE,timezone.utc).isoformat()
        obs=dict(window=[BASE,BASE],summary=dict(schemaVersion=1,generatedAt=at,gitRevision='r',queueVersion=1,complete=True,articles=[article()]))
        self.assertEqual(len(summary_articles(obs)),1)
        for change in [dict(complete=False),dict(queueVersion=True),dict(articles=[article(),article()]),dict(generatedAt='2026-10-15T06:00:00+08:00')]:
            bad={**obs,'summary':{**obs['summary'],**change}}
            with self.assertRaises(ValueError):summary_articles(bad)


if __name__=='__main__':unittest.main()
