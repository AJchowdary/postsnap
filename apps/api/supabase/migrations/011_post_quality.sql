-- Caption quality rubric (Task 2) — denormalized for analytics queries

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS quality_score DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS quality_dimensions JSONB;

COMMENT ON COLUMN posts.quality_score IS 'Last scored caption total 0–100';
COMMENT ON COLUMN posts.quality_dimensions IS 'Per-dimension scores from qualityScorer';
