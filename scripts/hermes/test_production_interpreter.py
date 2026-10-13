import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import production_owner as owner


class OriginalInterpreter(unittest.TestCase):
    def probe(self, home, version='3.11.15'):
        alias=home/'.local/share/uv/python/cpython-3.11-macos-aarch64-none'
        result=SimpleNamespace(stdout=json.dumps(dict(version=version,base_prefix=str(alias),euid=os.geteuid())))
        with patch.object(owner,'HOME',home),patch.object(owner.subprocess,'run',return_value=result):
            return owner.original_native_probe(SimpleNamespace(pw_name='test',pw_uid=os.geteuid(),pw_gid=os.getegid()))

    def fixture(self, home, target_name='cpython-3.11.15-macos-aarch64-none'):
        parent=home/'.local/share/uv/python';parent.mkdir(parents=True)
        target=parent/target_name;target.mkdir()
        alias=parent/'cpython-3.11-macos-aarch64-none';alias.symlink_to(target_name)
        return alias,target

    def test_reviewed_uv_alias_preserves_literal_and_pins_resolved_runtime(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve();alias,target=self.fixture(home)
            native=self.probe(home)
            self.assertEqual(native['base_prefix'],str(alias))
            self.assertEqual(native['base_prefix_resolved'],str(target))
            self.assertEqual(native['base_alias']['target'],target.name)

    def test_version_drift_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve();self.fixture(home)
            with self.assertRaisesRegex(ValueError,'original-interpreter-version-drift'):self.probe(home,'3.11.16')

    def test_alias_to_unreviewed_version_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve();self.fixture(home,'cpython-3.11.16-macos-aarch64-none')
            with self.assertRaisesRegex(ValueError,'unreviewed-original-base-runtime'):self.probe(home)

    def test_writable_target_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve();alias,target=self.fixture(home);target.chmod(0o777)
            with self.assertRaisesRegex(ValueError,'unsafe-original-base-runtime'):self.probe(home)

    def test_backup_copies_real_runtime_and_preserves_original_alias(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve();alias,target=self.fixture(home)
            (target/'runtime-marker').write_text('original-runtime')
            native=self.probe(home);folder=home/'backup';folder.mkdir()
            with patch.object(owner,'original_native_probe',return_value=native):
                owner.backup_original_base(native,folder,None)
            self.assertFalse((folder/'python-base').is_symlink())
            self.assertEqual((folder/'python-base/runtime-marker').read_text(),'original-runtime')
            self.assertEqual(os.readlink(folder/'python-base.alias'),os.readlink(alias))
            self.assertEqual(alias.resolve(),target)
            self.assertEqual((target/'runtime-marker').read_text(),'original-runtime')

    def test_changed_alias_during_backup_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve();self.fixture(home)
            native=self.probe(home);folder=home/'backup';folder.mkdir()
            changed=dict(native,base_prefix_resolved='/unreviewed')
            with patch.object(owner,'original_native_probe',return_value=changed):
                with self.assertRaisesRegex(ValueError,'original-base-changed-during-backup'):
                    owner.backup_original_base(native,folder,None)


if __name__=='__main__':unittest.main()
