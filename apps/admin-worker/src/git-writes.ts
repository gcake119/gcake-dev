export type ConflictCode = 'ARTICLE_CONFLICT' | 'SERIES_CONFLICT';

export class RepositoryConflictError extends Error {
  constructor(
    readonly code: ConflictCode,
    readonly path: string,
    readonly expectedBlobSha: string | undefined,
    readonly currentBlobSha: string | undefined,
    readonly currentCommitSha: string,
  ) {
    super(code);
  }
}

export interface RepositoryFile { readonly sha: string; readonly content: string }
export interface RepositoryChange { readonly path: string; readonly expectedBlobSha?: string; readonly content?: string }
export interface RepositoryTransaction {
  readonly expectedBaseCommitSha: string;
  readonly message: string;
  readonly changes: readonly RepositoryChange[];
}
export interface RepositoryCommit { readonly sha: string; readonly message: string; readonly paths: readonly string[] }

export interface GitWriteRepository {
  currentCommitSha(): Promise<string>;
  getFile(path: string): Promise<RepositoryFile | undefined>;
  commit(transaction: RepositoryTransaction): Promise<RepositoryCommit>;
}

function conflictCode(path: string): ConflictCode {
  return path.includes('/series/') ? 'SERIES_CONFLICT' : 'ARTICLE_CONFLICT';
}

export async function saveRepositoryTransaction(
  repository: GitWriteRepository,
  transaction: RepositoryTransaction,
): Promise<RepositoryCommit> {
  const currentCommitSha = await repository.currentCommitSha();
  if (currentCommitSha !== transaction.expectedBaseCommitSha) {
    const first = transaction.changes[0];
    throw new RepositoryConflictError(
      conflictCode(first?.path ?? ''), first?.path ?? '', first?.expectedBlobSha,
      first ? (await repository.getFile(first.path))?.sha : undefined, currentCommitSha,
    );
  }
  for (const change of transaction.changes) {
    const current = await repository.getFile(change.path);
    if (change.expectedBlobSha !== current?.sha) {
      throw new RepositoryConflictError(
        conflictCode(change.path), change.path, change.expectedBlobSha, current?.sha, currentCommitSha,
      );
    }
  }
  return repository.commit(transaction);
}

export async function createSeries(repository: GitWriteRepository, input: {
  readonly path: string;
  readonly source: string;
  readonly expectedBaseCommitSha: string;
}): Promise<RepositoryCommit> {
  return saveRepositoryTransaction(repository, {
    expectedBaseCommitSha: input.expectedBaseCommitSha,
    message: `Create series ${input.path}`,
    changes: [{ path: input.path, content: input.source }],
  });
}

export async function updateSeries(repository: GitWriteRepository, input: {
  readonly path: string;
  readonly source: string;
  readonly expectedBlobSha: string;
  readonly expectedBaseCommitSha: string;
}): Promise<RepositoryCommit> {
  return saveRepositoryTransaction(repository, {
    expectedBaseCommitSha: input.expectedBaseCommitSha,
    message: `Update series ${input.path}`,
    changes: [{ path: input.path, expectedBlobSha: input.expectedBlobSha, content: input.source }],
  });
}

export async function renameSeries(repository: GitWriteRepository, input: {
  readonly oldPath: string;
  readonly newPath: string;
  readonly source: string;
  readonly expectedBlobSha: string;
  readonly expectedBaseCommitSha: string;
}): Promise<RepositoryCommit> {
  return saveRepositoryTransaction(repository, {
    expectedBaseCommitSha: input.expectedBaseCommitSha,
    message: `Rename series ${input.oldPath} to ${input.newPath}`,
    changes: [
      { path: input.oldPath, expectedBlobSha: input.expectedBlobSha },
      { path: input.newPath, content: input.source },
    ],
  });
}

export type DeleteSeriesResult =
  | { readonly kind: 'confirmation-required' }
  | { readonly kind: 'deleted'; readonly commit: RepositoryCommit };

export async function deleteSeries(repository: GitWriteRepository, input: {
  readonly path: string;
  readonly expectedBlobSha: string;
  readonly expectedBaseCommitSha: string;
  readonly confirmed: boolean;
}): Promise<DeleteSeriesResult> {
  if (!input.confirmed) return { kind: 'confirmation-required' };
  const commit = await saveRepositoryTransaction(repository, {
    expectedBaseCommitSha: input.expectedBaseCommitSha,
    message: `Delete series ${input.path}`,
    changes: [{ path: input.path, expectedBlobSha: input.expectedBlobSha }],
  });
  return { kind: 'deleted', commit };
}

export class InMemoryGitRepository implements GitWriteRepository {
  #baseCommitSha: string;
  readonly #files: Map<string, RepositoryFile>;
  readonly commits: RepositoryCommit[] = [];

  constructor(input: { readonly baseCommitSha: string; readonly files: Readonly<Record<string, RepositoryFile>> }) {
    this.#baseCommitSha = input.baseCommitSha;
    this.#files = new Map(Object.entries(input.files));
  }
  async currentCommitSha(): Promise<string> { return this.#baseCommitSha; }
  async getFile(path: string): Promise<RepositoryFile | undefined> { return this.#files.get(path); }
  async commit(transaction: RepositoryTransaction): Promise<RepositoryCommit> {
    for (const change of transaction.changes) {
      if (change.content === undefined) this.#files.delete(change.path);
      else this.#files.set(change.path, { sha: `blob-${this.commits.length + 1}-${this.#files.size}`, content: change.content });
    }
    const commit = {
      sha: `commit-${this.commits.length + 1}`,
      message: transaction.message,
      paths: transaction.changes.map((change) => change.path),
    };
    this.commits.push(commit);
    this.#baseCommitSha = commit.sha;
    return commit;
  }
}

export type DeletePostResult =
  | { readonly kind: 'confirmation-required' }
  | { readonly kind: 'blocked'; readonly seriesReferences: readonly string[] }
  | { readonly kind: 'deleted'; readonly commit: RepositoryCommit };

export async function deletePost(repository: GitWriteRepository, input: {
  readonly path: string;
  readonly expectedBlobSha: string;
  readonly expectedBaseCommitSha: string;
  readonly confirmed: boolean;
  readonly seriesReferences: readonly string[];
}): Promise<DeletePostResult> {
  if (!input.confirmed) return { kind: 'confirmation-required' };
  if (input.seriesReferences.length) return { kind: 'blocked', seriesReferences: input.seriesReferences };
  const commit = await saveRepositoryTransaction(repository, {
    expectedBaseCommitSha: input.expectedBaseCommitSha,
    message: `Delete ${input.path}`,
    changes: [{ path: input.path, expectedBlobSha: input.expectedBlobSha }],
  });
  return { kind: 'deleted', commit };
}
