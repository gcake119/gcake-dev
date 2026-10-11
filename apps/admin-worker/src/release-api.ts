import { requireCsrf, type CmsSession } from './auth.js';
import { ReleaseDelivery } from './release-delivery.js';
import type { QueueControl } from '@gcake/admin-contract';
const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });
const actions = new Set(['pause', 'resume', 'adopt-auto', 'override', 'cancel-override', 'unlock']);
export async function releaseApi(request: Request, runtime: ReleaseDelivery, session: CmsSession | undefined): Promise<Response> {
  if (!session || session.expiresAt <= Date.now()) return fail(401, 'UNAUTHENTICATED', '請先登入。');
  const url = new URL(request.url);
  const prefix = '/api/v1/releases';
  try {
    if (request.method === 'GET' && url.pathname === prefix) return Response.json(await runtime.queue.ingest(await runtime.git.snapshot()));
    if (request.method === 'GET' && url.pathname.startsWith(prefix + '/')) {
      const snapshot = await runtime.git.snapshot();
      const view = await runtime.queue.view(snapshot);
      const id = decodeURIComponent(url.pathname.slice(prefix.length + 1));
      const record = view.releases.find((r) => r.id === id);
      return record ? Response.json(record) : fail(404, 'NOT_FOUND', '找不到發布紀錄。');
    }
    if (request.method !== 'POST') return fail(404, 'NOT_FOUND', '找不到發布操作。');
    try {
      requireCsrf(request, session);
    } catch {
      return fail(403, 'FORBIDDEN', '安全驗證失敗，請重新整理。');
    }
    const body = (await request.json()) as Record<string, unknown>;
    if (url.pathname === prefix + '/reverify' || url.pathname === prefix + '/retry') {
      if (typeof body.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(body.id)) return fail(400, 'VALIDATION_FAILED', '發布紀錄編號無效。');
      return Response.json(url.pathname.endsWith('/reverify') ? await runtime.reverify(body.id) : await runtime.retry(body.id));
    }
    if (typeof body.slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(body.slug))
      return fail(400, 'VALIDATION_FAILED', '文章識別名稱無效。');
    const snapshot = await runtime.git.snapshot();
    if (url.pathname === prefix + '/preview') {
      if (typeof body.releaseAt !== 'string') return fail(400, 'VALIDATION_FAILED', '請選擇週一或週四的時段。');
      return Response.json(await runtime.queue.previewOverride(snapshot, body.slug, body.releaseAt));
    }
    if (url.pathname === prefix + '/finalize') {
      if (typeof body.revision !== 'string' || typeof body.blobSha !== 'string' || typeof body.source !== 'string')
        return fail(400, 'VALIDATION_FAILED', '定稿資料不完整，請先儲存新文章。');
      return Response.json(await runtime.finalize(body.slug, body.revision, body.blobSha, body.source));
    }
    if (url.pathname === prefix + '/action') {
      if (
        typeof body.action !== 'string' ||
        !actions.has(body.action) ||
        (body.scope !== undefined && !['post', 'series'].includes(String(body.scope))) ||
        (body.version !== undefined && !Number.isSafeInteger(body.version)) ||
        (body.confirmed !== undefined && typeof body.confirmed !== 'boolean')
      )
        return fail(400, 'VALIDATION_FAILED', '排程操作無效。');
      if (
        body.action === 'override' &&
        (typeof body.releaseAt !== 'string' || typeof body.revision !== 'string' || typeof body.version !== 'number')
      )
        return fail(400, 'VALIDATION_FAILED', '請先預覽並確認排程變動。');
      return Response.json(await runtime.queue.control(snapshot, body as unknown as QueueControl));
    }
    return fail(404, 'NOT_FOUND', '找不到發布操作。');
  } catch (error) {
    const code = error instanceof Error ? error.message : 'RELEASE_FAILED';
    const messages: Record<string, string> = {
      RELEASE_DISABLED: '正式發布尚未啟用；目前僅提供排程與驗證。',
      MULTIPLE_ACTIVE_SERIES: '有多個已開始系列，請先確認接續的系列；尚未新增發布。',
      ACTIVE_SERIES_RECONCILIATION_REQUIRED: '接續系列已刪除或內容不一致，請先恢復並核對閱讀順序。',
      QUEUE_CONFLICT: '佇列已變更，請重新載入並預覽。',
      SLOT_CONFLICT: '時段衝突，請重新選擇或檢查系列順序。',
      GIT_CONFLICT: 'Git 內容已更新，請重新載入。',
      REVERIFY_REQUIRED: '公開結果尚未確認，請先檢查公開狀態。',
      UNSAFE_UNLOCK: '無法安全解除此承諾，請先檢查公開狀態。',
      CONFIRMATION_REQUIRED: '解除鎖定需要明確確認。',
      INVALID_RELEASE_SLOT: '請選擇未來週一或週四 07:00 的時段。',
      RELEASE_MIGRATION_REQUIRED: '發布佇列資料庫尚未完成遷移。',
      LEASE_ACTIVE: '發布仍在執行，請稍後檢查。',
    };
    return fail(
      /CONFLICT|REQUIRED|DISABLED|ACTIVE/.test(code) ? 409 : 400,
      code.startsWith('GITHUB') ? 'GITHUB_API_FAILED' : code in messages ? code : 'RELEASE_FAILED',
      messages[code] ?? '發布操作失敗，請重新載入或檢查執行紀錄。',
    );
  }
}
