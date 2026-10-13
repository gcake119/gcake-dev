import contextlib
import copy
import unittest
from activate_production import activate

DIGEST='8e285697719b62295eae5bd8db23ed52b8da6f6dbe585eabef91b835462f9f2e'
MAIN='550aaf17723d'
DRY='ea3c550669f1'

class Store:
    def __init__(self):self.policy=dict(digest=DIGEST,mode='dry-run');self.status='ready'
    def active(self):return self.policy.copy()
    def maintenance(self):return contextlib.nullcontext()
    def gate(self,status,digest=None,mode='dry-run'):self.status=status
    def select(self,mode):self.policy['mode']=mode

class Actor:
    def __init__(self):
        self.rows={MAIN:dict(id=MAIN,enabled=True,no_agent=True,schedule=dict(kind='interval',minutes=60),script='gcake-rss-live.sh'),
                   DRY:dict(id=DRY,enabled=True,no_agent=True,schedule=dict(kind='interval',minutes=60),script='gcake-rss-dry.sh')}
        self.pauses=0;self.history=b'sent and uncertain history';self.fail=False
    def jobs(self):return copy.deepcopy(self.rows)
    def db_hash(self):return self.history
    def pause(self):
        self.pauses+=1;self.rows[DRY]['enabled']=False;self.rows[DRY]['paused_reason']='gcake-managed-live-activation'
        if self.fail:raise RuntimeError('pause-check-failed')

class Acceptance(unittest.TestCase):
    def setup(self):
        store=Store();actor=Actor();journal={}
        def load():return copy.deepcopy(journal) if journal else None
        def save(value):journal.clear();journal.update(copy.deepcopy(value))
        return store,actor,journal,load,save
    def test_success_pauses_only_old_dry_job_preserves_main_and_history(self):
        s,a,j,l,w=self.setup();before=a.jobs()[MAIN];history=a.history
        result=activate(s,a,l,w)
        self.assertEqual(result['status'],'activated-live');self.assertEqual(s.policy['mode'],'live')
        self.assertEqual(s.status,'ready');self.assertEqual(a.jobs()[MAIN],before)
        self.assertFalse(a.jobs()[DRY]['enabled']);self.assertEqual(a.history,history)
    def test_failure_keeps_sender_dry_and_preserves_history(self):
        s,a,j,l,w=self.setup();a.fail=True
        with self.assertRaises(RuntimeError):activate(s,a,l,w)
        self.assertEqual(s.policy['mode'],'dry-run');self.assertEqual(s.status,'ready')
        self.assertEqual(j['phase'],'blocked');self.assertEqual(a.history,b'sent and uncertain history')
    def test_committed_retry_does_not_repeat_job_operation(self):
        s,a,j,l,w=self.setup();activate(s,a,l,w);result=activate(s,a,l,w)
        self.assertEqual(a.pauses,1);self.assertEqual(result['status'],'already-live')
    def test_interrupted_selection_recovers_before_live_activation(self):
        s,a,j,l,w=self.setup();j.update(phase='selecting-live',digest=DIGEST);s.select('live');s.status='maintenance'
        self.assertEqual(activate(s,a,l,w)['status'],'activated-live');self.assertEqual(s.status,'ready')
    def test_changed_main_wrapper_blocks_before_job_modification(self):
        s,a,j,l,w=self.setup();a.rows[MAIN]['script']='other.sh'
        with self.assertRaises(ValueError):activate(s,a,l,w)
        self.assertEqual(a.pauses,0);self.assertEqual(s.policy['mode'],'dry-run')

if __name__=='__main__':unittest.main()
