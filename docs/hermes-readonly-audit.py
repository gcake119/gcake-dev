#!/usr/bin/env python3
"""Read-only inventory. No monitor execution, network, secret files or DB writes."""
import hashlib
import json
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('/Users/hermes')
SITE = 'https://gcake119.github.io/gcake-dev/'
IDS = {'550aaf17723d': 'gcake-editorial-rss-live', 'ea3c550669f1': None}
EXPECTED_HASH = 'f4b1e2dd88e53674e30abbd73b7a8ba7874246f74c20b46a9a6745e4a30ee7ac'
STATES = {'sent', 'unknown', 'uncertain', 'baseline', 'verified-dry-run', 'pending', 'intent', 'failed'}


def bounded_read(path):
    # Exact inventory paths only. Never follow a link into another file.
    if path.is_symlink():
        raise ValueError('Symlink refused')
    with path.open('rb') as source:
        raw = source.read(2 * 1024 * 1024 + 1)
    if len(raw) > 2 * 1024 * 1024:
        raise ValueError('Size bound')
    return raw


def numeric(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and str(value) not in {'nan', 'inf', '-inf'}:
        return value
    if isinstance(value, str) and re.fullmatch(r'\d{1,16}(?:\.\d{1,6})?', value):
        return value
    return '<omitted>'


def safe_time(value):
    if value is None:
        return None
    if isinstance(value, str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?', value):
        return value
    return numeric(value)


def schedule(value):
    if isinstance(value, dict):
        return {key: schedule(value[key]) for key in ('type', 'kind', 'mode', 'interval', 'minutes', 'seconds', 'every', 'expression', 'cron', 'timezone', 'value') if key in value}
    if isinstance(value, str):
        if value in {'interval', 'cron', 'once', 'Asia/Taipei', 'UTC'} or re.fullmatch(r'(?:every\s+)?\d{1,6}\s*(?:m|h|s|minutes?|hours?|seconds?)', value):
            return value
        if re.fullmatch(r'[\d*/?, -]+', value) and len(value.split()) == 5:
            return value
    return numeric(value)


def job_records(value, depth=0):
    if depth > 8:
        return
    if isinstance(value, dict):
        identity = value.get('id', value.get('job_id'))
        if isinstance(identity, str) and identity in IDS:
            yield value
        for key, child in value.items():
            if key in IDS and isinstance(child, dict):
                yield dict(child, id=key)
            else:
                yield from job_records(child, depth + 1)
    elif isinstance(value, list):
        for child in value:
            yield from job_records(child, depth + 1)


def cron_report(root):
    candidates = [root / '.hermes/cron/jobs.json', root / '.hermes/cron_jobs.json']
    directory = root / '.hermes/cron'
    if directory.is_dir() and not directory.is_symlink():
        candidates.extend(path for path in directory.glob('*.json') if path not in candidates)
    found = []
    for path in candidates:
        if not path.is_file():
            continue
        # Do not expose arbitrary JSON contents, paths, arguments or diagnostics.
        raw = bounded_read(path)
        for item in job_records(json.loads(raw)):
            identity = item.get('id', item.get('job_id'))
            row = {'id': identity}
            if 'name' in item:
                row['known_live_name_matches'] = item['name'] == IDS.get(identity)
            for key in ('enabled', 'no_agent', 'no-agent', 'interval', 'interval_minutes', 'interval_seconds', 'every_minutes', 'run_count'):
                if key in item:
                    row[key] = numeric(item[key])
            for key in ('schedule', 'schedule_type', 'cron'):
                if key in item:
                    row[key] = schedule(item[key])
            for key in ('next_run', 'next_run_at', 'last_run', 'last_run_at', 'created_at'):
                if key in item:
                    row[key] = safe_time(item[key])
            for key in ('status', 'state', 'deliver', 'failure_deliver', 'failure-deliver', 'delivery', 'failure_delivery'):
                if key in item:
                    row[key] = item[key] if item[key] in ('local', 'scheduled', 'running', 'enabled', 'disabled', 'paused', 'completed', 'failed') else '<omitted>'
            row['has_script'] = bool(item.get('script'))
            found.append(row)
    return {'matching_jobs': found, 'complete_job_format_verified': False}


def sqlite_report(root):
    path = root / '.local/state/gcake-rss/live.sqlite'
    if not path.is_file() or path.is_symlink():
        raise ValueError('Missing or linked live DB')
    # mode=ro sees committed WAL; immutable=1 must never be used for live state.
    connection = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True, timeout=5)
    try:
        connection.execute('PRAGMA query_only=ON')
        connection.execute('BEGIN')
        tables = [row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        report = {'journal_mode': connection.execute('PRAGMA journal_mode').fetchone()[0], 'schema': {}}
        for table in tables:
            # Print structural identifiers only, never CREATE SQL/default expressions.
            if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,63}', table):
                continue
            report['schema'][table] = [
                {'name': row[1] if re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,63}', row[1]) else '<omitted>',
                 'type': row[2] if re.fullmatch(r'[A-Za-z0-9_ ()]{0,40}', row[2]) else '<omitted>',
                 'not_null': bool(row[3]), 'primary_key': row[5]}
                for row in connection.execute('PRAGMA table_info("' + table + '")')]
        if 'meta' in tables:
            values = dict(connection.execute('SELECT key,value FROM meta'))
            report['meta'] = {key: numeric(values[key]) for key in ('initialized', 'failures', 'next_check') if key in values}
            report['meta']['mode_live'] = values.get('mode') == 'live'
            report['meta']['site_matches'] = values.get('site') == SITE
            report['meta']['site_present'] = 'site' in values
        if 'outbox' in tables:
            counts = {}
            for state, count in connection.execute('SELECT status,COUNT(*) FROM outbox GROUP BY status'):
                key = state if state in STATES else '<unrecognized>'
                counts[key] = counts.get(key, 0) + count
            report['outbox_status_counts'] = counts
        return report
    finally:
        connection.close()


def script_report(root):
    raw = bounded_read(root / '.local/lib/gcake-rss/rss_monitor.py')
    wrapper = bounded_read(root / '.hermes/scripts/gcake-rss-live.sh')
    digest = hashlib.sha256(raw).hexdigest()
    return {'monitor_sha256': digest, 'matches_remote_main_monitor': digest == EXPECTED_HASH,
            'wrapper_sha256': hashlib.sha256(wrapper).hexdigest(),
            'wrapper_mentions_expected_monitor': b'/gcake-rss/rss_monitor.py' in wrapper,
            'wrapper_mentions_live_flag': b'--live' in wrapper,
            'wrapper_mentions_expected_state': b'/gcake-rss/live.sqlite' in wrapper,
            'wrapper_mentions_private_env': b'live.env' in wrapper}


def version_report(root):
    raw = bounded_read(root / '.hermes/hermes-agent/pyproject.toml').decode('utf-8')
    match = re.search(r'^version\s*=\s*[\'"](\d+\.\d+\.\d+(?:[A-Za-z0-9.+-]*))[\'"]\s*$', raw, re.MULTILINE)
    return {'source_package_version': match.group(1) if match else '<not_found>',
            'runtime_version_verified': False}


def main():
    report = {'audit_utc': datetime.now(timezone.utc).isoformat(), 'python_version': sys.version.split()[0],
              'secret_files_read': False, 'network_used': False, 'monitor_executed': False}
    for section, function in (('version', version_report), ('scripts', script_report), ('cron', cron_report), ('sqlite', sqlite_report)):
        try:
            report[section] = function(ROOT)
        except Exception as error:
            # Exception text can include private values; only its class is safe.
            report[section] = {'error_type': type(error).__name__}
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
