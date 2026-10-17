import {planTarget} from './distribution-inventory';
import {anonymousArchiveResolver} from './substack-public-identity';
import type {BrowserContext} from 'playwright';
import type {DistributionArticle} from '../../apps/admin-worker/src/distribution-coordinator';
import type {RuntimePublicationRepository} from '../../apps/admin-worker/src/distribution-runtime';
import type {DistributionConfig} from './run-distribution';
import {AttendedSubstackAdapter,anonymousSubstackReader,type AttendedOperation} from './substack-attended';
import {PlaywrightSubstackAdapter,openSubstackProfile,type PublicDomEvidence} from './substack-browser';
export async function createProfileTransport(article:DistributionArticle,operation:AttendedOperation,repository:RuntimePublicationRepository,config:DistributionConfig,runtime:string,opener= openSubstackProfile,beforeWrite:()=>Promise<unknown>=async()=>{},reader:(remote:{id:string;url:string})=>Promise<PublicDomEvidence>=anonymousSubstackReader(config.substack.ui),background=false){
 if(!['profile','macos-chrome'].includes(config.substack.transport??''))throw Error('SUBSTACK_PROFILE_TRANSPORT_REQUIRED');
 if(background){
  const current=(await repository.listStates(article.slug)).find(s=>s.target==='substack');
  const planned=planTarget(article.sourceRevision,current,await repository.runtime.checkpoint(article.slug,'substack'),false,true);
  if(operation!=='verify'||planned.operations[0]!=='verify')throw Error(planned.reason??'SUBSTACK_BACKGROUND_ATTENDED_REQUIRED');
 }
 const state=operation==='retry'?(await repository.listStates(article.slug)).find(s=>s.target==='substack'):undefined;
 if(operation==='verify'||operation==='retry'&&state?.remoteUrl&&/^\/p\//.test(new URL(state.remoteUrl).pathname)){
  // Reuse full public verification only; this exchange can never produce a file request or perform UI writes.
  return {adapter:new AttendedSubstackAdapter(article,operation,repository.runtime,async()=>{throw Error('SUBSTACK_PROFILE_READONLY_REQUIRES_PUBLIC_IDENTITY');},reader,beforeWrite),context:undefined};
 }
 if((config.substack.transport==='profile'?config.substack.profileContractReviewed!==true:config.substack.macosChrome?.contractReviewed!==true)||!config.substack.ui.discoveryScopes||config.substack.ui.discoveryScopes.length!==3||['published','draft','scheduled'].some(state=>!config.substack.ui.discoveryScopes!.some(scope=>scope.state===state)))throw Error('SUBSTACK_PROFILE_CONTRACT_UNREVIEWED');
 if(!config.substack.ui.appNotification||!config.substack.ui.schedule||!config.substack.ui.immediateUpdate||!(config.substack.ui.websiteOnlyConfirm||config.substack.ui.publicIdentity))throw Error('SUBSTACK_PROFILE_DELIVERY_CONTROLS_UNREVIEWED');
 if(config.substack.transport==='macos-chrome'){
  const native=config.substack.macosChrome;if(native?.automationApproved!==true)throw Error('SUBSTACK_NATIVE_PERMISSION_APPROVAL_REQUIRED');
  const {openNativeChromePage}=await import('./macos-chrome-page');
  const page=openNativeChromePage({...native,url:config.substack.ui.origin+config.substack.ui.homePath},beforeWrite);
  const adapter=new PlaywrightSubstackAdapter(page.asPage(),{...config.substack.ui,publishingCapabilitiesVerified:true,discoveryVerified:true},false,beforeWrite,reader,config.substack.ui.publicIdentity?anonymousArchiveResolver(config.substack.ui.publicIdentity.publicationId):undefined);
  await adapter.preflight();return {adapter,context:{close:async()=>{}}};
 }
 const context:BrowserContext=await opener(config.substack.profile,runtime,{headless:true});
 try{
  // Only this exact approved trial receives observed control capabilities; general policy flags remain unchanged.
  const ui={...config.substack.ui,publishingCapabilitiesVerified:true,discoveryVerified:true};
  const adapter=new PlaywrightSubstackAdapter(await context.newPage(),ui,false,beforeWrite);
  await adapter.preflight();return {adapter,context};
 }catch(error){await context.close();throw error;}
}
