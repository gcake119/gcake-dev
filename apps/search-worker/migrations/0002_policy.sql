-- Operator-approved active corpus, fee evidence and verified provider window.
CREATE TABLE discovery_policy (id TEXT PRIMARY KEY CHECK(id='active'), policy TEXT NOT NULL);
