def _script_argv(path: Path) -> tuple[Optional[list[str]], dict[str, str], Optional[str]]:
    """``(argv, env_overlay, error)`` for a validated script. Interpreter by extension — the
    shebang is deliberately NOT honoured (small, auditable surface): ``.sh``/``.bash`` → bash,
    else ``sys.executable`` (Windows uv-venv overlay gets the .pth bootstrap)."""
    if path.suffix.lower() in {'.sh', '.bash'}:
        _bash = shutil.which('bash') or ('/bin/bash' if os.path.isfile('/bin/bash') else None)
        if _bash is None:
            return (None, {}, f'Cannot run .sh/.bash script {path.name!r}: bash not found on PATH. On Windows, install Git for Windows (which ships Git Bash) or rewrite the script as Python (.py).')
        return ([_bash, str(path)], {}, None)
    python_exe, env_overlay = _windows_cron_python_invocation(sys.executable)
    if env_overlay:
        return (_windows_cron_bootstrap_argv(python_exe, env_overlay, str(path)), env_overlay, None)
    return ([python_exe, str(path)], env_overlay, None)

def _script_cron_context(job: dict) -> dict[str, str]:
    """Trusted immutable dispatch metadata; no clock or mutable jobs-file lookup."""
    from datetime import datetime, timezone
    import re
    context = {}
    for key, field in (('HERMES_CRON_JOB_ID', 'id'), ('HERMES_CRON_EXECUTION_ID', 'execution_id')):
        value = job.get(field)
        if not isinstance(value, str) or not re.fullmatch('[A-Za-z0-9][A-Za-z0-9._:-]{0,127}', value):
            raise ValueError('Invalid cron invocation identity')
        context[key] = value
    scheduled = job.get('_scheduled_instant')
    value = ''
    if scheduled is not None:
        if not isinstance(scheduled, str):
            raise ValueError('Invalid cron scheduled instant')
        parsed = datetime.fromisoformat(scheduled.replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            raise ValueError('Cron scheduled instant requires timezone')
        value = parsed.astimezone(timezone.utc).isoformat()
    context['HERMES_CRON_SCHEDULED_INSTANT'] = value
    return context

def _run_job_script(script_path: str, workdir: Optional[str]=None, cancel_event: Optional[_CancelEventLike]=None, *, cron_context: Optional[dict[str, str]]=None) -> tuple[bool, str]:
    """Execute a cron job's script and return ``(success, output)``; on failure *output* is the
    error message for the LLM to report. Env goes through ``build_subprocess_env`` (SECURITY.md
    §2.3). ``workdir`` sets the subprocess cwd only; the Python process cwd is NEVER mutated (an
    ``os.chdir()`` would leak into concurrent gateway sessions).

    Args: script_path: Path to the script. Relative paths are resolved against HERMES_HOME/scripts/.
    Absolute and ~-prefixed paths are also validated to ensure they stay within the scripts dir. workdir:
    Optional absolute path to use as the script's cwd. When set, the subprocess runs in this directory
    instead of the scripts-dir parent. See #69396.
    """
    path, err = _resolve_script_path(script_path)
    if path is None:
        return (False, err)
    script_timeout = _get_script_timeout()
    argv, env_overlay, err = _script_argv(path)
    if argv is None:
        return (False, err)
    try:
        from tools.environments.local import build_subprocess_env
        popen_kwargs: dict[str, Any] = {'start_new_session': True, 'errors': 'replace'}
        if sys.platform == 'win32':
            popen_kwargs = {'creationflags': windows_hide_flags() | getattr(subprocess, 'CREATE_NEW_PROCESS_GROUP', 0), 'encoding': 'utf-8', 'errors': 'replace'}
        env = build_subprocess_env(strip_launch_profile=True)
        env.update(env_overlay)
        for key in ('HERMES_CRON_JOB_ID', 'HERMES_CRON_EXECUTION_ID', 'HERMES_CRON_SCHEDULED_INSTANT'):
            env.pop(key, None)
        if cron_context is not None:
            env.update(cron_context)
        proc = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd=workdir or str(path.parent), env=env, **popen_kwargs)
        deadline = time.monotonic() + script_timeout
        while True:
            if cancel_event is not None and cancel_event.is_set():
                _terminate_cron_script_tree(proc)
                _drain_script_pipes(proc)
                return (False, 'Script cancelled because cron fire ownership was lost')
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                _terminate_cron_script_tree(proc)
                _drain_script_pipes(proc)
                return (False, f'Script timed out after {script_timeout}s: {path}')
            try:
                stdout_raw, stderr_raw = proc.communicate(timeout=min(0.1, remaining))
                break
            except subprocess.TimeoutExpired:
                continue
        stdout = (stdout_raw or '').strip()
        stderr = (stderr_raw or '').strip()
        try:
            from agent.redact import redact_sensitive_text
            stdout = redact_sensitive_text(stdout)
            stderr = redact_sensitive_text(stderr)
        except Exception as e:
            logger.warning('Failed to redact sensitive text from output: %s', e)
            stdout = stderr = '[REDACTED - redaction failed]'
        if proc.returncode != 0:
            parts = [f'Script exited with code {proc.returncode}']
            if stderr:
                parts.append(f'stderr:\n{stderr}')
            if stdout:
                parts.append(f'stdout:\n{stdout}')
            return (False, '\n'.join(parts))
        return (True, stdout)
    except Exception as exc:
        return (False, f'Script execution failed: {exc}')

