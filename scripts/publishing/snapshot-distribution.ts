import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openFixedSnapshot} from './distribution-inventory';
import {boundedDistributionError} from '../../apps/admin-worker/src/distribution-runtime';
const exec=promisify(execFile);
/** One fresh remote main fetch, then all consumers read the same detached commit. */
export async function snapshotDistribution(output:string,runtime=process.cwd()){
 const root=path.resolve(output),relative=path.relative(path.resolve(runtime),root);
 if(relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative))throw Error('DISTRIBUTION_SNAPSHOT_OUTSIDE_RUNTIME');
 await fs.mkdir(path.dirname(root),{recursive:true,mode:0o700});
 // git clone refuses an existing non-empty destination: never reset another checkout.
 await exec('git',['clone','--no-checkout','--single-branch','--branch','main','https://github.com/gcake119/gcake-dev.git',root]);
 await fs.chmod(root,0o700);
 const commit=(await exec('git',['rev-parse','refs/remotes/origin/main'],{cwd:root})).stdout.trim();
 if(!/^[a-f0-9]{40}$/.test(commit))throw Error('DISTRIBUTION_SOURCE_COMMIT_REQUIRED');
 await exec('git',['checkout','--detach',commit],{cwd:root});
 return {sourceRoot:root,sourceCommit:await openFixedSnapshot(root)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [out,...extra]=process.argv.slice(2);
 if(!out||extra.length){console.error('DISTRIBUTION_USAGE: distribution:snapshot fresh-private-directory');process.exitCode=1;}
 else snapshotDistribution(out).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(boundedDistributionError(error));process.exitCode=1;});
}
