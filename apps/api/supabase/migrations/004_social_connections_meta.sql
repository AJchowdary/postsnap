-- Step 4: Meta OAuth – extend social_connections for Facebook Page + IG Business
-- Run in Supabase SQL Editor after 001_initial_schema.sql

ALTER TABLE social_connections
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS meta_page_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_page_name TEXT,
  ADD COLUMN IF NOT EXISTS ig_business_id TEXT,
  ADD COLUMN IF NOT EXISTS ig_username TEXT,
  ADD COLUMN IF NOT EXISTS granted_scopes JSONB;

-- status already exists (TEXT); use values: connected, disconnected, expired, revoked
COMMENT ON COLUMN social_connections.meta_page_id IS 'Facebook Page ID (for platform=facebook)';
COMMENT ON COLUMN social_connections.meta_page_name IS 'Facebook Page display name';
COMMENT ON COLUMN social_connections.ig_business_id IS 'Instagram Business account ID (for platform=instagram)';
COMMENT ON COLUMN social_connections.ig_username IS 'Instagram Business username';
COMMENT ON COLUMN social_connections.granted_scopes IS 'Array of granted OAuth scopes';
