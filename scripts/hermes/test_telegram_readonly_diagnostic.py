import io
import json
import unittest
import urllib.error
from telegram_readonly_diagnostic import inspect_provider,read_method

TOKEN='123:fixture_secret'
CHAT='456'


class Response(io.BytesIO):
    def __init__(self,url,value):
        super().__init__(json.dumps(value).encode());self.url=url;self.status=200


class ReadOnlyProbe(unittest.TestCase):
    def test_only_identity_reads_and_no_disclosure_or_send_proof(self):
        calls=[]
        def opener(request,timeout):
            calls.append(request.full_url.rsplit('/',1)[-1])
            self.assertEqual(timeout,15)
            if calls[-1]=='getMe':value={'id':123,'is_bot':True,'first_name':'PRIVATE_NAME'}
            else:
                self.assertEqual(json.loads(request.data),{'chat_id':CHAT})
                value={'id':456,'type':'private','first_name':'PRIVATE_TARGET'}
            return Response(request.full_url,dict(ok=True,result=value))
        report=inspect_provider(TOKEN,CHAT,opener)
        self.assertEqual(calls,['getMe','getChat'])
        self.assertTrue(report['bot_identity_matches_token']);self.assertTrue(report['chat_identity_matches_configuration'])
        self.assertFalse(report['send_permission_confirmed']);self.assertEqual(report['message_sends'],0)
        for value in (TOKEN,CHAT,'PRIVATE_NAME','PRIVATE_TARGET'):self.assertNotIn(value,json.dumps(report))

    def test_unauthorized_stops_after_one_call_and_preserves_numeric_error(self):
        calls=[]
        def opener(request,timeout):
            calls.append(request)
            raise urllib.error.HTTPError(request.full_url,401,'credential-secret',{},io.BytesIO(json.dumps(dict(ok=False,error_code=401,description='Unauthorized')).encode()))
        report=inspect_provider(TOKEN,CHAT,opener)
        self.assertEqual(len(calls),1);self.assertEqual(report['getMe']['error_code'],401)
        self.assertEqual(report['getMe']['error_reason'],'unauthorized')
        self.assertNotIn(TOKEN,json.dumps(report));self.assertNotIn('credential-secret',json.dumps(report))

    def test_chat_rejection_discloses_only_bounded_reason(self):
        def opener(request,timeout):
            if request.full_url.endswith('/getMe'):return Response(request.full_url,dict(ok=True,result=dict(id=123,is_bot=True)))
            return Response(request.full_url,dict(ok=False,error_code=400,description='Bad Request: private-target '+CHAT))
        report=inspect_provider(TOKEN,CHAT,opener)
        self.assertEqual(report['getChat']['error_reason'],'telegram_rejected')
        self.assertNotIn(CHAT,json.dumps(report));self.assertNotIn('private-target',json.dumps(report))

    def test_timeout_has_no_retry_or_secret_text(self):
        calls=[]
        def opener(request,timeout):calls.append(request);raise TimeoutError(request.full_url)
        report=inspect_provider(TOKEN,CHAT,opener)
        self.assertEqual(len(calls),1);self.assertEqual(report['getMe']['error_type'],'TimeoutError')
        self.assertNotIn(TOKEN,json.dumps(report))

    def test_invalid_config_and_mutating_methods_never_reach_network(self):
        def forbidden(*args,**kwargs):self.fail('unexpected network')
        self.assertEqual(inspect_provider('',CHAT,forbidden)['network_requests'],0)
        for method in ('sendMessage','getUpdates','setWebhook'):
            with self.assertRaises(ValueError):read_method(TOKEN,method,{},forbidden)

    def test_redirect_cannot_leak_token_to_second_host(self):
        def opener(request,timeout):return Response('https://other.invalid/',dict(ok=True,result=dict(id=123,is_bot=True)))
        report=inspect_provider(TOKEN,CHAT,opener)
        self.assertEqual(report['getMe']['error_type'],'ValueError')
        self.assertEqual(report['network_requests'],1)


if __name__=='__main__':unittest.main()
