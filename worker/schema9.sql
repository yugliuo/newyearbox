CREATE TABLE IF NOT EXISTS games (
  room TEXT PRIMARY KEY,
  order_json TEXT,
  idx INTEGER DEFAULT -1,
  phase TEXT DEFAULT 'idle',
  deadline INTEGER DEFAULT 0,
  started_at INTEGER
);
CREATE TABLE IF NOT EXISTS guesses (
  room TEXT NOT NULL,
  round INTEGER NOT NULL,
  guesser TEXT NOT NULL,
  guess TEXT NOT NULL,
  ts INTEGER,
  PRIMARY KEY (room, round, guesser)
);
CREATE TABLE IF NOT EXISTS scores (
  room TEXT NOT NULL,
  username TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  PRIMARY KEY (room, username)
);