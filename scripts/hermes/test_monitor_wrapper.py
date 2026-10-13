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


if __name__=='__main__':unittest.main()
