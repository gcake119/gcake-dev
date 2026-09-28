import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuditEvent } from './audit';

test('audit events retain bounded diagnostics and reject secrets or article bodies', () => {
  const event = createAuditEvent({
    id: 'audit-a', actorId: '119', category: 'publication', action: 'verify', resourceId: 'post:paragraph',
    outcome: 'failed', errorCode: 'VERIFY_FAILED',
    metadata: { target: 'paragraph', token: 'secret', privateKey: 'key', articleBody: '# full article', diagnostic: 'HTTP 502'.repeat(100) },
    createdAt: '2026-09-28T00:00:00Z',
  });
  assert.deepEqual(Object.keys(event.metadata).sort(), ['diagnostic', 'target']);
  assert.ok(String(event.metadata.diagnostic).length <= 500);
  assert.equal(JSON.stringify(event).includes('secret'), false);
  assert.equal(JSON.stringify(event).includes('full article'), false);
});
