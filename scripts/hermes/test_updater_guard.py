import fcntl
import hashlib
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from updater_guard import apply_update, recover_update, verify_active

def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(',',':')).encode()

def fixture_bundle(path, release):
    payload=path/'payload';payload.mkdir(parents=True)
    for name in ('code/main.py','runtime/python','runtime/dependency','library/helper.py','wrapper.sh'):
        p=payload/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(release+' '+name);p.chmod(0o600)
    files={}
    for p in sorted(payload.rglob('*')):
        rel=str(p.relative_to(payload))
        files[rel]={'kind':'directory','mode':stat.S_IMODE(p.stat().st_mode)} if p.is_dir() else {'kind':'file','mode':stat.S_IMODE(p.stat().st_mode),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
    manifest=dict(schema=1,release_id=release,source_sha='a'*40,patch_sha='b'*64,python_version='3.11.15',lock_sha='c'*64,verification={'passed':True,'evidence_sha':'d'*64},files=files)
    (path/'manifest.json').write_bytes(canonical(manifest))
    return manifest,hashlib.sha256(canonical(manifest)).hexdigest()

class Service:
    def __init__(self):self.calls=[];self.running=True;self.drain=True;self.fail_on=set()
    def drained(self):self.calls.append('drain');return self.drain
    def stop(self):self.calls.append('stop');self.running=False
    def start(self,current,mode):self.calls.append('start:'+mode);self.running=True
    def verify(self,current):
        self.calls.append('verify');release=(current/'runtime/python').read_text().split()[0]
        if release in self.fail_on:raise RuntimeError('fixture verification failure')
    def activate(self,current,mode):self.calls.append('activate:'+mode)

class UpdateAcceptance(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='updater-acceptance-',dir='/private/tmp');self.addCleanup(self.temp.cleanup)
        self.base=Path(self.temp.name);self.root=self.base/'managed';self.root.mkdir()
        (self.root/'.owned.json').write_text(json.dumps({'schema':1,'root':str(self.root),'uid':os.getuid()}))
        self.old=self.base/'old';self.new=self.base/'new'
        old,oldsha=fixture_bundle(self.old,'old');new,newsha=fixture_bundle(self.new,'new')
        self.catalog={'old':oldsha,'new':newsha};self.oldmanifest=old;self.newmanifest=new
        import shutil
        shutil.copytree(self.old/'payload',self.root/'current')
        (self.root/'active.json').write_text(json.dumps({'manifest':old,'digest':oldsha,'mode':'live'}))
        (self.root/'approvals.json').write_text(json.dumps(self.catalog))
        self.history=self.root/'home/history.json';self.history.parent.mkdir();self.history.write_text(json.dumps({'sent':['old','new-sent'],'unknown':['lost'],'job':'unchanged'}))
        self.before=self.history.read_bytes();self.service=Service()
    def update(self,**kwargs):return apply_update(self.root,self.new,self.catalog,self.service,**kwargs)
    def assert_old(self):
        self.assertEqual((self.root/'current/runtime/python').read_text(),'old runtime/python')
        self.assertEqual((self.root/'current/runtime/dependency').read_text(),'old runtime/dependency')
        self.assertEqual((self.root/'current/wrapper.sh').read_text(),'old wrapper.sh')
        self.assertEqual(self.history.read_bytes(),self.before)
    def test_unknown_skip_retained_once_without_service_calls(self):
        for _ in range(2):self.assertEqual(self.update(catalog_override={'old':self.catalog['old']})['status'],'skipped')
        self.assertEqual(self.service.calls,[]);self.assert_old()
        self.assertEqual(len(list((self.root/'pending').glob('*.json'))),1)
    def test_approved_update_and_explicit_mode(self):
        result=self.update(live_authorized=True)
        self.assertEqual(result['status'],'updated');self.assertEqual(verify_active(self.root,'live')['release_id'],'new')
        self.assertEqual(self.history.read_bytes(),self.before)
    def test_no_live_authority_remains_dry(self):
        self.assertEqual(self.update()['status'],'updated')
        self.assertEqual(verify_active(self.root,'dry-run')['release_id'],'new')
        with self.assertRaises(ValueError):verify_active(self.root,'live')

    def test_initial_live_activation_requires_separate_authority(self):
        from updater_guard import activate_release
        self.assertEqual(self.update()['status'],'updated')
        self.assertEqual(activate_release(self.root,self.service)['status'],'blocked')
        self.assertEqual(activate_release(self.root,self.service,live_authorized=True)['status'],'activated')
        self.assertEqual(verify_active(self.root,'live')['release_id'],'new')
    def test_altered_candidate_blocks_before_stop(self):
        (self.new/'payload/runtime/dependency').write_text('changed')
        self.assertEqual(self.update()['status'],'blocked');self.assertEqual(self.service.calls,[]);self.assert_old()
    def test_external_link_blocks_before_stop(self):
        (self.new/'payload/code/link').symlink_to(self.history)
        self.assertEqual(self.update()['status'],'blocked');self.assertEqual(self.service.calls,[]);self.assert_old()
    def test_traversal_manifest_blocks(self):
        self.newmanifest['files']['../escape']={'kind':'file','mode':0o600,'sha256':'e'*64}
        (self.new/'manifest.json').write_bytes(canonical(self.newmanifest))
        self.assertEqual(self.update()['status'],'blocked');self.assertEqual(self.service.calls,[])
    def test_busy_lock_preserves_service(self):
        with (self.root/'maintenance.lock').open('w') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            self.assertEqual(self.update()['status'],'blocked')
        self.assertEqual(self.service.calls,[]);self.assert_old()
    def test_failed_drain_preserves_running_sender(self):
        self.service.drain=False;self.assertEqual(self.update()['status'],'blocked')
        self.assertEqual(self.service.calls,['drain']);self.assertTrue(self.service.running);self.assert_old()
    def test_disk_limit_blocks(self):
        self.assertEqual(self.update(max_bytes=1)['status'],'blocked');self.assertEqual(self.service.calls,[])
    def test_failure_restores_entire_runtime_not_history(self):
        self.service.fail_on={'new'};self.assertEqual(self.update(live_authorized=True)['status'],'rolled_back')
        self.assert_old();self.assertTrue(self.service.running);self.assertFalse((self.root/'journal.json').exists())
    def test_ordinary_interruption_restores_entire_runtime(self):
        def interrupt(phase):
            if phase=='installed':raise KeyboardInterrupt()
        self.assertEqual(self.update(failpoint=interrupt)['status'],'rolled_back');self.assert_old()
    def test_hard_interruption_recovers_in_fresh_process(self):
        pid=os.fork()
        if pid==0:
            def hard(phase):
                if phase=='old_moved':os._exit(79)
            self.update(failpoint=hard);os._exit(1)
        self.assertEqual(os.waitpid(pid,0)[1]>>8,79)
        self.assertTrue((self.root/'journal.json').exists())
        self.assertEqual(recover_update(self.root,self.service,live_authorized=True)['status'],'rolled_back');self.assert_old()
    def test_failed_recovery_stops_and_does_not_auto_retry(self):
        self.service.fail_on={'old','new'};self.assertEqual(self.update()['status'],'recovery_failed')
        self.assertFalse(self.service.running);self.assertEqual(self.history.read_bytes(),self.before)
        calls=list(self.service.calls);self.assertEqual(self.update()['status'],'blocked');self.assertEqual(self.service.calls,calls)
    def test_drifted_runtime_and_pending_recovery_refuse_invocation(self):
        self.assertEqual(self.update()['status'],'updated')
        (self.root/'current/runtime/dependency').write_text('changed')
        with self.assertRaises(ValueError):verify_active(self.root,'dry-run')
    def test_forbidden_destination_refused(self):
        self.assertEqual(apply_update(Path('/Users/hermes'),self.new,self.catalog,self.service)['status'],'blocked')
        self.assertEqual(self.service.calls,[])

    def test_unverified_unknown_is_reviewed_but_cannot_be_approved(self):
        self.newmanifest['verification']['passed']=False
        (self.new/'manifest.json').write_bytes(canonical(self.newmanifest))
        self.assertEqual(self.update()['status'],'skipped')
        self.catalog['new']=hashlib.sha256(canonical(self.newmanifest)).hexdigest()
        self.assertEqual(self.update()['status'],'blocked');self.assertEqual(self.service.calls,[])

    def test_hard_crash_during_staging_cleans_without_service_stop(self):
        pid=os.fork()
        if pid==0:
            def hard(phase):
                if phase=='staging':os._exit(80)
            self.update(failpoint=hard);os._exit(1)
        self.assertEqual(os.waitpid(pid,0)[1]>>8,80)
        self.assertEqual(recover_update(self.root,self.service)['status'],'blocked')
        self.assertEqual(self.service.calls,[]);self.assert_old()
        self.assertEqual(list(self.root.glob('stage-*')),[])

    def test_reused_release_identity_with_changed_digest_is_blocked(self):
        self.newmanifest['release_id']='old';sha=hashlib.sha256(canonical(self.newmanifest)).hexdigest()
        (self.new/'manifest.json').write_bytes(canonical(self.newmanifest))
        self.catalog['old']=sha
        self.assertEqual(self.update()['status'],'blocked');self.assertEqual(self.service.calls,[]);self.assert_old()

    def test_repeat_approved_current_release_does_not_restart(self):
        self.assertEqual(self.update()['status'],'updated');calls=list(self.service.calls)
        self.assertEqual(self.update()['status'],'updated');self.assertEqual(self.service.calls,calls)

    def test_malformed_manifest_and_insufficient_free_space_block(self):
        self.assertEqual(self.update(min_free=10**30)['status'],'blocked')
        (self.new/'manifest.json').write_text('[]')
        self.assertEqual(self.update()['status'],'blocked');self.assertEqual(self.service.calls,[])

    def test_running_invocation_lease_blocks_update_without_stop(self):
        from updater_guard import invocation_lease
        with invocation_lease(self.root,'live'):
            self.assertEqual(self.update()['status'],'blocked')
        self.assertEqual(self.service.calls,[]);self.assert_old()

    def test_private_environment_file_cannot_enter_approved_payload(self):
        private=self.new/'payload/library/live.env';private.write_text('PRIVATE_CANARY=fixture_only');private.chmod(0o600)
        self.newmanifest['files']['library/live.env']={'kind':'file','mode':0o600,'sha256':hashlib.sha256(private.read_bytes()).hexdigest()}
        (self.new/'manifest.json').write_bytes(canonical(self.newmanifest))
        self.catalog['new']=hashlib.sha256(canonical(self.newmanifest)).hexdigest()
        self.assertEqual(self.update()['status'],'blocked');self.assertEqual(self.service.calls,[]);self.assert_old()

    def test_backup_pruning_preserves_unrelated_named_directory(self):
        unrelated=self.root/'previous-unrelated';unrelated.mkdir();(unrelated/'keep').write_text('not owned by this update')
        self.assertEqual(self.update()['status'],'updated')
        self.assertTrue((unrelated/'keep').exists())
        fresh=self.base/'fresh';manifest,sha=fixture_bundle(fresh,'fresh');self.catalog['fresh']=sha
        self.assertEqual(apply_update(self.root,fresh,self.catalog,self.service)['status'],'updated')
        self.assertTrue((unrelated/'keep').exists())
        backups=[p for p in self.root.glob('previous-*') if p!=unrelated]
        self.assertEqual(len(backups),1);self.assertEqual((backups[0]/'runtime/python').read_text(),'new runtime/python')

    def test_post_commit_receipt_failure_does_not_claim_rollback(self):
        from unittest.mock import patch
        with patch('updater_guard.receipt',side_effect=OSError('fixture disk failure')):
            result=self.update()
        self.assertEqual(result['status'],'updated');self.assertEqual(result['receipt_error'],'OSError')
        self.assertEqual(verify_active(self.root)['release_id'],'new');self.assertEqual(self.history.read_bytes(),self.before)

if __name__=='__main__':unittest.main()
