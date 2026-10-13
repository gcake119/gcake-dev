import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {inspectNativeTabs,appleEventsDriver,ChromeTabBridge,CHROME_PUBLICATION} from './macos-chrome';
export function assertNativeReadiness(evidence:{origin:string;loggedIn:boolean;dashboardVisible:boolean}){if(evidence.origin!==CHROME_PUBLICATION||evidence.loggedIn!==true||evidence.dashboardVisible!==true)throw Error('SUBSTACK_NATIVE_DASHBOARD_REQUIRED');}
export async function main(args=process.argv.slice(2)){
 if(args.length!==1||args[0]!=='--permission-approved')throw Error('SUBSTACK_NATIVE_PERMISSION_APPROVAL_REQUIRED');
 const target=await inspectNativeTabs();const bridge=new ChromeTabBridge(target,appleEventsDriver(target));
 const evidence=await bridge.evaluate<{origin:string;title:string;loggedIn:boolean;dashboardVisible:boolean}>(()=>({origin:location.origin,title:document.title,loggedIn:!document.body.innerText.match(/sign in to|登入以|登入.*Substack|captcha|just a moment|verify you are human/i),dashboardVisible:!!document.querySelector('a[href="/publish/posts"]')}));
 assertNativeReadiness(evidence);
 console.log(JSON.stringify({status:'read-only-preflight',target,evidence,articleWrites:0}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
