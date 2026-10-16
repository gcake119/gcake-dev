"""Required Telegram capability for newly approved production packages."""
import hashlib
from updater_guard import canonical,read,check_payload

PROOF='library/telegram-package-health.json'
def require_manifest(manifest):
    if manifest.get('capability',{}).get('telegram')!=dict(required=True,proof_file=PROOF,post_start_required=True):raise ValueError('telegram-required-capability-missing')
    report=manifest.get('verification',{}).get('telegram')
    if not isinstance(report,dict):raise ValueError('telegram-package-proof-required')
    if report.get('schema')!=1 or report.get('status')!='passed' or report.get('provenance')!='offline-SDK':raise ValueError('telegram-offline-proof-required')
    if any(report.get(k) is not True for k in ('lockMatched','dependenciesMatched','moduleOriginsMatched','healthFixturesPassed')):raise ValueError('telegram-package-check-incomplete')
    if type(report.get('modelCalls')) is not int or report['modelCalls']!=0 or type(report.get('actualTelegramRequests')) is not int or report['actualTelegramRequests']!=0 or report.get('fullGatewayStarted') is not False:raise ValueError('telegram-offline-boundary-required')
    if report.get('lockSha256')!=manifest.get('lock_sha'):raise ValueError('telegram-lock-proof-drift')
    if report.get('dependencySymbols')!=18 or report.get('inMemoryRequests')!=1 or set(report.get('blockedAttempts',[]))!={'run_agent','openai','ollama','mlx_lm','gateway.run','hermes_cli.main','network-socket','private-read','child-process'}:raise ValueError('telegram-offline-guard-proof-missing')
    files=manifest.get('files',{});proof=files.get(PROOF,{})
    sha=hashlib.sha256(canonical(report)).hexdigest()
    if proof.get('kind')!='file' or proof.get('sha256')!=sha or manifest['verification'].get('evidence_sha')!=sha:raise ValueError('telegram-proof-binding-drift')
    lock=files.get('code/uv.lock',{})
    if lock.get('kind')!='file' or lock.get('sha256')!=report['lockSha256']:raise ValueError('telegram-source-lock-drift')
    parts=manifest.get('python_version','').split('.');prefix='runtime/lib/python'+'.'.join(parts[:2])+'/site-packages/'
    versions=report.get('versions',{})
    import re
    for name in ('python-telegram-bot','tornado','httpx'):
        version=versions.get(name)
        if not isinstance(version,str) or not re.fullmatch(r'[0-9]+(?:\.[0-9]+)+(?:[a-z0-9.]*)?',version):raise ValueError('telegram-package-version-required')
        distribution=name.replace('-','_')+'-'+version+'.dist-info/METADATA'
        if files.get(prefix+distribution,{}).get('kind')!='file':raise ValueError('telegram-package-metadata-missing')
    for name in ('telegram/__init__.py','telegram/ext/__init__.py','telegram/request/_httpxrequest.py','tornado/web.py','httpx/__init__.py'):
        if files.get(prefix+name,{}).get('kind')!='file':raise ValueError('telegram-package-module-missing')
    return report

def verify_candidate(bundle):
    manifest=read(bundle/'manifest.json');report=require_manifest(manifest);check_payload(bundle/'payload',manifest)
    if read(bundle/'payload'/PROOF)!=report:raise ValueError('telegram-proof-content-drift')
    return report
