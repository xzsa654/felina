CREATE INDEX IF NOT EXISTS idx_skills_updated_at ON skills (updated_at DESC) WHERE deleted_at IS NULL;
