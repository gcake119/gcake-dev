"""Pure current-boot health validation. No RPC, credentials, models or APIs."""
from datetime import datetime
import math

def stamp(value):
    try:
        result=datetime.fromisoformat(value.replace('Z','+00:00'))
        if result.tzinfo is None:raise ValueError()
        return result.timestamp()
    except (AttributeError,TypeError,ValueError,OverflowError):raise ValueError('invalid-health-timestamp')

def check_current(identity,status,*,pid,home,now):
    if type(pid) is not int or pid<=0 or not math.isfinite(now):raise ValueError('invalid-health-identity')
    if not isinstance(identity,dict) or not isinstance(status,dict):raise ValueError('missing-current-health')
    start=identity.get('start_time')
    if identity.get('pid')!=pid or type(identity.get('pid')) is not int or identity.get('hermes_home')!=home or type(start) is not int:raise ValueError('foreign-health-identity')
    if status.get('answering_pid')!=pid or type(status.get('answering_pid')) is not int or status.get('gateway_state')!='running':raise ValueError('gateway-not-current-and-running')
    if not -5<=now-stamp(status.get('updated_at'))<=90:raise ValueError('stale-gateway-health')
    if status.get('restart_requested') is True or status.get('exit_reason'):raise ValueError('gateway-not-ready')
    platforms=status.get('platforms',{})
    platform=platforms.get('default:telegram',platforms.get('telegram')) if isinstance(platforms,dict) else None
    if not isinstance(platform,dict) or platform.get('state')!='connected':raise ValueError('telegram-not-connected')
    writer=platform.get('writer_start_time')
    if type(platform.get('writer_pid')) is not int or platform['writer_pid']!=pid or type(writer) is not int or abs(writer-start)>200:raise ValueError('foreign-platform-writer')
    connected=stamp(platform.get('updated_at'))
    if not start/100-2<=connected<=now+5:raise ValueError('platform-not-from-current-boot')
    if any(platform.get(k) for k in ('error_code','error_message','retrying_since','needs_attention')):raise ValueError('telegram-platform-error')
    return dict(status='passed',scope='current-boot-runtime',humanReceipt='not_run')
