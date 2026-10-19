export type DeploymentState = 'pending' | 'building' | 'deployed' | 'failed';

export interface DeploymentPresentation {
  readonly git: '內容已儲存';
  readonly deployment: string;
  readonly publiclyVerified: false;
}

const deploymentLabels: Record<DeploymentState, string> = {
  pending: '等待網站更新',
  building: '正在準備網站',
  deployed: '網站已更新，公開結果尚待確認',
  failed: '網站更新未完成',
};

export function deploymentPresentation(state: DeploymentState): DeploymentPresentation {
  return {
    git: '內容已儲存',
    deployment: deploymentLabels[state],
    publiclyVerified: false,
  };
}
