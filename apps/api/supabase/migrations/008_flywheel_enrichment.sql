-- Flywheel: signal counter, compact log for LLM enrichment, avoided topics, per-field confidence

ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS avoided_topics JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS brain_field_confidence JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS signal_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signal_log JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN business_profiles.avoided_topics IS 'Topics/angles to deprioritize from flywheel learning';
COMMENT ON COLUMN business_profiles.brain_field_confidence IS 'Per-field confidence 0–1 for Brand Brain fields updated by enrichment';
COMMENT ON COLUMN business_profiles.signal_log IS 'Recent capture_signal events for enrichment (capped server-side)';
