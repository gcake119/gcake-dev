CREATE TABLE IF NOT EXISTS cms_sessions (
  id TEXT PRIMARY KEY,
  github_user_id TEXT NOT NULL,
  github_login TEXT NOT NULL,
  github_avatar_url TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS cms_sessions_expiry_idx ON cms_sessions(expires_at);
