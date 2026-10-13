"""Read-only interpreter identity audit; run Python only as existing hermes."""
import json
import os
from pathlib import Path
import pwd
import stat
import subprocess


def metadata(path):
    p = Path(path)
    s = p.lstat()
    return dict(path=str(p), resolved=str(p.resolve(strict=True)),
                symlink=stat.S_ISLNK(s.st_mode), uid=s.st_uid,
                gid=s.st_gid, mode=oct(stat.S_IMODE(s.st_mode)))


def main():
    report = dict(read_only=True, production_operations=False,
                  hermes_imported=False, credential_files_opened=False,
                  jobs_executed=False, network_used=False)
    try:
        if os.geteuid() != 0:
            raise PermissionError('root-audit-required')
        user = pwd.getpwnam('hermes')
        if user.pw_uid != 502:
            raise ValueError('hermes-uid-drift')
        interpreter = '/Users/hermes/.hermes/hermes-agent/venv/bin/python'

        def drop():
            os.initgroups(user.pw_name, user.pw_gid)
            os.setgid(user.pw_gid)
            os.setuid(user.pw_uid)

        code = ('import sys,os,json;print(json.dumps(dict('
                'version=sys.version.split()[0],euid=os.geteuid(),'
                'executable=sys.executable,prefix=sys.prefix,'
                'base_prefix=sys.base_prefix)))')
        result = subprocess.run([interpreter, '-I', '-B', '-S', '-c', code],
                                preexec_fn=drop, capture_output=True, text=True,
                                timeout=20, cwd='/private/tmp',
                                env=dict(PATH='/usr/bin:/bin', HOME='/Users/hermes'))
        if result.returncode:
            report['interpreter_exit_code'] = result.returncode
            raise RuntimeError('interpreter-probe-failed')
        native = json.loads(result.stdout)
        report['native'] = native
        report['version_matches'] = native['version'] == '3.11.15'
        report['paths'] = [metadata(p) for p in dict.fromkeys(
            [interpreter, native['prefix'], native['base_prefix']])]
        base = Path(native['base_prefix'])
        report['base_path_is_canonical'] = str(base.resolve()) == str(base)
        report['base_path_aliases'] = [metadata(p) for p in
                                      reversed([base] + list(base.parents))
                                      if p.is_symlink()]
        report['passed'] = True
    except Exception as error:
        report.update(passed=False, error_type=type(error).__name__)
    print(json.dumps(report, indent=2))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
