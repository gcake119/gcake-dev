#!/usr/bin/env python3
"""Inspect scheduler source as data. Never import Hermes, run jobs or read secrets."""
import ast
import copy
import hashlib
import importlib.util
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('/Users/hermes')
SAFE_STRINGS = {
    'next_run_at', 'last_run_at', 'created_at', 'scheduled_at', 'scheduled_for',
    'due_at', 'run_at', 'schedule', 'kind', 'interval', 'minutes', 'seconds',
    'hours', 'timezone', 'cron', 'once', 'no_agent', 'no-agent', 'script',
    'job_id', 'id', 'env', 'cwd', 'shell', 'local', 'running', 'scheduled',
    'enabled', 'state', 'status', 'run_count', 'last_scheduled_at',
    '-c', '-lc', '/bin/bash', '/bin/sh', 'bash', 'sh', 'UTC', 'Asia/Taipei',
}
SIGNALS = {
    'next_run_at', 'last_run_at', 'scheduled_at', 'scheduled_for', 'due_at',
    'run_at', 'last_scheduled_at', 'no_agent', 'script', 'run_count',
    'subprocess', 'Popen', 'create_subprocess_exec', 'create_subprocess_shell',
    'timedelta', 'get_due_jobs', 'mark_job_run', 'compute_next_run',
}
MAX_LINES = 650
MAX_FILES = 140


def read(path):
    if path.is_symlink():
        raise ValueError('Symlink refused')
    with path.open('rb') as source:
        raw = source.read(2 * 1024 * 1024 + 1)
    if len(raw) > 2 * 1024 * 1024:
        raise ValueError('File bound')
    return raw


class Redact(ast.NodeTransformer):
    def visit_Constant(self, node):
        value = node.value
        if isinstance(value, str):
            allowed = value in SAFE_STRINGS or bool(re.fullmatch(r'(?:HERMES_CRON_|HERMES_JOB_|CRON_JOB_)[A-Z0-9_]{1,48}', value))
            if not allowed:
                return ast.copy_location(ast.Constant(value='<string omitted>'), node)
        elif isinstance(value, bytes):
            return ast.copy_location(ast.Constant(value=b'<bytes omitted>'), node)
        elif type(value) in (int, float) and value not in (0, 1, 2, 5, 10, 30, 60, 1000, 3600, 86400):
            return ast.copy_location(ast.Constant(value='<number omitted>'), node)
        return node


def relevant(node):
    for child in ast.walk(node):
        if isinstance(child, ast.Constant) and isinstance(child.value, str) and child.value in SIGNALS:
            return True
        if isinstance(child, ast.Name) and child.id in SIGNALS:
            return True
        if isinstance(child, ast.Attribute) and child.attr in SIGNALS:
            return True
    return False


def functions(tree, prefix=''):
    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            yield from functions(node, prefix + node.name + '.')
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            yield prefix + node.name, node
            yield from functions(node, prefix + node.name + '.')


def source_report(root):
    repo = root / '.hermes/hermes-agent'
    paths = []
    for name in ('cron', 'hermes_cli'):
        directory = repo / name
        if directory.is_dir() and not directory.is_symlink():
            paths.extend(sorted(directory.rglob('*.py')))
    for name in ('gateway/run.py', 'gateway/cron.py', 'tools/cronjob_tools.py'):
        path = repo / name
        if path.is_file():
            paths.append(path)
    if len(paths) > MAX_FILES:
        raise ValueError('Source inventory bound')
    report = {'files_scanned': 0, 'matches': [], 'truncated': False}
    budget = MAX_LINES
    for path in paths:
        if not path.resolve().is_relative_to(repo.resolve()) or any(p.is_symlink() for p in path.parents if p != repo.parent):
            continue
        raw = read(path)
        tree = ast.parse(raw.decode('utf-8'))
        report['files_scanned'] += 1
        hits = []
        for qualified, function in functions(tree):
            if not relevant(function):
                continue
            span = function.end_lineno - function.lineno + 1
            if span <= 75:
                nodes = [function]
            else:
                # Focus large gateway functions on original scheduler/script statements.
                nodes = [node for node in ast.walk(function)
                         if isinstance(node, ast.stmt) and not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
                         and node.end_lineno - node.lineno <= 18 and relevant(node)]
                nodes.sort(key=lambda node: (node.lineno, -node.end_lineno))
                selected = []
                for node in nodes:
                    if not any(parent.lineno <= node.lineno and parent.end_lineno >= node.end_lineno for parent in selected):
                        selected.append(node)
                nodes = selected
            snippets = []
            for node in nodes:
                safe = ast.fix_missing_locations(Redact().visit(copy.deepcopy(node)))
                code = ast.unparse(safe)
                length = len(code.splitlines())
                if length > budget:
                    report['truncated'] = True
                    break
                budget -= length
                snippets.append({'line_start': node.lineno, 'line_end': node.end_lineno, 'code': code})
            if snippets:
                hits.append({'function': qualified, 'line_start': function.lineno,
                             'full_function': nodes == [function] and not report['truncated'], 'snippets': snippets})
            if budget <= 0:
                report['truncated'] = True
                break
        if hits:
            report['matches'].append({'file': str(path.relative_to(repo)), 'sha256': hashlib.sha256(raw).hexdigest(), 'functions': hits})
        if report['truncated']:
            break
    return report


def wrapper_report(root):
    raw = read(root / '.hermes/scripts/gcake-rss-live.sh')
    text = raw.decode('utf-8')
    variables = set()
    for match in re.finditer(r'\$(?:\{([A-Za-z_][A-Za-z0-9_]*)(?::[^}]+)?\}|([A-Za-z_][A-Za-z0-9_]*))', text):
        variables.add(match.group(1) or match.group(2))
    return {'sha256': hashlib.sha256(raw).hexdigest(),
            'syntactic_shell_variable_names': sorted(variables),
            'mentions_round_at': '--round-at' in text,
            'values_and_commands_disclosed': False}


def main():
    # Reuse the reviewed job whitelist; import only our audit helper, never Hermes.
    helper = Path(__file__).with_name('hermes-readonly-audit.py')
    spec = importlib.util.spec_from_file_location('inventory_helper', helper)
    inventory = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(inventory)
    result = {'audit_utc': datetime.now(timezone.utc).isoformat(),
              'source_only': True, 'hermes_imported': False, 'jobs_executed': False,
              'secret_files_read': False, 'network_used': False}
    for name, function in [('scheduler_source', source_report), ('live_wrapper', wrapper_report), ('job_snapshot', inventory.cron_report)]:
        try:
            result[name] = function(ROOT)
        except Exception as error:
            result[name] = {'error_type': type(error).__name__}
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
