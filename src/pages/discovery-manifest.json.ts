import {lexicalAsset} from '../lib/discovery/assets';
import { loadDiscovery } from '../lib/discovery/site';
import { digest } from '../lib/discovery/build';
import { site } from '../data/site';
export async function GET(){
 const {corpus,config}=await loadDiscovery();
 const assets=Object.fromEntries(['index','passages','connections'].map(kind=>{
 const payload=kind==='index'?lexicalAsset(corpus):kind==='passages'?corpus.passages:corpus.connections;
 return [kind,{href:`${site.basePath}/discovery/${corpus.corpusId}/${kind}.json`,digest:digest(JSON.stringify(payload))}];}));
 return Response.json({schemaVersion:1,corpusId:corpus.corpusId,sourceTree:config.sourceTree,eligibilityInstant:config.now,snapshotDigest:config.snapshotDigest,configurationDigest:corpus.configurationDigest,assets});
}
