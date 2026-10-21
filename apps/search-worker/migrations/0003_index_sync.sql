-- Durable hosted indexing progress; no reader queries or source content are stored here.
CREATE TABLE discovery_sync (
 id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT, leaseUntil INTEGER NOT NULL DEFAULT 0,
 corpusId TEXT NOT NULL DEFAULT '', previousCorpusId TEXT NOT NULL DEFAULT '', cursor INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'idle', detail TEXT NOT NULL DEFAULT '', updated INTEGER NOT NULL DEFAULT 0
);
INSERT INTO discovery_sync(id) VALUES(1);
CREATE TABLE discovery_sync_vectors (
 id TEXT PRIMARY KEY, articleId TEXT NOT NULL, revision TEXT NOT NULL,
 contentHash TEXT NOT NULL, modelConfig TEXT NOT NULL, corpusId TEXT NOT NULL
);
CREATE TABLE discovery_sync_pending (
 id TEXT PRIMARY KEY, corpusId TEXT NOT NULL, payload TEXT NOT NULL, stage TEXT NOT NULL,
 reservationId TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE TABLE discovery_sync_receipts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, created INTEGER NOT NULL, corpusId TEXT NOT NULL,
 status TEXT NOT NULL, detail TEXT NOT NULL
);
