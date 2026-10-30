import {INDEX_STATUS_URL,parseIndexSnapshot,boundedJson,indexAssessment,createIndexSourceReader,type SourceTotal} from '@gcake/admin-contract';
const sources=new WeakMap<typeof fetch,ReturnType<typeof createIndexSourceReader>>();
export function createAdminIndexReader(token:string|undefined,fetcher:typeof fetch=fetch,source?:ReturnType<typeof createIndexSourceReader>){
 if(!source){source=sources.get(fetcher);if(!source){source=createIndexSourceReader(fetcher);sources.set(fetcher,source);}}
 const readSource=source;
 return async():Promise<Response>=>{
  const headers={'Cache-Control':'no-store'};
  if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))return Response.json({error:{code:'INDEX_STATUS_NOT_CONFIGURED'}},{status:503,headers});
  const all=AbortSignal.timeout(25000),statusSignal=AbortSignal.any([all,AbortSignal.timeout(5000)]);
  try{
   const snapshot=parseIndexSnapshot(await boundedJson(await fetcher(INDEX_STATUS_URL,{method:'GET',headers:{Authorization:'Bearer '+token},signal:statusSignal,redirect:'manual',cache:'no-store'}),statusSignal));
   let total:SourceTotal|null=null;try{total=await readSource(all);}catch{/* A failed public-source read cannot create a percentage. */}
   return Response.json({schemaVersion:1,snapshot,source:total,assessment:indexAssessment(snapshot,total),searchAcceptance:'unverified'},{headers});
  }catch{return Response.json({error:{code:'INDEX_STATUS_UNAVAILABLE'}},{status:503,headers});}
 };
}
