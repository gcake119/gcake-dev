export type MediaErrorCode = 'MEDIA_TYPE_NOT_ALLOWED' | 'MEDIA_TOO_LARGE' | 'MEDIA_KEY_INVALID';

export class MediaValidationError extends Error {
  constructor(readonly code: MediaErrorCode, message: string) { super(message); }
}

export interface MediaRecord {
  readonly id: string;
  readonly key: string;
  readonly url: string;
  readonly mime: 'image/webp' | 'image/png' | 'image/svg+xml';
  readonly width: number;
  readonly height: number;
  readonly size: number;
  readonly hash: string;
  readonly createdAt: string;
  readonly replacedMediaId?: string;
}

export interface ObjectStore {
  put(key: string, bytes: Uint8Array, metadata: Readonly<Record<string, string>>): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface MediaIndex {
  save(record: MediaRecord): Promise<void>;
  delete(id: string): Promise<void>;
  get(id: string): Promise<MediaRecord | undefined>;
  list(): Promise<readonly MediaRecord[]>;
}

export class InMemoryObjectStore implements ObjectStore {
  readonly #objects = new Map<string, Uint8Array>();
  get size(): number { return this.#objects.size; }
  has(key: string): boolean { return this.#objects.has(key); }
  async put(key: string, bytes: Uint8Array): Promise<void> { this.#objects.set(key, bytes.slice()); }
  async delete(key: string): Promise<void> { this.#objects.delete(key); }
}

export class InMemoryMediaIndex implements MediaIndex {
  readonly records: MediaRecord[] = [];
  async save(record: MediaRecord): Promise<void> { this.records.push(record); }
  async delete(id: string): Promise<void> {
    const index = this.records.findIndex((record) => record.id === id);
    if (index >= 0) this.records.splice(index, 1);
  }
  async get(id: string): Promise<MediaRecord | undefined> { return this.records.find((record) => record.id === id); }
  async list(): Promise<readonly MediaRecord[]> { return [...this.records]; }
}

export interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  run(): Promise<unknown>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}

export interface D1DatabaseLike {
  prepare(sql: string): D1StatementLike;
}

type MediaRow = {
  id: string; key: string; url: string; mime: MediaRecord['mime']; width: number; height: number;
  size: number; hash: string; created_at: string; replaced_media_id: string | null;
};

function rowToRecord(row: MediaRow): MediaRecord {
  return {
    id: row.id, key: row.key, url: row.url, mime: row.mime, width: row.width, height: row.height,
    size: row.size, hash: row.hash, createdAt: row.created_at,
    replacedMediaId: row.replaced_media_id ?? undefined,
  };
}

export class D1MediaIndex implements MediaIndex {
  constructor(readonly database: D1DatabaseLike) {}
  async save(record: MediaRecord): Promise<void> {
    await this.database.prepare(`INSERT INTO media_assets (
      id, object_key, public_url, mime_type, width, height, byte_size, content_hash, created_at, replaced_media_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      record.id, record.key, record.url, record.mime, record.width, record.height,
      record.size, record.hash, record.createdAt, record.replacedMediaId ?? null,
    ).run();
  }
  async delete(id: string): Promise<void> {
    await this.database.prepare('DELETE FROM media_assets WHERE id = ?').bind(id).run();
  }
  async get(id: string): Promise<MediaRecord | undefined> {
    const row = await this.database.prepare(`SELECT id, object_key AS key, public_url AS url,
      mime_type AS mime, width, height, byte_size AS size, content_hash AS hash,
      created_at, replaced_media_id FROM media_assets WHERE id = ?`).bind(id).first<MediaRow>();
    return row ? rowToRecord(row) : undefined;
  }
  async list(): Promise<readonly MediaRecord[]> {
    const rows = await this.database.prepare(`SELECT id, object_key AS key, public_url AS url,
      mime_type AS mime, width, height, byte_size AS size, content_hash AS hash,
      created_at, replaced_media_id FROM media_assets ORDER BY created_at DESC`).all<MediaRow>();
    return rows.results.map(rowToRecord);
  }
}

const MIME_EXTENSIONS = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/svg+xml': 'svg',
} as const;
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

function sanitizeName(name: string): string {
  const withoutExtension = name.replace(/\.[^.]+$/, '');
  const sanitized = withoutExtension.toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return sanitized || 'asset';
}

export function createMediaKey(input: {
  readonly slug: string;
  readonly date: Date;
  readonly assetId: string;
  readonly name: string;
  readonly mime?: keyof typeof MIME_EXTENSIONS;
}): string {
  const extensionFromName = input.name.split('.').pop()?.toLowerCase();
  const extension = input.mime ? MIME_EXTENSIONS[input.mime] : extensionFromName;
  const month = String(input.date.getUTCMonth() + 1).padStart(2, '0');
  return `posts/${input.slug}/${input.date.getUTCFullYear()}/${month}/${input.assetId}-${sanitizeName(input.name)}.${extension}`;
}

export interface UploadMediaInput {
  readonly objects: ObjectStore;
  readonly index: MediaIndex;
  readonly slug: string;
  readonly name: string;
  readonly mime: string;
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly hash: string;
  readonly now?: () => Date;
  readonly assetId?: () => string;
  readonly replacedMediaId?: string;
}

export async function uploadMedia(input: UploadMediaInput): Promise<MediaRecord> {
  if (!(input.mime in MIME_EXTENSIONS)) {
    throw new MediaValidationError('MEDIA_TYPE_NOT_ALLOWED', '僅支援 WebP、PNG 與 SVG。');
  }
  if (input.bytes.byteLength > MAX_MEDIA_BYTES) {
    throw new MediaValidationError('MEDIA_TOO_LARGE', '媒體檔案超過 10 MB。');
  }
  const now = input.now?.() ?? new Date();
  const id = input.assetId?.() ?? crypto.randomUUID();
  const mime = input.mime as keyof typeof MIME_EXTENSIONS;
  const key = createMediaKey({ slug: input.slug, date: now, assetId: id, name: input.name, mime });
  if (!/^posts\/[a-z0-9][a-z0-9-]*\/\d{4}\/\d{2}\/[a-zA-Z0-9-]+-[a-z0-9-]+\.(webp|png|svg)$/.test(key)) {
    throw new MediaValidationError('MEDIA_KEY_INVALID', '媒體物件路徑不合法。');
  }
  const record: MediaRecord = {
    id, key, url: `https://media.gcake.dev/${key}`, mime,
    width: input.width, height: input.height, size: input.bytes.byteLength,
    hash: input.hash, createdAt: now.toISOString(), replacedMediaId: input.replacedMediaId,
  };
  await input.objects.put(key, input.bytes, { mime, hash: input.hash });
  try {
    await input.index.save(record);
  } catch (error) {
    await input.objects.delete(key);
    throw error;
  }
  return record;
}

export function replaceMedia(original: MediaRecord, input: UploadMediaInput): Promise<MediaRecord> {
  return uploadMedia({ ...input, replacedMediaId: original.id });
}

export function scanMediaUsage(url: string, repositoryFiles: Readonly<Record<string, string>>): readonly string[] {
  return Object.entries(repositoryFiles)
    .filter(([, source]) => source.includes(url))
    .map(([path]) => path)
    .sort();
}

export async function deleteMedia(
  record: MediaRecord,
  objects: ObjectStore,
  index: MediaIndex,
  usages: readonly string[],
  confirmed: boolean,
): Promise<
  | { readonly kind: 'blocked'; readonly usages: readonly string[] }
  | { readonly kind: 'confirmation-required' }
  | { readonly kind: 'deleted' }
> {
  if (usages.length) return { kind: 'blocked', usages };
  if (!confirmed) return { kind: 'confirmation-required' };
  await objects.delete(record.key);
  await index.delete(record.id);
  return { kind: 'deleted' };
}

export interface RepositoryMediaScanner {
  sources(): Promise<Readonly<Record<string, string>>>;
}

export class MediaLibraryService {
  constructor(
    readonly objects: ObjectStore,
    readonly index: MediaIndex,
    readonly repository: RepositoryMediaScanner,
    readonly options: { readonly now?: () => Date; readonly assetId?: () => string } = {},
  ) {}

  async list(query = ''): Promise<readonly MediaRecord[]> {
    const normalized = query.trim().toLowerCase();
    const records = await this.index.list();
    return normalized
      ? records.filter((record) => record.key.toLowerCase().includes(normalized) || record.hash.toLowerCase().includes(normalized))
      : records;
  }

  upload(input: Omit<UploadMediaInput, 'objects' | 'index' | 'now' | 'assetId'>): Promise<MediaRecord> {
    return uploadMedia({ ...input, objects: this.objects, index: this.index, ...this.options });
  }

  async replace(id: string, input: Omit<UploadMediaInput, 'objects' | 'index' | 'now' | 'assetId'>): Promise<MediaRecord> {
    const original = await this.index.get(id);
    if (!original) throw new Error('MEDIA_NOT_FOUND');
    return replaceMedia(original, { ...input, objects: this.objects, index: this.index, ...this.options });
  }

  async usages(id: string): Promise<readonly string[]> {
    const record = await this.index.get(id);
    if (!record) throw new Error('MEDIA_NOT_FOUND');
    return scanMediaUsage(record.url, await this.repository.sources());
  }

  async delete(id: string, confirmed: boolean) {
    const record = await this.index.get(id);
    if (!record) throw new Error('MEDIA_NOT_FOUND');
    return deleteMedia(record, this.objects, this.index, await this.usages(id), confirmed);
  }
}
