-- Local candidate only. No migration or resource creation is authorized here.
CREATE TABLE discovery_windows (
 window TEXT PRIMARY KEY, verifiedUntil INTEGER NOT NULL,
 requests REAL NOT NULL, tokens REAL NOT NULL, units REAL NOT NULL,
 vectorQueries REAL NOT NULL, worker REAL NOT NULL, admission REAL NOT NULL, storage REAL NOT NULL
);
CREATE TABLE discovery_clients (client TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE discovery_reservations (
 id TEXT PRIMARY KEY, window TEXT NOT NULL, client TEXT NOT NULL, created INTEGER NOT NULL,
 requests REAL NOT NULL, tokens REAL NOT NULL, units REAL NOT NULL,
 vectorQueries REAL NOT NULL, worker REAL NOT NULL, admission REAL NOT NULL, storage REAL NOT NULL
);
CREATE INDEX discovery_reservation_expiry ON discovery_reservations(created);
CREATE TRIGGER discovery_reserve BEFORE INSERT ON discovery_reservations BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM discovery_windows WHERE window=NEW.window AND verifiedUntil>NEW.created
 AND requests>=NEW.requests AND tokens>=NEW.tokens AND units>=NEW.units AND vectorQueries>=NEW.vectorQueries
 AND worker>=NEW.worker AND admission>=NEW.admission AND storage>=NEW.storage)
 OR COALESCE((SELECT count FROM discovery_clients WHERE client=NEW.client),0)>=10
 THEN RAISE(ABORT,'QUOTA_EXCEEDED') END;
 UPDATE discovery_windows SET requests=requests-NEW.requests,tokens=tokens-NEW.tokens,units=units-NEW.units,
 vectorQueries=vectorQueries-NEW.vectorQueries,worker=worker-NEW.worker,admission=admission-NEW.admission,storage=storage-NEW.storage WHERE window=NEW.window;
 INSERT INTO discovery_clients(client,count,expires) VALUES(NEW.client,1,NEW.created+600000)
 ON CONFLICT(client) DO UPDATE SET count=count+1;
END;
