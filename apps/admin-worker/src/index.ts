import {
  HEALTH_CONTRACT_VERSION,
  type HealthResponse,
} from '@gcake/admin-contract';

export const serviceName = 'gcake-admin-worker' as const;

export type WorkerEnv = Readonly<Record<string, unknown>>;

export async function handleRequest(request: Request, _env: WorkerEnv): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/health') {
    const payload: HealthResponse = {
      status: 'ok',
      service: serviceName,
      contractVersion: HEALTH_CONTRACT_VERSION,
    };

    return Response.json(payload);
  }

  return Response.json(
    { error: { code: 'NOT_FOUND', message: '找不到此 API 路徑。' } },
    { status: 404 },
  );
}

export default {
  fetch: handleRequest,
};
