"""Small filesystem acceptance fixtures; no production writes or transport."""
import json
import os
from pathlib import Path
import tempfile
import subprocess
import pwd
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from updater_guard import atomic, digest, read, tree
from test_update_entry import bundle
from archive_retired_packages import ArchiveTransaction, capacity, extended_attributes, validate_references, read_launch_definition


class Archival(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='gcake-archive-',dir='/private/tmp')
        self.addCleanup(self.tmp.cleanup)
        self.base=Path(self.tmp.name);self.root=self.base/'authority';self.root.mkdir()
        (self.root/'releases').mkdir();(self.root/'manifests').mkdir()
        self.archive=self.base/'cold';self.items=[]
        for name in ('retired-a','retired-b'):
            candidate=bundle(self.base,name);manifest=read(candidate/'manifest.json');sha=digest(manifest)
            payload=candidate/'payload';payload.rename(self.root/'releases'/sha)
            atomic(self.root/'manifests'/(sha+'.json'),manifest)
            self.items.append(dict(kind='releases',digest=sha))
        self.protected=self.root/'history.txt';self.protected.write_text('sent;unknown;job unchanged')
        self.references=set()
    def tx(self,**kwargs):
        def check():
            if self.references:raise ValueError('operational-reference')
        return ArchiveTransaction(self.root,self.archive,self.items,check,**kwargs)
    def test_plan_archive_restore_preserves_identity_metadata_and_history(self):
        p=self.root/'releases'/self.items[0]['digest']/'library/monitor.py'
        p.chmod(0o640)
        if os.sys.platform=='darwin':subprocess.run(['/usr/bin/xattr','-w','com.gcake.test','fixture',str(p)],check=True)
        else:os.setxattr(p,'user.gcake-test',b'fixture')
        if os.sys.platform=='darwin':subprocess.run(['/bin/chmod','+a','user:'+pwd.getpwuid(os.getuid()).pw_name+' allow readattr',str(p)],check=True)
        original_attrs=extended_attributes(p)
        m=read(self.root/'manifests'/(self.items[0]['digest']+'.json'));m['files']=tree(p.parents[1])
        sha=digest(m);old=self.items[0]['digest'];p.parents[1].rename(self.root/'releases'/sha)
        atomic(self.root/'manifests'/(sha+'.json'),m);self.items[0]['digest']=sha
        tx=self.tx();before=tx.plan();self.assertFalse(self.archive.exists())
        self.assertEqual(before['status'],'planned')
        result=tx.run('archive');self.assertEqual(result['status'],'archived')
        self.assertFalse((self.root/'releases'/sha).exists())
        self.assertEqual(tx.run('archive')['status'],'archived')
        self.assertEqual(tx.run('restore')['status'],'restored')
        restored=self.root/'releases'/sha/'library/monitor.py'
        self.assertEqual(restored.stat().st_mode&0o777,0o640)
        self.assertEqual(extended_attributes(restored),original_attrs)
        self.assertEqual(self.protected.read_text(),'sent;unknown;job unchanged')
    def test_reference_tamper_and_missing_privilege_block_before_moves(self):
        self.references.add('lease')
        with self.assertRaisesRegex(ValueError,'operational-reference'):self.tx().run('archive')
        self.references.clear()
        p=self.root/'releases'/self.items[-1]['digest']/'library/monitor.py';p.write_text('tampered')
        with self.assertRaisesRegex(ValueError,'payload-integrity'):self.tx().run('archive')
        self.assertTrue((self.root/'releases'/self.items[0]['digest']).exists())
        with patch('archive_retired_packages.check_payload',side_effect=PermissionError('fixture')):
            with self.assertRaises(PermissionError):self.tx().plan()
    def test_crash_after_each_rename_resumes_and_restores(self):
        class Crash(BaseException):pass
        for boundary in ('intent','renamed'):
            for target in (0,1):
                with self.subTest(boundary=boundary,index=target):
                    def crash(phase,index):
                        if phase==boundary and index==target:raise Crash()
                    with self.assertRaises(Crash):self.tx(failpoint=crash).run('archive')
                    self.assertEqual(self.tx().run('resume')['status'],'archived')
                    with self.assertRaises(Crash):self.tx(failpoint=crash).run('restore')
                    self.assertEqual(self.tx().run('restore')['status'],'restored')
    def test_ordinary_failure_rolls_back_completed_moves(self):
        def fail(phase,index):
            if phase=='renamed' and index==0:raise OSError('fixture failure')
        self.assertEqual(self.tx(failpoint=fail).run('archive')['status'],'restored')
        for item in self.items:self.assertTrue((self.root/'releases'/item['digest']).exists())
    def test_foreign_destination_and_symlink_are_not_overwritten(self):
        self.archive.mkdir();(self.archive/'releases').mkdir()
        foreign=self.archive/'releases'/self.items[0]['digest'];foreign.mkdir();(foreign/'keep').write_text('foreign')
        with self.assertRaisesRegex(ValueError,'foreign-destination'):self.tx().run('archive')
        self.assertEqual((foreign/'keep').read_text(),'foreign')
        other=self.base/'link';other.symlink_to(self.archive)
        with self.assertRaisesRegex(ValueError,'unsafe-archive'):ArchiveTransaction(self.root,other,self.items,lambda:None).plan()
    def test_metadata_or_content_drift_requires_recovery(self):
        class Crash(BaseException):pass
        def crash(phase,index):
            if phase=='renamed':raise Crash()
        with self.assertRaises(Crash):self.tx(failpoint=crash).run('archive')
        target=self.archive/'releases'/self.items[0]['digest']/'library/monitor.py';target.chmod(0o600)
        with self.assertRaisesRegex(ValueError,'payload-integrity|metadata-drift'):self.tx().run('resume')
        self.assertFalse((self.root/'releases'/self.items[0]['digest']).exists())

    def test_failed_postmove_verification_reports_recovery_without_overwrite(self):
        def corrupt(phase,index):
            if phase=='renamed' and index==0:
                (self.archive/'releases'/self.items[0]['digest']/'library/monitor.py').write_text('corrupt')
        result=self.tx(failpoint=corrupt).run('archive')
        self.assertEqual(result['status'],'recovery-required')
        self.assertFalse((self.root/'releases'/self.items[0]['digest']).exists())
        self.assertTrue((self.root/'releases'/self.items[1]['digest']).exists())

    def test_restore_foreign_source_and_inventory_tamper_are_blocked(self):
        self.tx().run('archive');src=self.root/'releases'/self.items[0]['digest'];src.mkdir()
        (src/'foreign').write_text('keep')
        with self.assertRaisesRegex(ValueError,'foreign-or-missing'):self.tx().run('restore')
        self.assertEqual((src/'foreign').read_text(),'keep')
        record=read(self.archive/'inventory.json');record['items'][0]['source']='/foreign'
        atomic(self.archive/'inventory.json',record)
        with self.assertRaisesRegex(ValueError,'inventory-content'):self.tx().run('restore')
    def test_capacity_example_and_exact_boundary(self):
        self.assertEqual(capacity(4823534781-1110418723,373645288,10*1024**3)['projected_bytes'],4086761346)
        limit=4*1024**3
        self.assertTrue(capacity(limit-1,1,limit+1)['ready'])
        self.assertFalse(capacity(limit,1,limit+1)['ready'])
        self.assertFalse(capacity(1,1,limit)['ready'])

    @unittest.skipUnless(os.sys.platform=='darwin','native macOS plist contract')
    def test_launch_definition_uses_native_macos_plist_parser(self):
        path=self.base/'fixture.plist'
        path.write_text('<plist version="1.0"><dict><key>Label</key><string>fixture</string><key>ProgramArguments</key><array><string>/bin/sh</string><string>echo a\x1bb</string></array></dict></plist>')
        import plistlib
        with self.assertRaises(Exception):plistlib.loads(path.read_bytes())
        self.assertEqual(read_launch_definition(path)['ProgramArguments'],['/bin/sh','echo a\x1bb'])
        path.write_text('not a plist')
        with self.assertRaises(ValueError):read_launch_definition(path)

    def test_cross_device_is_blocked_before_writes(self):
        real=Path.stat
        def other(path,*args,**kwargs):
            value=real(path,*args,**kwargs)
            if path==self.base:
                fields={key:getattr(value,key) for key in dir(value) if key.startswith('st_')};fields['st_dev']+=1
                return SimpleNamespace(**fields)
            return value
        with patch.object(Path,'stat',other):
            with self.assertRaisesRegex(ValueError,'cross-device'):self.tx().plan()
        self.assertFalse(self.archive.exists())

    def test_production_reference_contract_rejects_active_pending_recovery_and_entry(self):
        (self.root/'private').mkdir()
        atomic(self.root/'active.json',dict(digest='a'*64,mode='live'))
        atomic(self.root/'gate.json',dict(digest='a'*64,status='ready',mode='live'))
        entry=self.base/'entry';entry.write_text('uses selected runtime')
        validate_references(self.root,self.items,[entry],[])
        for control in ('active.json','gate.json'):
            old=read(self.root/control);atomic(self.root/control,dict(old,digest=self.items[0]['digest']))
            with self.assertRaisesRegex(ValueError,'operational-reference'):validate_references(self.root,self.items,[entry],[])
            atomic(self.root/control,old)
        atomic(self.root/'private/journal.json',dict(phase='prepared'))
        with self.assertRaisesRegex(ValueError,'recovery-pending'):validate_references(self.root,self.items,[entry],[])
        (self.root/'private/journal.json').unlink()
        atomic(self.root/'private/next-candidate.json',dict(digest=self.items[0]['digest']))
        proposal=[dict(kind='proposals',digest=self.items[0]['digest'])]
        with self.assertRaisesRegex(ValueError,'operational-reference'):validate_references(self.root,proposal,[entry],[])
        (self.root/'private/next-candidate.json').unlink()
        entry.write_text(self.items[0]['digest'])
        with self.assertRaisesRegex(ValueError,'entry-reference'):validate_references(self.root,self.items,[entry],[])
        entry.write_text('selected')
        with self.assertRaisesRegex(ValueError,'process-reference'):validate_references(self.root,self.items,[entry],[str(self.root/'releases'/self.items[0]['digest'])])
        with self.assertRaises(FileNotFoundError):validate_references(self.root,self.items,[self.base/'missing'],[])


if __name__=='__main__':unittest.main()
