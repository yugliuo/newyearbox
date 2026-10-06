CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  avatar TEXT,
  reset_requested INTEGER DEFAULT 0,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS wishes (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS vaults (
  username TEXT PRIMARY KEY,
  message TEXT,
  video_key TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);