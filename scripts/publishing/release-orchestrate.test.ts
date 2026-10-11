import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function request(payload: unknown, status = 200) {
  const dir = mkdtempSync(join(tmpdir(), 'gcake-orchestrate-'));
  const output = join(dir, 'outputs');
  writeFileSync(output, '');
  const mock = 'globalThis.fetch = async (url, options) => { if (String(url) !== "https://cms.example/api/v1/release-automation" || options.redirect !== "error" || options.headers.authorization !== "Bearer test-private-secret") throw new Error("Unexpected request"); return new Response(' + JSON.stringify(JSON.stringify(payload)) + ', {status:' + status + '}); };';
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--import', 'data:text/javascript,' + encodeURIComponent(mock), 'scripts/publishing/release-orchestrate.ts'], {
    encoding: 'utf8', env: {...process.env, RELEASE_WORKER_URL: 'https://cms.example', RELEASE_AUTOMATION_SECRET: 'test-private-secret', GITHUB_OUTPUT: output},
  });
  const outputs = readFileSync(output, 'utf8');
  rmSync(dir, {recursive:true, force:true});
  assert.doesNotMatch(result.stdout + result.stderr, /test-private-secret/);
  return {...result, outputs};
}
const sha = 'a'.repeat(40);
test('committed publication exports its exact revision for Pages delivery', () => {
  const result = request({release:{id:'release-123',state:'awaiting-verification',commitSha:sha}});
  assert.equal(result.status,0);
  assert.equal(result.outputs,`release_id=release-123\nrelease_sha=${sha}\n`);
});
test('empty hourly verification never arms Pages delivery', () => {
  const result = request({});
  assert.equal(result.status,0);
  assert.equal(result.outputs,'');
});
test('known pre-write conflict and unknown Git result never arm deployment', () => {
  for (const state of ['failed','verification-unknown']) {
    const result = request({release:{id:'release-123',state}});
    assert.equal(result.status,0);
    assert.equal(result.outputs,'');
  }
});
test('malformed and injectable publication identities fail closed', () => {
  for (const release of [null, {state:'awaiting-verification'}, {id:'x\nrelease_sha=evil',state:'awaiting-verification',commitSha:sha}, {id:'x',state:'awaiting-verification',commitSha:'main'}, {id:'x',state:'verified-public',commitSha:sha}]) {
    const result=request({release});
    assert.notEqual(result.status,0);
    assert.equal(result.outputs,'');
  }
});
test('disabled Worker gate never arms deployment', () => {
  const result=request({error:{code:'RELEASE_DISABLED'}},409);
  assert.notEqual(result.status,0);
  assert.equal(result.outputs,'');
});
