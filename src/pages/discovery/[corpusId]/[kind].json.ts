import {lexicalAsset} from '../../../lib/discovery/assets';
import { loadDiscovery } from '../../../lib/discovery/site';
export async function getStaticPaths(){const {corpus}=await loadDiscovery();return ['index','passages','connections'].map(kind=>({params:{corpusId:corpus.corpusId,kind},props:{corpus,kind}}));}
export function GET({props}:{props:Awaited<ReturnType<typeof getStaticPaths>>[number]['props']}){const {corpus,kind}=props;return Response.json(kind==='index'?lexicalAsset(corpus):kind==='passages'?corpus.passages:corpus.connections);}
