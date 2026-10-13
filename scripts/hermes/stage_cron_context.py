"""Create a hash-bound local Hermes patch; never install or touch jobs/secrets."""
import argparse
import difflib
import hashlib
from pathlib import Path

SOURCE_SHA256='dfc96fea523334f1cc972be6e84336c3e69e3ebe1307a3a9215b3afe97928f99'
CONTEXT_HELPER='''def _script_cron_context(job: dict) -> dict[str, str]:
    """Trusted immutable dispatch metadata; no clock or mutable jobs-file lookup."""
    from datetime import datetime, timezone
    import re

    context = {}
    for key, field in (("HERMES_CRON_JOB_ID", "id"),
                       ("HERMES_CRON_EXECUTION_ID", "execution_id")):
        value = job.get(field)
        if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}", value):
            raise ValueError("Invalid cron invocation identity")
        context[key] = value
    scheduled = job.get("_scheduled_instant")
    value = ""
    if scheduled is not None:
        if not isinstance(scheduled, str):
            raise ValueError("Invalid cron scheduled instant")
        parsed = datetime.fromisoformat(scheduled.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("Cron scheduled instant requires timezone")
        value = parsed.astimezone(timezone.utc).isoformat()
    context["HERMES_CRON_SCHEDULED_INSTANT"] = value
    return context


'''


def patch_source(text):
    old='    cancel_event: Optional[_CancelEventLike] = None,\n) -> tuple[bool, str]:\n'
    if text.count(old)!=2 or text.count('def _run_job_script(')!=1:
        raise ValueError('Unsupported runner signature')
    start=text.index('def _run_job_script(')
    end=text.index('def _start_heartbeat_thread',start)
    runner=text[start:end]
    runner=runner.replace(old,'    cancel_event: Optional[_CancelEventLike] = None,\n    *, cron_context: Optional[dict[str, str]] = None,\n) -> tuple[bool, str]:\n',1)
    marker='        env.update(env_overlay)\n'
    if runner.count(marker)!=1:raise ValueError('Unsupported environment boundary')
    runner=runner.replace(marker,marker+'''        # Runtime context is scheduler-owned, not inherited or user passthrough.
        for key in ("HERMES_CRON_JOB_ID", "HERMES_CRON_EXECUTION_ID", "HERMES_CRON_SCHEDULED_INSTANT"):
            env.pop(key, None)
        if cron_context is not None:
            env.update(cron_context)
''')
    text=text[:start]+CONTEXT_HELPER+runner+text[end:]
    start=text.index('def _run_job_script_with_claim_heartbeat(')
    tail=text[start:]
    marker='    schedule = job.get("schedule")\n'
    call='_run_job_script(script_path, workdir=workdir, cancel_event=cancel_event)'
    if tail.count(marker)!=1 or tail.count(call)!=3:
        raise ValueError('Unsupported heartbeat branches')
    tail=tail.replace(marker,'    cron_context = _script_cron_context(job)\n'+marker,1)
    tail=tail.replace(call,'_run_job_script(script_path, workdir=workdir, cancel_event=cancel_event, cron_context=cron_context)')
    return text[:start]+tail


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--patch',required=True)
    args=parser.parse_args()
    source,output,patch_file=map(Path,(args.source,args.output,args.patch))
    # Tool scope is disposable local staging, never the installed runtime.
    for path in (source,output,patch_file):
        resolved=path.resolve()
        if not resolved.is_relative_to(Path('/private/tmp')) or path.is_symlink():
            raise ValueError('Only private temporary staging paths allowed')
    raw=source.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=SOURCE_SHA256:
        raise ValueError('Owner source hash differs; do not apply blindly')
    if source.resolve()==output.resolve():raise ValueError('Preserve original source')
    original=raw.decode('utf-8');patched=patch_source(original)
    compile(patched,str(output),'exec')
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(patched)
    patch_file.write_text(''.join(difflib.unified_diff(original.splitlines(True),patched.splitlines(True),fromfile='a/cron/scheduler_script.py',tofile='b/cron/scheduler_script.py')))


if __name__=='__main__':main()
