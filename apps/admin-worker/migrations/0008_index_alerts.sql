CREATE TABLE index_alert_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  document TEXT NOT NULL,
  owner TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE index_alert_events (
  id TEXT PRIMARY KEY,
  corpus_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  delivery TEXT NOT NULL CHECK (delivery IN ('sending','sent','rejected','unknown','not_configured')),
  delivered_at INTEGER,
  message_id INTEGER
);
CREATE INDEX index_alert_events_recent ON index_alert_events(created_at DESC, id DESC);
