export type DeploymentState = 'pending' | 'building' | 'deployed' | 'failed';

export interface DeploymentPresentation {
  readonly git: '已儲存至 Git';
  readonly deployment: string;
  readonly publiclyVerified: false;
}

const deploymentLabels: Record<DeploymentState, string> = {
  pending: '等待部署',
  building: '正在建置',
  deployed: '部署完成，尚未驗證公開結果',
  failed: '部署失敗',
};

export function deploymentPresentation(state: DeploymentState): DeploymentPresentation {
  return {
    git: '已儲存至 Git',
    deployment: deploymentLabels[state],
    publiclyVerified: false,
  };
}
