import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {verifyRuntimePin} from './sync-distribution';
import {assertGeneralPolicy} from './distribution-inventory';
import {boundedDistributionError} from '../../apps/admin-worker/src/distribution-runtime';
const exec=promisify(execFile);
export interface LaunchAgentOptions {node:string;runtime:string;privateDirectory:string;credentials:string;label:string;lock?:string}
const xml=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function renderLaunchAgent(options:LaunchAgentOptions):string{
 if([options.node,options.runtime,options.privateDirectory,options.credentials,...(options.lock?[options.lock]:[])].some(p=>!path.isAbsolute(p)))throw Error('DISTRIBUTION_LAUNCHD_ABSOLUTE_PATH_REQUIRED');
 if(options.label!=='dev.gcake.distribution-sync')throw Error('DISTRIBUTION_LAUNCHD_LABEL_INVALID');
 const base=options.privateDirectory;
 const args=[options.node,'--env-file='+options.credentials,'--import','tsx',path.join(options.runtime,'scripts/publishing/sync-distribution.ts'),'--config',path.join(base,'unattended.json'),'--pin',path.join(base,'runtime-sha256.json'),'--acceptance',path.join(base,'acceptance.json'),'--out',path.join(base,'rounds'),'--lock',options.lock??path.join(base,'round-lock'),'--execute'];
 return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>Label</key><string>${xml(options.label)}</string>\n<key>ProgramArguments</key><array>${args.map(a=>'<string>'+xml(a)+'</string>').join('')}</array>\n<key>WorkingDirectory</key><string>${xml(options.runtime)}</string>\n<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(path.dirname(options.node)+':/usr/bin:/bin:/usr/sbin:/sbin')}</string></dict>\n<key>StartInterval</key><integer>900</integer>\n<key>RunAtLoad</key><false/>\n<key>KeepAlive</key><false/>\n<key>ProcessType</key><string>Background</string>\n<key>ThrottleInterval</key><integer>60</integer>\n<key>StandardOutPath</key><string>${xml(path.join(base,'logs/stdout.log'))}</string>\n<key>StandardErrorPath</key><string>${xml(path.join(base,'logs/stderr.log'))}</string>\n</dict></plist>\n`;
}
export function assertStandaloneAcceptance(value:unknown):void{
 const a=value as {status?:string;transport?:string;profileVerified?:boolean;nativePermissionsVerified?:boolean;readOnlyRound?:string;inFlight?:number};
 if(!a||a.status!=='passed'||!['profile','macos-chrome'].includes(a.transport??'')||(a.transport==='profile'?a.profileVerified!==true:a.nativePermissionsVerified!==true)||a.readOnlyRound!=='completed'||a.inFlight!==0)throw Error('DISTRIBUTION_STANDALONE_ACCEPTANCE_REQUIRED');
}
export async function prepareLaunchAgent(options:LaunchAgentOptions){
 const text=renderLaunchAgent(options);const base=options.privateDirectory;
 const realRuntime=await fs.realpath(options.runtime);await fs.mkdir(base,{recursive:true,mode:0o700});const realBase=await fs.realpath(base);const rel=path.relative(realRuntime,realBase);if(!rel||rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel))throw Error('DISTRIBUTION_LAUNCHD_OUTSIDE_GIT');
 await verifyRuntimePin(options.runtime,path.join(base,'runtime-sha256.json'),['scripts/publishing/distribution-launchd.ts','scripts/publishing/substack-profile.ts','scripts/publishing/sync-distribution.ts','scripts/publishing/macos-chrome.ts','scripts/publishing/macos-chrome-page.ts','scripts/publishing/native-chrome-preflight.ts','scripts/publishing/substack-public-identity.ts']);
 const config=JSON.parse(await fs.readFile(path.join(base,'unattended.json'),'utf8'));assertGeneralPolicy(config);if(config.substack.transport==='macos-chrome'?config.substack.macosChrome?.automationApproved!==true||config.substack.macosChrome?.contractReviewed!==true:config.substack.transport!=='profile'||config.substack.profileContractReviewed!==true)throw Error('SUBSTACK_PROFILE_CONTRACT_UNREVIEWED');
 const credential=await fs.stat(options.credentials);if(!credential.isFile()||(credential.mode&0o077)!==0)throw Error('DISTRIBUTION_CREDENTIAL_FILE_PRIVATE_REQUIRED');
 const logDir=path.join(base,'logs');await fs.mkdir(logDir,{recursive:true,mode:0o700});await fs.chmod(logDir,0o700);
 for(const name of ['stdout.log','stderr.log']){const file=path.join(logDir,name);const handle=await fs.open(file,'a',0o600);await handle.close();await fs.chmod(file,0o600);}
 const file=path.join(base,options.label+'.plist');await fs.writeFile(file,text,{mode:0o600});await fs.chmod(file,0o600);return file;
}
export async function main(args=process.argv.slice(2)){
 const [command,...flags]=args;if(!['prepare','install','status','uninstall'].includes(command))throw Error('DISTRIBUTION_LAUNCHD_USAGE');if(process.platform!=='darwin')throw Error('DISTRIBUTION_LAUNCHD_MACOS_REQUIRED');
 const values=new Map<string,string>();for(let i=0;i<flags.length;i+=2){if(!['--private-dir','--runtime','--node','--credentials','--agents-dir','--lock'].includes(flags[i])||values.has(flags[i])||!flags[i+1])throw Error('DISTRIBUTION_ARGUMENT_INVALID');values.set(flags[i],flags[i+1]);}
 if(!values.has('--private-dir'))throw Error('DISTRIBUTION_LAUNCHD_USAGE');
 const label='dev.gcake.distribution-sync',domain='gui/'+process.getuid!(),target=domain+'/'+label;
 const options:LaunchAgentOptions={...(values.has('--lock')?{lock:path.resolve(values.get('--lock')!)}:{}),label,privateDirectory:path.resolve(values.get('--private-dir')!),runtime:path.resolve(values.get('--runtime')??path.join(path.dirname(fileURLToPath(import.meta.url)),'../..')),node:values.get('--node')??process.execPath,credentials:values.get('--credentials')??path.join(path.dirname(path.resolve(values.get('--private-dir')!)),'credentials.env')};
 const agents=values.get('--agents-dir')??path.join(os.homedir(),'Library/LaunchAgents'),agent=path.join(agents,label+'.plist');
 if(command==='status'){try{console.log((await exec('launchctl',['print',target])).stdout);}catch{console.log(JSON.stringify({label,loaded:false}));}return;}
 if(command==='uninstall'){
  const expected=renderLaunchAgent(options);if(await fs.readFile(agent,'utf8')!==expected)throw Error('DISTRIBUTION_LAUNCHD_OWNERSHIP_MISMATCH');
  await exec('launchctl',['bootout',target]);await fs.unlink(agent);console.log(JSON.stringify({label,loaded:false,privateDataPreserved:true}));return;
 }
 const file=await prepareLaunchAgent(options);if(command==='prepare'){console.log(JSON.stringify({prepared:file,loaded:false}));return;}
 assertStandaloneAcceptance(JSON.parse(await fs.readFile(path.join(options.privateDirectory,'standalone-acceptance.json'),'utf8')));
 await fs.access(options.node,fs.constants.X_OK);
 try{await fs.access(agent);throw Error('DISTRIBUTION_LAUNCHD_ALREADY_INSTALLED');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 await fs.mkdir(agents,{recursive:true,mode:0o700});await fs.copyFile(file,agent,fs.constants.COPYFILE_EXCL);await fs.chmod(agent,0o600);
 try{await exec('launchctl',['bootstrap',domain,agent]);}catch(error){await fs.unlink(agent);throw error;}
 console.log(JSON.stringify({label,loaded:true,agent,startIntervalSeconds:900}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(boundedDistributionError(error));process.exitCode=1;});
