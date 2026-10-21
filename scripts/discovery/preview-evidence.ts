import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
/** Foreground preview receipts. Each invocation preserves earlier runs. */
export async function createPreviewEvidence(root:string){
    await mkdir(root,{recursive:true});
    const path=await mkdtemp(join(root,'run-'));
    return {path,save:async(name:string,value:unknown)=>writeFile(join(path,name),JSON.stringify(value,null,2)+'\n')};
}
