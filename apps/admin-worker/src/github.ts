export const GITHUB_APP_PERMISSIONS = Object.freeze({
  repository: 'gcake119/gcake-dev',
  metadata: 'read',
  contents: 'read-write',
  actions: 'read',
  actionsWrite: false,
} as const);

export interface InstallationTokenProvider {
  create(): Promise<string>;
}

export interface GitHubRepository {
  readonly fullName: 'gcake119/gcake-dev';
  readonly defaultBranch: string;
  readonly private: boolean;
}

interface GitHubAppReadClientOptions {
  readonly installationTokens: InstallationTokenProvider;
  readonly fetch?: typeof fetch;
}

export class GitHubAppReadClient {
  readonly #installationTokens: InstallationTokenProvider;
  readonly #fetch: typeof fetch;

  constructor(options: GitHubAppReadClientOptions) {
    this.#installationTokens = options.installationTokens;
    this.#fetch = options.fetch ?? fetch;
  }

  async #get(path: string): Promise<unknown> {
    const installationToken = await this.#installationTokens.create();
    const response = await this.#fetch(`https://api.github.com${path}`, {
      method: 'GET',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${installationToken}`,
        'user-agent': 'gcake-admin-worker',
        'x-github-api-version': '2022-11-28',
      },
    });
    if (!response.ok) {
      throw new Error(`GITHUB_API_FAILED: GitHub returned HTTP ${response.status}`);
    }
    return response.json();
  }

  async getRepository(): Promise<GitHubRepository> {
    const value = await this.#get('/repos/gcake119/gcake-dev') as {
      full_name?: unknown;
      default_branch?: unknown;
      private?: unknown;
    };
    if (
      value.full_name !== 'gcake119/gcake-dev'
      || typeof value.default_branch !== 'string'
      || typeof value.private !== 'boolean'
    ) {
      throw new Error('GITHUB_API_FAILED: Unexpected repository response');
    }
    return {
      fullName: value.full_name,
      defaultBranch: value.default_branch,
      private: value.private,
    };
  }
}
