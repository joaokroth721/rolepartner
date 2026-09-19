-- Everything the admin page reads that nothing else was already recording:
-- who is allowed in, how often the app is opened, and what the AI calls cost in tokens.

-- The allow list for /admin. Email, because that is the only identity the app can
-- verify: the rp_uid cookie is self-assigned, so an anonymous visitor can never be an
-- admin. The first entry cannot be added through the UI (there is nobody to add it),
-- so ADMIN_EMAILS bootstraps it from the environment; see app/admin.js.
CREATE TABLE IF NOT EXISTS admins (
  email       TEXT PRIMARY KEY,
  added_by    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per user per day, counting page opens.
-- `users.last_seen_at` only ever holds the latest visit, so it can answer "who is active
-- now" but not "how many visits were there in March". This can answer both, and it stays
-- small: one row per active user per day, not one per request.
CREATE TABLE IF NOT EXISTS visits (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day      TEXT NOT NULL,
  hits     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS visits_day ON visits (day);

-- Token spend, the part of the bill `ai_usage` cannot see: that table counts calls, and a
-- call to /api/translate for one word and a call to /api/feedback for a whole transcript
-- are both "1" there while differing by two orders of magnitude in cost.
-- Aggregated on (user, day, route, model) for the same reason as `visits`: the admin page
-- slices by all four, and nothing it draws needs a per-request row.
CREATE TABLE IF NOT EXISTS ai_tokens (
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day              TEXT NOT NULL,
  route            TEXT NOT NULL,
  model            TEXT NOT NULL,
  calls            INTEGER NOT NULL DEFAULT 0,
  input_tokens     INTEGER NOT NULL DEFAULT 0,
  output_tokens    INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, route, model)
);
CREATE INDEX IF NOT EXISTS ai_tokens_day ON ai_tokens (day);
