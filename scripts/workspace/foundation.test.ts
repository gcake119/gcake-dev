import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootPackage = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
const rootTypeScriptConfig = JSON.parse(
  await readFile(new URL('../../tsconfig.json', import.meta.url), 'utf8'),
);

test('Phase 0 exposes independent workspace build and test entry points', async () => {
  assert.equal(rootPackage.scripts['build:astro'], 'pnpm content:validate && astro build');
  assert.equal(rootPackage.scripts['build:admin'], 'pnpm --filter @gcake/admin build');
  assert.equal(rootPackage.scripts['build:worker'], 'pnpm --filter @gcake/admin-worker build');
  assert.equal(rootPackage.scripts['build:workspaces'], 'pnpm --filter "./apps/**" --filter "./packages/**" build');

  for (const relativePath of [
    '../../apps/admin/package.json',
    '../../apps/admin-worker/package.json',
    '../../packages/admin-contract/package.json',
    '../../packages/publishing-contract/package.json',
  ]) {
    const manifest = JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));
    assert.equal(typeof manifest.scripts?.build, 'string', `${manifest.name} requires a build command`);
    assert.equal(typeof manifest.scripts?.test, 'string', `${manifest.name} requires a test command`);
  }
});

test('Astro checks exclude generated workspace build output', () => {
  assert.deepEqual(rootTypeScriptConfig.exclude, [
    'dist',
    'apps/*/dist',
    'packages/*/dist',
  ]);
});
