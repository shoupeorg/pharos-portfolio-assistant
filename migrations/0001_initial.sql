CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('LIVE','RECORDED')),
  block_number INTEGER NOT NULL,
  block_hash TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS snapshots_wallet_time ON snapshots(wallet, captured_at DESC);

CREATE TABLE IF NOT EXISTS answers (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  question TEXT NOT NULL,
  intent TEXT NOT NULL,
  status TEXT NOT NULL,
  answer TEXT NOT NULL,
  source_ids TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(snapshot_id) REFERENCES snapshots(id)
);
CREATE INDEX IF NOT EXISTS answers_snapshot_time ON answers(snapshot_id, created_at DESC);
