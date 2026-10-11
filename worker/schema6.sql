ALTER TABLE sessions ADD COLUMN region TEXT;
ALTER TABLE sessions ADD COLUMN city TEXT;
ALTER TABLE logins ADD COLUMN region TEXT;
ALTER TABLE logins ADD COLUMN city TEXT;

CREATE TABLE IF NOT EXISTS locations (
  username TEXT PRIMARY KEY,
  lat REAL,
  lng REAL,
  accuracy REAL,
  place TEXT,
  updated_at INTEGER
);