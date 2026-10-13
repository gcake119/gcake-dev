#!/usr/bin/env python3
"""Predeployment inventory. Never start/import Hermes or open credential files."""
import hashlib
import json
import os
from pathlib import Path
import plistlib
import pwd
import re
import shlex
import stat
import subprocess
from datetime import datetime, timezone

ROOT = Path('/Users/hermes')
CORE = ROOT / '.hermes/hermes-agent'
EXPECTED = {
    str(CORE / 'cron/scheduler.py'): 'f59d641fcc5182a83275da4b45340dd6d7d96f3ab7af6cecf801376def6cc426',
    str(CORE / 'cron/scheduler_script.py'): 'dfc96fea523334f1cc972be6e84336c3e69e3ebe1307a3a9215b3afe97928f99',
    str(ROOT / '.hermes/scripts/gcake-rss-live.sh'): 'f3d1868862188c77ccc6c6f8bfb20c14ac9d2fd6354072943194e0bc11c60e46',
    str(ROOT / '.local/lib/gcake-rss/rss_monitor.py'): 'f4b1e2dd88e53674e30abbd73b7a8ba7874246f74c20b46a9a6745e4a30ee7ac',
}


def run(argv):
    # No inherited tokens, user Git configuration, shell evaluation or network CLI.
    env = dict(PATH='/usr/bin:/bin:/usr/sbin:/sbin', HOME='/var/empty',
               LANG='C', GIT_OPTIONAL_LOCKS='0', GIT_CONFIG_NOSYSTEM='1')
    try:
        result = subprocess.run(argv, env=env, capture_output=True, text=True, timeout=8)
        return result.returncode, result.stdout
    except OSError: return 127, ''
    except subprocess.TimeoutExpired: return 124, ''


def safe_path(value):
    if value == str(ROOT): return value
    if isinstance(value, str) and re.fullmatch(r'/(?:Users/hermes|Library|Applications|usr|opt|bin|sbin|private)/[A-Za-z0-9_./+ -]+', value):
        return value
    return '<redacted>'


def safe_args(values):
    allowed = {'-m', 'gateway.run', 'hermes', 'gateway', 'run', '--force', '--replace',
               '--foreground', '-u', 'hermes_cli.main', '-I', '-B', '-S'}
    output = []
    for value in values:
        # Never emit command strings, URLs, flag values or arbitrary inline code.
        if value in allowed:
            output.append(value)
        elif isinstance(value, str) and value.startswith('/') and re.fullmatch(r'[A-Za-z0-9_./+-]+', value) and Path(value).suffix in ('.sh', '.py'):
            output.append(safe_path(value))
        elif isinstance(value, str) and value.startswith('/') and re.fullmatch(r'(?:python(?:3(?:\.\d+)?)?|bash|sh|zsh|hermes|uv)', Path(value).name):
            output.append(safe_path(value))
        else:
            output.append('<redacted>')
    return output


def launch_status(label, domain):
    code, output = run(['/bin/launchctl', 'print', domain + '/' + label])
    result = dict(label=label, domain=domain, query_exit_code=code,
                  loaded=None if code in (124, 127) else code == 0)
    if code == 0:
        for key in ('state', 'pid', 'runs', 'last exit code'):
            match = re.search(r'^\s*' + re.escape(key) + r' = ([A-Za-z0-9_-]+)\s*$', output, re.M)
            if match: result[key.replace(' ', '_')] = match.group(1)
    return result


def metadata(path, hash_source=False):
    path = Path(path)
    row = dict(path=str(path))
    try:
        info = path.lstat()
        row.update(exists=True, uid=info.st_uid, gid=info.st_gid,
                   mode=oct(stat.S_IMODE(info.st_mode)), symlink=path.is_symlink(),
                   group_writable=bool(info.st_mode & stat.S_IWGRP),
                   other_writable=bool(info.st_mode & stat.S_IWOTH))
        try: row['owner'] = pwd.getpwuid(info.st_uid).pw_name
        except KeyError: pass
        code, listing = run(['/bin/ls', '-lde', str(path)])
        row['acl'] = [line.strip() for line in listing.splitlines()[1:]
                      if re.fullmatch(r'\s*\d+: (?:user|group):[A-Za-z0-9_. -]+ (?:allow|deny) [a-z_,]+\s*', line)] if code == 0 else None
        if hash_source:
            raw = source(path)
            row['sha256'] = hashlib.sha256(raw).hexdigest()
            if str(path) in EXPECTED: row['matches_tested_original'] = row['sha256'] == EXPECTED[str(path)]
    except FileNotFoundError: row['exists'] = False
    except Exception as error: row['error_type'] = type(error).__name__
    return row


