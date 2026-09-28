CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/webp', 'image/png', 'image/svg+xml')),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  replaced_media_id TEXT REFERENCES media_assets(id)
);

CREATE INDEX IF NOT EXISTS media_assets_created_at_idx ON media_assets(created_at DESC);
