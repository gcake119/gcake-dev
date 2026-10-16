"""Guard this qualification process against providers, network and child code."""
import importlib.abc
import os
import socket
import sys

DENIED=('gateway','hermes_cli','agent','run_agent','tools','openai','anthropic','litellm','ollama','mlx','mlx_lm','torch','transformers')
def install(write_root=None):
    events=[]
    def denied(n):return any(n==p or n.startswith(p+'.') for p in DENIED)
    if any(denied(n) for n in sys.modules):raise RuntimeError('forbidden-module-already-loaded')
    class Blocker(importlib.abc.MetaPathFinder):
        def find_spec(self,fullname,path=None,target=None):
            if denied(fullname):
                events.append('forbidden-import');raise RuntimeError('offline-forbidden-import')
    sys.meta_path.insert(0,Blocker())
    def audit(event,args):
        if event in ('socket.connect','socket.getaddrinfo','socket.gethostbyname','subprocess.Popen','os.system','os.exec','os.posix_spawn','os.fork'):
            events.append('forbidden-effect');raise RuntimeError('offline-forbidden-effect')
        if event=='socket.__new__' and args[1]!=socket.AF_UNIX:
            events.append('forbidden-network-socket');raise RuntimeError('offline-forbidden-network-socket')
        if event=='open' and isinstance(args[0],(str,bytes,os.PathLike)):
            path=os.fsdecode(args[0])
            if path=='/Users/hermes' or path.startswith('/Users/hermes/'):
                events.append('forbidden-private-read');raise RuntimeError('offline-forbidden-private-read')
            flags=args[2] if len(args)>2 and type(args[2]) is int else 0
            if flags & (os.O_WRONLY|os.O_RDWR|os.O_CREAT|os.O_TRUNC|os.O_APPEND):
                from pathlib import Path
                if write_root is None or not Path(path).resolve().is_relative_to(Path(write_root).resolve()):
                    raise RuntimeError('offline-forbidden-write')
    sys.addaudithook(audit)
    return events
