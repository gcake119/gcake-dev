#!/usr/bin/env python3
"""Single-run RSS watcher. Install/run as the Hermes account, state outside Git."""
import argparse, datetime, email.utils, fcntl, json, os, time
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.parse import urljoin, urlparse
import xml.etree.ElementTree as ET

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def http_get(url):
    with build_opener(NoRedirect).open(Request(url,headers={'User-Agent':'gcake-hermes-rss/1'}),timeout=20) as response:
        if response.status!=200:raise RuntimeError('public fetch failed')
        return response.read(4_000_000).decode('utf8')

class ArticleHTML(HTMLParser):
    def __init__(self):
        super().__init__();self.canonical=None;self.metadata=[];self.in_json=False;self.buffer=''
    def handle_starttag(self,tag,attrs):
        values=dict(attrs)
        if tag=='link' and values.get('rel')=='canonical':self.canonical=values.get('href')
        if tag=='script' and values.get('type')=='application/ld+json':self.in_json=True;self.buffer=''
    def handle_data(self,data):
        if self.in_json:self.buffer+=data
    def handle_endtag(self,tag):
        if tag=='script' and self.in_json:
            self.in_json=False
            try:
                obj=json.loads(self.buffer)
                self.metadata.extend(obj if isinstance(obj,list) else obj.get('@graph',[obj]))
            except (ValueError,AttributeError):pass

def verify_page(source,url,title,expected_date=None):
    page=ArticleHTML();page.feed(source)
    return page.canonical==url and any(isinstance(m,dict) and m.get('@type') in ('Article','BlogPosting') and m.get('headline')==title and m.get('datePublished') and (expected_date is None or datetime.datetime.fromisoformat(m['datePublished'].replace('Z','+00:00'))==expected_date) for m in page.metadata)

class Poller:
    def __init__(self,state,base,fetch_page,send,now=time.time):
        self.path=Path(state);self.base=base.rstrip('/')+'/';self.fetch=fetch_page;self.send=send;self.now=now
    def save(self,state):
        temp=self.path.with_suffix('.tmp')
        fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
        with os.fdopen(fd,'w') as f:
            json.dump(state,f,ensure_ascii=False);f.flush();os.fsync(f.fileno())
        os.replace(temp,self.path);os.chmod(self.path,0o600)
    def poll(self,xml):
        self.path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        with self.path.with_suffix('.lock').open('a') as lock:
            os.chmod(lock.name,0o600);fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            state=json.loads(self.path.read_text()) if self.path.exists() else {'version':1,'seen':{},'failures':0,'retry_at':0}
            if state.get('version')!=1:raise RuntimeError('unknown state version')
            if self.now()<state['retry_at']:return state
            try:
                root=ET.fromstring(xml)
                if root.tag!='rss' or root.find('channel') is None:raise ValueError('invalid RSS feed')
                items=[]
                for item in root.findall('./channel/item'):
                    title=item.findtext('title') or '';url=item.findtext('link') or '';guid=item.findtext('guid') or ''
                    if not title or not guid or not url.startswith(self.base+'posts/') or urlparse(url).netloc!=urlparse(self.base).netloc:continue
                    items.append((title,url,guid,item.findtext('pubDate')))
                if not state.get('baseline'):
                    for _,url,guid,_ in items:state['seen'][url]={'state':'baseline','guid':guid}
                    state['baseline']=True;self.save(state);return state
                for title,url,guid,published in reversed(items):
                    if url in state['seen']:continue
                    if not published:raise ValueError('RSS publication date missing')
                    dt=email.utils.parsedate_to_datetime(published)
                    if dt.tzinfo is None:raise ValueError('RSS timezone missing')
                    if guid!=url or not verify_page(self.fetch(url),url,title,dt):raise ValueError('page identity mismatch')
                    taipei=dt.astimezone(datetime.timezone(datetime.timedelta(hours=8))).isoformat()
                    state['seen'][url]={'state':'pending-send','guid':guid,'at':self.now()};self.save(state)
                    try:
                        self.send(f'{title}\n{url}\n發布時間：{taipei}（Asia/Taipei）')
                    except Exception:
                        state['seen'][url]['state']='unknown';self.save(state);continue
                    state['seen'][url]['state']='sent';self.save(state)
                state['failures']=0;state['retry_at']=0;state.pop('error',None)
            except Exception:
                state['failures']+=1;state['retry_at']=self.now()+min(3600,60*(2**min(state['failures']-1,6)));state['error']='feed-or-page-unavailable'
            state['unknown']=sum(x['state'] in ('unknown','pending-send') for x in state['seen'].values());self.save(state);return state

def telegram(message):
    token=os.environ.get('TELEGRAM_BOT_TOKEN');chat=os.environ.get('TELEGRAM_CHAT_ID')
    if not token or not chat:raise RuntimeError('Telegram credentials unavailable')
    request=Request('https://api.telegram.org/bot'+token+'/sendMessage',data=json.dumps({'chat_id':chat,'text':message,'disable_web_page_preview':True}).encode(),headers={'Content-Type':'application/json'},method='POST')
    with build_opener(NoRedirect).open(request,timeout=20) as response:
        if not json.load(response).get('ok'):raise RuntimeError('Telegram did not acknowledge')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--state',default=str(Path.home()/'.local/state/gcake-release/rss.json'));parser.add_argument('--base',default='https://gcake119.github.io/gcake-dev/');parser.add_argument('--dry-run',action='store_true');args=parser.parse_args()
    if not args.base.startswith('https://') and urlparse(args.base).hostname not in ('localhost','127.0.0.1'):raise RuntimeError('HTTPS base required')
    state=Path(args.state).resolve()
    if args.dry_run:
        # A simulation must never consume real notification deduplication state.
        state=state.with_name(state.stem+'.dry-run'+state.suffix)
    if (Path(__file__).resolve().parents[2] == state or Path(__file__).resolve().parents[2] in state.parents):raise RuntimeError('State must live outside repository')
    poller=Poller(state,args.base,http_get,lambda message:print('DRY RUN：'+message) if args.dry_run else telegram(message))
    try:xml=http_get(urljoin(poller.base,'rss.xml'))
    except Exception:xml=''
    result=poller.poll(xml)
    print(json.dumps({'baseline':result.get('baseline',False),'unknown':result.get('unknown',0),'retry_at':result.get('retry_at',0),'error':result.get('error')},ensure_ascii=False))
if __name__=='__main__':main()
