import type { Env as GeneratedBindings } from '../worker-configuration';
import { createProductionWorker } from './runtime';
export { createWorker } from './worker';
// Compile the real generated binding shape against the tested dependency boundary.
export default createProductionWorker() satisfies { fetch(request: Request, env: GeneratedBindings): Promise<Response> };
