import type {Page} from 'playwright';
import {ChromeTabBridge,type NativeTab,appleEventsDriver} from './macos-chrome';
type Selector={css:string}|{role:string;name:string};
interface DomCall {selectors:Selector[];kind:string;value?:unknown;source?:string}
function domCall(call:DomCall){
 let nodes:Element[]=[document.documentElement];
 for(const spec of call.selectors){nodes=nodes.flatMap(root=>{if('css' in spec)return [...root.querySelectorAll(spec.css)];const tags:Record<string,string>={button:'button,[role="button"]',link:'a[href],[role="link"]',textbox:'input:not([type="checkbox"]),textarea,[contenteditable="true"],[role="textbox"]',checkbox:'input[type="checkbox"],[role="checkbox"]',heading:'h1,h2,h3,h4,h5,h6,[role="heading"]',tab:'[role="tab"]',generic:'div:not(:has(*)),span:not(:has(*)),p:not(:has(*))'};return [...root.querySelectorAll(tags[spec.role]??`[role="${spec.role}"]`)].filter(n=>(n.getAttribute('aria-label')??([...((n as HTMLInputElement).labels??[])].map(l=>l.textContent?.trim()).join(' ')||n.textContent?.trim()))===spec.name);});}
 const visible=(n:Element)=>n.getClientRects().length>0&&getComputedStyle(n).visibility!=='hidden';
 if(call.kind==='count')return nodes.length;
 if(call.kind==='all')return Function('nodes','arg','__name',`return (${call.source})(nodes,arg)`)(nodes,call.value,(fn:Function)=>fn);
 if(nodes.length!==1)throw Error('SUBSTACK_NATIVE_CONTROL_AMBIGUOUS');const element=nodes[0] as HTMLElement;
 if(call.kind==='visible')return visible(element);
 if(call.kind==='enabled')return !element.hasAttribute('disabled')&&element.getAttribute('aria-disabled')!=='true';
 if(call.kind==='value')return (element as HTMLInputElement).value;
 const checked=()=>{if(element instanceof HTMLInputElement&&element.type==='checkbox')return element.checked;if(element.getAttribute('role')==='checkbox'&&['true','false'].includes(element.getAttribute('aria-checked')??''))return element.getAttribute('aria-checked')==='true';throw Error('SUBSTACK_NATIVE_CHECKBOX_REQUIRED');};
 if(call.kind==='checked')return checked();
 if(call.kind==='text')return element.innerText;
 if(call.kind==='attribute')return element.getAttribute(String(call.value));
 if(call.kind==='evaluate')return Function('element','arg','__name',`return (${call.source})(element,arg)`)(element,call.value,(fn:Function)=>fn);
 if(!visible(element))throw Error('SUBSTACK_NATIVE_CONTROL_HIDDEN');
 if(call.kind==='click'){element.click();return;}
 if(call.kind==='uncheck'){if(checked())element.click();return;}
 if(call.kind==='fill'){const proto=element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;if(!setter)throw Error('SUBSTACK_NATIVE_FILL_UNSUPPORTED');setter.call(element,String(call.value));element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));return;}
 if(call.kind==='selectAll'){element.focus();const range=document.createRange();range.selectNodeContents(element);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);return;}
 throw Error('SUBSTACK_NATIVE_ACTION_UNSUPPORTED');
}
class NativeLocator {
 constructor(private page:NativeChromePage,private selectors:Selector[],private expectedUrl=page.url()){}
 private call(kind:string,value?:unknown,source?:string,write=false){return this.page.bridge.evaluate(domCall,{selectors:this.selectors,kind,value,source},write,this.expectedUrl);}
 count(){return this.call('count') as Promise<number>;}async isVisible(){return await this.count()===1?await this.call('visible') as boolean:false;}isEnabled(){return this.call('enabled') as Promise<boolean>;}
 inputValue(){return this.call('value') as Promise<string>;}isChecked(){return this.call('checked') as Promise<boolean>;}innerText(){return this.call('text') as Promise<string>;}getAttribute(name:string){return this.call('attribute',name) as Promise<string|null>;}
 async click(){const href=await this.getAttribute('href');if(href&&!/^javascript:/i.test(href)){await this.page.bridge.proveWrite();await this.page.goto(new URL(href,this.page.url()).href);return;}await this.call('click',undefined,undefined,true);await this.page.refresh(this.expectedUrl);}fill(value:string){return this.call('fill',value,undefined,true);}uncheck(){return this.call('uncheck',undefined,undefined,true);}
 press(key:string){if(key!=='ControlOrMeta+A')throw Error('SUBSTACK_NATIVE_KEY_UNSUPPORTED');return this.call('selectAll',undefined,undefined,true);}
 locator(css:string){return new NativeLocator(this.page,[...this.selectors,{css}],this.expectedUrl);}
 evaluate(fn:Function,arg?:unknown){return this.call('evaluate',arg,fn.toString(),true);}evaluateAll(fn:Function,arg?:unknown){return this.call('all',arg,fn.toString());}
 async waitFor(options:{state:string}){await this.page.wait(()=>options.state==='visible'?this.isVisible():this.isVisible().then(v=>!v));}
}
export class NativeChromePage {
 private currentUrl:string;private timeout=10000;
 constructor(readonly bridge:ChromeTabBridge){this.currentUrl=bridge.target.url;}
 setDefaultTimeout(value:number){this.timeout=value;}
 locator(css:string){return new NativeLocator(this,[{css}]);}
 getByRole(role:string,options:{name:string}){return new NativeLocator(this,[{role,name:options.name}]);}
 async wait(check:()=>Promise<boolean>){const until=Date.now()+this.timeout;while(Date.now()<until){if(await check())return;await new Promise(r=>setTimeout(r,100));}throw Error('SUBSTACK_NATIVE_WAIT_TIMEOUT');}
 async goto(url:string){await this.bridge.navigate(url);await this.wait(async()=>{const state=await this.bridge.state();this.currentUrl=state.url;return this.bridge.evaluate((expected:string)=>location.href===expected&&document.readyState!=='loading',url);});return {ok:()=>true};}
 url(){return this.currentUrl;}
 async reload(){const live=await this.bridge.state();if(new URL(live.url).pathname!==new URL(this.currentUrl).pathname)throw Error('SUBSTACK_NATIVE_TAB_NAVIGATED');return this.goto(this.currentUrl);}
 async waitForURL(check:(url:URL)=>boolean){await this.wait(async()=>{this.currentUrl=(await this.bridge.state()).url;return check(new URL(this.currentUrl));});}
 async refresh(before:string){const state=await this.bridge.state();const id=(value:string)=>new URL(value).pathname.match(/\/publish\/(?:post|posts\/detail)\/(\d+)/)?.[1];if(id(before)&&id(state.url)&&id(before)!==id(state.url))throw Error('SUBSTACK_NATIVE_TAB_NAVIGATED');this.currentUrl=state.url;}
 asPage(){return this as unknown as Page;}
}
export function openNativeChromePage(target:NativeTab,beforeWrite:()=>Promise<unknown>){return new NativeChromePage(new ChromeTabBridge(target,appleEventsDriver(target),beforeWrite));}
