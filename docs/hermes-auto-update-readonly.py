"""Read updater configuration/source hashes. Never execute/source an updater."""
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import runpy
from datetime import datetime, timezone


def main():
    helpers = runpy.run_path(str(Path(__file__).with_name('hermes-predeploy-readonly.py')))
    metadata, run, status = (helpers[k] for k in ('metadata', 'run', 'launch_status'))
    root = Path('/Users/hermes/.hermes/hermes-agent')
    exported = Path(__file__).resolve().parents[1]/'hermes-gateway-source'
    report = dict(audit_utc=datetime.now(timezone.utc).isoformat(), read_only=True,
                  updater_executed=False, hermes_imported=False, credential_files_opened=False,
                  jobs_modified=False, network_used=False)
    plist = Path('/Library/LaunchDaemons/ai.hermes.auto-update.plist')
    data = plistlib.loads(helpers['source'](plist))
    report['plist'] = metadata(plist, True)
    report['command_matches_reviewed_launcher'] = data.get('ProgramArguments') == ['/usr/local/libexec/hermes-auto-update']
    schedule = data.get('StartCalendarInterval', {})
    report['calendar'] = {k: v for k, v in schedule.items() if k in ('Weekday','Day','Month','Hour','Minute') and isinstance(v,int)} if isinstance(schedule,dict) else '<unrecognized>'
    report['interval_seconds'] = data.get('StartInterval') if isinstance(data.get('StartInterval'),int) else None
    report['run_at_load'] = data.get('RunAtLoad',False) is True
    report['keep_alive'] = data.get('KeepAlive',False) is True
    report['launcher_timezone_override_present'] = 'TZ' in data.get('EnvironmentVariables', {})
    zone = os.readlink('/etc/localtime').split('zoneinfo/')[-1]
    report['host_timezone'] = zone if re.fullmatch(r'[A-Za-z_]+/[A-Za-z_]+',zone) else '<omitted>'
    report['service'] = status('ai.hermes.auto-update','system')
    code, disabled = run(['/bin/launchctl','print-disabled','system'])
    match = re.search(r'"ai\.hermes\.auto-update"\s*=>\s*(true|false)',disabled)
    report['disabled_query_exit_code'] = code
    report['explicit_disabled_override'] = match.group(1)=='true' if match else None
    report['outer_update_lock_metadata'] = metadata('/var/run/ai.hermes.auto-update.lock')
    report['files'] = []
    paths = [Path('/usr/local/libexec/hermes-auto-update'),Path('/usr/local/libexec/hermes-auto-update-lib')]
    paths += [root/'hermes_cli'/name for name in ('main.py','update_cmd.py','update_cmd_git.py','update_cmd_stash.py','update_cmd_deps.py','update_lock.py')]
    for path in paths:
        row = metadata(path)
        try:
            if path.is_symlink(): raise ValueError('Symlink refused')
            with path.open('rb') as stream: raw=stream.read(2*1024*1024+1)
            if len(raw)>2*1024*1024: raise ValueError('Size bound')
            row['sha256']=hashlib.sha256(raw).hexdigest()
            if str(path).startswith(str(root)+'/'):
                baseline=exported/path.relative_to(root)
                row['matches_isolated_export']=row['sha256']==hashlib.sha256(baseline.read_bytes()).hexdigest()
        except Exception as error: row['read_error_type']=type(error).__name__
        report['files'].append(row)
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=='__main__': main()
