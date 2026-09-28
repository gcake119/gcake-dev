import assert from 'node:assert/strict';
import test from 'node:test';
import { deploymentPresentation } from './deployment';

test('deployment observation never promotes a Git save into publication proof', () => {
  assert.deepEqual(deploymentPresentation('pending'), {
    git: '已儲存至 Git',
    deployment: '等待部署',
    publiclyVerified: false,
  });
  assert.deepEqual(deploymentPresentation('building'), {
    git: '已儲存至 Git',
    deployment: '正在建置',
    publiclyVerified: false,
  });
  assert.deepEqual(deploymentPresentation('deployed'), {
    git: '已儲存至 Git',
    deployment: '部署完成，尚未驗證公開結果',
    publiclyVerified: false,
  });
  assert.deepEqual(deploymentPresentation('failed'), {
    git: '已儲存至 Git',
    deployment: '部署失敗',
    publiclyVerified: false,
  });
});
