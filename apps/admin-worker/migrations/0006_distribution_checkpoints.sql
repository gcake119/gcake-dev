-- Additive runtime metadata only. Never store article bodies or credentials.
CREATE TABLE IF NOT EXISTS publication_locks (
  post_slug TEXT NOT NULL, target TEXT NOT NULL, owner TEXT NOT NULL, acquired_at TEXT NOT NULL,
  PRIMARY KEY (post_slug, target)
);
CREATE TABLE IF NOT EXISTS publication_checkpoints (
  post_slug TEXT NOT NULL, target TEXT NOT NULL, source_revision TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'publish', 'metadata')),
  substack_policy TEXT CHECK (substack_policy IS NULL OR substack_policy = 'full-mirror'),
  created_at TEXT NOT NULL, attempt_id TEXT NOT NULL, PRIMARY KEY (post_slug, target)
);
