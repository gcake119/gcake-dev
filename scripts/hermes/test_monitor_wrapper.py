import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import unittest
from contextlib import closing
from datetime import datetime,timezone
from monitor_wrapper import render_wrapper


class Wrapper(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='monitor-wrapper-')
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)/'paths with spaces';self.root.mkdir()
        self.lib=self.root/'lib';self.lib.mkdir()
        for name in ('publication_monitor.py','rss_monitor.py'):
            shutil.copy2(Path(__file__).with_name(name),self.lib/name)
        self.db=self.root/'state.sqlite'
        with closing(sqlite3.connect(self.db)) as conn,conn:
            conn.executescript('CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE outbox(url TEXT PRIMARY KEY,guid TEXT,status TEXT NOT NULL);')
            conn.executemany('INSERT INTO meta VALUES(?,?)',[('initialized','1'),('mode','live'),('site','https://gcake119.github.io/gcake-dev/')])
        self.legacy=self.root/'legacy.env';self.legacy.write_text('HERMES_RSS_NOTIFY_ENABLED=true\n')
        self.summary=self.root/'summary.env';self.summary.write_text("PUBLICATION_MONITOR_SUMMARY_URL=https://fixture.invalid/api/v1/monitoring/publications\nPUBLICATION_MONITOR_READ_SECRET=fixture-canary-private\n")
        self.env=dict(PATH='/usr/bin:/bin',HERMES_CRON_JOB_ID='test-job',HERMES_CRON_EXECUTION_ID='test-execution',HERMES_CRON_SCHEDULED_INSTANT=datetime.fromtimestamp(__import__('time').time()-10,timezone.utc).isoformat())
        # Real observer fetch path, with HTTP fixture responses installed before CLI.
        helper=self.lib/'rss_monitor.py'
        raw=helper.read_text()
        hook='''
import io,json,urllib.request
from datetime import datetime,timezone
class _FixtureResponse(io.BytesIO):
    def __init__(self,url,data,mime):
        super().__init__(data);self.url=url;self.headers={'Content-Type':mime}
def _fixture_open(self,request,timeout=20):
    if request.full_url.endswith('/api/v1/monitoring/publications'):
        data=json.dumps(dict(schemaVersion=1,generatedAt=datetime.now(timezone.utc).isoformat(),gitRevision='fixture',queueVersion=0,complete=True,articles=[])).encode()
        return _FixtureResponse(request.full_url,data,'application/json')
    if request.full_url.endswith('/rss.xml'):
        return _FixtureResponse(request.full_url,b'<rss><channel></channel></rss>','application/rss+xml')
    raise AssertionError('Unexpected fixture HTTP request')
urllib.request.OpenerDirector.open=_fixture_open
'''
        helper.write_text(raw.replace("if __name__ == '__main__':",hook+"\nif __name__ == '__main__':"))

    def run_wrapper(self,env=None):
        path=self.root/'wrapper.sh'
        path.write_text(render_wrapper(job_id='test-job',legacy_env=self.legacy,summary_env=self.summary,library=self.lib,db=self.db))
        return subprocess.run(['/bin/bash',str(path)],env=env or self.env,capture_output=True,text=True,timeout=10)

    def test_actual_isolated_python_import_and_dry_run(self):
        before=self.db.read_bytes();result=self.run_wrapper()
        self.assertEqual(result.returncode,0,result.stderr+result.stdout)
        self.assertEqual(json.loads(result.stdout),{'evaluated_messages':0,'mode':'dry-run'})
        self.assertEqual(self.db.read_bytes(),before)
        self.assertNotIn('fixture-canary-private',result.stdout+result.stderr)

    def test_missing_wrong_or_overwritten_context_refuses_without_state_change(self):
        before=self.db.read_bytes()
        for env in ({k:v for k,v in self.env.items() if k!='HERMES_CRON_EXECUTION_ID'},{**self.env,'HERMES_CRON_JOB_ID':'wrong-job'}):
            self.assertNotEqual(self.run_wrapper(env).returncode,0)
            self.assertEqual(self.db.read_bytes(),before)
        self.summary.write_text(self.summary.read_text()+'HERMES_CRON_SCHEDULED_INSTANT=2000-01-01T00:00:00Z\n')
        result=self.run_wrapper()
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(self.db.read_bytes(),before)
        self.assertNotIn('fixture-canary-private',result.stdout+result.stderr)

    def test_managed_identity_mode_and_recovery_preflight(self):
        from updater_guard import init_root, tree, digest, atomic
        from test_updater_guard import fixture_bundle
        isolated=tempfile.TemporaryDirectory(prefix='guarded-wrapper-',dir='/private/tmp');self.addCleanup(isolated.cleanup)
        managed=Path(isolated.name)/'managed';init_root(managed)
        bundle=self.root/'release';manifest,_=fixture_bundle(bundle,'guarded')
        shutil.copytree(bundle/'payload',managed/'current')
        target=managed/'current/library';shutil.copytree(self.lib,target,dirs_exist_ok=True)
        shutil.copy2(Path(__file__).with_name('updater_guard.py'),target/'updater_guard.py')
        self.lib=target;manifest['files']=tree(managed/'current');sha=digest(manifest)
        atomic(managed/'active.json',{'manifest':manifest,'digest':sha,'mode':'dry-run'})
        atomic(managed/'approvals.json',{'guarded':sha})
        def invoke(mode):
            path=self.root/'guarded.sh';path.write_text(render_wrapper(job_id='test-job',legacy_env=self.legacy,summary_env=self.summary,library=self.lib,db=self.db,mode=mode,guard_root=managed))
            return subprocess.run(['/bin/bash',str(path)],env=self.env,capture_output=True,text=True,timeout=10)
        before=self.db.read_bytes()
        self.assertEqual(invoke('dry-run').returncode,0)
        self.assertNotEqual(invoke('live').returncode,0)
        atomic(managed/'journal.json',{'phase':'recovery_failed','candidate_digest':sha})
        self.assertNotEqual(invoke('dry-run').returncode,0)
        (managed/'journal.json').unlink();(managed/'current/runtime/dependency').write_text('drift')
        result=invoke('dry-run');self.assertNotEqual(result.returncode,0)
        self.assertEqual(self.db.read_bytes(),before)
        self.assertNotIn('fixture-canary-private',result.stdout+result.stderr)


    def test_shared_entrypoint_reuses_actual_sender_context_and_one_notification_ledger(self):
        from unittest.mock import patch
        import monitor_wrapper
        tools=self.root/'tools';tools.mkdir()
        for name in ['shared_publication_monitor.py','substack_attention.py']:
            shutil.copy2(Path(__file__).with_name(name),tools/name)
        helper=self.lib/'rss_monitor.py';raw=helper.read_text()
        old="gitRevision='fixture',queueVersion=0,complete=True,articles=[]"
        block="gitRevision='fixture',queueVersion=0,complete=True,articles=[],requestId=dict((k.lower(),v) for k,v in request.header_items()).get('x-gcake-observation-id'),substackPublications=dict(complete=True,publications=[dict(slug='published',id='221098688',revision='sha256:'+'a'*64,title='Published',actualAt='2026-10-21T23:01:02.155Z',confirmedAt='2026-10-21T23:00:00Z',differenceSeconds=62.155)])"
        self.assertIn(old,raw);raw=raw.replace(old,block)
        raw=raw.replace("    raise AssertionError('Unexpected fixture HTTP request')","    if request.full_url.startswith('https://api.telegram.org/'):\n        return _FixtureResponse(request.full_url,b'{\"ok\":true,\"result\":{\"message_id\":777}}','application/json')\n    raise AssertionError('Unexpected fixture HTTP request')")
        helper.write_text(raw)
        self.legacy.write_text('HERMES_RSS_NOTIFY_ENABLED=true\nTELEGRAM_BOT_TOKEN=123:fixture_only\nTELEGRAM_CHAT_ID=42\n')
        with patch.object(monitor_wrapper,'__file__',str(tools/'monitor_wrapper.py')):
            script=render_wrapper(job_id='test-job',legacy_env=self.legacy,summary_env=self.summary,library=self.lib,db=self.db,mode='live',entrypoint='shared_publication_monitor')
        def invoke():return subprocess.run(['/bin/bash','-c',script],env=self.env,capture_output=True,text=True,timeout=10)
        first=invoke();self.assertEqual(first.returncode,0,first.stdout+first.stderr)
        self.assertEqual(json.loads(first.stdout)['substack']['sent'],1)
        second=invoke();self.assertEqual(second.returncode,0,second.stdout+second.stderr)
        with closing(sqlite3.connect(self.db)) as db:
            self.assertEqual(db.execute('SELECT kind,status FROM monitor_events').fetchall(),[('substack','sent')])
            self.assertEqual(db.execute('SELECT status,message_id FROM monitor_delivery_attempts').fetchall(),[('sent',777)])
        self.assertNotIn('fixture-canary-private',first.stdout+first.stderr)
        self.assertNotIn('fixture_only',first.stdout+first.stderr)

    def test_shared_dry_run_keeps_the_existing_live_database_unchanged(self):
        from unittest.mock import patch
        import monitor_wrapper
        tools=self.root/'tools';tools.mkdir()
        for name in ['shared_publication_monitor.py','substack_attention.py']:shutil.copy2(Path(__file__).with_name(name),tools/name)
        with patch.object(monitor_wrapper,'__file__',str(tools/'monitor_wrapper.py')):
            script=render_wrapper(job_id='test-job',legacy_env=self.legacy,summary_env=self.summary,library=self.lib,db=self.db,entrypoint='shared_publication_monitor')
        before=self.db.read_bytes();result=subprocess.run(['/bin/bash','-c',script],env=self.env,capture_output=True,text=True,timeout=10)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr);self.assertEqual(self.db.read_bytes(),before)

    def test_unreviewed_monitor_entrypoint_is_rejected(self):
        with self.assertRaises(ValueError):render_wrapper(job_id='test-job',legacy_env=self.legacy,summary_env=self.summary,library=self.lib,db=self.db,entrypoint='../unreviewed')


if __name__=='__main__':unittest.main()
