"""Bounded Telegram getMe/getChat probe. No sends, polling or state writes."""
import json
import os
from pathlib import Path
import pwd
import re
import urllib.error
import urllib.request

LIMIT=65536
METHODS=frozenset(('getMe','getChat'))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args):raise ValueError('redirect-refused')


def read_method(token,method,parameters,opener):
    if method not in METHODS:raise ValueError('read-only-method-required')
    url='https://api.telegram.org/bot'+token+'/'+method
    request=urllib.request.Request(url,data=json.dumps(parameters).encode(),headers={'Content-Type':'application/json'},method='POST')
    report=dict(method=method,ok=False)
    try:
        try:
            response=opener(request,timeout=15)
        except urllib.error.HTTPError as error:
            response=error
        with response:
            if response.url!=url:raise ValueError('redirect-refused')
            raw=response.read(LIMIT+1)
            status=getattr(response,'status',None) or getattr(response,'code',None)
            if type(status) is int:report['http_status']=status
        if len(raw)>LIMIT:raise ValueError('response-too-large')
        value=json.loads(raw)
        if not isinstance(value,dict):raise ValueError('invalid-response')
        if value.get('ok') is False:
            code=value.get('error_code')
            report['error_code']=code if type(code) is int else None
            # Never expose free-form provider text, names, token or recipient.
            reasons={'Unauthorized':'unauthorized','Not Found':'not_found',
                     'Bad Request: chat not found':'chat_not_found',
                     'Forbidden: bot was blocked by the user':'bot_blocked',
                     'Forbidden: user is deactivated':'user_deactivated',
                     'Forbidden: bot was kicked from the group chat':'bot_kicked',
                     'Forbidden: bot is not a member of the channel chat':'bot_not_member',
                     'Too Many Requests: retry after':'rate_limited'}
            report['error_reason']=reasons.get(value.get('description'),'telegram_rejected')
            return report,None
        if value.get('ok') is not True or not isinstance(value.get('result'),dict):raise ValueError('invalid-response')
        report['ok']=True
        return report,value['result']
    except Exception as error:
        allowed=('TimeoutError','HTTPError','URLError','ValueError','JSONDecodeError','OSError')
        report['error_type']=type(error).__name__ if type(error).__name__ in allowed else 'Exception'
        return report,None


def inspect_provider(token,chat,opener=None):
    report=dict(scope='telegram_provider_readonly',state_writes=0,message_sends=0,
                network_requests=0,send_permission_confirmed=False)
    if not re.fullmatch(r'\d+:[A-Za-z0-9_-]+',token) or not re.fullmatch(r'-?\d+',chat):
        report['preflight']='invalid_configuration';return report
    opener=opener or urllib.request.build_opener(NoRedirect,urllib.request.ProxyHandler({})).open
    report['network_requests']+=1
    report['getMe'],bot=read_method(token,'getMe',{},opener)
    if bot is None:return report
    report['bot_identity_matches_token']=type(bot.get('id')) is int and str(bot['id'])==str(int(token.split(':',1)[0])) and bot.get('is_bot') is True
    if not report['bot_identity_matches_token']:return report
    report['network_requests']+=1
    report['getChat'],target=read_method(token,'getChat',{'chat_id':chat},opener)
    if target is not None:
        report['chat_identity_matches_configuration']=type(target.get('id')) is int and target['id']==int(chat)
        if target.get('type') in ('private','group','supergroup','channel'):report['chat_type']=target['type']
    return report


def main():
    if os.geteuid()!=pwd.getpwnam('hermes').pw_uid:raise PermissionError('hermes account required')
    print(json.dumps(inspect_provider(os.environ.get('TELEGRAM_BOT_TOKEN',''),os.environ.get('TELEGRAM_CHAT_ID',''))))


if __name__=='__main__':
    try:main()
    except Exception as error:
        print(json.dumps(dict(status='blocked',error_type=type(error).__name__)))
        raise SystemExit(1)
