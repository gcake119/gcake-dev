-- Operational state only. One CAS document makes ingestion and slot acquisition
-- a single atomic SQLite/D1 write; revision fences all concurrent publishers.
CREATE TABLE release_queue_runtime (
 id INTEGER PRIMARY KEY CHECK (id = 1),
 version INTEGER NOT NULL CHECK (version >= 0),
 document TEXT NOT NULL CHECK (json_valid(document))
);
INSERT INTO release_queue_runtime VALUES (1, 0, '{"posts":{},"seriesReadyAt":{},"seriesOrder":{},"paused":[],"overrides":{},"adopted":[],"releases":[]}');
