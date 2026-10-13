import copy
import unittest


class ProductionMapping(unittest.TestCase):
    def original(self):
        return dict(Label='ai.hermes.gateway.boot',UserName='hermes',RunAtLoad=True,KeepAlive=True,
                    WorkingDirectory='/Users/hermes/.hermes/hermes-agent',
                    ProgramArguments=['/Users/hermes/.hermes/hermes-agent/venv/bin/python','-m','hermes_cli.main','gateway','run','--replace'],
                    EnvironmentVariables=dict(HOME='/Users/hermes',HERMES_HOME='/Users/hermes/.hermes',EXISTING_PLATFORM_CONTEXT='preserved'),
                    StandardErrorPath='/Users/hermes/.hermes/gateway-error.log')

    def test_preserves_original_context_and_uses_fixed_launcher(self):
        from production_entry import render_gateway_plist
        original=self.original();before=copy.deepcopy(original)
        result=render_gateway_plist(original)
        self.assertEqual(original,before)
        self.assertEqual(result['ProgramArguments'],['/usr/local/libexec/hermes-gateway-managed'])
        self.assertEqual(result['WorkingDirectory'],'/usr/local/share/gcake-hermes-runtime')
        for key in ('Label','UserName','RunAtLoad','KeepAlive','EnvironmentVariables','StandardErrorPath'):
            self.assertEqual(result[key],original[key])

    def test_unexpected_original_mapping_is_rejected(self):
        from production_entry import render_gateway_plist
        for key,value in [('Label','another.gateway'),('UserName','root'),('KeepAlive',False),('RunAtLoad',False),('ProgramArguments',['/bin/sh','-c','unreviewed'])]:
            original=self.original();original[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):render_gateway_plist(original)
        for key in ('HOME','HERMES_HOME'):
            original=self.original();original['EnvironmentVariables'][key]='/other/home'
            with self.subTest(key=key),self.assertRaises(ValueError):render_gateway_plist(original)

    def test_production_namespace_has_no_arbitrary_path_override(self):
        from production_entry import production_root
        self.assertEqual(str(production_root('/usr/local/share/gcake-hermes-runtime')),'/usr/local/share/gcake-hermes-runtime')
        for path in ('/private/tmp/test','/Users/hermes/runtime','/usr/local/share/gcake-hermes-runtime/../other'):
            with self.subTest(path=path),self.assertRaises(ValueError):production_root(path)

    def test_isolated_store_still_rejects_production_root(self):
        from update_entry import EntryStore
        with self.assertRaisesRegex(ValueError,'isolated-authority-root-required'):
            EntryStore('/usr/local/share/gcake-hermes-runtime')

    def test_nonroot_cannot_initialize_production_authority(self):
        from production_entry import ProductionStore
        from unittest.mock import patch
        with patch('production_entry.os.geteuid',return_value=501):
            with self.assertRaisesRegex(PermissionError,'root-installation-required'):
                ProductionStore.initialize()

    def test_gateway_environment_retains_home_without_python_path_injection(self):
        from production_entry import gateway_environment
        original=dict(HOME='/wrong',HERMES_HOME='/wrong',PYTHONPATH='/untrusted',PYTHONHOME='/untrusted',PYTHONSTARTUP='/untrusted',NEEDED_CONTEXT='retained')
        env=gateway_environment(original,'a'*64)
        self.assertEqual(env['HOME'],'/Users/hermes')
        self.assertEqual(env['HERMES_HOME'],'/Users/hermes/.hermes')
        self.assertEqual(env['NEEDED_CONTEXT'],'retained')
        self.assertEqual(env['GCAKE_RELEASE_DIGEST'],'a'*64)
        self.assertEqual(env['PYTHONNOUSERSITE'],'1')
        for key in ('PYTHONPATH','PYTHONHOME','PYTHONSTARTUP'):self.assertNotIn(key,env)

    def test_root_cannot_execute_runner_private_monitor_environment(self):
        from production_entry import ProductionStore
        from unittest.mock import patch
        store=object.__new__(ProductionStore);store.runner_uid=502
        with patch('production_entry.os.geteuid',return_value=0):
            with self.assertRaisesRegex(PermissionError,'hermes-monitor-required'):store.monitor()


if __name__=='__main__':unittest.main()
