export interface BrowserDraft {
  readonly repository: string;
  readonly slug: string;
  readonly baseBlobSha: string;
  readonly source: string;
  readonly savedAt: number;
}

export interface DraftStore {
  get(key: string): BrowserDraft | undefined;
  set(key: string, value: BrowserDraft): void;
  values(): readonly BrowserDraft[];
}

export class InMemoryDraftStore implements DraftStore {
  readonly #drafts = new Map<string, BrowserDraft>();
  get(key: string): BrowserDraft | undefined { return this.#drafts.get(key); }
  set(key: string, value: BrowserDraft): void { this.#drafts.set(key, value); }
  values(): readonly BrowserDraft[] { return [...this.#drafts.values()]; }
}

export function draftKey(repository: string, slug: string, baseBlobSha: string): string {
  return `${repository}:${slug}:${baseBlobSha}`;
}

export function saveDraft(store: DraftStore, draft: BrowserDraft): void {
  store.set(draftKey(draft.repository, draft.slug, draft.baseBlobSha), draft);
}

export type DraftRecovery =
  | { readonly kind: 'none'; readonly repositorySourceApplied: true }
  | { readonly kind: 'recoverable'; readonly draft: BrowserDraft; readonly repositorySourceApplied: false }
  | { readonly kind: 'conflict'; readonly draft: BrowserDraft; readonly repositorySourceApplied: true };

export function recoverDraft(
  store: DraftStore,
  repository: string,
  slug: string,
  currentBlobSha: string,
): DraftRecovery {
  const exact = store.get(draftKey(repository, slug, currentBlobSha));
  if (exact) return { kind: 'recoverable', draft: exact, repositorySourceApplied: false };
  const stale = store.values()
    .filter((draft) => draft.repository === repository && draft.slug === slug)
    .sort((left, right) => right.savedAt - left.savedAt)[0];
  return stale
    ? { kind: 'conflict', draft: stale, repositorySourceApplied: true }
    : { kind: 'none', repositorySourceApplied: true };
}
