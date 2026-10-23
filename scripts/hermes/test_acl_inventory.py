"""Real Darwin ACL behavior; synthetic files, no production writes or services."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from contextlib import redirect_stdout
from io import StringIO
from unittest.mock import patch

import update_entry as entry


@unittest.skipUnless(sys.platform == 'darwin', 'Darwin ACL contract')
class ACLInventoryAcceptance(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='rh-acl-contract-', dir='/private/tmp')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base/'tree'
        self.root.mkdir()

    def file(self, name='file'):
        p = self.root/name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b'SYNTHETIC_ACL_CONTRACT_ONLY')
        return p

    def grant(self, p, rule):
        subprocess.run(['/bin/chmod', '+a', rule, str(p)], capture_output=True, check=True, timeout=5)

    def test_readable_acl_does_not_depend_on_stalled_presentation_command(self):
        self.file()
        actual = subprocess.run
        def without_display(command, **options):
            if command[0] == '/bin/ls':
                raise subprocess.TimeoutExpired(command, 30)
            return actual(command, **options)
        with patch.object(entry.subprocess, 'run', side_effect=without_display):
            entry.reject_write_acl(self.root, recursive=True)

    def test_all_existing_nonroot_mutation_rights_are_refused(self):
        for right in ('write', 'append', 'delete', 'writeattr', 'writeextattr', 'writesecurity', 'chown'):
            with self.subTest(right=right):
                p = self.file(right)
                self.grant(p, 'user:hermes allow '+right)
                with self.assertRaisesRegex(ValueError, 'runner-writable-acl'):
                    entry.reject_write_acl(p)

    def test_directory_add_rights_are_refused(self):
        for right in ('add_file', 'add_subdirectory', 'delete_child'):
            with self.subTest(right=right):
                p = self.root/right
                p.mkdir()
                self.grant(p, 'user:hermes allow '+right)
                with self.assertRaisesRegex(ValueError, 'runner-writable-acl'):
                    entry.reject_write_acl(p)

    def test_root_user_write_exception_is_preserved(self):
        p = self.file()
        self.grant(p, 'user:root allow read,write,delete,writesecurity,chown')
        entry.reject_write_acl(p)

    def test_resolved_root_uuid_retains_user_exception(self):
        inventory = entry._NativeACLInventory()
        value = entry.C.create_string_buffer(16)
        self.assertEqual(inventory.lib.mbr_uid_to_uuid(0, value), 0)
        self.assertTrue(inventory.root_user(value.raw))
        self.assertFalse(inventory.root_user(bytes.fromhex('0123456789abcdef0123456789abcdef')))

    def test_failed_root_identity_resolution_is_refused(self):
        inventory = entry._NativeACLInventory()
        with patch.object(inventory.lib, 'mbr_uid_to_uuid', return_value=5):
            with self.assertRaisesRegex(ValueError, 'acl-inventory-failed'):
                inventory.root_user(bytes(16))

    def test_root_group_is_not_the_root_user_exception(self):
        p = self.file()
        self.grant(p, 'group:wheel allow write')
        with self.assertRaisesRegex(ValueError, 'runner-writable-acl'):
            entry.reject_write_acl(p)

    def test_readonly_grant_and_deny_keep_prior_meaning(self):
        p = self.file()
        self.grant(p, 'user:hermes allow read,readattr,readextattr,readsecurity')
        self.grant(p, 'user:hermes deny write,delete,chown')
        entry.reject_write_acl(p)

    def test_nested_hidden_write_grant_is_not_skipped(self):
        p = self.file('.hidden/nested/file')
        self.grant(p, 'user:hermes allow write')
        with self.assertRaisesRegex(ValueError, 'runner-writable-acl'):
            entry.reject_write_acl(self.root, recursive=True)

    def test_link_does_not_follow_outside_tree(self):
        outside = self.base/'outside'
        outside.mkdir()
        p = outside/'foreign'
        p.write_bytes(b'SYNTHETIC_OUTSIDE')
        self.grant(p, 'user:hermes allow write')
        (self.root/'link').symlink_to(outside, target_is_directory=True)
        entry.reject_write_acl(self.root, recursive=True)

    def test_missing_root_is_not_silently_empty(self):
        with self.assertRaises(ValueError):
            entry.reject_write_acl(self.root/'missing', recursive=True)

    def test_unreadable_acl_evidence_is_refused(self):
        p = self.file()
        with patch.object(entry.os, 'lstat', side_effect=PermissionError('synthetic ACL evidence unavailable')):
            output = StringIO()
            with redirect_stdout(output):
                self.assertEqual(entry._native_acl_worker(p, False), 2)
            self.assertEqual(output.getvalue(), 'acl-inventory-failed')

    def test_existing_thirty_second_budget_is_not_extended(self):
        p = self.file()
        with patch.object(entry.time, 'monotonic', side_effect=[0, 30]):
            with self.assertRaisesRegex(ValueError, 'acl-inventory-failed'):
                entry._NativeACLInventory().visit(p, False)

    def test_changed_node_during_acl_read_is_refused(self):
        p = self.file()
        real_lstat = entry.os.lstat
        calls = []
        def changed(path):
            info = real_lstat(path)
            calls.append(path)
            if len(calls) == 2:
                p.write_bytes(b'SYNTHETIC_CHANGED_DURING_READ')
                return real_lstat(path)
            return info
        with patch.object(entry.os, 'lstat', side_effect=changed):
            with self.assertRaisesRegex(ValueError, 'acl-inventory-failed'):
                entry._NativeACLInventory().visit(p, False)

    def test_target_metadata_is_read_only_inside_bounded_child(self):
        # Inspecting the target in the parent would escape subprocess timeout.
        p = self.file()
        actual = os.lstat
        def no_parent_target(path, *args, **kwargs):
            if os.fspath(path) == str(p):
                raise AssertionError('target metadata escaped the inspection deadline')
            return actual(path, *args, **kwargs)
        with patch.object(entry.os, 'lstat', side_effect=no_parent_target):
            entry.reject_write_acl(p)

    def test_stalled_native_child_is_refused_and_reaped(self):
        p = self.file()
        pidfile = self.base/'inspection-pid'
        real_run = subprocess.run
        def stalled_worker(command, **options):
            return real_run([sys.executable, '-c',
                "import os,time,pathlib;pathlib.Path(__import__('sys').argv[1]).write_text(str(os.getpid()));time.sleep(10)",
                str(pidfile)], **options)
        started = time.monotonic()
        with patch.object(entry, '_ACL_TIMEOUT_SECONDS', .5, create=True), patch.object(entry.subprocess, 'run', side_effect=stalled_worker):
            with self.assertRaisesRegex(ValueError, 'acl-inventory-failed'):
                entry.reject_write_acl(p)
        self.assertLess(time.monotonic()-started, 3)
        pid = int(pidfile.read_text())
        with self.assertRaises(ProcessLookupError):
            os.kill(pid, 0)

    def test_unexpected_native_child_result_is_never_safe(self):
        p = self.file()
        for result in [subprocess.CompletedProcess([], 0, 'partial', ''),
                       subprocess.CompletedProcess([], 0, '', 'native diagnostic'),
                       subprocess.CompletedProcess([], 2, 'unexpected', ''),
                       subprocess.CompletedProcess([], -9, '', '')]:
            with self.subTest(result=result), patch.object(entry.subprocess, 'run', return_value=result):
                with self.assertRaisesRegex(ValueError, 'acl-inventory-failed'):
                    entry.reject_write_acl(p)

    def test_later_write_entry_cannot_hide_behind_root_allow(self):
        p = self.file()
        self.grant(p, 'user:root allow read,write')
        self.grant(p, 'user:hermes allow write')
        with self.assertRaisesRegex(ValueError, 'runner-writable-acl'):
            entry.reject_write_acl(p)


if __name__ == '__main__':
    unittest.main()
