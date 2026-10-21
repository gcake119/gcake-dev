-- Minute checks retain 30 days of metadata. Avoid scanning all receipts on every check
-- (which would consume the Free D1 rows-read allowance despite no article changes).
CREATE INDEX discovery_sync_receipt_expiry ON discovery_sync_receipts(created);
