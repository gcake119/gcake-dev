-- A public release is membership, not physical vector placement.
-- Empty fields preserve legacy rows without granting a reusable proof.
ALTER TABLE discovery_sync_vectors ADD COLUMN namespace TEXT NOT NULL DEFAULT '';
ALTER TABLE discovery_sync_vectors ADD COLUMN metadataHash TEXT NOT NULL DEFAULT '';
-- Persist provider acknowledgement and scheduling across hosted executions.
ALTER TABLE discovery_sync ADD COLUMN mutationId TEXT NOT NULL DEFAULT '';
ALTER TABLE discovery_sync ADD COLUMN nextAttemptAt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE discovery_sync ADD COLUMN readbackAttempts INTEGER NOT NULL DEFAULT 0;
