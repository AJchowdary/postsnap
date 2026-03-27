-- Brand DNA: website scan + manual onboarding fields
-- brand_color and city may already exist from 001_initial_schema; IF NOT EXISTS is safe.

ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS brand_color TEXT,
  ADD COLUMN IF NOT EXISTS brand_vibe TEXT,
  ADD COLUMN IF NOT EXISTS dominant_colors JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS website_summary TEXT,
  ADD COLUMN IF NOT EXISTS tone_example TEXT,
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
  ADD COLUMN IF NOT EXISTS facebook_page TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS brand_dna_source TEXT DEFAULT 'manual';

COMMENT ON COLUMN business_profiles.brand_dna_source IS 'website | manual | hybrid';
