ALTER TABLE users ADD COLUMN disabled INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  device TEXT,
  ip TEXT,
  country TEXT,
  created_at INTEGER,
  last_seen INTEGER,
  revoked INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(username);

CREATE TABLE IF NOT EXISTS logins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  username TEXT,
  event TEXT,
  ok INTEGER,
  ip TEXT,
  country TEXT,
  device TEXT
);
CREATE INDEX IF NOT EXISTS logins_ts ON logins(ts);