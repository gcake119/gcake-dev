"""Run actual owner-supplied Hermes runner functions, never its gateway/import hooks."""
import ast
import concurrent.futures
import contextvars
import json
import logging
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import types
import unittest
from unittest.mock import patch


FIXTURE=Path(__file__).with_name('fixtures')/'hermes_scheduler_script.py'


class CronScriptContext(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='hermes-script-context-')
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        source=ast.parse(FIXTURE.read_text())
        self.namespace=dict(os=os,sys=sys,shutil=shutil,subprocess=subprocess,time=time,
                            threading=threading,contextvars=contextvars,logger=logging.getLogger('cron-fixture'))
        self.namespace.update(_resolve_script_path=lambda p:(Path(p),None),
                              _get_script_timeout=lambda:5,
                              _windows_cron_python_invocation=lambda p:(p,{}),
                              _sched=types.SimpleNamespace(_RUN_CLAIM_HEARTBEAT_SECONDS=60,heartbeat_run_claim=lambda *a,**k:None))
        code=compile(source,str(FIXTURE),'exec',flags=__import__('__future__').annotations.compiler_flag)
        exec(code,self.namespace)
        self.base={'PATH':os.environ.get('PATH',''),'HERMES_CRON_JOB_ID':'stale-job','HERMES_CRON_EXECUTION_ID':'stale-execution','HERMES_CRON_SCHEDULED_INSTANT':'2000-01-01T00:00:00+00:00'}
        env_service=types.ModuleType('tools.environments.local')
        env_service.build_subprocess_env=lambda **kwargs:self.base.copy()
        redaction=types.ModuleType('agent.redact');redaction.redact_sensitive_text=lambda s:s
        self.modules=patch.dict(sys.modules,{'tools.environments.local':env_service,'agent.redact':redaction})
        self.modules.start();self.addCleanup(self.modules.stop)

    def job(self, identity='job-a', execution='exec-a', scheduled='2026-10-15T07:00:00+08:00'):
        return dict(id=identity,execution_id=execution,_scheduled_instant=scheduled,schedule={'kind':'interval','minutes':60})

    def script(self,suffix):
        p=self.root/('capture'+suffix)
        # Fixed print payload; never enumerate or expose process secrets.
        capture="import os,json;print(json.dumps({k:os.environ.get(k) for k in ['HERMES_CRON_JOB_ID','HERMES_CRON_EXECUTION_ID','HERMES_CRON_SCHEDULED_INSTANT']}))"
        if suffix=='.sh':capture=shutil.which('python3')+" -I -B -S -c '"+capture.replace("'",'"')+"'\n"
        p.write_text(capture)
        return p

    def run_job(self,job,suffix='.py'):
        ok,output=self.namespace['_run_job_script_with_claim_heartbeat'](job,str(self.script(suffix)))
        self.assertTrue(ok,output)
        return json.loads(output)

    def test_python_and_shell_receive_original_occurrence(self):
        for suffix in ('.py','.sh'):
            result=self.run_job(self.job(),suffix)
            self.assertEqual(result,{'HERMES_CRON_JOB_ID':'job-a','HERMES_CRON_EXECUTION_ID':'exec-a','HERMES_CRON_SCHEDULED_INSTANT':'2026-10-14T23:00:00+00:00'})
        self.assertEqual(self.base['HERMES_CRON_JOB_ID'],'stale-job')

    def test_manual_invocation_clears_stale_schedule(self):
        result=self.run_job(self.job(scheduled=None))
        self.assertEqual(result['HERMES_CRON_SCHEDULED_INSTANT'],'')

    def test_parallel_jobs_do_not_mutate_process_environment(self):
        before=os.environ.copy()
        script=self.script('.py')
        def call(n):
            ok,output=self.namespace['_run_job_script_with_claim_heartbeat'](self.job('job-'+str(n),'exec-'+str(n)),str(script))
            self.assertTrue(ok,output);return json.loads(output)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(call,[1,2]))
        self.assertEqual([r['HERMES_CRON_JOB_ID'] for r in results],['job-1','job-2'])
        self.assertEqual(os.environ.copy(),before)

    def test_heartbeat_and_thread_start_failure_preserve_context(self):
        job=self.job();job.update(schedule={'kind':'once'},run_claim={'by':'fixture-owner'})
        self.assertEqual(self.run_job(job)['HERMES_CRON_EXECUTION_ID'],'exec-a')
        with patch('threading.Thread.start',side_effect=RuntimeError('fixture start failure')):
            self.assertEqual(self.run_job(job)['HERMES_CRON_EXECUTION_ID'],'exec-a')

    def test_invalid_context_rejected_before_spawning(self):
        for job in (self.job(identity=''),self.job(execution=None),self.job(scheduled='2026-10-15T07:00:00')):
            with patch('subprocess.Popen') as spawn:
                with self.assertRaises(ValueError):
                    self.namespace['_run_job_script_with_claim_heartbeat'](job,str(self.script('.py')))
                spawn.assert_not_called()

    def test_unscoped_runner_removes_inherited_scheduler_context(self):
        ok,output=self.namespace['_run_job_script'](str(self.script('.py')))
        self.assertTrue(ok,output)
        self.assertEqual(set(json.loads(output).values()),{None})

    def test_real_child_enters_monitor_cli_with_injected_context(self):
        from publication_monitor import PublicationMonitor
        from test_publication_monitor_acceptance import BASE
        from datetime import datetime,timezone
        db=self.root/'fixture.sqlite'
        def observe(now):
            return dict(window=[now,now],summary=dict(schemaVersion=1,generatedAt=datetime.fromtimestamp(now,timezone.utc).isoformat(),gitRevision='fixture',queueVersion=0,complete=True,articles=[]),feed=[],pages={})
        PublicationMonitor(db,observe,mode='test').run_round(BASE-3600,BASE-3600)
        before=db.read_bytes()
        script=self.root/'monitor-entry.py'
        library=str(Path(__file__).resolve().parent)
        script.write_text('import sys\nsys.path.insert(0,'+repr(library)+')\nimport publication_monitor as monitor\nfrom datetime import datetime,timezone\n'+
            'monitor.time.time=lambda: '+repr(BASE+180)+'\n'+
            'monitor.PublicationObserver=lambda *a: lambda now: dict(window=[now,now], summary=dict(schemaVersion=1,generatedAt=datetime.fromtimestamp(now,timezone.utc).isoformat(),gitRevision="fixture",queueVersion=0,complete=True,articles=[]),feed=[],pages={})\n'+
            'sys.argv=["monitor","--db",'+repr(str(db))+']\nmonitor.main()\n')
        self.base.update(PUBLICATION_MONITOR_SUMMARY_URL='https://fixture.invalid/api/v1/monitoring/publications',PUBLICATION_MONITOR_READ_SECRET='fixture-secret',HERMES_RSS_NOTIFY_ENABLED='false')
        ok,output=self.namespace['_run_job_script_with_claim_heartbeat'](self.job(),str(script))
        self.assertTrue(ok,output)
        self.assertEqual(json.loads(output),{'evaluated_messages':0,'mode':'dry-run'})
        self.assertEqual(db.read_bytes(),before)


if __name__=='__main__':unittest.main()
