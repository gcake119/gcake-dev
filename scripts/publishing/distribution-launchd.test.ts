import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {renderLaunchAgent,assertStandaloneAcceptance} from './distribution-launchd';
const opts={node:'/opt/node/bin/node',runtime:'/Users/demo/runtime',privateDirectory:'/Users/demo/private',credentials:'/Users/demo/credentials.env',label:'dev.gcake.distribution-sync'};
test('system scheduler uses absolute paths, 15-minute cadence and existing private env file without Codex',()=>{const xml=renderLaunchAgent(opts);const agent=JSON.parse(execFileSync('python3',['-c','import plistlib,json,sys;print(json.dumps(plistlib.loads(sys.stdin.buffer.read())))'],{input:xml,encoding:'utf8'}));assert.equal(agent.StartInterval,900);assert.equal(agent.WorkingDirectory,opts.runtime);assert.equal(agent.ProgramArguments[0],opts.node);assert.ok(agent.ProgramArguments.includes('--env-file='+opts.credentials));assert.ok(agent.ProgramArguments.includes('--execute'));assert.equal(agent.RunAtLoad,false);assert.equal(agent.KeepAlive,false);assert.ok(!xml.includes('codex'));assert.equal(agent.StandardOutPath,opts.privateDirectory+'/logs/stdout.log');});
test('relative paths and incomplete independent acceptance cannot activate',()=>{assert.throws(()=>renderLaunchAgent({...opts,node:'node'}),/ABSOLUTE/);assert.throws(()=>assertStandaloneAcceptance({status:'passed',transport:'attended'}),/ACCEPTANCE/);assert.throws(()=>assertStandaloneAcceptance({status:'passed',transport:'profile',profileVerified:true,readOnlyRound:'completed',inFlight:0}),/ACCEPTANCE/);assert.throws(()=>assertStandaloneAcceptance({status:'passed',transport:'profile',profileVerified:true,readOnlyRound:'completed',inFlight:1}),/ACCEPTANCE/);});
test('cutover can preserve the original shared lock instead of introducing a competing writer namespace',()=>{const lock='/Users/demo/old/round-lock';const xml=renderLaunchAgent({...opts,lock});assert.ok(xml.includes('<string>'+lock+'</string>'));assert.ok(!xml.includes('<string>'+opts.privateDirectory+'/round-lock</string>'));});
test('native scheduled source verification uses the qualified IPv4 path without weakening TLS or retrying requests',()=>{
 const xml=renderLaunchAgent(opts);
 assert.ok(xml.includes('<string>--no-network-family-autoselection</string>'));
 assert.ok(xml.includes('<string>--dns-result-order=ipv4first</string>'));
 assert.ok(!xml.includes('NODE_TLS_REJECT_UNAUTHORIZED'));
});

test('browser-free acceptance permits held targets without pretending they are verified or needing native permissions',()=>{
 const accepted={status:'passed',executionMode:'anonymous-only',transport:'anonymous-public',browserAccess:false,articleWrites:0,readOnlyRound:'completed',inFlight:0,providerStates:[{target:'substack',status:'manual_required'}]};
 assert.doesNotThrow(()=>assertStandaloneAcceptance(accepted));
 for(const patch of [{browserAccess:true},{articleWrites:1},{inFlight:1},{readOnlyRound:'not_run'},{providerStates:[]},{providerStates:[{target:'substack',status:'uncertain'}]}])assert.throws(()=>assertStandaloneAcceptance({...accepted,...patch}),/ACCEPTANCE/);
});

test('scheduler install refuses legacy profile and native receipts without anonymous evidence',()=>{
 for(const receipt of [{status:'passed',transport:'profile',profileVerified:true,readOnlyRound:'completed',inFlight:0},{status:'passed',transport:'macos-chrome',nativePermissionsVerified:true,readOnlyRound:'completed',inFlight:0}])assert.throws(()=>assertStandaloneAcceptance(receipt),/ANONYMOUS_ACCEPTANCE/);
});
