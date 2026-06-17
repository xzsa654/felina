CREATE TABLE leaderboard_entries (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  total_tokens BIGINT NOT NULL DEFAULT 0,
  input_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  cache_read_tokens BIGINT NOT NULL DEFAULT 0,
  cache_write_tokens BIGINT NOT NULL DEFAULT 0,
  reasoning_tokens BIGINT NOT NULL DEFAULT 0,
  total_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  event_count BIGINT NOT NULL DEFAULT 0,
  active_days INTEGER NOT NULL DEFAULT 0,
  top_model TEXT,
  submit_count INTEGER NOT NULL DEFAULT 1,
  first_submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX leaderboard_entries_handle_unique ON leaderboard_entries (lower(handle));
CREATE INDEX leaderboard_entries_tokens ON leaderboard_entries (total_tokens DESC);
CREATE INDEX leaderboard_entries_cost ON leaderboard_entries (total_cost_usd DESC);
CREATE INDEX leaderboard_entries_active_days ON leaderboard_entries (active_days DESC);

CREATE TABLE leaderboard_daily (
  user_id UUID NOT NULL REFERENCES leaderboard_entries(user_id) ON DELETE CASCADE,
  day DATE NOT NULL,
  tokens BIGINT NOT NULL DEFAULT 0,
  cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
