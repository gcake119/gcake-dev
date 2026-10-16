"""SDK and current-boot health fixture; everything external is denied."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from offline_guard import install
events=install()
site=Path(sys.prefix)/'lib'/('python'+'.'.join(map(str,sys.version_info[:2])))/'site-packages'
sys.path.append(str(site))
import asyncio
from datetime import datetime,timezone
import hashlib
import importlib
import importlib.metadata as metadata
import json
import socket
import tomllib
from packaging.requirements import Requirement
from telegram import Bot
from telegram.request import BaseRequest
from telegram_health import check_current

payload=Path(sys.prefix).parent
lock_bytes=(payload/'code/uv.lock').read_bytes();lock=tomllib.loads(lock_bytes.decode())
locked={p['name']:p['version'] for p in lock['package']}
project=tomllib.loads((payload/'code/pyproject.toml').read_text())
requirements=[Requirement(v) for v in project['project']['optional-dependencies']['messaging']]
requested=[v for v in requirements if v.name=='python-telegram-bot']
assert len(requested)==1 and 'webhooks' in requested[0].extras
versions={name:metadata.version(name) for name in ('python-telegram-bot','tornado','httpx')}
assert all(locked[name]==version for name,version in versions.items())
assert requested[0].specifier.contains(versions['python-telegram-bot'])
seen=set();pending=[('python-telegram-bot',{'webhooks'})]
while pending:
    name,extras=pending.pop()
    key=(name,tuple(sorted(extras)))
    if key in seen:continue
    seen.add(key)
    for raw in metadata.requires(name) or []:
        requirement=Requirement(raw)
        if requirement.marker and not any(requirement.marker.evaluate({'extra':extra}) for extra in ({''}|extras)):continue
        assert not requirement.url
        installed=metadata.version(requirement.name)
        assert requirement.specifier.contains(installed), 'telegram-transitive-dependency-mismatch'
        pending.append((requirement.name,requirement.extras))

required={'telegram':['Update','Bot','Message','InlineKeyboardButton','InlineKeyboardMarkup','LinkPreviewOptions'],
 'telegram.ext':['Application','CommandHandler','CallbackQueryHandler','InlineQueryHandler','MessageHandler','ContextTypes','TypeHandler','filters'],
 'telegram.constants':['ParseMode','ChatType'],'telegram.request':['HTTPXRequest'],'tornado.web':['Application']}
for name,symbols in required.items():
    module=importlib.import_module(name);assert all(hasattr(module,symbol) for symbol in symbols)
    assert Path(module.__file__).resolve().is_relative_to(Path(sys.prefix).resolve())

class FixtureRequest(BaseRequest):
    calls=0
    @property
    def read_timeout(self):return 5
    async def initialize(self):pass
    async def shutdown(self):pass
    async def do_request(self,url,method,request_data=None,**kwargs):
        assert url=='https://api.telegram.org/bot123456789:OFFLINE_FIXTURE_TOKEN/getMe' and method=='POST' and self.calls==0
        self.calls+=1
        return 200,json.dumps(dict(ok=True,result=dict(id=123456789,is_bot=True,first_name='Fixture'))).encode()

def fixture_health():
    now=1810000000;start=int((now-3600)*100);iso=lambda n:datetime.fromtimestamp(n,timezone.utc).isoformat()
    identity=dict(pid=123,start_time=start,hermes_home='/fixture/home')
    platform=dict(state='connected',writer_pid=123,writer_start_time=start,updated_at=iso(now-3500))
    status=dict(answering_pid=123,gateway_state='running',updated_at=iso(now),platforms={'telegram':dict(state='failed'),'default:telegram':platform})
    assert check_current(identity,status,pid=123,home='/fixture/home',now=now)['status']=='passed'
    for key,value in (('writer_pid',999),('writer_start_time',start-300),('error_code','fixed_error'),('updated_at',iso(now-3605)),('state','failed')):
        broken=dict(status,platforms={'default:telegram':dict(platform,**{key:value})})
        try:check_current(identity,broken,pid=123,home='/fixture/home',now=now)
        except ValueError:pass
        else:raise AssertionError('unhealthy-runtime-accepted')

async def main():
    request=FixtureRequest();bot=Bot('123456789:OFFLINE_FIXTURE_TOKEN',request=request,get_updates_request=request)
    user=await asyncio.wait_for(bot.get_me(),timeout=5);assert user.id==123456789 and user.is_bot and request.calls==1
    fixture_health();blocks=[]
    for name in ('run_agent','openai','ollama','mlx_lm','gateway.run','hermes_cli.main'):
        try:importlib.import_module(name)
        except RuntimeError:blocks.append(name)
        else:raise AssertionError('forbidden-import-allowed')
    try:socket.socket(socket.AF_INET,socket.SOCK_STREAM)
    except RuntimeError:blocks.append('network-socket')
    else:raise AssertionError('network-allowed')
    try:open('/Users/hermes/.hermes/.env')
    except RuntimeError:blocks.append('private-read')
    else:raise AssertionError('private-read-allowed')
    import subprocess
    try:subprocess.run(['/usr/bin/true'])
    except RuntimeError:blocks.append('child-process')
    else:raise AssertionError('child-process-allowed')
    assert len(blocks)==9
    return dict(schema=1,status='passed',provenance='offline-SDK',versions=versions,lockSha256=hashlib.sha256(lock_bytes).hexdigest(),
      lockMatched=True,dependenciesMatched=True,moduleOriginsMatched=True,healthFixturesPassed=True,dependencySymbols=18,
      modelCalls=0,actualTelegramRequests=0,fullGatewayStarted=False,inMemoryRequests=1,blockedAttempts=blocks,auditEvents=events,humanReceipt='not_run',liveHealth='not_run')

print(json.dumps(asyncio.run(main())))
