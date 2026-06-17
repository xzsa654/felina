CREATE TABLE leaderboard_models (
  user_id UUID NOT NULL REFERENCES leaderboard_entries(user_id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  provider TEXT,
  tokens BIGINT NOT NULL DEFAULT 0,
  cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  event_count BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, model)
);
