CREATE TABLE IF NOT EXISTS publication_runs (
  id TEXT PRIMARY KEY,
  post_slug TEXT NOT NULL,
  source_revision TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('prepare', 'publish', 'verify', 'retry', 'newsletter')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS publication_attempts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES publication_runs(id),
  target TEXT NOT NULL CHECK (target IN ('github_pages', 'paragraph', 'substack')),
  status TEXT NOT NULL,
  error_code TEXT,
  diagnostic TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS publication_target_states (
  post_slug TEXT NOT NULL,
  target TEXT NOT NULL CHECK (target IN ('github_pages', 'paragraph', 'substack')),
  source_revision TEXT NOT NULL,
  status TEXT NOT NULL,
  remote_id TEXT,
  remote_url TEXT,
  verified_at TEXT,
  newsletter_sent_at TEXT,
  last_error_code TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (post_slug, target)
);

CREATE TABLE IF NOT EXISTS publication_migrations (
  migration_key TEXT PRIMARY KEY,
  imported_at TEXT NOT NULL,
  imported_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_id TEXT,
  outcome TEXT NOT NULL,
  error_code TEXT,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS publication_attempts_run_idx ON publication_attempts(run_id, created_at);
CREATE INDEX IF NOT EXISTS audit_events_created_idx ON audit_events(created_at DESC);
