CREATE TABLE IF NOT EXISTS mmr_team (
  account_id TEXT UNIQUE,
  nickname TEXT,
  mmr FLOAT DEFAULT 0,
  mu FLOAT DEFAULT 0,
  sigma FLOAT DEFAULT 0,
  matches_won INTEGER DEFAULT 0,
  matches_lost INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mmr_ffa (
  account_id TEXT UNIQUE,
  nickname TEXT,
  mmr FLOAT DEFAULT 0,
  mu FLOAT DEFAULT 0,
  sigma FLOAT DEFAULT 0,
  matches_won INTEGER DEFAULT 0,
  matches_lost INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS matches (
  match_id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_name TEXT,
  server_id TEXT,
  arena TEXT,
  game_mode TEXT,
  winners TEXT,
  losers TEXT,
  win_score INTEGER,
  lose_score INTEGER,
  event_match_multiplier FLOAT DEFAULT 1,
  match_start_date TIMESTAMP,
  match_end_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS associations (
  child_id TEXT UNIQUE,
  parent_id TEXT UNIQUE
);


--
-- Users table: stores login information for Steam accounts
-- Metadata retrieved from homepage sign-in
--
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    lastLogin INTEGER,
    ip TEXT
);