def _start_heartbeat_thread(loop_fn, name: str, fail_log) -> Optional[threading.Thread]:
    """Start ``loop_fn`` on a daemon thread inside a copy of the current context (multiplexed
    profile ContextVars). On failure calls ``fail_log()`` inside the except (traceback intact) and
    returns None."""
    thread = threading.Thread(target=contextvars.copy_context().run, args=(loop_fn,), name=name, daemon=True)
    try:
        thread.start()
    except Exception:
        fail_log()
        return None
    return thread

def _run_job_script_with_claim_heartbeat(job: dict, script_path: str, workdir: Optional[str]=None, cancel_event: Optional[_CancelEventLike]=None) -> tuple[bool, str]:
    """Run a cron script while heartbeating its owned one-shot claim. A long script can outlive
    the stale-claim TTL; without a heartbeat another scheduler would re-dispatch the one-shot.
    Recurring/unclaimed runs have no durable claim → no thread. The owner is captured from the
    dispatched job, never re-read, so a stale runner cannot extend a replacement owner's claim."""
    cron_context = _script_cron_context(job)
    schedule = job.get('schedule')
    claim = job.get('run_claim')
    owner = str(claim.get('by') or '') if isinstance(claim, dict) else ''
    if not (isinstance(schedule, dict) and schedule.get('kind') == 'once' and owner):
        return _run_job_script(script_path, workdir=workdir, cancel_event=cancel_event, cron_context=cron_context)
    job_id = str(job.get('id') or '')
    stop = threading.Event()

    def _heartbeat_loop() -> None:
        while not stop.wait(_sched._RUN_CLAIM_HEARTBEAT_SECONDS):
            try:
                _sched.heartbeat_run_claim(job_id, expected_owner=owner)
            except Exception:
                logger.debug("Job '%s': script run_claim heartbeat failed", job_id, exc_info=True)
    heartbeat_thread = _start_heartbeat_thread(_heartbeat_loop, 'cron-script-claim-heartbeat', lambda: logger.debug("Job '%s': could not start script run_claim heartbeat", job_id, exc_info=True))
    if heartbeat_thread is None:
        return _run_job_script(script_path, workdir=workdir, cancel_event=cancel_event, cron_context=cron_context)
    try:
        return _run_job_script(script_path, workdir=workdir, cancel_event=cancel_event, cron_context=cron_context)
    finally:
        stop.set()
        heartbeat_thread.join(timeout=1.0)