def source(path):
    path = Path(path)
    # Read only explicit source/service configuration files, never .env or DB.
    if path.is_symlink() or path.suffix not in ('.py', '.sh', '.plist', '.toml', '.cfg'):
        raise ValueError('Source file refused')
    with path.open('rb') as stream: raw = stream.read(2 * 1024 * 1024 + 1)
    if len(raw) > 2 * 1024 * 1024: raise ValueError('Source size bound')
    return raw


def service(path, uid):
    row = dict(file=metadata(path, True))
    try:
        try:
            data = plistlib.loads(source(path)); row['plist_parser'] = 'plistlib'
        except Exception as error:
            row['strict_plist_error_type'] = type(error).__name__
            code, converted = run(['/usr/bin/plutil', '-convert', 'json', '-o', '-', str(path)])
            if code:
                hint = path.stem
                if re.fullmatch(r'[A-Za-z0-9_.-]{1,160}', hint): row['filename_label_probe'] = launch_status(hint, 'system')
                raise ValueError('Service plist not parseable')
            data = json.loads(converted); row['plist_parser'] = 'plutil'
        label = data.get('Label', '')
        if not re.fullmatch(r'[A-Za-z0-9_.-]{1,160}', label): raise ValueError('Label refused')
        row.update(label=label, user=data.get('UserName') if data.get('UserName') in ('hermes', 'root') else '<omitted>',
                   working_directory=safe_path(data.get('WorkingDirectory')),
                   program=safe_path(data.get('Program')),
                   arguments=safe_args(data.get('ProgramArguments', [])),
                   run_at_load=data.get('RunAtLoad') is True,
                   keep_alive=data.get('KeepAlive') if isinstance(data.get('KeepAlive'), bool) else '<structured-or-absent>')
        env = data.get('EnvironmentVariables', {})
        row['home_context'] = {key: safe_path(env[key]) for key in ('HOME', 'HERMES_HOME') if key in env}
        row['other_environment_values_disclosed'] = False
        domain = 'system' if path.parent.name == 'LaunchDaemons' else 'gui/' + str(uid)
        row.update(launch_status(label, domain))
        row['launch_scripts'] = []
        for arg in data.get('ProgramArguments', []):
            if isinstance(arg, str) and arg.startswith(str(ROOT) + '/') and arg.endswith('.sh') and safe_path(arg) != '<redacted>':
                item = metadata(arg, True)
                try:
                    text = source(arg).decode('utf-8')
                    item['mentions'] = {key: key in text for key in ('gateway.run', 'hermes gateway', 'launchctl', '--replace', '--force')}
                    item['known_labels'] = sorted(set(re.findall(r'\bai\.hermes\.[A-Za-z0-9_.-]+', text)))
                    item['python_paths'] = sorted(set(re.findall(r'/Users/hermes/[A-Za-z0-9_./-]+/bin/python[0-9.]*', text)))
                    item['launchctl_operations'] = sorted(set(re.findall(r'\blaunchctl\s+(bootstrap|bootout|kickstart|submit|asuser|enable|disable|print)\b', text)))
                    item['related_services'] = [launch_status(label, domain) for label in item['known_labels']
                                                if 'gateway' in label for domain in ('system', 'gui/'+str(uid))]
                except Exception as error: item['source_error_type'] = type(error).__name__
                row['launch_scripts'].append(item)
    except Exception as error: row['error_type'] = type(error).__name__
    return row


