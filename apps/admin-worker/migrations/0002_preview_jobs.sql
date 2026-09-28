CREATE TABLE IF NOT EXISTS preview_jobs (
  id TEXT PRIMARY KEY,
  repository TEXT NOT NULL,
  post_slug TEXT NOT NULL,
  base_revision TEXT NOT NULL,
  draft_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'ready', 'failed', 'expired')),
  preview_url TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS preview_jobs_expiry_idx ON preview_jobs(status, expires_at);
