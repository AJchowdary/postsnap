-- Multi-format crops for Instagram / Facebook publishing (paths in storage, not URLs)

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS export_assets JSONB DEFAULT NULL;

COMMENT ON COLUMN posts.export_assets IS 'Per-platform export paths: instagram 1_1, 4_5; facebook 16_9, 1_1';
