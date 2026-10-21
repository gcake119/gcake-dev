import type { Env as GeneratedBindings } from '../worker-configuration';
import { createProductionWorker } from './runtime';
import { synchronizeIndex } from './sync';
import { authorizeIndexTrigger } from './sync-trigger';
export { createWorker } from './worker';
// Compile the real generated binding shape against the tested dependency boundary.
export default {
    async fetch(request: Request, env: Partial<GeneratedBindings> = {}) {
        if (new URL(request.url).pathname === '/internal/index-sync') {
            if (!await authorizeIndexTrigger(request, env.INDEX_SYNC_TOKEN)) return new Response(null,{status:404});
            return Response.json(await synchronizeIndex(env),{headers:{'Cache-Control':'no-store'}});
        }
        return createProductionWorker().fetch(request,env);
    },
    async scheduled(_event: unknown, env: GeneratedBindings) {
        await synchronizeIndex(env);
    }
};
