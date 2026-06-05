CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE skills (
  name TEXT PRIMARY KEY,
  version TEXT,
  description TEXT,
  content_hash TEXT NOT NULL,
  tarball_hash TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  previous_storage_key TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX skills_live ON skills (name) WHERE deleted_at IS NULL;
