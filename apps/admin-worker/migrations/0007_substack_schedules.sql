-- Additive, operational-only state. Never stores article bodies or subscriber data.
CREATE TABLE publication_schedules (
 schedule_id TEXT PRIMARY KEY,
 post_slug TEXT NOT NULL UNIQUE,
 remote_id TEXT UNIQUE,
 version INTEGER NOT NULL CHECK (version > 0),
 record_json TEXT NOT NULL CHECK (json_valid(record_json))
);
