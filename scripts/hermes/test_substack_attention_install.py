import importlib.util
from pathlib import Path
import unittest
import install_substack_attention as product

class OwnerPreparation(unittest.TestCase):
    def test_service_is_event_driven_hermes_owned_and_never_restarts_gateway(self):
        spec=product.service_spec('/runtime/python','/runtime/code',501)
        self.assertEqual(spec['UserName'],'hermes');self.assertEqual(spec['WatchPaths'],[str(product.SHARED/'input')])
        self.assertNotIn('StartInterval',spec);self.assertFalse(spec['KeepAlive']);self.assertTrue(spec['RunAtLoad'])
        args=' '.join(spec['ProgramArguments']);self.assertNotIn('gateway-managed',args);self.assertNotIn('sudo',args)
        self.assertIn('--producer-uid',spec['ProgramArguments'])
    def test_pinned_paths_reject_unrelated_or_traversing_files(self):
        for name in ['../secret','/absolute','node_modules/secret']:
            with self.subTest(name=name),self.assertRaises(ValueError):product.validate_pin_name(name)
    def test_install_requires_authenticated_owner_before_any_operation(self):
        from unittest.mock import patch
        with patch.object(product.os,'geteuid',return_value=501),self.assertRaises(PermissionError):product.activate(Path('/nonexistent'))
if __name__=='__main__':unittest.main()
