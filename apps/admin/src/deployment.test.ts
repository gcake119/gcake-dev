import assert from 'node:assert/strict';
import test from 'node:test';
import { deploymentPresentation } from './deployment';

test('deployment observation never promotes a Git save into publication proof', () => {
  assert.deepEqual(deploymentPresentation('pending'), {
    git: '內容已儲存',
    deployment: '等待網站更新',
    publiclyVerified: false,
  });
  assert.deepEqual(deploymentPresentation('building'), {
    git: '內容已儲存',
    deployment: '正在準備網站',
    publiclyVerified: false,
  });
  assert.deepEqual(deploymentPresentation('deployed'), {
    git: '內容已儲存',
    deployment: '網站已更新，公開結果尚待確認',
    publiclyVerified: false,
  });
  assert.deepEqual(deploymentPresentation('failed'), {
    git: '內容已儲存',
    deployment: '網站更新未完成',
    publiclyVerified: false,
  });
});
