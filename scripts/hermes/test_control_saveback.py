"""Local acceptance for installed control protections; never operates production."""
import contextlib
import copy
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import production_entry
import production_owner as owner
import updater_guard as guard
from update_entry import EntryStore
from test_update_entry import bundle


class ControlSaveback(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='gcake-entry-control-saveback-', dir='/private/tmp')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)

    def candidate(self):
        path = bundle(self.base, 'candidate')
        payload = path / 'payload'
        lock = b'offline-fixture-lock'
        proof = dict(schema=1, status='passed', provenance='offline-SDK',
                     lockMatched=True, dependenciesMatched=True, moduleOriginsMatched=True,
                     healthFixturesPassed=True, modelCalls=0, actualTelegramRequests=0,
                     fullGatewayStarted=False, lockSha256=hashlib.sha256(lock).hexdigest(),
                     dependencySymbols=18, inMemoryRequests=1,
                     blockedAttempts=['run_agent','openai','ollama','mlx_lm','gateway.run',
                                      'hermes_cli.main','network-socket','private-read','child-process'],
                     versions={'python-telegram-bot':'22.8','tornado':'6.5.8','httpx':'0.28.1'})
        files = {'code/uv.lock': lock, 'library/telegram-package-health.json': guard.canonical(proof)}
        prefix = 'runtime/lib/python3.11/site-packages/'
        for name, version in proof['versions'].items():
            files[prefix + name.replace('-', '_') + '-' + version + '.dist-info/METADATA'] = b'fixture'
        for name in ('telegram/__init__.py','telegram/ext/__init__.py','telegram/request/_httpxrequest.py',
                     'tornado/web.py','httpx/__init__.py'):
            files[prefix + name] = b'fixture'
        for name, data in files.items():
            file = payload / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(data)
        manifest = guard.read(path / 'manifest.json')
        manifest.update(lock_sha=proof['lockSha256'], files=guard.tree(payload),
                        capability={'telegram':dict(required=True, proof_file='library/telegram-package-health.json',
                                                    post_start_required=True)},
                        verification=dict(passed=True, evidence_sha=hashlib.sha256(guard.canonical(proof)).hexdigest(),
                                          telegram=proof))
        guard.atomic(path / 'manifest.json', manifest)
        return path, manifest

    def test_production_approval_refuses_missing_capability_before_persisting(self):
        path = bundle(self.base, 'without-capability')
        manifest = guard.read(path / 'manifest.json')
        isolated = EntryStore.initialize(self.base / 'authority', os.getuid())
        store = object.__new__(production_entry.ProductionStore)
        store.__dict__.update(isolated.__dict__)
        before = (store.root / 'approvals.json').read_bytes()
        with self.assertRaisesRegex(ValueError, 'telegram-required-capability-missing'):
            store.approve(manifest, guard.digest(manifest))
        self.assertEqual((store.root / 'approvals.json').read_bytes(), before)

    def test_complete_manifest_approves_exact_digest_in_local_authority(self):
        _, manifest = self.candidate()
        isolated = EntryStore.initialize(self.base / 'authority', os.getuid())
        store = object.__new__(production_entry.ProductionStore)
        store.__dict__.update(isolated.__dict__)
        sha = guard.digest(manifest)
        store.approve(manifest, sha)
        self.assertEqual(guard.read(store.root / 'approvals.json')['candidate'], sha)

    def test_package_contract_rejects_missing_tampered_or_external_evidence(self):
        import packaging_contract as contract
        path, manifest = self.candidate()
        self.assertEqual(contract.verify_candidate(path), manifest['verification']['telegram'])
        mutations = [
            lambda m: m.pop('capability'),
            lambda m: m['verification'].pop('telegram'),
            lambda m: m['verification']['telegram'].update(provenance='fixture'),
            lambda m: m['verification']['telegram'].update(actualTelegramRequests=1),
            lambda m: m['verification']['telegram'].update(modelCalls=True),
            lambda m: m['verification']['telegram'].update(fullGatewayStarted=True),
            lambda m: m['verification']['telegram'].update(lockSha256='0'*64),
            lambda m: m['verification']['telegram'].update(blockedAttempts=[]),
            lambda m: m['verification']['telegram'].update(dependenciesMatched=False),
            lambda m: m['verification']['telegram'].update(moduleOriginsMatched=False),
            lambda m: m['verification']['telegram'].update(healthFixturesPassed=False),
            lambda m: m['verification'].update(evidence_sha='0'*64),
            lambda m: m['files'].pop('runtime/lib/python3.11/site-packages/tornado/web.py'),
            lambda m: m['files'].pop('runtime/lib/python3.11/site-packages/httpx-0.28.1.dist-info/METADATA'),
        ]
        for index, mutate in enumerate(mutations):
            broken = copy.deepcopy(manifest)
            mutate(broken)
            with self.subTest(index=index), self.assertRaises(ValueError):
                contract.require_manifest(broken)
        (path / 'payload/code/uv.lock').write_bytes(b'tampered')
        with self.assertRaisesRegex(ValueError, 'payload-integrity-mismatch'):
            contract.verify_candidate(path)

    def managed_update(self, path, manifest):
        authority = self.base / 'managed-authority'
        (authority / 'private').mkdir(parents=True)
        (authority / 'proposals').mkdir()
        sha = guard.digest(manifest)
        guard.atomic(path / 'manifest.json', manifest)
        # The fixture candidate is moved, never installed or selected.
        path.rename(authority / 'proposals' / sha)
        guard.atomic(authority / 'private/next-candidate.json', {'digest':sha})
        guard.atomic(authority / 'approvals.json', {manifest['release_id']:sha})
        guard.atomic(authority / 'private/original-gateway-map.json', {})
        store = SimpleNamespace(safe=lambda p: None)
        entry = SimpleNamespace(ProductionStore=lambda: store)
        controller = Mock()
        controller.UpdateEntry.return_value.update.return_value = {'status':'skipped'}
        supervisor = Mock()
        with patch.object(owner, 'ROOT', authority), patch.object(owner.os, 'geteuid', return_value=0), \
             patch.object(owner, 'updater_exclusion', contextlib.nullcontext), \
             patch.object(owner, 'modules', return_value=(entry, None, guard, controller)), \
             patch.object(owner, 'Supervisor', supervisor), patch.object(owner, 'Actor', Mock()), \
             contextlib.redirect_stdout(io.StringIO()):
            try:
                result = owner.manage('update')
            except ValueError:
                self.assertFalse(supervisor.called)
                self.assertFalse(controller.UpdateEntry.called)
                raise
        self.assertTrue(supervisor.called)
        self.assertTrue(controller.UpdateEntry.return_value.update.called)
        return result

    def test_approved_but_capabilityless_update_never_constructs_supervisor(self):
        path = bundle(self.base, 'unprotected')
        with self.assertRaisesRegex(ValueError, 'telegram-required-capability-missing'):
            self.managed_update(path, guard.read(path / 'manifest.json'))

    def test_verified_update_reaches_existing_controller(self):
        path, manifest = self.candidate()
        self.assertEqual(self.managed_update(path, manifest), 0)

    def health(self):
        now = 1810000000
        iso = lambda n: datetime.fromtimestamp(n, timezone.utc).isoformat()
        start = (now - 3600) * 100
        identity = dict(pid=123, start_time=start, hermes_home='/fixture/home')
        status = dict(answering_pid=123, gateway_state='running', updated_at=iso(now),
                      platforms={'default:telegram':dict(state='connected', writer_pid=123,
                      writer_start_time=start, updated_at=iso(now-3500))})
        return now, iso, identity, status

    def test_current_boot_health_and_rejection_boundaries(self):
        from telegram_health import check_current
        now, iso, identity, status = self.health()
        self.assertEqual(check_current(identity,status,pid=123,home='/fixture/home',now=now),
                         dict(status='passed',scope='current-boot-runtime',humanReceipt='not_run'))
        cases = [dict(answering_pid=999),dict(updated_at=iso(now-91)),dict(updated_at=iso(now+6)),
                 dict(restart_requested=True),dict(exit_reason='failure'),dict(gateway_state='stopped')]
        for fields in cases:
            with self.subTest(fields=fields), self.assertRaises(ValueError):
                check_current(identity,dict(status,**fields),pid=123,home='/fixture/home',now=now)
        for key, value in [('writer_pid',999),('writer_start_time',identity['start_time']-201),
                           ('updated_at',iso(now-3603)),('updated_at',iso(now+6)),('state','failed'),
                           ('error_code','error'),('error_message','error'),('retrying_since','time'),
                           ('needs_attention',True)]:
            broken = copy.deepcopy(status)
            broken['platforms']['default:telegram'][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                check_current(identity,broken,pid=123,home='/fixture/home',now=now)
        for offset in (-5,90):
            check_current(identity,dict(status,updated_at=iso(now-offset)),pid=123,home='/fixture/home',now=now)

    def qualification(self, telegram_state):
        now, iso, identity, status = self.health()
        status['platforms']['default:telegram']['state'] = telegram_state
        home = self.base / 'home'
        receipt = home / '.local/state/gcake-rss/managed-last-run.json'
        receipt.parent.mkdir(parents=True)
        guard.atomic(receipt, dict(execution_id='new',digest='candidate',job_id=owner.JOB_ID,
                                  scheduled_instant='time',uid=502,mode='dry-run',exit_code=0))
        db = self.base / 'state.sqlite'
        db.write_bytes(b'unchanged-fixture')
        payload = self.base / 'candidate'
        service = object.__new__(owner.Supervisor)
        service.store = SimpleNamespace(active=lambda:dict(digest='candidate'),runner_uid=502,gate=Mock())
        service.actor = Mock()
        service.actor.ledger.return_value = [('new',owner.JOB_ID,'time','completed')]
        service.actor.payload.return_value = payload
        identity['hermes_home'] = str(home / '.hermes')
        service.actor.run.side_effect = [dict(uid=502,version='3.11.15',prefix=str(payload/'runtime'),identity=identity),
                                        dict(identity=identity,status=status)]
        service.actor.summary.return_value = dict(complete=True)
        service.pid = lambda: 123
        service.before = set()
        service.before_db = hashlib.sha256(db.read_bytes()).hexdigest()
        with patch.object(owner,'HOME',home), patch.object(owner,'HH',home/'.hermes'), \
             patch.object(owner,'DB',db), patch.object(owner.time,'time',return_value=now), \
             patch.object(owner.subprocess,'run',return_value=SimpleNamespace(stdout='123 502 hermes_cli.main gateway run')):
            if telegram_state == 'connected':
                service.verify_managed()
                service.store.gate.assert_called_once_with('ready','candidate')
            else:
                with self.assertRaisesRegex(ValueError,'telegram-not-connected'):
                    service.verify_managed()
                service.store.gate.assert_not_called()
        self.assertEqual(db.read_bytes(),b'unchanged-fixture')

    def test_supervisor_never_marks_ready_with_disconnected_telegram(self):
        self.qualification('failed')

    def test_supervisor_accepts_current_connected_boot(self):
        self.qualification('connected')

    def test_first_install_refuses_controls_missing_health_dependencies(self):
        controls = dict(schema=1,bundle_digest='a'*64,
                        modules={name:'b'*64 for name in ('production_entry.py','production_install.py',
                        'production_owner.py','production_monitor_dispatch.py','updater_guard.py',
                        'monitor_wrapper.py','update_entry.py')})
        output = io.StringIO()
        with patch.object(owner.os,'geteuid',return_value=0), patch.object(owner.sys,'platform','darwin'), \
             patch.object(owner,'bytes_checked',return_value=json.dumps(controls).encode()), \
             patch.object(owner.pwd,'getpwnam',return_value=SimpleNamespace(pw_uid=502)), \
             patch.object(owner,'updater_exclusion',contextlib.nullcontext), \
             patch.object(owner,'snapshot_baseline') as snapshot, contextlib.redirect_stdout(output):
            self.assertEqual(owner.owner_main('c'*64),1)
        snapshot.assert_not_called()
        self.assertEqual(json.loads(output.getvalue())['error'],'fixed-control-modules-required')

    def test_offline_guard_blocks_external_effects_in_isolated_process(self):
        scripts = Path(__file__).resolve().parent
        code = '''
import sys, socket, subprocess, importlib
sys.path.insert(0,sys.argv[1])
from offline_guard import install
events=install()
actions=[lambda: socket.socket(socket.AF_INET,socket.SOCK_STREAM),
         lambda: socket.getaddrinfo('invalid.example',443),
         lambda: open('/Users/hermes/.hermes/.env'),
         lambda: subprocess.run(['/usr/bin/true']),
         lambda: importlib.import_module('openai'),
         lambda: open(sys.argv[2],'w')]
for action in actions:
    try: action()
    except RuntimeError: pass
    else: raise AssertionError('forbidden-effect-allowed')
print('blocked',len(actions))
'''
        result = subprocess.run([sys.executable,'-I','-B','-S','-c',code,str(scripts),str(self.base/'denied-write')],
                                capture_output=True,text=True,timeout=10)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn('blocked 6',result.stdout)
        self.assertFalse((self.base/'denied-write').exists())


if __name__ == '__main__':
    unittest.main()
