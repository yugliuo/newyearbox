DROP TABLE IF EXISTS wishes;
CREATE TABLE wishes (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS wishes_room ON wishes(room);

CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS members (
  room TEXT NOT NULL,
  username TEXT NOT NULL,
  joined_at INTEGER,
  PRIMARY KEY (room, username)
);