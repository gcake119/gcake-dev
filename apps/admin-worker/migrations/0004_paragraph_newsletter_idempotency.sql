CREATE TABLE IF NOT EXISTS paragraph_newsletter_intents (
  post_slug TEXT NOT NULL,
  intent_key TEXT NOT NULL,
  source_revision TEXT NOT NULL,
  remote_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('reserved', 'sent', 'uncertain')),
  claim_token TEXT NOT NULL,
  sent_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (post_slug, intent_key)
);

CREATE INDEX IF NOT EXISTS paragraph_newsletter_remote_idx
  ON paragraph_newsletter_intents(remote_id, updated_at DESC);
