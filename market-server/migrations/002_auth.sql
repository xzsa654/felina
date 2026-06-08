CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  entra_oid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE skills ADD COLUMN author TEXT;
ALTER TABLE skills ADD COLUMN updated_by TEXT;
ALTER TABLE skills ADD COLUMN updated_ip INET;
ALTER TABLE skills ADD COLUMN owner_id TEXT;
ALTER TABLE skills ADD COLUMN created_by_id TEXT;
