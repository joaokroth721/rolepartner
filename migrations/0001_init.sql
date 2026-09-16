-- Initial schema for the Role Partner backend (Cloudflare D1).
-- Covers the data flows in the 16.09.2026 diagram: login identity, conversation
-- transcripts, the score behind the leaderboard, and everything flagged as favorite.

-- One row per person. `email` stays NULL until Google login exists: before that a
-- browser is identified by the rp_uid cookie, and the row is linked to the email on
-- first login (see app/db.js).
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE,
  name          TEXT,
  avatar_url    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Everything the star button saves, from any screen: corrections (evaluation),
-- vocab and phrases (intro), partner messages (conversation), words (reader).
-- `payload` keeps the type-specific fields as JSON so a new favorite type needs no migration.
CREATE TABLE IF NOT EXISTS favorites (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fav_key     TEXT NOT NULL,
  type        TEXT NOT NULL,
  payload     TEXT NOT NULL,
  tag         TEXT,
  scenario    TEXT,
  reviews     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS favorites_user_key ON favorites (user_id, fav_key);

-- One finished conversation: the transcript plus the evaluation the LLM produced.
-- `score` is duplicated out of the evaluation JSON so the leaderboard can index it.
CREATE TABLE IF NOT EXISTS sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id  TEXT NOT NULL,
  title        TEXT,
  score        INTEGER NOT NULL,
  transcript   TEXT NOT NULL,
  evaluation   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_board ON sessions (scenario_id, score DESC);
