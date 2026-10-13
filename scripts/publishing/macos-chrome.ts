import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
const exec=promisify(execFile);
export const CHROME_PUBLICATION='https://gcakedev.substack.com';
export interface NativeTab {processId?:number;windowId:number;tabId:number;url:string}
export interface NativeChromeDriver {read():Promise<NativeTab>;execute(script:string):Promise<string>;navigate?(url:string):Promise<void>}
export function authorizedNativeUrl(value:string,origin=CHROME_PUBLICATION){const u=new URL(value);if(u.origin!==origin||u.username||u.password||!/^\/(publish(?:\/|$)|p\/)/.test(u.pathname))throw Error('SUBSTACK_NATIVE_UNAUTHORIZED_TAB');return u.href;}
export class ChromeTabBridge {
 constructor(readonly target:NativeTab,private driver:NativeChromeDriver,private beforeWrite:()=>Promise<unknown>=async()=>{},readonly origin=CHROME_PUBLICATION){}
 private async guard(){const live=await this.driver.read();if(this.target.processId!==undefined&&live.processId!==this.target.processId||live.windowId!==this.target.windowId||live.tabId!==this.target.tabId)throw Error('SUBSTACK_NATIVE_TAB_IDENTITY_CHANGED');authorizedNativeUrl(live.url,this.origin);return live;}
 async evaluate<T>(fn:Function,arg:unknown=undefined,write=false,expectedUrl?:string):Promise<T>{
  const checkPath=async()=>{const live=await this.guard();if(expectedUrl&&new URL(live.url).pathname!==new URL(expectedUrl).pathname)throw Error('SUBSTACK_NATIVE_TAB_NAVIGATED');};
  await checkPath();if(write){await this.beforeWrite();await checkPath();}
  const key='__gcake_'+randomUUID().replace(/-/g,'');
  const guard=`if(location.origin!==${JSON.stringify(this.origin)}||!/^\\/(publish(?:\\/|$)|p\\/)/.test(location.pathname))throw Error('SUBSTACK_NATIVE_UNAUTHORIZED_TAB');`;
  const exact=expectedUrl?`if(location.pathname!==${JSON.stringify(new URL(expectedUrl).pathname)})throw Error('SUBSTACK_NATIVE_TAB_NAVIGATED');`:'';
  const start=`(()=>{${guard}${exact} const __name=(fn)=>fn;const key=${JSON.stringify(key)};const box={status:'pending'};window[key]=box;try{const value=(${fn.toString()})(${JSON.stringify(arg)??'undefined'});if(value&&typeof value.then==='function'){value.then(result=>{box.status='done';box.value=result;},()=>{box.status='failed';});}else{box.status='done';box.value=value;}}catch(e){box.status='failed';}if(box.status==='done')delete window[key];return JSON.stringify(box);})()`;
  let frame=JSON.parse(await this.driver.execute(start));const deadline=Date.now()+15000;
  while(frame.status==='pending'&&Date.now()<deadline){await new Promise(r=>setTimeout(r,50));await this.guard();frame=JSON.parse(await this.driver.execute(`(()=>{${guard}const box=window[${JSON.stringify(key)}]??{status:'lost'};if(box.status==='done')delete window[${JSON.stringify(key)}];return JSON.stringify(box);})()`));}
  if(frame.status!=='done')throw Error('SUBSTACK_NATIVE_OPERATION_UNCERTAIN');
  await this.guard();return frame.value as T;
 }
 async state(){return this.guard();}
 async proveWrite(){await this.guard();await this.beforeWrite();await this.guard();}
 async navigate(url:string){authorizedNativeUrl(url,this.origin);await this.guard();if(!this.driver.navigate)throw Error('SUBSTACK_NATIVE_NAVIGATION_UNAVAILABLE');await this.driver.navigate(url);await this.guard();}

}
export function appleEventsDriver(target:NativeTab):NativeChromeDriver {
 if(process.platform!=='darwin')throw Error('SUBSTACK_NATIVE_MACOS_REQUIRED');
 if(![target.processId,target.windowId,target.tabId].every(v=>Number.isSafeInteger(v)&&v!>0))throw Error('SUBSTACK_NATIVE_ID_INVALID');
 const command=`ObjC.import('AppKit');
function run(args){
 const pid=Number(args[0]),w=Number(args[1]),t=Number(args[2]);
 const native=$.NSRunningApplication.runningApplicationWithProcessIdentifier(pid);
 if(ObjC.unwrap(native.bundleIdentifier)!=='com.google.Chrome')throw Error('SUBSTACK_NATIVE_CHROME_NOT_RUNNING');
 const app=Application(pid),windows=app.windows(),window=windows.filter(x=>Number(x.id())===w)[0];
 if(!window)throw Error('SUBSTACK_NATIVE_TAB_IDENTITY_CHANGED');
 const tab=window.tabs().filter(x=>Number(x.id())===t)[0];if(!tab)throw Error('SUBSTACK_NATIVE_TAB_IDENTITY_CHANGED');
 const url=String(tab.url());if(args[3]==='read')return url;
 if(!url.startsWith('https://gcakedev.substack.com/publish/')&&!url.startsWith('https://gcakedev.substack.com/p/'))throw Error('SUBSTACK_NATIVE_UNAUTHORIZED_TAB');
 if(args[3]==='navigate'){if(!String(args[4]).startsWith('https://gcakedev.substack.com/'))throw Error('SUBSTACK_NATIVE_UNAUTHORIZED_TAB');tab.url=args[4];return 'null';}
 return String(app.execute(tab,{javascript:args[4]}));
}`;
 const run=async(mode:string,script='')=>{try{return (await exec('/usr/bin/osascript',['-l','JavaScript','-e',command,'--',String(target.processId),String(target.windowId),String(target.tabId),mode,script],{timeout:20000,maxBuffer:2_000_000,env:{PATH:'/usr/bin:/bin:/usr/sbin:/sbin',LANG:'en_US.UTF-8'}})).stdout.trim();}catch(error){const message=String((error as {stderr?:string}).stderr??'');const explicit=message.match(/SUBSTACK_NATIVE_[A-Z_]+/)?.[0];throw Error(explicit??(/not allowed|not authorized|JavaScript.*(?:disabled|關閉)|not permitted|-1743|-1728/i.test(message)?'SUBSTACK_NATIVE_PERMISSION_OR_TAB_REQUIRED':'SUBSTACK_NATIVE_OPERATION_UNCERTAIN'));}};
 return {read:async()=>({...target,url:await run('read')}),execute:script=>run('execute',script),navigate:async url=>{authorizedNativeUrl(url);await run('navigate',url);}};
}
export function selectNativeTab(rows:NativeTab[]){if(rows.length!==1)throw Error('SUBSTACK_NATIVE_TAB_SELECTION_REQUIRED');const target=rows[0];if(![target.windowId,target.tabId,...(target.processId!==undefined?[target.processId]:[])].every(v=>Number.isSafeInteger(v)&&v>0))throw Error('SUBSTACK_NATIVE_ID_INVALID');authorizedNativeUrl(target.url);return target;}
export async function inspectNativeTabs(){
 if(process.platform!=='darwin')throw Error('SUBSTACK_NATIVE_MACOS_REQUIRED');
 const script=`ObjC.import('AppKit');function run(){const apps=$.NSRunningApplication.runningApplicationsWithBundleIdentifier('com.google.Chrome'),rows=[];for(let i=0;i<apps.count;i++){const pid=Number(apps.objectAtIndex(i).processIdentifier);try{const app=Application(pid);for(const w of app.windows())for(const t of w.tabs()){const url=String(t.url());if(url.startsWith('https://gcakedev.substack.com/publish/'))rows.push({processId:pid,windowId:Number(w.id()),tabId:Number(t.id()),url});}}catch(e){}}return JSON.stringify(rows);}`;
 let output:string;try{output=(await exec('/usr/bin/osascript',['-l','JavaScript','-e',script],{timeout:20000,maxBuffer:100000,env:{PATH:'/usr/bin:/bin:/usr/sbin:/sbin',LANG:'en_US.UTF-8'}})).stdout.trim();}catch{throw Error('SUBSTACK_NATIVE_PERMISSION_OR_TAB_REQUIRED');}
 return selectNativeTab(JSON.parse(output));
}