def main():
    uid = pwd.getpwnam('hermes').pw_uid
    report = dict(audit_utc=datetime.now(timezone.utc).isoformat(), audit_euid=os.geteuid(),
                  hermes_imported=False, jobs_executed=False, credential_files_opened=False,
                  database_opened=False, gateway_control_commands_executed=False, network_used=False,
                  running_process_package_version_verified=False)
    paths = list(EXPECTED) + [str(CORE/'pyproject.toml'), str(ROOT/'.local/lib/gcake-rss/publication_monitor.py')]
    report['files'] = [metadata(p, True) for p in paths]
    private = [ROOT/'.config/gcake-rss/live.env', ROOT/'.config/gcake-rss/publication-monitor.env',
               ROOT/'.local/state/gcake-rss/live.sqlite', ROOT/'.local/state/gcake-rss/live.sqlite.lock']
    dirs = [ROOT, ROOT/'.hermes', CORE, CORE/'cron', ROOT/'.hermes/scripts',
            ROOT/'.local/lib/gcake-rss', ROOT/'.local/state/gcake-rss', ROOT/'.config/gcake-rss']
    report['permissions_only'] = [metadata(p) for p in dirs + private]
    try:
        text = source(CORE/'pyproject.toml').decode('utf-8')
        match = re.search(r'^version\s*=\s*[\x27\x22](\d+\.\d+\.\d+[^\x27\x22\r\n]*)', text, re.M)
        report['source_package_version'] = match.group(1) if match else None
        code, head = run(['/usr/bin/git', '-c', 'safe.directory='+str(CORE), '-C', str(CORE), 'rev-parse', 'HEAD'])
        report['source_git_head'] = head.strip() if code == 0 and re.fullmatch(r'[0-9a-f]{40}\s*', head) else None
    except Exception as error: report['source_error_type'] = type(error).__name__
    directories = [Path('/Library/LaunchDaemons'), Path('/Library/LaunchAgents'), ROOT/'Library/LaunchAgents', Path('/Users/caiyijun/Library/LaunchAgents')]
    report['services'] = []
    for directory in directories:
        try: matches = sorted(directory.glob('*hermes*.plist'))
        except OSError as error:
            report['services'].append(dict(directory=str(directory),error_type=type(error).__name__))
            continue
        for path in matches:
            if 'gateway' in path.name or 'auto-update' in path.name:
                report['services'].append(service(path, uid if str(directory).startswith(str(ROOT)) else pwd.getpwnam('caiyijun').pw_uid))
    code, processes = run(['/bin/ps', '-axo', 'pid=,ppid=,uid=,comm='])
    report['process_inventory_available'] = code == 0
    report['gateway_processes'] = []
    if code == 0:
        for line in processes.splitlines():
            parts = line.split(None, 3)
            if len(parts) != 4 or parts[2] != str(uid): continue
            pid, parent, _, executable = parts
            if not re.search(r'python|hermes|bash|zsh', executable): continue
            status, args = run(['/bin/ps', '-p', pid, '-o', 'args='])
            if status or not (re.search(r'gateway\.run|hermes(?:\s+|/)gateway|gateway/(?:run|bootstrap)\.py', args)
                              or ('hermes_cli.main' in args and re.search(r'\bgateway\s+run\b', args))): continue
            try: tokens = shlex.split(args)
            except ValueError: tokens = []
            report['gateway_processes'].append(dict(pid=int(pid), parent_pid=int(parent), executable=safe_path(executable), arguments=safe_args(tokens)))
    report['python_versions'] = []
    for path in [Path('/usr/bin/python3'), CORE/'.venv/bin/python', CORE/'venv/bin/python']:
        try:
            if not path.exists(): continue
        except OSError as error:
            report['python_versions'].append(dict(path=str(path),error_type=type(error).__name__))
            continue
        row = metadata(path); resolved = path.resolve(); row['resolved'] = safe_path(str(resolved))
        try:
            # Execute only a binary Python interpreter, -S prevents site hooks.
            with resolved.open('rb') as stream: header = stream.read(4)
            if header == b'#!' or header[:2] == b'#!' or not re.fullmatch(r'python(?:3(?:\.\d+)?)?', resolved.name): raise ValueError('Interpreter refused')
            code, output = run([str(path), '-I', '-B', '-S', '-c', 'import sys,json;print(json.dumps({"version":sys.version.split()[0],"executable":sys.executable}))'])
            if code == 0:
                value = json.loads(output)
                row['version'] = value['version'] if re.fullmatch(r'\d+\.\d+\.\d+', value['version']) else '<omitted>'
                row['reported_executable'] = safe_path(value['executable'])
            else: row['probe_exit_code'] = code
        except Exception as error: row['error_type'] = type(error).__name__
        report['python_versions'].append(row)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
