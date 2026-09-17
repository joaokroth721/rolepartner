-- Per-user, per-day counter for the AI routes.
-- The three AI routes cost money per call and are reachable by anyone, so each caller
-- gets a daily allowance. One row per user per day; old rows are harmless and can be
-- deleted at any time.
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day      TEXT NOT NULL,
  calls    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
